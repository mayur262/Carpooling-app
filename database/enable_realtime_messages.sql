-- Enable Realtime for Messages Table
-- This script enables Supabase Realtime for the messages table to enable full-duplex communication

-- Enable realtime for messages table
ALTER TABLE messages REPLICA IDENTITY FULL;

-- Enable publication for realtime
-- Note: This assumes you have already enabled the realtime extension in your Supabase project

-- Grant necessary permissions for realtime
GRANT SELECT ON messages TO anon, authenticated;
GRANT INSERT ON messages TO anon, authenticated;
GRANT UPDATE ON messages TO anon, authenticated;

-- Create a specific publication for messages if it doesn't exist
-- This enables realtime subscriptions on the messages table
CREATE PUBLICATION supabase_realtime_messages FOR TABLE messages;

-- Alternative: Add messages to the default realtime publication
-- ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Ensure RLS policies allow realtime operations
-- These policies work with the existing ones but ensure realtime compatibility
CREATE POLICY "Users can receive realtime messages" ON messages FOR SELECT USING (
  auth.uid() IN (
    SELECT passenger_id FROM bookings WHERE bookings.id = messages.booking_id
  ) OR
  auth.uid() IN (
    SELECT driver_id FROM rides WHERE rides.id = (
      SELECT ride_id FROM bookings WHERE bookings.id = messages.booking_id
    )
  )
);

-- Add notification function for new messages
CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS TRIGGER AS $$
BEGIN
  -- This function can be used to trigger additional notifications if needed
  PERFORM pg_notify('new_message', json_build_object(
    'booking_id', NEW.booking_id,
    'sender_id', NEW.sender_id,
    'content', NEW.content,
    'created_at', NEW.created_at
  )::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for message notifications (optional)
CREATE TRIGGER message_notification_trigger
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION notify_new_message();

-- Verify realtime is working
-- You can test with this query in Supabase dashboard:
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime_messages';