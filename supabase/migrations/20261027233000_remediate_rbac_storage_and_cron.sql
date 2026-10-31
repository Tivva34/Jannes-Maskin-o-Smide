-- Migration: 20261027233000_remediate_rbac_storage_and_cron.sql
-- Beskrivning: Säkerhetskorrigeringar för Storage (quote-attachments), quote_messages, user_profiles och is_admin().
-- OBS: Cron-hantering har separerats ut från denna migration enligt krav.

-- -----------------------------------------------------------------------------
-- 1. TÄTA STORAGE: quote-attachments
-- -----------------------------------------------------------------------------
-- Tidigare policyer tillät godtycklig läsning/uppladdning/radering för alla 'authenticated'
-- oavsett roll eller behörighet (även interns utan quotes-rättigheter).
-- Ersätts med RBAC-policyer harmoniserade med quote_requests och quote_messages.

DROP POLICY IF EXISTS "Auth can read quote-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Auth can upload quote-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Auth can delete quote-attachments" ON storage.objects;

-- Läsning: superadmin, admin, employee samt användare med explicit quotes:read
CREATE POLICY "Staff can read quote-attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'quote-attachments'
  AND (
    public.has_role('superadmin')
    OR public.has_role('admin')
    OR public.has_role('employee')
    OR public.has_permission('quotes:read')
  )
);

-- Uppladdning: superadmin, admin, employee samt användare med explicit quotes:write
CREATE POLICY "Staff can upload quote-attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'quote-attachments'
  AND (
    public.has_role('superadmin')
    OR public.has_role('admin')
    OR public.has_role('employee')
    OR public.has_permission('quotes:write')
  )
);

-- Radering: superadmin, admin samt användare med explicit quotes:delete
CREATE POLICY "Staff can delete quote-attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'quote-attachments'
  AND (
    public.has_role('superadmin')
    OR public.has_role('admin')
    OR public.has_permission('quotes:delete')
  )
);

-- -----------------------------------------------------------------------------
-- 2. TÄTA quote_messages: Ta bort överflödig och vidöppen INSERT-policy
-- -----------------------------------------------------------------------------
-- Tabellen har redan policyn "RBAC Insert quote messages" som kräver quotes:write.
-- Den äldre "Public can insert quote messages" med WITH CHECK (true) öppnade för att
-- alla inloggade (även utan behörighet) kunde skicka meddelanden till valfri offert.
-- Kundmejl importeras säkert via service_role i Edge Function (kringgår RLS),
-- och publika offertförfrågningar skapas via quote_requests (ej quote_messages).

DROP POLICY IF EXISTS "Public can insert quote messages" ON public.quote_messages;

-- -----------------------------------------------------------------------------
-- 3. TÄTA user_profiles: Explicit WITH CHECK för Admin can update interns
-- -----------------------------------------------------------------------------
-- Säkerställer att en admin varken kan ändra en icke-intern eller eskalera en intern
-- till någon annan roll (t.ex. admin eller superadmin) via direkt PostgREST API-anrop.

DROP POLICY IF EXISTS "Admin can update interns" ON public.user_profiles;

CREATE POLICY "Admin can update interns"
ON public.user_profiles FOR UPDATE
TO authenticated
USING (
  public.has_role('admin')
  AND role = 'intern'
)
WITH CHECK (
  public.has_role('admin')
  AND role = 'intern'
);

-- -----------------------------------------------------------------------------
-- 4. SÄKRA is_admin(): Sätt explicit tom search_path och fullt kvalificerade anrop
-- -----------------------------------------------------------------------------
-- is_admin() var SECURITY DEFINER utan explicit search_path. Vi sätter search_path = ''
-- och anropar public.has_role() explicit för att eliminera risk för search_path-hijacking.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN public.has_role('superadmin') OR public.has_role('admin');
END;
$$;

-- Minsta nödvändiga behörigheter: anon behöver inte exekvera is_admin() (har inga tabellprivilegier eller anrop)
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 5. AVVECKLA FÖRLEGAD TRIGGER OCH FUNKTION PÅ auth.users
-- -----------------------------------------------------------------------------
-- on_auth_user_created infogade automatiskt (NEW.id, 'admin') i den gamla tabellen
-- public.profiles. Inga aktiva funktioner, vyer eller klientkod använder public.profiles
-- (alla använder public.user_profiles via admin-users Edge Function).
-- Triggern tas bort för att förhindra spridning av falsk adminstatus.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
