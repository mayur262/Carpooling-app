-- Disable Row Level Security (RLS) for all tables
-- This script will disable RLS policies to help debug authentication issues

-- Disable RLS for users table
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Disable RLS for rides table  
ALTER TABLE rides DISABLE ROW LEVEL SECURITY;

-- Disable RLS for bookings table
ALTER TABLE bookings DISABLE ROW LEVEL SECURITY;

-- Disable RLS for messages table
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;

-- Disable RLS for ratings table
ALTER TABLE ratings DISABLE ROW LEVEL SECURITY;

-- Disable RLS for notifications table
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT 
    schemaname,
    tablename,
    rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'rides', 'bookings', 'messages', 'ratings', 'notifications');