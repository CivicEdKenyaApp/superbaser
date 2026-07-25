-- ============================================================================
-- SUPERBASER MIGRATION: AI ASSISTANT AUDIT + CHAT SESSION PERSISTENCE
-- Timestamp: 20260725205500
-- Context: Supports dynamic SUPERB AI suggestions, chat session persistence,
--          navigation telemetry, and AI interaction analytics per org/user.
-- ============================================================================

-- ─── 1. ai_chat_sessions ─────────────────────────────────────────────────────
-- Persists chat history per authenticated user per org.
-- Anonymous sessions are excluded at the RLS layer.

CREATE TABLE IF NOT EXISTS public.ai_chat_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  title           TEXT,
  message_count   INT NOT NULL DEFAULT 0,
  last_view       TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.ai_chat_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_chat_sessions_select" ON public.ai_chat_sessions;
CREATE POLICY "ai_chat_sessions_select" ON public.ai_chat_sessions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.is_permanent_user());

DROP POLICY IF EXISTS "ai_chat_sessions_insert" ON public.ai_chat_sessions;
CREATE POLICY "ai_chat_sessions_insert" ON public.ai_chat_sessions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_permanent_user());

DROP POLICY IF EXISTS "ai_chat_sessions_update" ON public.ai_chat_sessions;
CREATE POLICY "ai_chat_sessions_update" ON public.ai_chat_sessions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND public.is_permanent_user());

DROP POLICY IF EXISTS "ai_chat_sessions_delete" ON public.ai_chat_sessions;
CREATE POLICY "ai_chat_sessions_delete" ON public.ai_chat_sessions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND public.is_permanent_user());

-- ─── 2. ai_chat_messages ─────────────────────────────────────────────────────
-- Stores individual messages within a chat session.

CREATE TABLE IF NOT EXISTS public.ai_chat_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID NOT NULL REFERENCES public.ai_chat_sessions(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role             TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content          TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  provider         TEXT,
  latency_ms       INT,
  suggestions      JSONB,
  navigation_target TEXT,
  metadata         JSONB NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_chat_messages_select" ON public.ai_chat_messages;
CREATE POLICY "ai_chat_messages_select" ON public.ai_chat_messages
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.is_permanent_user());

DROP POLICY IF EXISTS "ai_chat_messages_insert" ON public.ai_chat_messages;
CREATE POLICY "ai_chat_messages_insert" ON public.ai_chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_permanent_user());

DROP POLICY IF EXISTS "ai_chat_messages_delete" ON public.ai_chat_messages;
CREATE POLICY "ai_chat_messages_delete" ON public.ai_chat_messages
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND public.is_permanent_user());

-- ─── 3. ai_navigation_events ─────────────────────────────────────────────────
-- Records every navigation triggered by SUPERB AI in-message links,
-- slash commands, or suggestion chip clicks. Feeds the priority algorithm.

CREATE TABLE IF NOT EXISTS public.ai_navigation_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  session_id      UUID REFERENCES public.ai_chat_sessions(id) ON DELETE SET NULL,
  from_view       TEXT,
  to_target       TEXT NOT NULL,
  trigger_type    TEXT NOT NULL DEFAULT 'inline_link',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_navigation_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_nav_events_select" ON public.ai_navigation_events;
CREATE POLICY "ai_nav_events_select" ON public.ai_navigation_events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.is_permanent_user());

DROP POLICY IF EXISTS "ai_nav_events_insert" ON public.ai_navigation_events;
CREATE POLICY "ai_nav_events_insert" ON public.ai_navigation_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_permanent_user());

-- ─── 4. ai_suggestion_feedback ───────────────────────────────────────────────
-- Records which suggestion chips users actually click.
-- Feeds future backend suggestion ranking model.

CREATE TABLE IF NOT EXISTS public.ai_suggestion_feedback (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id    UUID REFERENCES public.ai_chat_sessions(id) ON DELETE SET NULL,
  suggestion_id TEXT NOT NULL,
  label         TEXT NOT NULL,
  prompt        TEXT NOT NULL,
  clicked       BOOLEAN NOT NULL DEFAULT TRUE,
  current_view  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_suggestion_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_suggestion_feedback_select" ON public.ai_suggestion_feedback;
CREATE POLICY "ai_suggestion_feedback_select" ON public.ai_suggestion_feedback
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.is_permanent_user());

DROP POLICY IF EXISTS "ai_suggestion_feedback_insert" ON public.ai_suggestion_feedback;
CREATE POLICY "ai_suggestion_feedback_insert" ON public.ai_suggestion_feedback
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_permanent_user());

-- ─── 5. Superadmin grants ─────────────────────────────────────────────────────

GRANT SELECT ON public.ai_chat_sessions       TO service_role;
GRANT SELECT ON public.ai_chat_messages       TO service_role;
GRANT SELECT ON public.ai_navigation_events   TO service_role;
GRANT SELECT ON public.ai_suggestion_feedback TO service_role;

-- Superadmin analytics RPC
CREATE OR REPLACE FUNCTION public.superadmin_get_ai_stats()
RETURNS TABLE (
  total_sessions   BIGINT,
  total_messages   BIGINT,
  total_nav_events BIGINT,
  top_destinations JSONB
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.ai_chat_sessions)     AS total_sessions,
    (SELECT COUNT(*) FROM public.ai_chat_messages)     AS total_messages,
    (SELECT COUNT(*) FROM public.ai_navigation_events) AS total_nav_events,
    (
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT to_target, COUNT(*) AS hits
        FROM public.ai_navigation_events
        GROUP BY to_target
        ORDER BY hits DESC
        LIMIT 10
      ) t
    ) AS top_destinations;
END;
$$;

-- ─── 6. updated_at trigger ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ai_chat_sessions_updated_at ON public.ai_chat_sessions;
CREATE TRIGGER ai_chat_sessions_updated_at
  BEFORE UPDATE ON public.ai_chat_sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ─── 7. Realtime publication ──────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'ai_chat_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_chat_sessions;
  END IF;
END $$;

-- ─── 8. Performance indexes ───────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_user    ON public.ai_chat_sessions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_org     ON public.ai_chat_sessions (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_session ON public.ai_chat_messages (session_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_ai_nav_events_user       ON public.ai_navigation_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_nav_events_target     ON public.ai_navigation_events (to_target);
CREATE INDEX IF NOT EXISTS idx_ai_suggestion_clicks     ON public.ai_suggestion_feedback (suggestion_id, current_view);

