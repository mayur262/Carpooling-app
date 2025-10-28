-- Update SOS tables for EmailJS integration
-- Run this SQL in your Supabase SQL editor

-- Add email column to contacts table if not exists
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS email TEXT;

-- Add comment for documentation
COMMENT ON COLUMN contacts.email IS 'Email address for EmailJS notifications';

-- Update existing contacts to have email field (optional - for existing data)
-- UPDATE contacts SET email = NULL WHERE email IS NULL;

-- Ensure RLS policies allow users to manage their own contacts
-- These should already exist, but verify they're correct

-- Check if policies exist before creating them
DO $$ 
BEGIN
    -- Policy for users to view their own contacts
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'contacts' AND policyname = 'Users can view own contacts'
    ) THEN
        CREATE POLICY "Users can view own contacts" ON contacts
            FOR SELECT USING (auth.uid() = user_id);
    END IF;

    -- Policy for users to insert their own contacts  
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'contacts' AND policyname = 'Users can insert own contacts'
    ) THEN
        CREATE POLICY "Users can insert own contacts" ON contacts
            FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;

    -- Policy for users to update their own contacts
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'contacts' AND policyname = 'Users can update own contacts'
    ) THEN
        CREATE POLICY "Users can update own contacts" ON contacts
            FOR UPDATE USING (auth.uid() = user_id);
    END IF;

    -- Policy for users to delete their own contacts
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'contacts' AND policyname = 'Users can delete own contacts'
    ) THEN
        CREATE POLICY "Users can delete own contacts" ON contacts
            FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

-- Ensure sos_events table has proper indexes for performance
CREATE INDEX IF NOT EXISTS idx_sos_events_user_id ON sos_events(user_id);
CREATE INDEX IF NOT EXISTS idx_sos_events_status ON sos_events(status);
CREATE INDEX IF NOT EXISTS idx_sos_events_timestamp ON sos_events(timestamp);

-- Add status index if not exists
CREATE INDEX IF NOT EXISTS idx_sos_events_created_at ON sos_events(created_at);

-- Verify table structure
SELECT table_name, column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name IN ('contacts', 'sos_events')
ORDER BY table_name, ordinal_position;

-- Sample data verification queries
-- Check contacts with emails
SELECT id, name, phone, email, user_id 
FROM contacts 
WHERE email IS NOT NULL 
LIMIT 5;

-- Check recent SOS events
SELECT id, user_id, latitude, longitude, status, created_at 
FROM sos_events 
ORDER BY created_at DESC 
LIMIT 5;

-- Enable realtime for sos_events (should already be enabled)
ALTER TABLE sos_events REPLICA IDENTITY FULL;

-- Grant necessary permissions (should already be set)
GRANT ALL ON contacts TO authenticated;
GRANT ALL ON sos_events TO authenticated;

-- Add notification preferences table (optional enhancement)
CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email_alerts BOOLEAN DEFAULT true,
    sms_alerts BOOLEAN DEFAULT false,
    push_alerts BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Add RLS for notification preferences
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can manage own preferences" ON notification_preferences
    FOR ALL USING (auth.uid() = user_id);

-- Insert default preferences for existing users (optional)
INSERT INTO notification_preferences (user_id, email_alerts, sms_alerts, push_alerts)
SELECT id, true, false, true FROM auth.users
ON CONFLICT (user_id) DO NOTHING;