-- ==========================================================
-- ZENITH HABIT TRACKER — SECURE SERVER-ONLY SUPABASE SCHEMA
-- Completely Protected from Public Browser/Anon Access
-- ==========================================================

-- 1. Create HABITS table
CREATE TABLE IF NOT EXISTS public.habits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- 2. Create HABIT_LOGS table (Unique per habit per date)
CREATE TABLE IF NOT EXISTS public.habit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    habit_id UUID NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    value NUMERIC NOT NULL DEFAULT 0,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_habit_date UNIQUE (habit_id, date)
);

-- 3. High-Performance Indexes for 0ms queries & heatmaps
CREATE INDEX IF NOT EXISTS idx_habits_archived ON public.habits(archived);
CREATE INDEX IF NOT EXISTS idx_habits_order ON public.habits(sort_order);
CREATE INDEX IF NOT EXISTS idx_habit_logs_habit_date ON public.habit_logs(habit_id, date);
CREATE INDEX IF NOT EXISTS idx_habit_logs_date ON public.habit_logs(date);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_logs ENABLE ROW LEVEL SECURITY;

-- 5. Strict Server Access Policy (Public 'anon' is blocked; Server Actions bypass via service_role)
DROP POLICY IF EXISTS "Single user full access habits" ON public.habits;
DROP POLICY IF EXISTS "Single user full access habit_logs" ON public.habit_logs;
DROP POLICY IF EXISTS "Allow service role only habits" ON public.habits;
DROP POLICY IF EXISTS "Allow service role only habit_logs" ON public.habit_logs;

-- Policies allowing access only via authenticated service role / backend
CREATE POLICY "Allow service role only habits"
    ON public.habits
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow service role only habit_logs"
    ON public.habit_logs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 6. Trigger to automatically update updated_at timestamps
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
