-- TradingGoose PoC research-first schema patch
-- Safe to run in Supabase SQL Editor on a fresh Supabase project.

-- ---------------------------------------------------------------------------
-- Minimal bootstrap objects required by the PoC
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_roles(p_user_id uuid)
RETURNS TABLE(role_id uuid, role_name varchar, is_active boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT NULL::uuid, NULL::varchar, false
    WHERE false;
$$;

GRANT ALL ON FUNCTION public.get_user_roles(uuid) TO anon;
GRANT ALL ON FUNCTION public.get_user_roles(uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_roles(uuid) TO service_role;

CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text,
    name text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    discord_id text UNIQUE
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'users_view_own_profile'
    ) THEN
        CREATE POLICY "users_view_own_profile"
            ON public.profiles
            FOR SELECT
            USING (auth.uid() = id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'users_update_own_profile'
    ) THEN
        CREATE POLICY "users_update_own_profile"
            ON public.profiles
            FOR UPDATE
            USING (auth.uid() = id)
            WITH CHECK (auth.uid() = id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'system_insert_profiles'
    ) THEN
        CREATE POLICY "system_insert_profiles"
            ON public.profiles
            FOR INSERT
            WITH CHECK (auth.uid() = id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'service_role_full_access_profiles'
    ) THEN
        CREATE POLICY "service_role_full_access_profiles"
            ON public.profiles
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name, created_at, updated_at)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(
            NEW.raw_user_meta_data ->> 'name',
            NEW.raw_user_meta_data ->> 'full_name',
            split_part(COALESCE(NEW.email, ''), '@', 1),
            NEW.email
        ),
        COALESCE(NEW.created_at, NOW()),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET
        email = EXCLUDED.email,
        name = COALESCE(EXCLUDED.name, public.profiles.name),
        updated_at = NOW();

    RETURN NEW;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'on_auth_user_created_profile'
    ) THEN
        CREATE TRIGGER on_auth_user_created_profile
            AFTER INSERT ON auth.users
            FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'update_profiles_updated_at'
    ) THEN
        CREATE TRIGGER update_profiles_updated_at
            BEFORE UPDATE ON public.profiles
            FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;

GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;

CREATE TABLE IF NOT EXISTS public.provider_configurations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nickname text NOT NULL,
    provider text NOT NULL,
    api_key text NOT NULL,
    is_default boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT provider_configurations_provider_check
      CHECK (provider = ANY (ARRAY['openai', 'anthropic', 'google', 'deepseek', 'openrouter']))
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'provider_configurations_user_id_nickname_key'
    ) THEN
        ALTER TABLE public.provider_configurations
            ADD CONSTRAINT provider_configurations_user_id_nickname_key
            UNIQUE (user_id, nickname);
    END IF;
END $$;

ALTER TABLE public.provider_configurations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'provider_configurations' AND policyname = 'Users can view their own provider configurations'
    ) THEN
        CREATE POLICY "Users can view their own provider configurations"
            ON public.provider_configurations
            FOR SELECT TO authenticated
            USING (auth.uid() = user_id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'provider_configurations' AND policyname = 'Users can insert their own provider configurations'
    ) THEN
        CREATE POLICY "Users can insert their own provider configurations"
            ON public.provider_configurations
            FOR INSERT TO authenticated
            WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'provider_configurations' AND policyname = 'Users can update their own provider configurations'
    ) THEN
        CREATE POLICY "Users can update their own provider configurations"
            ON public.provider_configurations
            FOR UPDATE TO authenticated
            USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'provider_configurations' AND policyname = 'Users can delete their own provider configurations'
    ) THEN
        CREATE POLICY "Users can delete their own provider configurations"
            ON public.provider_configurations
            FOR DELETE TO authenticated
            USING (auth.uid() = user_id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'provider_configurations' AND policyname = 'service_role_full_access_provider_configurations'
    ) THEN
        CREATE POLICY "service_role_full_access_provider_configurations"
            ON public.provider_configurations
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'update_provider_configurations_updated_at'
    ) THEN
        CREATE TRIGGER update_provider_configurations_updated_at
            BEFORE UPDATE ON public.provider_configurations
            FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;

GRANT ALL ON TABLE public.provider_configurations TO authenticated;
GRANT ALL ON TABLE public.provider_configurations TO service_role;

CREATE TABLE IF NOT EXISTS public.api_settings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    ai_provider text NOT NULL DEFAULT 'openai',
    ai_api_key text DEFAULT '',
    ai_model text DEFAULT 'gpt-4o-mini',
    openai_api_key text,
    anthropic_api_key text,
    google_api_key text,
    deepseek_api_key text,
    openrouter_api_key text,
    analysis_optimization varchar(20) DEFAULT 'speed',
    analysis_history_days text DEFAULT '1M',
    analysis_search_sources integer DEFAULT 5,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT api_settings_ai_provider_check
      CHECK (ai_provider = ANY (ARRAY['openai', 'anthropic', 'google', 'openrouter', 'deepseek'])),
    CONSTRAINT api_settings_analysis_history_days_check
      CHECK (analysis_history_days = ANY (ARRAY['1M', '3M', '6M', '1Y']))
);

