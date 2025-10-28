-- Notifications table for ShareMyRide app
-- This table stores user notifications for various app events

-- Create the notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('booking', 'message', 'rating', 'ride_update')),
    is_read BOOLEAN DEFAULT FALSE,
    related_id UUID, -- Can reference booking_id, ride_id, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- Enable Row Level Security
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- Function to mark notifications as read
CREATE OR REPLACE FUNCTION mark_notification_as_read(notification_id UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE notifications 
    SET is_read = TRUE 
    WHERE id = notification_id AND user_id = user_uuid;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create a notification
CREATE OR REPLACE FUNCTION create_notification(
    target_user_id UUID,
    notification_title TEXT,
    notification_message TEXT,
    notification_type TEXT,
    related_uuid UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    new_notification_id UUID;
BEGIN
    INSERT INTO notifications (user_id, title, message, type, related_id)
    VALUES (target_user_id, notification_title, notification_message, notification_type, related_uuid)
    RETURNING id INTO new_notification_id;
    
    RETURN new_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get unread notification count
CREATE OR REPLACE FUNCTION get_unread_notification_count(user_uuid UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*) FROM notifications WHERE user_id = user_uuid AND is_read = FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions (adjust based on your Supabase setup)
GRANT SELECT, INSERT, UPDATE ON notifications TO authenticated;

-- Sample notification types and their usage:
-- 'booking' - When someone books your ride, or your booking is accepted/rejected
-- 'message' - When you receive a new message in a booking chat
-- 'rating' - When someone rates you after a ride
-- 'ride_update' - When a ride you're booked on is updated or cancelled