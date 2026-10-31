import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sanitizePermissions, isValidRole, canManageTarget } from "../_shared/rbac.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

class HttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new HttpError("Unauthorized", 401);
    }

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      throw new HttpError("Unauthorized", 401);
    }

    // 1. Hämta anropande användare explicit med token
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) {
      console.error("Auth verification failed:", userError?.message);
      throw new HttpError("Unauthorized", 401);
    }

    // (Verifierad användares e-post och id loggas medvetet inte.)

    // 2. Initiera Service Role-klient för administratörsåtgärder
    // Vi gör detta EFTER att ha verifierat JWT för att säkert kunna kringgå RLS vid profiluppslagning
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    console.log("SUPABASE_URL present:", !!supabaseUrl);
    console.log("SERVICE_ROLE_KEY present:", !!serviceRoleKey);

    if (supabaseUrl) {
      try {
        const url = new URL(supabaseUrl);
        console.log("Supabase project host:", url.hostname);
      } catch (e) {
        console.log("Supabase project host: invalid url format");
      }
    }

    if (!supabaseUrl || !serviceRoleKey) {
      throw new HttpError("Server configuration error", 500);
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 3. Hämta anroparens profil säkert via admin-klienten
    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .select("id, email, role, is_active")
      .eq("id", user.id)
      .maybeSingle();

    console.log("Caller profile lookup:", {
      found: !!callerProfile,
      error: profileError?.message ?? null,
      code: profileError?.code ?? null,
    });

    if (profileError) {
      console.error("Caller profile lookup failed:", {
        message: profileError.message,
        code: profileError.code,
      });
      throw new HttpError("Caller profile lookup failed", 500);
    }

    if (!callerProfile) {
      console.error("Caller profile does not exist for verified user.");
      throw new HttpError("Caller profile not found", 404);
    }

    if (!callerProfile.is_active) {
      throw new HttpError("Caller account is inactive", 403);
    }

    const callerRole = callerProfile.role;
    if (callerRole !== "superadmin" && callerRole !== "admin") {
      throw new HttpError("Forbidden: Requires admin privileges", 403);
    }

    // 4. Extrahera omdirigerings-URL från anropets Origin
    const origin = req.headers.get("origin") || req.headers.get("referer") || Deno.env.get("VITE_APP_URL");
    const redirectTo = origin ? `${origin.replace(/\/$/, "")}/admin` : undefined;

    const { action, payload } = await req.json();

    // Hjälpfunktion för att kontrollera om borttagning av målet skulle lämna 0 superadmins
    const checkLastSuperadmin = async (targetId: string) => {
      const { count, error } = await supabaseAdmin
        .from("user_profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "superadmin")
        .eq("is_active", true)
        .neq("id", targetId);

      if (error) throw new HttpError(error.message, 500);
      if (count === 0) {
        throw new HttpError("Säkerhetsspärr: Kan inte radera, inaktivera eller degradera den sista aktiva Superadmin-användaren.", 403);
      }
    };

    // -- HÄMTA ANVÄNDARE --
    if (action === "getUsers") {
      // Hämta användarprofiler och deras notifikationsinställningar
      const { data: profiles, error: profileError } = await supabaseAdmin
        .from("user_profiles")
        .select("*, user_notification_preferences(*)")
        .order("created_at", { ascending: false });

      if (profileError) throw new HttpError(profileError.message, 500);
      let currentProfiles = profiles || [];

      // Hämta autentiseringsanvändare för att avgöra väntande status och saknade profiler
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers();
      if (authError) throw new HttpError(authError.message, 500);

      const authUsers = authData?.users || [];

      // Återskapa saknade profiler automatiskt
      const missingProfiles = authUsers.filter(u => !currentProfiles.find(p => p.id === u.id));
      for (const missingUser of missingProfiles) {
        const { data: newProfile, error: createError } = await supabaseAdmin.from("user_profiles")
          .upsert({
            id: missingUser.id,
            email: missingUser.email,
            name: missingUser.user_metadata?.name || null,
            role: 'employee',
            job_role: 'Övrigt',
            is_active: true,
            permissions: []
          })
          .select()
          .single();

        if (!createError && newProfile) {
          currentProfiles.push(newProfile);
        } else if (createError) {
          console.error("Auto-repair failed for user:", missingUser.id, createError.message);
        }
      }

      // Sortera om profiler efter created_at fallande om nya lades till
      currentProfiles.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const enrichedUsers = currentProfiles.map(profile => {
        const authUser = authUsers.find(u => u.id === profile.id);
        const lastSignIn = authUser?.last_sign_in_at;
        // Om användaren aldrig har loggat in och inte har bekräftad e-post räknas kontot som väntande
        const is_pending = authUser ? (!lastSignIn && !authUser.email_confirmed_at) : false;

        return {
          ...profile,
          last_sign_in_at: lastSignIn || null,
          is_pending
        };
      });

      return new Response(JSON.stringify({ success: true, users: enrichedUsers }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // -- BJUD IN --
    if (action === "invite") {
      const { email, name, role, job_role, permissions, notification_preferences } = payload;

      if (callerRole === "admin" && role !== "intern" && role !== "employee") {
        throw new HttpError("Admins can only invite employees and interns", 403);
      }
      if (!isValidRole(role)) {
        throw new HttpError("Ogiltig roll", 400);
      }
      if (typeof email !== "string" || !email.includes("@")) {
        throw new HttpError("Ogiltig e-postadress", 400);
      }
      // 1. Kontrollera om användaren redan finns i Auth
      const { data: authData, error: authSearchError } = await supabaseAdmin.auth.admin.listUsers();
      if (authSearchError) throw new HttpError(authSearchError.message, 500);

      const existingUser = authData?.users.find(u => u.email === email);

      if (existingUser) {
        // Användaren finns i Auth; kontrollera om inbjudan är väntande
        const is_pending = !existingUser.last_sign_in_at && !existingUser.email_confirmed_at;

        if (is_pending) {
          throw new HttpError(JSON.stringify({
            message: "Användaren väntar redan på inbjudan.",
            already_invited: true,
            userId: existingUser.id
          }), 409);
        } else {
          throw new HttpError(JSON.stringify({
            message: "Den här e-postadressen har redan ett aktivt konto.",
            already_invited: false
          }), 409);
        }
      }

      // Användaren finns inte, skicka inbjudan
      const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: { name, role },
        redirectTo
      });
      if (inviteError) throw new HttpError(inviteError.message, 500);

      const userId = inviteData.user.id;

      // Backend-skydd: endast välformade behörigheter; praktikanter får aldrig write/delete
      const finalPermissions = sanitizePermissions(permissions, role);

      // Skapa eller uppdatera profil
      const { error: upsertError } = await supabaseAdmin.from("user_profiles")
        .upsert({
          id: userId,
          email: email,
          name: name,
          role: role,
          job_role: job_role || 'Övrigt',
          permissions: finalPermissions,
          is_active: true
        });

      if (upsertError) throw new HttpError(upsertError.message, 500);

      // Spara notifikationsinställningar om de angivits
      if (notification_preferences) {
        const { error: prefError } = await supabaseAdmin.from("user_notification_preferences")
          .upsert({
            user_id: userId,
            ...notification_preferences
          });
        if (prefError) console.error("Could not save notification preferences:", prefError.message);
      }

      return new Response(JSON.stringify({ success: true, user: inviteData.user }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // -- SKICKA OM INBJUDAN --
    if (action === "resendInvite") {
      const { email, role } = payload;

      if (callerRole === "admin" && role !== "intern" && role !== "employee") {
        throw new HttpError("Admins can only invite employees and interns", 403);
      }

      const { data: authData, error: authSearchError } = await supabaseAdmin.auth.admin.listUsers();
      if (authSearchError) throw new HttpError(authSearchError.message, 500);

      const existingUser = authData?.users.find(u => u.email === email);
      if (!existingUser) {
        throw new HttpError("Användaren hittades inte i systemet.", 404);
      }

      const is_pending = !existingUser.last_sign_in_at && !existingUser.email_confirmed_at;
      if (!is_pending) {
        throw new HttpError(JSON.stringify({
          message: "Den här e-postadressen har redan ett aktivt konto.",
          already_invited: false
        }), 409);
      }

      // Skicka om inbjudan
      const { error: resendError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo,
      });

      if (resendError) throw new HttpError(resendError.message, 500);

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // -- UPPDATERA PROFIL (namn, yrkesroll, notifikationer) --
    if (action === "updateProfile") {
      const { userId, name, job_role, notification_preferences } = payload;

      // Admin får inte ändra profiler för admin/superadmin (utom sin egen).
      const { data: updTarget, error: updTargetError } = await supabaseAdmin.from("user_profiles").select("role").eq("id", userId).single();
      if (updTargetError) throw new HttpError(updTargetError.message, 404);
      if (!canManageTarget(callerRole, updTarget.role, userId === user.id)) {
        throw new HttpError("Du har inte behörighet att ändra den här användaren", 403);
      }

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (job_role !== undefined) updateData.job_role = job_role;

      if (Object.keys(updateData).length > 0) {
        const { error } = await supabaseAdmin.from("user_profiles")
          .update(updateData)
          .eq("id", userId);
        if (error) throw new HttpError(error.message, 500);
      }

      // Uppdatera notifikationsinställningar
      if (notification_preferences) {
        const { error: prefError } = await supabaseAdmin.from("user_notification_preferences")
          .upsert({
            user_id: userId,
            ...notification_preferences
          }, { onConflict: 'user_id' });
        if (prefError) throw new HttpError(prefError.message, 500);
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // -- UPPDATERA ROLL --
    if (action === "updateRole") {
      const { userId, role } = payload;

      if (!role) {
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Tillåt administratörer att uppdatera yrkesroller och inställningar för underordnade,
      // men endast superadmin får ändra systemets behörighetsroll ('role')
      if (callerRole !== "superadmin") {
        throw new HttpError("Only superadmins can change system roles", 403);
      }

      if (role && userId === user.id && role !== "superadmin") {
        throw new HttpError("En Superadmin kan inte ändra sin egen behörighetsroll.", 403);
      }

      const { data: targetProfile, error: targetError } = await supabaseAdmin.from("user_profiles").select("role, is_active").eq("id", userId).single();
      if (targetError) throw new HttpError(targetError.message, 404);

      if (role && targetProfile.role === "superadmin" && targetProfile.is_active && role !== "superadmin") {
        await checkLastSuperadmin(userId);
      }

      const updateData: any = { role };

      const { error } = await supabaseAdmin.from("user_profiles")
        .update(updateData)
        .eq("id", userId);
      if (error) throw new HttpError(error.message, 500);

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // -- UPPDATERA BEHÖRIGHETER --
    if (action === "updatePermissions") {
      const { userId, permissions } = payload;

      const { data: targetProfile, error: targetError } = await supabaseAdmin.from("user_profiles").select("role").eq("id", userId).single();
      if (targetError) throw new HttpError(targetError.message, 404);

      if (callerRole === "admin" && targetProfile.role !== "intern" && targetProfile.role !== "employee") {
        throw new HttpError("Admins can only update permissions for employees and interns", 403);
      }

      // Backend-skydd: endast välformade behörigheter; praktikanter får aldrig write/delete
      const finalPermissions = sanitizePermissions(permissions, targetProfile.role);

      const { data, error } = await supabaseAdmin.from("user_profiles")
        .update({ permissions: finalPermissions })
        .eq("id", userId)
        .select()
        .single();
      if (error) throw new HttpError(error.message, 500);
      return new Response(JSON.stringify({ success: true, profile: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // -- VÄXLA STATUS --
    if (action === "toggleStatus") {
      const { userId, is_active } = payload;

      if (userId === user.id && !is_active) {
        throw new HttpError("Du kan inte inaktivera ditt eget konto", 403);
      }

      const { data: targetProfile, error: targetError } = await supabaseAdmin.from("user_profiles").select("role, is_active").eq("id", userId).single();
      if (targetError) throw new HttpError(targetError.message, 404);

      if (callerRole === "admin" && targetProfile.role !== "intern" && targetProfile.role !== "employee") {
        throw new HttpError("Admins can only toggle status for employees and interns", 403);
      }

      if (targetProfile.role === "superadmin" && targetProfile.is_active && is_active === false) {
        await checkLastSuperadmin(userId);
      }

      const { data, error } = await supabaseAdmin.from("user_profiles")
        .update({ is_active })
        .eq("id", userId)
        .select()
        .single();
      if (error) throw new HttpError(error.message, 500);
      return new Response(JSON.stringify({ success: true, profile: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // -- RADERA ANVÄNDARE --
    if (action === "deleteUser") {
      const { userId } = payload;

      if (callerRole !== "superadmin") {
        throw new HttpError("Endast Superadmin kan radera användare", 403);
      }

      const { data: targetProfile, error: targetError } = await supabaseAdmin.from("user_profiles").select("role").eq("id", userId).single();
      if (targetError) throw new HttpError(targetError.message, 404);

      if (targetProfile.role === "superadmin") {
        throw new HttpError("En Superadmin kan inte raderas via detta gränssnitt.", 403);
      }

      // Radera användaren från auth.users (user_profiles raderas automatiskt om ON DELETE CASCADE är satt)
      const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (deleteAuthError) throw new HttpError(deleteAuthError.message, 500);

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    throw new HttpError(`Unknown action: ${action}`, 400);

  } catch (err: any) {
    console.error("Error in admin-users function:", err.message);
    const status = err instanceof HttpError ? err.status : 500;

    let errorMsg = err.message;
    // Försök tolka JSON-fel (från 409)
    try {
      const parsed = JSON.parse(err.message);
      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: status,
      });
    } catch (e) {
      // Inte JSON, returnera vanligt fel
      return new Response(JSON.stringify({ error: err.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: status,
      });
    }
  }
});
