-- =========================================================================
-- SUPERBASER MIGRATION: PROMO CODE SYSTEM + SCHEMA FIXES
-- Timestamp: 20260726210000
-- =========================================================================

-- ─── FIX 1: Define is_superadmin() (was referenced but missing) ──────────────

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_superadmin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_superadmin() TO service_role;

-- ─── FIX 2: Restrict jobs trigger to backup-related kinds only ───────────────

DROP TRIGGER IF EXISTS "trigger-backup-container" ON public.jobs;

CREATE OR REPLACE FUNCTION public.tg_jobs_fire_backup_worker()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.kind IN ('backup', 'restore', 'verify', 'storage', 'cleanup') THEN
    PERFORM net.http_post(
      url := 'https://superbaser-backup.saemscodes.workers.dev',
      body := jsonb_build_object('old_record', NULL, 'record', NEW, 'type', TG_OP, 'table', TG_TABLE_NAME, 'schema', TG_TABLE_SCHEMA),
      headers := '{"Content-type":"application/json"}'::jsonb,
      params := '{}'::jsonb,
      timeout_milliseconds := 5000
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "trigger-backup-container"
  AFTER INSERT ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.tg_jobs_fire_backup_worker();

-- ─── FIX 3: Remove weaker orgs_creator_insert policy (security hole) ────────

DROP POLICY IF EXISTS "orgs_creator_insert" ON public.organizations;

-- ─── FIX 4: Expand plan constraint to include pro_lifetime ──────────────────

ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS check_valid_plan_tier;

ALTER TABLE public.organizations
  ADD CONSTRAINT check_valid_plan_tier
  CHECK (lower(plan) IN ('free', 'pro', 'premium', 'pro_lifetime'));

-- ─── 1. promo_codes table ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.promo_codes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         TEXT NOT NULL UNIQUE,
  tier         TEXT NOT NULL DEFAULT 'pro_lifetime',
  max_uses     INT NOT NULL DEFAULT 1,
  uses_count   INT NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'active',
  expires_at   TIMESTAMPTZ,
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes        TEXT
);

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.promo_codes TO service_role;

-- ─── 2. promo_redemptions table ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.promo_redemptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id   UUID NOT NULL REFERENCES public.promo_codes(id) ON DELETE RESTRICT,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code            TEXT NOT NULL,
  tier_granted    TEXT NOT NULL,
  redeemed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address      TEXT,
  user_agent      TEXT
);

ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "promo_redemptions_self_select" ON public.promo_redemptions;
CREATE POLICY "promo_redemptions_self_select" ON public.promo_redemptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.is_permanent_user());

GRANT SELECT ON public.promo_redemptions TO authenticated;
GRANT ALL ON public.promo_redemptions TO service_role;

CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON public.promo_codes (code);
CREATE INDEX IF NOT EXISTS idx_promo_codes_status ON public.promo_codes (status);
CREATE INDEX IF NOT EXISTS idx_promo_redemptions_user ON public.promo_redemptions (user_id);
CREATE INDEX IF NOT EXISTS idx_promo_redemptions_org ON public.promo_redemptions (organization_id);
CREATE INDEX IF NOT EXISTS idx_promo_redemptions_code ON public.promo_redemptions (promo_code_id);

