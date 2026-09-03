-- ==========================================================
-- ZENITH HABIT TRACKER — SECURE SERVER-ONLY SUPABASE SCHEMA
-- Completely Protected from Public Browser/Anon Access
-- Supports Multi-User Privacy & One-Time Friend Invitations
-- ==========================================================

-- 1. Create APP_USERS table
CREATE TABLE IF NOT EXISTS public.app_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    pin_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member', -- 'owner' | 'member'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

-- 4. Create HABIT_LOGS table (Unique per habit per date)
CREATE TABLE IF NOT EXISTS public.habit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.app_users(id) ON DELETE CASCADE,
    habit_id UUID NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    value NUMERIC NOT NULL DEFAULT 0,
    notes TEXT DEFAULT '',
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

-- CRITICAL BACKFILL: Safely attach ALL existing habits, logs, and day notes to the Owner profile
UPDATE public.habits 
SET user_id = '00000000-0000-0000-0000-000000000001' 
WHERE user_id IS NULL;

UPDATE public.habit_logs 
SET user_id = '00000000-0000-0000-0000-000000000001' 
WHERE user_id IS NULL;

UPDATE public.day_notes 
SET user_id = '00000000-0000-0000-0000-000000000001' 
WHERE user_id IS NULL;

-- 6. High-Performance Indexes for 0ms queries & multi-user isolation
CREATE INDEX IF NOT EXISTS idx_habits_user_id ON public.habits(user_id);
CREATE INDEX IF NOT EXISTS idx_habits_archived ON public.habits(archived);
CREATE INDEX IF NOT EXISTS idx_habits_order ON public.habits(sort_order);
CREATE INDEX IF NOT EXISTS idx_habit_logs_user_id ON public.habit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_habit_logs_habit_date ON public.habit_logs(habit_id, date);
CREATE INDEX IF NOT EXISTS idx_habit_logs_date ON public.habit_logs(date);
CREATE INDEX IF NOT EXISTS idx_day_notes_user_date ON public.day_notes(user_id, date);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.invitations(token);

-- 7. Enable Row Level Security (RLS)
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.day_notes ENABLE ROW LEVEL SECURITY;

-- 8. Strict Server Access Policy (Public 'anon' is blocked; Server Actions bypass via service_role)
DROP POLICY IF EXISTS "Allow service role only app_users" ON public.app_users;
DROP POLICY IF EXISTS "Allow service role only invitations" ON public.invitations;
DROP POLICY IF EXISTS "Allow service role only habits" ON public.habits;
DROP POLICY IF EXISTS "Allow service role only habit_logs" ON public.habit_logs;
DROP POLICY IF EXISTS "Allow service role only day_notes" ON public.day_notes;

CREATE POLICY "Allow service role only app_users" ON public.app_users FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role only invitations" ON public.invitations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role only habits" ON public.habits FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role only habit_logs" ON public.habit_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role only day_notes" ON public.day_notes FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 9. Trigger to automatically update updated_at timestamps
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
