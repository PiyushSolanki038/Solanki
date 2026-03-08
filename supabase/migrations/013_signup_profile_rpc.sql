-- SECURITY DEFINER RPC to create/update a profile during signup.
-- Bypasses RLS because auth.uid() is not yet available for newly signed-up
-- users whose email has not been confirmed.

SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION public.create_signup_profile(
  p_user_id uuid,
  p_full_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first text;
  v_last  text;
  v_parts text[];
BEGIN
  -- Split full name into first / last
  v_parts := string_to_array(btrim(p_full_name), ' ');
  v_first := coalesce(v_parts[1], '');
  v_last  := coalesce(array_to_string(v_parts[2:], ' '), '');

  INSERT INTO public.profiles (user_id, first_name, last_name, full_name, created_at, updated_at)
  VALUES (p_user_id, v_first, v_last, btrim(p_full_name), NOW(), NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name  = EXCLUDED.last_name,
    full_name  = EXCLUDED.full_name,
    updated_at = NOW();
END;
$$;

-- Allow both anon (pre-confirmation signup) and authenticated callers.
REVOKE ALL ON FUNCTION public.create_signup_profile(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_signup_profile(uuid, text) TO anon, authenticated, service_role;
