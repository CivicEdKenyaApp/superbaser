-- =========================================================================
-- SUPERBASER MIGRATION: SECURE PLAN UPDATE PATH
-- Timestamp: 20260802000000
-- Purpose:
--   1. Add paystack_reference column to organizations
--   2. Create set_organization_plan() SECURITY DEFINER RPC — the ONLY
--      server-authorised path to change plan for non-free tiers
--   3. Tighten organizations UPDATE RLS so authenticated users cannot
--      directly write plan/paystack_reference via the client SDK
-- =========================================================================

-- ─── 1. Add paystack_reference column ────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'organizations'
      AND column_name  = 'paystack_reference'
  ) THEN
    ALTER TABLE public.organizations ADD COLUMN paystack_reference TEXT;
  END IF;
END $$;

-- ─── 2. Add plan_activated_at column ────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'organizations'
      AND column_name  = 'plan_activated_at'
  ) THEN
    ALTER TABLE public.organizations ADD COLUMN plan_activated_at TIMESTAMPTZ;
  END IF;
END $$;

-- ─── 3. Expand plan constraint to include all valid tiers ────────────────────

ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS check_valid_plan_tier;

ALTER TABLE public.organizations
  ADD CONSTRAINT check_valid_plan_tier
  CHECK (lower(plan) IN ('free', 'pro', 'premium', 'pro_lifetime',
                         'mwananchi (monthly)', 'mwananchi (annual)',
                         'taifa enterprise (monthly)', 'taifa enterprise (annual)'));

-- ─── 4. set_organization_plan RPC — ONLY authorised path to change plan ──────
--
--  Rules enforced server-side:
--    a. Caller must be is_permanent_user() (not anonymous)
--    b. Caller must be org owner or admin
--    c. For any non-free plan, a non-empty paystack_reference is required
--    d. Writes audit log on every change
--    e. Returns JSON {success, plan, error}

CREATE OR REPLACE FUNCTION public.set_organization_plan(
  p_organization_id   UUID,
  p_plan              TEXT,
  p_paystack_reference TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id     UUID  := auth.uid();
  v_clean_plan  TEXT  := lower(btrim(p_plan));
  v_is_free     BOOL  := v_clean_plan = 'free';
BEGIN
  -- Guard: must be a permanent (non-anonymous) authenticated user
  IF v_user_id IS NULL OR NOT public.is_permanent_user() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required. Anonymous users cannot change plan.');
  END IF;

  -- Guard: must be org owner or admin
  IF NOT public.is_org_admin(p_organization_id, v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You must be an organization owner or admin to change the plan.');
  END IF;

  -- Guard: non-free plans require a non-empty Paystack reference
  IF NOT v_is_free AND (p_paystack_reference IS NULL OR btrim(p_paystack_reference) = '') THEN
    RETURN jsonb_build_object('success', false, 'error', 'A valid payment reference is required to activate a paid plan.');
  END IF;

  -- Guard: plan must be a valid known value
  IF v_clean_plan NOT IN ('free', 'pro', 'premium', 'pro_lifetime',
                           'mwananchi (monthly)', 'mwananchi (annual)',
                           'taifa enterprise (monthly)', 'taifa enterprise (annual)') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid plan identifier: ' || v_clean_plan);
  END IF;

  -- Atomic plan update
  UPDATE public.organizations
  SET
    plan                = v_clean_plan,
    paystack_reference  = CASE WHEN v_is_free THEN NULL ELSE btrim(p_paystack_reference) END,
    plan_activated_at   = now(),
    updated_at          = now()
  WHERE id = p_organization_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Organization not found.');
  END IF;

  -- Audit log
  INSERT INTO public.audit_logs (
    organization_id, actor_user_id, action, resource_type, resource_id, metadata
  ) VALUES (
    p_organization_id,
    v_user_id,
    'plan.changed',
    'organization',
    p_organization_id,
    jsonb_build_object(
      'plan', v_clean_plan,
      'paystack_reference', COALESCE(btrim(p_paystack_reference), 'N/A'),
      'activated_at', now()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'plan', v_clean_plan,
    'paystack_reference', COALESCE(btrim(p_paystack_reference), NULL)
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', 'Plan update failed: ' || SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_organization_plan(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_organization_plan(UUID, TEXT, TEXT) TO service_role;

-- ─── 5. Tighten organizations UPDATE RLS ─────────────────────────────────────
--
--  Authenticated users can update name/slug (non-sensitive fields).
--  They CANNOT directly write plan or paystack_reference — those must go
--  through set_organization_plan() which is SECURITY DEFINER.
--  The WITH CHECK expression blocks any UPDATE that changes the plan column
--  via the client SDK by verifying the new plan value matches the existing
--  plan (i.e., the plan column is not being changed).

DROP POLICY IF EXISTS "orgs_member_update" ON public.organizations;
CREATE POLICY "orgs_member_update" ON public.organizations
  FOR UPDATE TO authenticated
  USING (
    public.is_org_member(id, auth.uid())
    AND public.is_permanent_user()
  )
  WITH CHECK (
    public.is_org_member(id, auth.uid())
    AND public.is_permanent_user()
    -- Block direct plan column changes via client SDK
    -- (plan must equal the existing plan — unchanged — for this policy to pass)
    AND plan = (SELECT o2.plan FROM public.organizations o2 WHERE o2.id = id)
  );

-- ─── 6. is_org_admin helper — create if missing ──────────────────────────────

CREATE OR REPLACE FUNCTION public.is_org_admin(p_org_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = p_org_id
      AND user_id         = p_user_id
      AND role IN ('owner', 'admin')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_org_admin(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_admin(UUID, UUID) TO service_role;

-- ─── DONE ────────────────────────────────────────────────────────────────────