ALTER TABLE public.api_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'api_settings' AND policyname = 'api_settings_select_own'
    ) THEN
        CREATE POLICY "api_settings_select_own"
            ON public.api_settings
            FOR SELECT TO authenticated
            USING (user_id = auth.uid());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'api_settings' AND policyname = 'api_settings_insert_own'
    ) THEN
        CREATE POLICY "api_settings_insert_own"
            ON public.api_settings
            FOR INSERT TO authenticated
            WITH CHECK (user_id = auth.uid());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'api_settings' AND policyname = 'api_settings_update_own'
    ) THEN
        CREATE POLICY "api_settings_update_own"
            ON public.api_settings
            FOR UPDATE TO authenticated
            USING (user_id = auth.uid())
            WITH CHECK (user_id = auth.uid());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'api_settings' AND policyname = 'api_settings_delete_own'
    ) THEN
        CREATE POLICY "api_settings_delete_own"
            ON public.api_settings
            FOR DELETE TO authenticated
            USING (user_id = auth.uid());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'api_settings' AND policyname = 'api_settings_service_role_all'
    ) THEN
        CREATE POLICY "api_settings_service_role_all"
            ON public.api_settings
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'update_api_settings_updated_at'
    ) THEN
        CREATE TRIGGER update_api_settings_updated_at
            BEFORE UPDATE ON public.api_settings
            FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;

GRANT ALL ON TABLE public.api_settings TO authenticated;
GRANT ALL ON TABLE public.api_settings TO service_role;

CREATE TABLE IF NOT EXISTS public.analysis_history (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ticker text NOT NULL,
    analysis_date date NOT NULL,
    decision text NOT NULL DEFAULT 'PENDING',
    confidence numeric(5,2) NOT NULL DEFAULT 0,
    agent_insights jsonb,
    full_analysis jsonb DEFAULT '{}'::jsonb,
    analysis_status text DEFAULT 'pending',
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT analysis_history_confidence_check
      CHECK (confidence >= 0 AND confidence <= 100),
    CONSTRAINT analysis_history_decision_check
      CHECK (decision = ANY (ARRAY['BUY', 'SELL', 'HOLD', 'PENDING'])),
    CONSTRAINT analysis_history_status_check
      CHECK (analysis_status = ANY (ARRAY['pending', 'running', 'completed', 'error', 'cancelled']))
);

CREATE INDEX IF NOT EXISTS idx_analysis_history_user_ticker_date
    ON public.analysis_history(user_id, ticker, analysis_date);

ALTER TABLE public.analysis_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'analysis_history' AND policyname = 'Users can view own analysis history'
    ) THEN
        CREATE POLICY "Users can view own analysis history"
            ON public.analysis_history
            FOR SELECT
            USING (user_id = auth.uid());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'analysis_history' AND policyname = 'Users can create own analysis history'
    ) THEN
        CREATE POLICY "Users can create own analysis history"
            ON public.analysis_history
            FOR INSERT
            WITH CHECK (user_id = auth.uid());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'analysis_history' AND policyname = 'Users can update own analysis history'
    ) THEN
        CREATE POLICY "Users can update own analysis history"
            ON public.analysis_history
            FOR UPDATE
            USING (user_id = auth.uid())
            WITH CHECK (user_id = auth.uid());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'analysis_history' AND policyname = 'Service role full access to analysis history'
    ) THEN
        CREATE POLICY "Service role full access to analysis history"
            ON public.analysis_history
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'update_analysis_history_updated_at'
    ) THEN
        CREATE TRIGGER update_analysis_history_updated_at
            BEFORE UPDATE ON public.analysis_history
            FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;

GRANT ALL ON TABLE public.analysis_history TO authenticated;
GRANT ALL ON TABLE public.analysis_history TO service_role;

CREATE TABLE IF NOT EXISTS public.analysis_messages (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    analysis_id uuid NOT NULL REFERENCES public.analysis_history(id) ON DELETE CASCADE,
    agent_name text NOT NULL,
    message text NOT NULL,
    message_type text DEFAULT 'analysis',
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_analysis_messages_analysis_id
    ON public.analysis_messages(analysis_id);

ALTER TABLE public.analysis_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'analysis_messages' AND policyname = 'Users can read their own analysis messages'
    ) THEN
        CREATE POLICY "Users can read their own analysis messages"
            ON public.analysis_messages
            FOR SELECT
            USING (
                EXISTS (
                    SELECT 1
                    FROM public.analysis_history ah
                    WHERE ah.id = analysis_messages.analysis_id
                      AND ah.user_id = auth.uid()
                )
            );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'analysis_messages' AND policyname = 'Service role full access to analysis messages'
    ) THEN
        CREATE POLICY "Service role full access to analysis messages"
            ON public.analysis_messages
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

