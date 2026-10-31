import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
// @deno-types="npm:@types/nodemailer"
import nodemailer from "npm:nodemailer";
import { sanitizeSenderName, isValidAttachmentPath, sendMailChecked } from "../_shared/email-logic.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface QuoteRequestRow {
  id: string;
  email: string;
  status: string;
  name: string;
  machine: { name: string } | null;
  inventory_item: { name: string } | null;
  request_type: string | null;
}

serve(async (req) => {
  // Hantera CORS-förförfrågan (preflight)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");

    // ── 1. Skapa klient med användarkontext (respekterar RLS genomgående) ────
    // Vi använder användarens JWT för ALLA operationer. Ingen service-role behövs eftersom:
    // - user_profiles: RLS tillåter "SELECT WHERE auth.uid() = id" (egen profil)
    // - quote_requests: RBAC RLS tillåter SELECT/UPDATE för roller med quotes:write
    // - quote_messages: RBAC RLS tillåter INSERT för roller med quotes:write
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: authHeader ? { Authorization: authHeader } : {},
        },
      }
    );

    // ── 2. Verifiera JWT och hämta användaridentitet ─────────────────────────
    const token = authHeader?.replace(/^Bearer\s+/i, "");

    // Skicka med token explicit till getUser() för att säkerställa korrekt verifiering
    const { data: { user }, error: userError } = await userClient.auth.getUser(token);

    if (userError || !user) {
      console.error("[send-quote-reply] userError or no user:", userError, !!user);
      return new Response(JSON.stringify({ error: "Unauthorized: invalid or missing session." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    // ── 3. Hämta egen profil för RBAC-kontroll (RLS: användare får läsa egen profil) ─
    const { data: profile, error: profileError } = await userClient
      .from("user_profiles")
      .select("role, permissions, is_active")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      console.error("Profile fetch error:", profileError);
      return new Response(JSON.stringify({ error: "Unauthorized: user profile not found." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    if (!profile.is_active) {
      return new Response(JSON.stringify({ error: "Unauthorized: account is inactive." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    // ── 4. RBAC: Kräv behörigheten quotes:write ──────────────────────────────
    // Explicit tillåtna: superadmin, admin, employee (alla har implicita quotes:*)
    // Explicit nekade: intern och övriga roller som inte anges ovan
    // Detta speglar funktionen has_permission() i databasen exakt.
    const { role, permissions } = profile;
    const hasQuotesWrite =
      role === "superadmin" ||
      role === "admin" ||
      role === "employee" ||
      (Array.isArray(permissions) && permissions.includes("quotes:write"));

    if (!hasQuotesWrite) {
      return new Response(
        JSON.stringify({ error: "Forbidden: insufficient permissions to reply to quote requests." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    // ── 5. Tolka och validera anropskroppen ──────────────────────────────────
    const body = await req.json().catch(() => null);
    // Tillåt tomt meddelande om det finns bilagor
    const hasMessage = body && body.message && body.message.trim();
    const hasAttachments = body && Array.isArray(body.attachments) && body.attachments.length > 0;
    if (!body || !body.quote_request_id || (!hasMessage && !hasAttachments)) {
      return new Response(JSON.stringify({ error: "Missing quote_request_id, message, or attachments." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }
    const { quote_request_id, message, attachments = [] } = body;

    // Bilagor måste ligga under det aktuella ärendets sökväg (`<id>/…` eller `customer_reply/<id>/…`),
    // annars kan en användare bifoga filer från andra ärenden.
    if (!Array.isArray(attachments) || attachments.some((a: any) => !a || !isValidAttachmentPath(a.path, quote_request_id))) {
      return new Response(JSON.stringify({ error: "Ogiltig bilaga: sökvägen hör inte till detta ärende." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // ── 6. Hämta offertförfrågan via userClient ──────────────────────────────
    // RLS-policyn "RBAC Read quote requests" säkerställer att endast roller med
    // quotes:read kan göra SELECT. Eftersom employee har quotes:* passerar detta.
    // Om RLS-policyn nekar åtkomst returneras ett fel som ett andra skyddslager utöver steg 4.
    const { data: quote, error: quoteError } = await userClient
      .from("quote_requests")
      .select("id, email, status, name, machine:machines(name), inventory_item:inventory_items(name), request_type")
      .eq("id", quote_request_id)
      .single<QuoteRequestRow>();

    if (quoteError || !quote) {
      console.error("Quote fetch error:", quoteError);
      return new Response(JSON.stringify({ error: "Quote request not found or access denied." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    // ── 7. Spara meddelandet i quote_messages (körs alltid, DB är sanningskälla) ─
    // RLS-policyn "RBAC Insert quote messages" kräver quotes:write – passerar för employee.
    const senderEmail = user.email ?? "no-reply@jannesmaskin.example";
    const { data: savedMessage, error: insertError } = await userClient
      .from("quote_messages")
      .insert({
        quote_request_id,
        sender_type: "admin",
        sender_email: senderEmail,
        body_text: message ? message.trim() : "",
        attachments: attachments,
      })
      .select()
      .single();

    if (insertError || !savedMessage) {
      console.error("Failed to save message:", insertError);
      return new Response(
        JSON.stringify({ error: "Kunde inte spara svaret i databasen. Försök igen." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // ── 8. Uppdatera offertstatus → 'contacted' om den för närvarande är 'new' ─
    // Körs endast efter att meddelandet har sparats.
    // RLS-policyn "RBAC Update quote requests" kräver quotes:write – passerar för employee.
    if (quote.status === "new") {
      const { error: updateError } = await userClient
        .from("quote_requests")
        .update({ status: "contacted" })
        .eq("id", quote_request_id);

      if (updateError) {
        // Ej kritiskt: meddelandet är sparat, endast statusuppdateringen uteblev. Loggas för felsökning.
        console.error("Failed to update status to contacted:", updateError);
      }
    }

    // ── 9. E-postutskick via Google SMTP (valfritt, icke-blockerande) ────────
    // Databasoperationerna ovan är alltid sanningskällan.
    let emailStatus = "not_configured";
    const smtpUser = Deno.env.get("GMAIL_SMTP_USER");
    const smtpPassword = Deno.env.get("GMAIL_SMTP_PASSWORD");

    if (smtpUser && smtpPassword) {
      try {
        const testMode = Deno.env.get("EMAIL_TEST_MODE") === "true";
        const testRecipient = Deno.env.get("EMAIL_TEST_RECIPIENT");
        const recipientEmail = testMode && testRecipient ? testRecipient : quote.email;

        let subjectItem = "Jannes Maskin & Smide";
        if (quote.machine?.name) subjectItem = quote.machine.name;
        else if (quote.inventory_item?.name) subjectItem = quote.inventory_item.name;
        else if (quote.request_type) subjectItem = quote.request_type;

        const transporter = nodemailer.createTransport({
          host: "smtp.gmail.com",
          port: 465,
          secure: true,
          auth: {
            user: smtpUser,
            pass: smtpPassword, // Loggas aldrig
          },
        });

        // Ladda ner bilagor för Nodemailer
        const mailAttachments = [];
        if (Array.isArray(attachments) && attachments.length > 0) {
          for (const att of attachments) {
            const { data: fileData, error: downloadError } = await userClient
              .storage
              .from('quote-attachments')
              .download(att.path);

            if (downloadError || !fileData) {
              console.error(`Failed to download attachment ${att.path}:`, downloadError);
              continue;
            }

            // Konvertera Blob till Uint8Array för Nodemailer
            const arrayBuffer = await fileData.arrayBuffer();
            mailAttachments.push({
              filename: att.name,
              content: new Uint8Array(arrayBuffer),
            });
          }
        }

        const info = await sendMailChecked(transporter, {
          // Namnet styrs av EMAIL_SENDER_NAME (fallback: demons namn). Adressen måste vara auth-kontot.
          // Objektformen låter nodemailer koda namnet; CR/LF och kontrolltecken tas bort mot header-injektion.
          from: {
            name: sanitizeSenderName(Deno.env.get("EMAIL_SENDER_NAME")),
            address: smtpUser,
          },
          replyTo: smtpUser,                    // Systemets gemensamma email som "svara till"
          to: recipientEmail,
          subject: `Re: Förfrågan angående ${subjectItem}`,
          text: message ? message.trim() : "Bifogat dokument angående din förfrågan.",
          attachments: mailAttachments,
        });

        // --- DIAGNOSTIK START ---
        if (!info.messageId) {
          console.error("SMTP succeeded but Nodemailer returned no Message-ID.");
        } else {
          console.log(`SMTP send successful. Message-ID present: ${!!info.messageId}`);
        }

        if (info.messageId && savedMessage?.id) {
          // Använd service-role client uteslutande för denna interna systemuppdatering
          // för att kringgå eventuella RLS-begränsningar som döljer den nyskapade raden.
          const adminClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
          );

          const { data: updatedRows, error: msgUpdateError } = await adminClient
            .from("quote_messages")
            .update({ email_message_id: info.messageId })
            .eq("id", savedMessage.id)
            .select("id, email_message_id");

          if (msgUpdateError) {
            console.error("Failed to save SMTP Message-ID:", msgUpdateError.message);
          } else if (!updatedRows || updatedRows.length === 0) {
            console.error("SMTP succeeded but quote_messages UPDATE affected 0 rows.");
          } else {
            console.log("SMTP Message-ID successfully saved to quote_messages.");
          }
        }
        // --- DIAGNOSTIK SLUT ---

        emailStatus = testMode ? "sent_test_mode" : "sent";
        console.log(`Email sent. Status: ${emailStatus}`);
      } catch (emailErr: any) {
        // Loggar endast felmeddelandet, aldrig credentials
        console.error("Email send exception:", emailErr.message);
        emailStatus = "failed";
      }
    } else {
      console.log("Email not configured (no GMAIL_SMTP_USER/PASSWORD). Message saved to DB only.");
    }

    // ── 10. Returnera lyckat svar ────────────────────────────────────────────
    const emailMessage =
      emailStatus === "sent" ? "Svaret sparades och skickades till kunden." :
        emailStatus === "sent_test_mode" ? "Svaret sparades. Testläge: e-post skickades till testadress." :
          emailStatus === "failed" ? "Svaret sparades i systemet, men e-post kunde inte skickas." :
      /* ej konfigurerat */               "Svaret sparades i systemet. E-post är inte konfigurerat.";

    return new Response(
      JSON.stringify({
        success: true,
        message: savedMessage,
        email_status: emailStatus,
        email_message: emailMessage,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (err: any) {
    console.error("Unhandled error in send-quote-reply:", err.message);
    return new Response(JSON.stringify({ error: "Ett oväntat fel uppstod. Försök igen." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
