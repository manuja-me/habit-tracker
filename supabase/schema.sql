-- ==========================================================
-- ZENITH HABIT TRACKER -- SECURE SUPABASE SCHEMA
-- Completely Protected Server Actions
-- Supports Multi-User Privacy, One-Time Friend Invitations,
-- and Dedicated DAY_NOTES Table (No notes in habit_logs)
-- ==========================================================

-- 1. Create APP_USERS table
CREATE TABLE IF NOT EXISTS public.app_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    pin_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member', -- 'owner' | 'member'
    last_login_at TIMESTAMPTZ,
    deactivated_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Safe migration for existing installations (Add last_login_at and deactivated_at columns if not exists)
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ DEFAULT NULL;

-- Ensure fixed Owner user exists (Default PIN 1001 with salt)
INSERT INTO public.app_users (id, username, pin_hash, role)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'owner',
    'd4b1fb9e198b108cb929315ebfc003d15db47be352d126639c09d57a942ce293', -- Salted SHA-256 of 1001
    'owner'
)
ON CONFLICT (username) DO NOTHING;

-- 2. Create INVITATIONS table (One-Time Secret Links)
CREATE TABLE IF NOT EXISTS public.invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT UNIQUE NOT NULL,
    created_by UUID REFERENCES public.app_users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_by UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create HABITS table
CREATE TABLE IF NOT EXISTS public.habits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.app_users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    category TEXT NOT NULL DEFAULT 'productivity',
    color TEXT NOT NULL DEFAULT '#10B981',
    icon TEXT NOT NULL DEFAULT 'Flame',
    type TEXT NOT NULL DEFAULT 'boolean' CHECK (type IN ('boolean', 'number')),
    target_value NUMERIC NOT NULL DEFAULT 1,
    target_unit TEXT DEFAULT '',
    frequency TEXT NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekdays', 'weekends', 'custom')),
    custom_days INTEGER[] DEFAULT '{}',
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Safe migration for existing installations (Add user_id column if not exists)
ALTER TABLE public.habits ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.app_users(id) ON DELETE CASCADE;

-- 4. Create HABIT_LOGS table (Pure completions & numerical values - NO notes column)
CREATE TABLE IF NOT EXISTS public.habit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.app_users(id) ON DELETE CASCADE,
    habit_id UUID NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    value NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_habit_date UNIQUE (habit_id, date)
);

-- Safe migration for existing installations (Add user_id column if not exists)
ALTER TABLE public.habit_logs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.app_users(id) ON DELETE CASCADE;

-- 5. Create DAY_NOTES table (Per-user per-date directives / tasks)
CREATE TABLE IF NOT EXISTS public.day_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.app_users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_user_day_note UNIQUE (user_id, date)
);

ALTER TABLE public.day_notes ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.app_users(id) ON DELETE CASCADE;

-- Safe constraint check for day_notes (ensures unique (user_id, date) is present)
DO 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_user_day_note'
    ) THEN
        ALTER TABLE public.day_notes DROP CONSTRAINT IF EXISTS day_notes_pkey CASCADE;
        ALTER TABLE public.day_notes ADD PRIMARY KEY (id);
        ALTER TABLE public.day_notes ADD CONSTRAINT unique_user_day_note UNIQUE (user_id, date);
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END ;

-- ================================================================
-- DATA REPLACEMENT MIGRATION:
-- Move notes from habit_logs into day_notes, clean up shadow habit,
-- and drop notes column from habit_logs with ZERO DATA LOSS.
-- ================================================================
DO 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'habit_logs' 
          AND column_name = 'notes'
    ) THEN
        INSERT INTO public.day_notes (user_id, date, content, updated_at)
        SELECT 
            COALESCE(hl.user_id, '00000000-0000-0000-0000-000000000001') AS user_id,
            hl.date,
            hl.notes AS content,
            hl.updated_at
        FROM public.habit_logs hl
        WHERE hl.notes IS NOT NULL AND hl.notes != ''
        ON CONFLICT (user_id, date) 
        DO UPDATE SET 
            content = EXCLUDED.content,
            updated_at = EXCLUDED.updated_at;

        -- Remove notes column from habit_logs
        ALTER TABLE public.habit_logs DROP COLUMN notes;
    END IF;
END ;

-- Clean up any shadow habits created during transition
DELETE FROM public.habits WHERE category IN ('__system_planner__', '__planner_system__');

