-- Migration: Add full_name column to users and backfill from name
-- Run this in Supabase SQL editor

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'full_name'
  ) THEN
    ALTER TABLE public.users ADD COLUMN full_name TEXT;
  END IF;
END$$;

-- Backfill full_name from name if name exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'name'
  ) THEN
    UPDATE public.users 
    SET full_name = COALESCE(full_name, name)
    WHERE full_name IS NULL OR full_name = '';
  END IF;
END$$;

-- Optional: Keep name for backward compatibility. If you want to drop it later:
-- ALTER TABLE public.users DROP COLUMN name;

-- Verify
-- SELECT id, full_name, email FROM public.users LIMIT 10;