GRANT ALL ON TABLE public.analysis_messages TO authenticated;
GRANT ALL ON TABLE public.analysis_messages TO service_role;

ALTER TABLE IF EXISTS public.provider_configurations
    ADD COLUMN IF NOT EXISTS model text,
    ADD COLUMN IF NOT EXISTS base_url text,
    ADD COLUMN IF NOT EXISTS provider_type text DEFAULT 'direct',
    ADD COLUMN IF NOT EXISTS extra_headers_json jsonb DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS is_openai_compatible boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS description text,
    ADD COLUMN IF NOT EXISTS enabled boolean DEFAULT true;

CREATE TABLE IF NOT EXISTS public.conversations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title text NOT NULL,
    market_scope text DEFAULT 'multi-market',
    entity_context jsonb DEFAULT '{}'::jsonb,
    status text DEFAULT 'active',
    last_message_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.briefings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
    briefing_type text NOT NULL,
    market_scope text DEFAULT 'multi-market',
    watch_entities jsonb DEFAULT '[]'::jsonb,
    style_profile jsonb DEFAULT '{}'::jsonb,
    title text NOT NULL,
    summary text,
    content text NOT NULL,
    stance jsonb DEFAULT '{}'::jsonb,
    theses jsonb DEFAULT '{"bull":[],"bear":[]}'::jsonb,
    scenarios jsonb DEFAULT '[]'::jsonb,
    risks jsonb DEFAULT '[]'::jsonb,
    compliance_flags jsonb DEFAULT '[]'::jsonb,
    provider_snapshot jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.research_runs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
    briefing_id uuid REFERENCES public.briefings(id) ON DELETE SET NULL,
    analysis_history_id uuid REFERENCES public.analysis_history(id) ON DELETE SET NULL,
    query text NOT NULL,
    market_scope text DEFAULT 'multi-market',
    entity_context jsonb DEFAULT '{}'::jsonb,
    output_mode text DEFAULT 'research-note',
    answer text NOT NULL,
    stance jsonb DEFAULT '{}'::jsonb,
    theses jsonb DEFAULT '{"bull":[],"bear":[]}'::jsonb,
    scenarios jsonb DEFAULT '[]'::jsonb,
    risks jsonb DEFAULT '[]'::jsonb,
    compliance_flags jsonb DEFAULT '[]'::jsonb,
    provider_snapshot jsonb DEFAULT '{}'::jsonb,
    source_summary jsonb DEFAULT '{}'::jsonb,
    status text DEFAULT 'completed',
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.conversation_messages (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role text NOT NULL,
    content text NOT NULL,
    structured_answer jsonb,
    market_scope text DEFAULT 'multi-market',
    entity_context jsonb DEFAULT '{}'::jsonb,
    research_run_id uuid REFERENCES public.research_runs(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.citations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    research_run_id uuid REFERENCES public.research_runs(id) ON DELETE CASCADE,
    conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
    briefing_id uuid REFERENCES public.briefings(id) ON DELETE CASCADE,
    title text NOT NULL,
    url text NOT NULL,
    publisher text,
    snippet text,
    source_tier integer DEFAULT 2,
    source_type text DEFAULT 'media',
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.thesis_cards (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    research_run_id uuid REFERENCES public.research_runs(id) ON DELETE SET NULL,
    conversation_id uuid UNIQUE REFERENCES public.conversations(id) ON DELETE SET NULL,
    source_message_id uuid REFERENCES public.conversation_messages(id) ON DELETE SET NULL,
    legacy_briefing_id uuid REFERENCES public.briefings(id) ON DELETE SET NULL,
    card_kind text DEFAULT 'chat',
    title text NOT NULL,
    summary text,
    query text,
    market_scope text DEFAULT 'multi-market',
    entity_context jsonb DEFAULT '{}'::jsonb,
    content jsonb NOT NULL DEFAULT '{}'::jsonb,
    stance jsonb DEFAULT '{}'::jsonb,
    theses jsonb DEFAULT '{"bull":[],"bear":[]}'::jsonb,
    scenarios jsonb DEFAULT '[]'::jsonb,
    risks jsonb DEFAULT '[]'::jsonb,
    citations jsonb DEFAULT '[]'::jsonb,
    compliance_flags jsonb DEFAULT '[]'::jsonb,
    provider_snapshot jsonb DEFAULT '{}'::jsonb,
    source_summary jsonb DEFAULT '{}'::jsonb,
    status text DEFAULT 'active',
    pinned boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT thesis_cards_card_kind_check
      CHECK (card_kind = ANY (ARRAY['chat', 'briefing', 'manual'])),
    CONSTRAINT thesis_cards_status_check
      CHECK (status = ANY (ARRAY['active', 'archived']))
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_last_message
    ON public.conversations(user_id, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation_created
    ON public.conversation_messages(conversation_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_briefings_user_created
    ON public.briefings(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_research_runs_user_created
    ON public.research_runs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_citations_research_run
    ON public.citations(research_run_id);

CREATE INDEX IF NOT EXISTS idx_thesis_cards_user_updated
    ON public.thesis_cards(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_thesis_cards_research_run
    ON public.thesis_cards(research_run_id);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thesis_cards ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'conversations' AND policyname = 'Users can manage own conversations'
    ) THEN
        CREATE POLICY "Users can manage own conversations"
            ON public.conversations
            USING (user_id = auth.uid())
            WITH CHECK (user_id = auth.uid());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'conversation_messages' AND policyname = 'Users can manage own conversation messages'
    ) THEN
        CREATE POLICY "Users can manage own conversation messages"
            ON public.conversation_messages
            USING (user_id = auth.uid())
            WITH CHECK (user_id = auth.uid());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'briefings' AND policyname = 'Users can manage own briefings'
    ) THEN
        CREATE POLICY "Users can manage own briefings"
            ON public.briefings
            USING (user_id = auth.uid())
            WITH CHECK (user_id = auth.uid());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'research_runs' AND policyname = 'Users can manage own research runs'
    ) THEN
        CREATE POLICY "Users can manage own research runs"
            ON public.research_runs
            USING (user_id = auth.uid())
            WITH CHECK (user_id = auth.uid());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'citations' AND policyname = 'Users can view own citations'
    ) THEN
        CREATE POLICY "Users can view own citations"
            ON public.citations
            USING (user_id = auth.uid())
            WITH CHECK (user_id = auth.uid());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'thesis_cards' AND policyname = 'Users can manage own thesis cards'
    ) THEN
        CREATE POLICY "Users can manage own thesis cards"
            ON public.thesis_cards
            USING (user_id = auth.uid())
            WITH CHECK (user_id = auth.uid());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'conversations' AND policyname = 'Service role full access to conversations'
    ) THEN
        CREATE POLICY "Service role full access to conversations"
            ON public.conversations
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'conversation_messages' AND policyname = 'Service role full access to conversation messages'
    ) THEN
        CREATE POLICY "Service role full access to conversation messages"
            ON public.conversation_messages
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'briefings' AND policyname = 'Service role full access to briefings'
    ) THEN
        CREATE POLICY "Service role full access to briefings"
            ON public.briefings
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'research_runs' AND policyname = 'Service role full access to research runs'
    ) THEN
        CREATE POLICY "Service role full access to research runs"
            ON public.research_runs
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'citations' AND policyname = 'Service role full access to citations'
    ) THEN
        CREATE POLICY "Service role full access to citations"
            ON public.citations
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'thesis_cards' AND policyname = 'Service role full access to thesis cards'
    ) THEN
        CREATE POLICY "Service role full access to thesis cards"
            ON public.thesis_cards
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_conversations_updated_at'
    ) THEN
        CREATE TRIGGER update_conversations_updated_at
            BEFORE UPDATE ON public.conversations
            FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_briefings_updated_at'
    ) THEN
        CREATE TRIGGER update_briefings_updated_at
            BEFORE UPDATE ON public.briefings
            FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_research_runs_updated_at'
    ) THEN
        CREATE TRIGGER update_research_runs_updated_at
            BEFORE UPDATE ON public.research_runs
            FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_thesis_cards_updated_at'
    ) THEN
        CREATE TRIGGER update_thesis_cards_updated_at
            BEFORE UPDATE ON public.thesis_cards
            FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;

GRANT ALL ON TABLE public.conversations TO authenticated;
GRANT ALL ON TABLE public.conversations TO service_role;
GRANT ALL ON TABLE public.conversation_messages TO authenticated;
GRANT ALL ON TABLE public.conversation_messages TO service_role;
GRANT ALL ON TABLE public.briefings TO authenticated;
GRANT ALL ON TABLE public.briefings TO service_role;
GRANT ALL ON TABLE public.research_runs TO authenticated;
GRANT ALL ON TABLE public.research_runs TO service_role;
GRANT ALL ON TABLE public.citations TO authenticated;
GRANT ALL ON TABLE public.citations TO service_role;
GRANT ALL ON TABLE public.thesis_cards TO authenticated;
GRANT ALL ON TABLE public.thesis_cards TO service_role;

RESET ALL;