-- ─── 3. updated_at trigger for promo_codes ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS promo_codes_updated_at ON public.promo_codes;
CREATE TRIGGER promo_codes_updated_at
  BEFORE UPDATE ON public.promo_codes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ─── 4. redeem_promo_code RPC ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.redeem_promo_code(
  p_code TEXT,
  p_organization_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_promo     public.promo_codes%ROWTYPE;
  v_user_id   UUID := auth.uid();
  v_org_plan  TEXT;
  v_already   INT;
  v_ip        TEXT := current_setting('request.headers', true)::jsonb->>'x-forwarded-for';
  v_ua        TEXT := current_setting('request.headers', true)::jsonb->>'user-agent';
BEGIN
  IF v_user_id IS NULL OR NOT public.is_permanent_user() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;

  IF NOT public.is_org_admin(p_organization_id, v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You must be an organization admin to redeem a promo code');
  END IF;

  p_code := upper(btrim(p_code));

  IF p_code = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'No promo code provided');
  END IF;

  SELECT * INTO v_promo
  FROM public.promo_codes
  WHERE code = p_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid promo code');
  END IF;

  IF v_promo.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This promo code is no longer active');
  END IF;

  IF v_promo.expires_at IS NOT NULL AND v_promo.expires_at < now() THEN
    UPDATE public.promo_codes SET status = 'expired' WHERE id = v_promo.id;
    RETURN jsonb_build_object('success', false, 'error', 'This promo code has expired');
  END IF;

  IF v_promo.uses_count >= v_promo.max_uses THEN
    UPDATE public.promo_codes SET status = 'redeemed' WHERE id = v_promo.id;
    RETURN jsonb_build_object('success', false, 'error', 'This promo code has been fully redeemed');
  END IF;

  SELECT COUNT(*) INTO v_already
  FROM public.promo_redemptions
  WHERE promo_code_id = v_promo.id AND user_id = v_user_id;

  IF v_already > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'You have already redeemed this promo code');
  END IF;

  SELECT lower(plan) INTO v_org_plan
  FROM public.organizations WHERE id = p_organization_id;

  IF v_org_plan = 'pro_lifetime' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This organization already has lifetime Pro access');
  END IF;

  -- ATOMIC REDEMPTION
  UPDATE public.promo_codes
  SET uses_count = uses_count + 1,
      status = CASE WHEN uses_count + 1 >= max_uses THEN 'redeemed' ELSE status END
  WHERE id = v_promo.id;

  UPDATE public.organizations
  SET plan = v_promo.tier
  WHERE id = p_organization_id;

  INSERT INTO public.promo_redemptions (
    promo_code_id, user_id, organization_id, code, tier_granted, ip_address, user_agent
  )
  VALUES (
    v_promo.id, v_user_id, p_organization_id, v_promo.code, v_promo.tier, v_ip, v_ua
  );

  INSERT INTO public.audit_logs (
    organization_id, actor_user_id, action, resource_type, resource_id, metadata, ip_address, user_agent
  )
  VALUES (
    p_organization_id,
    v_user_id,
    'promo_redeemed',
    'promo_code',
    v_promo.id,
    jsonb_build_object('code', v_promo.code, 'tier', v_promo.tier, 'uses_count_before', v_promo.uses_count),
    v_ip,
    v_ua
  );

  INSERT INTO public.jobs (
    organization_id, kind, priority, status, payload
  )
  VALUES (
    p_organization_id,
    'billing',
    'normal',
    'queued',
    jsonb_build_object('action', 'promo_redeemed', 'code', v_promo.code, 'tier', v_promo.tier, 'user_id', v_user_id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'tier', v_promo.tier,
    'message', 'Lifetime Pro access unlocked!'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', 'Redemption failed: ' || SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_promo_code(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_promo_code(TEXT, UUID) TO service_role;

-- ─── 5. generate_promo_codes admin function ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.generate_promo_codes(
  p_count INT DEFAULT 20,
  p_tier TEXT DEFAULT 'pro_lifetime',
  p_prefix TEXT DEFAULT 'SUPERBASER'
)
RETURNS TABLE(code TEXT, id UUID)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_i INT;
  v_code TEXT;
  v_suffix TEXT;
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  FOR v_i IN 1..p_count LOOP
    v_suffix := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 6));
    v_code := upper(p_prefix) || '-' || upper(p_tier) || '-' || v_suffix;

    INSERT INTO public.promo_codes (code, tier, max_uses, status, created_by)
    VALUES (v_code, p_tier, 1, 'active', auth.uid())
    ON CONFLICT (code) DO NOTHING
    RETURNING promo_codes.code, promo_codes.id INTO code, id;

    IF code IS NULL THEN
      v_suffix := upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 8));
      v_code := upper(p_prefix) || '-' || upper(p_tier) || '-' || v_suffix;
      INSERT INTO public.promo_codes (code, tier, max_uses, status, created_by)
      VALUES (v_code, p_tier, 1, 'active', auth.uid())
      RETURNING promo_codes.code, promo_codes.id INTO code, id;
    END IF;

    RETURN NEXT;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_promo_codes(INT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_promo_codes(INT, TEXT, TEXT) TO service_role;

-- ─── 6. list_promo_codes admin function ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.list_promo_codes()
RETURNS TABLE(
  id UUID,
  code TEXT,
  tier TEXT,
  max_uses INT,
  uses_count INT,
  status TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  notes TEXT
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT id, code, tier, max_uses, uses_count, status, expires_at, created_at, notes
  FROM public.promo_codes
  ORDER BY created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.list_promo_codes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_promo_codes() TO service_role;

-- ─── 7. get_org_promo_status function ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_org_promo_status(p_organization_id UUID)
RETURNS JSONB
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'plan', o.plan,
    'is_lifetime', lower(o.plan) = 'pro_lifetime',
    'redemptions', (
      SELECT jsonb_agg(jsonb_build_object(
        'code', pr.code,
        'tier', pr.tier_granted,
        'redeemed_at', pr.redeemed_at
      ))
      FROM public.promo_redemptions pr
      WHERE pr.organization_id = p_organization_id
    )
  )
  FROM public.organizations o
  WHERE o.id = p_organization_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_org_promo_status(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_org_promo_status(UUID) TO service_role;

-- ─── 8. Realtime publication for promo_redemptions ───────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'promo_redemptions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.promo_redemptions;
  END IF;
END $$;

-- ─── 9. Organization Auto-Owner Membership Trigger & RPC ─────────────────────

DROP POLICY IF EXISTS "orgs_member_insert" ON public.organizations;
CREATE POLICY "orgs_member_insert" ON public.organizations 
  FOR INSERT TO authenticated 
  WITH CHECK (
    (created_by IS NULL OR created_by = auth.uid()) 
    AND public.is_permanent_user()
  );

CREATE OR REPLACE FUNCTION public.handle_new_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'owner')
    ON CONFLICT (organization_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_organization_created ON public.organizations;
CREATE TRIGGER on_organization_created
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_organization();

-- Fallback RPC function for creating organization securely
CREATE OR REPLACE FUNCTION public.create_organization_rpc(p_name TEXT, p_slug TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id UUID;
  v_org_id UUID;
  v_slug TEXT;
  v_res JSONB;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  v_slug := COALESCE(p_slug, lower(regexp_replace(p_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(md5(random()::text), 1, 4));

  INSERT INTO public.organizations (name, slug, created_by, plan)
  VALUES (p_name, v_slug, v_user_id, 'free')
  RETURNING id INTO v_org_id;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org_id, v_user_id, 'owner')
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  SELECT jsonb_build_object(
    'id', o.id,
    'name', o.name,
    'slug', o.slug,
    'created_by', o.created_by,
    'plan', o.plan,
    'created_at', o.created_at
  ) INTO v_res
  FROM public.organizations o
  WHERE o.id = v_org_id;

  RETURN v_res;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_organization_rpc(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_organization_rpc(TEXT, TEXT) TO service_role;

-- ─── DONE ───────────────────────────────────────────────────────────────────
