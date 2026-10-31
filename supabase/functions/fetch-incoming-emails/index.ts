import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { ImapFlow } from "npm:imapflow";
import { simpleParser } from "npm:mailparser";
import { resolveThread, isDuplicateError, stripQuotedReply } from "../_shared/email-logic.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Reservmatchning på avsändarens e-post är AV som standard (kan koppla mejl till fel ärende).
// Omatchade mejl lämnas UNSEEN i brevlådan (ingen riktig karantän finns ännu) och sparas inte i något ärende. Aktivera endast med INBOUND_SENDER_FALLBACK=true.
const ALLOW_SENDER_FALLBACK = Deno.env.get("INBOUND_SENDER_FALLBACK") === "true";
// Brevlåda/etikett att polla. Låt demon använda en egen Gmail-etikett för att inte röra originalets inkorg.
const IMAP_MAILBOX = Deno.env.get("IMAP_MAILBOX") || "INBOX";

// Helper for multipart traversal
function extractParts(node: any, result: { textPart: string | null, textCharset: string | null, htmlPart: string | null, htmlCharset: string | null, attachments: any[] } = { textPart: null, textCharset: null, htmlPart: null, htmlCharset: null, attachments: [] }) {
    if (!node) return result;

    // Ignore multipart containers, recurse children
    if (node.type && node.type.toLowerCase().startsWith('multipart/')) {
        if (node.childNodes && Array.isArray(node.childNodes)) {
            for (const child of node.childNodes) extractParts(child, result);
        }
        return result;
    }

    // Check if attachment
    const isAttachment =
        (node.disposition && node.disposition.toLowerCase() === 'attachment') ||
        (node.dispositionParameters && node.dispositionParameters.filename) ||
        (node.parameters && node.parameters.name) ||
        (node.type && !node.type.toLowerCase().startsWith('text/') && !node.type.toLowerCase().startsWith('multipart/'));

    if (isAttachment) {
        let filename = "unnamed_attachment";
        if (node.dispositionParameters && node.dispositionParameters.filename) {
            filename = node.dispositionParameters.filename;
        } else if (node.parameters && node.parameters.name) {
            filename = node.parameters.name;
        }

        result.attachments.push({
            partId: node.part,
            filename: filename,
            contentType: node.type || 'application/octet-stream',
            size: node.size || 0
        });
    } else if (node.type && node.type.toLowerCase() === 'text/plain') {
        if (!result.textPart) {
            result.textPart = node.part;
            result.textCharset = node.parameters?.charset || null;
        }
    } else if (node.type && node.type.toLowerCase() === 'text/html') {
        if (!result.htmlPart) {
            result.htmlPart = node.part;
            result.htmlCharset = node.parameters?.charset || null;
        }
    }
    return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // --- SÄKERHET ---
  const apiKeyHeader = req.headers.get("apikey");
  const expectedApiKey = Deno.env.get("IMAP_TEST_API_KEY")?.trim();

  if (!apiKeyHeader || !expectedApiKey || apiKeyHeader !== expectedApiKey) {
    console.error("Unauthorized access attempt: Invalid or missing API key.");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let dryRun = false;
  let sinceDate: Date | null = null;
  let fromFilter: string | null = null;
  try {
    const body = await req.json();
    if (body) {
      if (typeof body.dry_run === "boolean") dryRun = body.dry_run;
      if (typeof body.from === "string") fromFilter = body.from.trim();
      if (typeof body.since === "string") {
        const parsedDate = new Date(body.since);
        if (!isNaN(parsedDate.getTime())) {
          sinceDate = parsedDate;
        }
      }
    }
  } catch (e) {
    // ignore
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const smtpUser = Deno.env.get("GMAIL_SMTP_USER") ?? "";
  const smtpPassword = Deno.env.get("GMAIL_SMTP_PASSWORD") ?? "";

  if (!supabaseUrl || !serviceRoleKey || !smtpUser || !smtpPassword) {
    console.error("Missing required environment variables.");
    return new Response(JSON.stringify({ error: "Server configuration error." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: {
      user: smtpUser,
      pass: smtpPassword,
    },
    disableAutoIdle: true,
    logger: false,
  });

  client.on('error', (err: any) => {
    console.error(`Background IMAP Error: ${err.message}`);
  });

  let processed = 0;
  let matched = 0;
  let inserted = 0;

  try {
    await client.connect();
    const lock = await client.getMailboxLock(IMAP_MAILBOX);
    try {
      let searchCriteria: any = { seen: false };
      if (sinceDate) {
        searchCriteria.since = sinceDate;
      }

      const searchResult = await client.search(searchCriteria, { uid: true });

      if (!searchResult || searchResult.length === 0) {
        return new Response(JSON.stringify({
          success: true,
          message: "No emails found matching criteria.",
          processed, matched, inserted, dry_run: dryRun, from: fromFilter
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const maxMessages = 10;
      const uidsToProcess = searchResult.slice(-maxMessages);

      for (const uid of uidsToProcess) {
        processed++;

        try {
            const msgMeta = await client.fetchOne(uid, { size: true, envelope: true }, { uid: true });

            if (!msgMeta || typeof msgMeta.size !== 'number') {
                console.error(`UID ${uid}: Kunde inte verifiera meddelandestorlek. Lämnar UNSEEN.`);
                continue;
            }

            const sizeKB = (msgMeta.size / 1024).toFixed(2);
            let envIdRaw = msgMeta?.envelope?.messageId || "none";
            let envFrom = "unknown@customer.com";
            if (msgMeta?.envelope?.from && Array.isArray(msgMeta.envelope.from) && msgMeta.envelope.from.length > 0) {
                envFrom = msgMeta.envelope.from[0].address || "unknown@customer.com";
            }

            let messageId = envIdRaw.startsWith('<') ? envIdRaw : `<${envIdRaw}>`;
            if (envIdRaw === "none") {
                console.error(`UID ${uid}: Saknar Message-ID i envelope. Lämnar UNSEEN.`);
                continue;
            }

            // --- TIDIG IDEMPOTENCY CHECK ---
            const { data: existingMsg, error: exErr } = await adminClient
                .from("quote_messages")
                .select("id")
                .eq("email_message_id", messageId)
                .maybeSingle();

            if (exErr) {
                console.error(`UID ${uid}: Databasfel vid idempotenskontroll: ${exErr.message}`);
                continue;
            }

            if (existingMsg) {
                if (!dryRun) await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
                continue;
            }

            let inReplyToRaw = msgMeta?.envelope?.inReplyTo;
            let inReplyTo = inReplyToRaw ? (inReplyToRaw.startsWith('<') ? inReplyToRaw : `<${inReplyToRaw}>`) : null;

            // Variabler att fylla oavsett gren
            let bodyText = "";
            let bodyHtml: string | null = null;
            let attachmentsToUpload: any[] = [];
            let senderEmail = envFrom;
            let references: string[] | null = null;
            let quoteRequestId: string | null = null;
            let matchedOriginalMessageId: string | null = null;

            // POISON PILL: > 20 MB
            if (msgMeta.size > 20 * 1024 * 1024) {
                console.warn(`UID ${uid}: Meddelande överskrider gränsen (>20 MB).`);

                if (inReplyTo) {
                    const { data: parentMsg, error: lookupErr } = await adminClient
                        .from("quote_messages")
                        .select("quote_request_id")
                        .eq("email_message_id", inReplyTo)
                        .limit(1)
                        .maybeSingle();

                    if (lookupErr) {
                        console.error(`UID ${uid}: Databasfel vid tråduppslagning: ${lookupErr.message}`);
                        continue;
                    }
                    if (parentMsg) quoteRequestId = parentMsg.quote_request_id;
                }

                if (!quoteRequestId && ALLOW_SENDER_FALLBACK && senderEmail !== "unknown@customer.com") {
                    const { data: fallbackMatch, error: fallbackErr } = await adminClient
                        .from("quote_requests")
                        .select("id")
                        .eq("email", senderEmail)
                        .in("status", ["new", "contacted"])
                        .order("created_at", { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    if (fallbackErr) {
                        console.error(`UID ${uid}: Databasfel vid reservmatchning: ${fallbackErr.message}`);
                        continue;
                    }
                    if (fallbackMatch) quoteRequestId = fallbackMatch.id;
                }

                if (!quoteRequestId) {
                    continue;
                }

                if (!dryRun) {
                    const { error: insErr } = await adminClient.from("quote_messages").insert({
                        quote_request_id: quoteRequestId,
                        sender_type: "customer",
                        sender_email: senderEmail,
                        body_text: `[SYSTEM-MEDDELANDE]\nEtt mycket stort kundsvar mottogs (${sizeKB} KB) som överskrider systemets gräns för automatisk hantering (>20 MB).\n\nVänligen kontrollera den manuella Gmail-inkorgen för att läsa meddelandet och se bilagor.`,
                        email_message_id: messageId,
                        has_attachments: true,
                        is_read: false
                    });

                    if (insErr) {
                        if (insErr.code === '23505') {
                            await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
                        } else {
                            console.error(`UID ${uid}: Misslyckades spara systemmeddelande: ${insErr.message}`);
                        }
                    } else {
                        await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
                    }
                }
                continue;
            }

            // HYBRID IMAP EXTRACTOR: Inaktiverad (tröskel höjd till 20MB). Alla mail <= 20MB går till NORMAL.
            if (msgMeta.size > 20 * 1024 * 1024) {
                // Matchning FÖRE download
                if (inReplyTo) {
                    const { data: parentMsg, error: lookupErr } = await adminClient
                        .from("quote_messages")
                        .select("quote_request_id")
                        .eq("email_message_id", inReplyTo)
                        .limit(1)
                        .maybeSingle();

                    if (lookupErr) {
                        console.error(`UID ${uid}: Databasfel vid tråduppslagning: ${lookupErr.message}`);
                        continue;
                    }
                    if (parentMsg) {
                        quoteRequestId = parentMsg.quote_request_id;
                    }
                }

                if (!quoteRequestId && ALLOW_SENDER_FALLBACK && senderEmail !== "unknown@customer.com") {
                    const { data: fallbackMatch, error: fallbackErr } = await adminClient
                        .from("quote_requests")
                        .select("id")
                        .eq("email", senderEmail)
                        .in("status", ["new", "contacted"])
                        .order("created_at", { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    if (fallbackErr) {
                        console.error(`UID ${uid}: Databasfel vid reservmatchning: ${fallbackErr.message}`);
                        continue;
                    }
                    if (fallbackMatch) {
                        quoteRequestId = fallbackMatch.id;
                    }
                }

                if (!quoteRequestId) {
                    continue;
                }

                // Extrahera parts via bodyStructure
                const parts = extractParts(msgMeta.bodyStructure);

                // Hjälpfunktion för att ladda ner part som Uint8Array
                const downloadPart = async (pId: string): Promise<Uint8Array | null> => {
                    try {
                        const { content } = await client.download(uid, pId, { uid: true });
                        if (!content) return null;
                        const chunks: Uint8Array[] = [];
                        let totalLength = 0;
                        
                        await new Promise<void>((resolve, reject) => {
                            content.on('data', (chunk: any) => {
                                chunks.push(chunk as Uint8Array);
                                totalLength += (chunk as Uint8Array).length;
                            });
                            content.on('end', () => resolve());
                            content.on('error', (err: any) => reject(err));
                        });

                        const buffer = new Uint8Array(totalLength);
                        let offset = 0;
                        for (const chunk of chunks) {
                            buffer.set(chunk, offset);
                            offset += chunk.length;
                        }
                        return buffer;
                    } catch (e: any) {
                        console.error(`UID ${uid}: Fel vid nedladdning av del ${pId}: ${e.message}`);
                        return null;
                    }
                };

                if (parts.textPart) {
                    const buf = await downloadPart(parts.textPart);
                    if (buf) {
                        bodyText = new TextDecoder(parts.textCharset || "utf-8").decode(buf);
                    } else {
                        bodyText = "[System: Kunde inte ladda ner textdelen. Se eventuell bilaga.]";
                    }
                } else if (parts.htmlPart) {
                    const buf = await downloadPart(parts.htmlPart);
                    if (buf) {
                        bodyHtml = new TextDecoder(parts.htmlCharset || "utf-8").decode(buf);
                    }
                }

                if (!bodyText && bodyHtml) {
                    bodyText = bodyHtml.replace(/<[^>]+>/g, ' ').trim(); // Simple HTML to text
                }

                // Ladda ner bilagor
                for (const att of parts.attachments) {
                    if (!att.partId) continue;
                    const buf = await downloadPart(att.partId);
                    if (!buf) {
                        throw new Error(`Kunde inte ladda ner bilaga ${att.filename}`);
                    }
                    attachmentsToUpload.push({
                        filename: att.filename,
                        contentType: att.contentType,
                        size: att.size || buf.length,
                        content: buf
                    });
                }
            }
            // NORMAL FLÖDE: <= 2 MB
            else {
                const message = await client.fetchOne(uid, { source: true }, { uid: true });
                if (!message || !message.source) {
                    continue;
                }
                const parsedMail = await simpleParser(message.source);

                bodyText = parsedMail.text || "";
                bodyHtml = parsedMail.html || null;

                let pMsgId = parsedMail.messageId;
                if (Array.isArray(pMsgId)) pMsgId = pMsgId[0];
                if (pMsgId) {
                    pMsgId = String(pMsgId).trim();
                    messageId = pMsgId.startsWith('<') ? pMsgId : `<${pMsgId}>`;
                }

                let pReplyTo = parsedMail.inReplyTo;
                if (Array.isArray(pReplyTo)) pReplyTo = pReplyTo[0];
                if (pReplyTo) {
                    pReplyTo = String(pReplyTo).trim();
                    inReplyTo = pReplyTo.startsWith('<') ? pReplyTo : `<${pReplyTo}>`;
                }

                let refRaw = parsedMail.references;
                if (typeof refRaw === 'string') refRaw = refRaw.split(/\s+/).filter(Boolean);
                if (Array.isArray(refRaw)) {
                    references = refRaw.map(ref => {
                        let r = String(ref).trim();
                        return r.startsWith('<') ? r : `<${r}>`;
                    });
                }

                senderEmail = parsedMail.from?.value[0]?.address ?? envFrom;

                if (parsedMail.attachments) {
                    for (const att of parsedMail.attachments) {
                        if (att.content) {
                            const size = att.size || att.content.length;
                            attachmentsToUpload.push({
                                filename: att.filename || "unnamed_attachment",
                                contentType: att.contentType || 'application/octet-stream',
                                size: size,
                                content: new Uint8Array(att.content)
                            });
                        }
                    }
                }
            }

            // GEMENSAM LOGIK FÖR BÅDE HYBRID OCH NORMAL (match, upload, insert)

            // --- STEG 5 & 6: Match quote_request (körs igen för normala mail, eller återanvänds om hybrid redan gjort det) ---
            if (!matchedOriginalMessageId) matchedOriginalMessageId = inReplyTo;

            if (!quoteRequestId) {
                const thread = await resolveThread({ inReplyTo, references }, async (mid: string) => {
                    const { data: matchData, error: mErr } = await adminClient
                        .from("quote_messages")
                        .select("quote_request_id")
                        .eq("email_message_id", mid)
                        .maybeSingle();
                    return { quoteRequestId: matchData?.quote_request_id ?? null, error: mErr?.message ?? null };
                });
                if (thread.error) {
                    console.error(`UID ${uid}: Databasfel vid trådmatchning: ${thread.error}`);
                    continue;
                }
                if (thread.quoteRequestId) {
                    quoteRequestId = thread.quoteRequestId;
                    matchedOriginalMessageId = thread.matchedOriginalMessageId;
                }
            }

            if (!quoteRequestId && ALLOW_SENDER_FALLBACK && senderEmail && senderEmail !== "unknown@customer.com") {
                const { data: fallbackMatch, error: fbErr } = await adminClient
                    .from("quote_requests")
                    .select("id")
                    .eq("email", senderEmail)
                    .in("status", ["new", "contacted"])
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .maybeSingle();
                if (fbErr) {
                    console.error(`UID ${uid}: Databasfel vid reservmatchning: ${fbErr.message}`);
                    continue;
                }
                if (fallbackMatch) quoteRequestId = fallbackMatch.id;
            }

            if (!quoteRequestId) {
                continue; // Lämna UNSEEN om det inte är matchat
            }

            matched++;

            // --- STEG 7: Ladda upp bilagor ---
            let uploadedAttachments: any[] = [];
            let uploadFailed = false;

            if (attachmentsToUpload.length > 0) {
                if (!dryRun) {
                    for (const att of attachmentsToUpload) {
                        try {
                            const safeFilename = (att.filename || "unnamed_attachment").replace(/[^a-zA-Z0-9.\-_]/g, '_');
                            const uniqueId = crypto.randomUUID();
                            const filePath = `customer_reply/${quoteRequestId}/${uniqueId}-${safeFilename}`;

                            const { error: uploadError } = await adminClient.storage
                                .from("quote-attachments")
                                .upload(filePath, att.content, {
                                    contentType: att.contentType,
                                    upsert: false
                                });

                            if (uploadError) {
                                console.error(`UID ${uid}: Misslyckades att ladda upp bilaga: ${uploadError.message}`);
                                uploadFailed = true;
                                break;
                            } else {
                                uploadedAttachments.push({
                                    name: att.filename || "unnamed_attachment",
                                    size: att.size,
                                    type: att.contentType,
                                    path: filePath
                                });
                            }
                        } catch (err: any) {
                            console.error(`UID ${uid}: Undantag vid uppladdning av bilaga: ${err.message}`);
                            uploadFailed = true;
                            break;
                        }
                    }
                }
            }

            if (uploadFailed) {
                continue; // Lämna UNSEEN
            }

            // --- STEG 8.5: Rensa citerad mejlhistorik ---
            const { cleanText, cleanHtml } = stripQuotedReply(bodyText, bodyHtml);
            const savedBodyText = cleanText || bodyText || "";
            const savedBodyHtml = cleanHtml || bodyHtml || null;

            // --- STEG 9: Spara i databas ---
            if (!dryRun) {
                const { error: insertError } = await adminClient
                    .from("quote_messages")
                    .insert({
                        quote_request_id: quoteRequestId,
                        sender_type: "customer",
                        sender_email: senderEmail,
                        body_text: savedBodyText,
                        body_html: savedBodyHtml,
                        email_message_id: messageId,
                        in_reply_to: matchedOriginalMessageId,
                        has_attachments: uploadedAttachments.length > 0,
                        attachments: uploadedAttachments,
                        is_read: false
                    });

                if (insertError) {
                    if (isDuplicateError(insertError)) {
                        await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
                    } else {
                        console.error(`UID ${uid}: Databasfel vid infogning av meddelande: ${insertError.message}`);
                    }
                    continue;
                }

                inserted++;

                // --- STEG 10: Markera som läst efter lyckad lagring ---
                await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
            }

        } catch (metaErr: any) {
            console.error(`UID ${uid}: Oväntat fel vid mejlbearbetning: ${metaErr.message}`);
            continue;
        }
      }
    } finally {
      lock.release();
    }
  } catch (error: any) {
    console.error("IMAP Error:", error.message);
    return new Response(JSON.stringify({ error: "Ett fel uppstod vid hämtning av e-post." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } finally {
    try { client.close(); } catch (e) {}
  }

  return new Response(JSON.stringify({
    success: true,
    processed,
    matched,
    inserted,
    dry_run: dryRun
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
