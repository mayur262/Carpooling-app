-- Fix RLS policies for users table
-- This addresses the "new row violates row-level security policy for table 'users'" error

-- Enable RLS on users table if not already enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies on users table (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can delete own profile" ON public.users;

-- Create RLS policies for users table
-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- Users can delete their own profile (optional - usually not needed)
CREATE POLICY "Users can delete own profile" ON public.users
    FOR DELETE USING (auth.uid() = id);

-- Grant necessary permissions
GRANT ALL ON public.users TO authenticated;

-- Verify policies are created
SELECT tablename, policyname, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY policyname;

-- Test the policies
-- You can test with these queries in Supabase SQL editor:

-- Test as authenticated user
SET ROLE authenticated;
SELECT current_user, current_role;

-- Test inserting a user profile (this should work now)
-- INSERT INTO public.users (id, full_name, email, bio, role) 
-- VALUES (auth.uid(), 'Test User', 'test@example.com', 'Test bio', 'user');

-- Test selecting own profile
-- SELECT * FROM public.users WHERE id = auth.uid();

-- Reset role
RESET ROLE;