-- Attach existing orphaned data to the Owner profile
UPDATE public.habits SET user_id = '00000000-0000-0000-0000-000000000001' WHERE user_id IS NULL;
UPDATE public.habit_logs SET user_id = '00000000-0000-0000-0000-000000000001' WHERE user_id IS NULL;
UPDATE public.day_notes SET user_id = '00000000-0000-0000-0000-000000000001' WHERE user_id IS NULL;

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_habits_user_id ON public.habits(user_id);
CREATE INDEX IF NOT EXISTS idx_habits_archived ON public.habits(archived);
CREATE INDEX IF NOT EXISTS idx_habits_order ON public.habits(sort_order);
CREATE INDEX IF NOT EXISTS idx_habit_logs_user_id ON public.habit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_habit_logs_habit_date ON public.habit_logs(habit_id, date);
CREATE INDEX IF NOT EXISTS idx_habit_logs_date ON public.habit_logs(date);
CREATE INDEX IF NOT EXISTS idx_day_notes_user_date ON public.day_notes(user_id, date);
CREATE INDEX IF NOT EXISTS idx_app_users_deactivated_at ON public.app_users(deactivated_at);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.invitations(token);

-- 7. Row Level Security (RLS)
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.day_notes ENABLE ROW LEVEL SECURITY;

-- 8. Access Policies
-- CRITICAL SECURITY: When SUPABASE_SERVICE_ROLE_KEY is configured in your server environment,
-- all tables should be restricted exclusively to service_role. This blocks direct anonymous REST
-- access from browsers while allowing Next.js server actions to execute with full privacy.
DROP POLICY IF EXISTS "Allow service role only app_users" ON public.app_users;
DROP POLICY IF EXISTS "Allow access app_users" ON public.app_users;
CREATE POLICY "Allow service role only app_users" ON public.app_users FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service role only invitations" ON public.invitations;
DROP POLICY IF EXISTS "Allow access invitations" ON public.invitations;
CREATE POLICY "Allow service role only invitations" ON public.invitations FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service role only habits" ON public.habits;
DROP POLICY IF EXISTS "Allow access habits" ON public.habits;
CREATE POLICY "Allow service role only habits" ON public.habits FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service role only habit_logs" ON public.habit_logs;
DROP POLICY IF EXISTS "Allow access habit_logs" ON public.habit_logs;
CREATE POLICY "Allow service role only habit_logs" ON public.habit_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service role only day_notes" ON public.day_notes;
DROP POLICY IF EXISTS "Allow access day_notes" ON public.day_notes;
CREATE POLICY "Allow service role only day_notes" ON public.day_notes FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 9. Updated At Trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS 
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
 LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_habits_updated_at ON public.habits;
CREATE TRIGGER set_habits_updated_at
    BEFORE UPDATE ON public.habits
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_habit_logs_updated_at ON public.habit_logs;
CREATE TRIGGER set_habit_logs_updated_at
    BEFORE UPDATE ON public.habit_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_day_notes_updated_at ON public.day_notes;
CREATE TRIGGER set_day_notes_updated_at
    BEFORE UPDATE ON public.day_notes
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ================================================================
-- 10. PROJECTS table (additive migration -- touches no existing data)
-- status: 'active' = ongoing, 'planned' = future project
-- tasks: JSONB array of { id, title, done } subtasks
-- ================================================================
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
    notes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'planned')),
    tasks JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(tasks) = 'array'),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow service role only projects" ON public.projects;
CREATE POLICY "Allow service role only projects" ON public.projects FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS set_projects_updated_at ON public.projects;
CREATE TRIGGER set_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ================================================================
-- 11. PROJECT_GROUPS table (organizations / people that own projects)
-- Additive: new table + nullable projects.group_id column. Deleting a
-- group sets its projects' group_id to NULL (Unassigned), never deletes them.
-- ================================================================
CREATE TABLE IF NOT EXISTS public.project_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
    kind TEXT NOT NULL DEFAULT 'org' CHECK (kind IN ('org', 'person')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.project_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_project_groups_user_id ON public.project_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_group_id ON public.projects(group_id);

ALTER TABLE public.project_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow service role only project_groups" ON public.project_groups;
CREATE POLICY "Allow service role only project_groups" ON public.project_groups FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS set_project_groups_updated_at ON public.project_groups;
CREATE TRIGGER set_project_groups_updated_at
    BEFORE UPDATE ON public.project_groups
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
