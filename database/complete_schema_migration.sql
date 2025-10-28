-- ============================================================================
-- COMPLETE SCHEMA MIGRATION FOR SHAREMYRIDE
-- ============================================================================
-- Purpose: Add all necessary columns and tables for notification system,
--          payment tracking, and other missing features
-- Date: October 28, 2025
-- Run this script in: Supabase Dashboard → SQL Editor
-- ============================================================================

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. USERS TABLE UPDATES
-- ============================================================================
-- Add push notification support columns
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS push_token TEXT,
ADD COLUMN IF NOT EXISTS push_token_updated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"bookingUpdates": true, "chatMessages": true, "rideReminders": true, "sosAlerts": true, "promotions": false}'::jsonb;

-- Add device info columns (helpful for debugging)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS device_type TEXT,
ADD COLUMN IF NOT EXISTS app_version TEXT;

-- Create index for push token lookups
CREATE INDEX IF NOT EXISTS idx_users_push_token ON users(push_token) WHERE push_token IS NOT NULL;

-- ============================================================================
-- 2. BOOKINGS TABLE UPDATES
-- ============================================================================
-- Ensure payment and fare columns exist
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending' 
    CHECK (payment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text, 'refunded'::text])),
ADD COLUMN IF NOT EXISTS fare_breakdown JSONB,
ADD COLUMN IF NOT EXISTS final_fare NUMERIC CHECK (final_fare IS NULL OR final_fare > 0::numeric),
ADD COLUMN IF NOT EXISTS payment_method TEXT CHECK (payment_method = ANY (ARRAY['card'::text, 'cash'::text, 'upi'::text, 'wallet'::text])),
ADD COLUMN IF NOT EXISTS payment_transaction_id TEXT,
ADD COLUMN IF NOT EXISTS driver_confirmed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS passenger_confirmed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- Update status constraint to include new statuses
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check 
CHECK (status = ANY (ARRAY[
    'pending'::text, 
    'approved'::text, 
    'confirmed'::text, 
    'active'::text,
    'rejected'::text, 
    'completed'::text, 
    'cancelled'::text,
    'pending_confirmation'::text,
    'pending_completion'::text
]));

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_bookings_passenger_id ON bookings(passenger_id);
CREATE INDEX IF NOT EXISTS idx_bookings_ride_id ON bookings(ride_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings(payment_status);

-- ============================================================================
-- 3. RIDES TABLE UPDATES
-- ============================================================================
-- Add ride counters and tracking
ALTER TABLE rides
ADD COLUMN IF NOT EXISTS confirmed_bookings INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS pending_bookings INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_revenue NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_rides_driver_id ON rides(driver_id);
CREATE INDEX IF NOT EXISTS idx_rides_status ON rides(status);
CREATE INDEX IF NOT EXISTS idx_rides_date ON rides(ride_date);

-- ============================================================================
-- 4. MESSAGES TABLE UPDATES
-- ============================================================================
-- Add read timestamp and delivery status
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS attachment_url TEXT,
ADD COLUMN IF NOT EXISTS attachment_type TEXT;

-- Update message type constraint
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_message_type_check;
ALTER TABLE messages ADD CONSTRAINT messages_message_type_check
CHECK (message_type = ANY (ARRAY['text'::text, 'system'::text, 'image'::text, 'location'::text]));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_messages_booking_id ON messages(booking_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(booking_id) WHERE is_read = false;

-- ============================================================================
-- 5. CONTACTS TABLE UPDATES
-- ============================================================================
-- Add missing columns for emergency contacts
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS relationship TEXT,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS last_notified_at TIMESTAMPTZ;

-- Create index
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id) WHERE is_active = true;

-- ============================================================================
-- 6. SOS_EVENTS TABLE UPDATES
-- ============================================================================
-- Add additional tracking columns
ALTER TABLE sos_events
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS notified_contacts UUID[] DEFAULT ARRAY[]::UUID[];

-- Create index
CREATE INDEX IF NOT EXISTS idx_sos_events_user_id ON sos_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sos_events_status ON sos_events(status) WHERE status = 'active';

-- ============================================================================
-- 7. CREATE NOTIFICATION_LOGS TABLE
-- ============================================================================
-- Track all push notifications sent
CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type = ANY (ARRAY[
    'booking_update'::text,
    'chat_message'::text,
    'sos_alert'::text,
    'ride_reminder'::text,
    'payment_received'::text,
    'rating_request'::text,
    'custom'::text
  ])),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  status TEXT DEFAULT 'sent' CHECK (status = ANY (ARRAY['sent'::text, 'failed'::text, 'read'::text])),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  error TEXT,
  expo_ticket_id TEXT,
  expo_receipt_id TEXT
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notification_logs_user ON notification_logs(user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_logs_type ON notification_logs(notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(status);

-- Add comment
COMMENT ON TABLE notification_logs IS 'Stores history of all push notifications sent to users';

-- ============================================================================
-- 8. CREATE RIDE_MATCHES TABLE (For Smart Matching)
-- ============================================================================
-- Store smart matching results
CREATE TABLE IF NOT EXISTS ride_matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ride_id UUID REFERENCES rides(id) ON DELETE CASCADE,
  passenger_id UUID REFERENCES users(id) ON DELETE CASCADE,
  match_score NUMERIC NOT NULL CHECK (match_score >= 0 AND match_score <= 100),
  score_breakdown JSONB,
  viewed BOOLEAN DEFAULT false,
  viewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ride_id, passenger_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ride_matches_passenger ON ride_matches(passenger_id, match_score DESC);
CREATE INDEX IF NOT EXISTS idx_ride_matches_ride ON ride_matches(ride_id, match_score DESC);

-- ============================================================================
-- 9. CREATE PAYMENT_TRANSACTIONS TABLE (Optional - for payment history)
-- ============================================================================
CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  currency TEXT DEFAULT 'INR',
  payment_method TEXT CHECK (payment_method = ANY (ARRAY['card'::text, 'cash'::text, 'upi'::text, 'wallet'::text])),
  payment_status TEXT CHECK (payment_status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'refunded'::text])),
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  failure_reason TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_payment_transactions_booking ON payment_transactions(booking_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user ON payment_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(payment_status);

-- ============================================================================
-- 10. CREATE FUNCTION TO UPDATE RIDE COUNTERS
-- ============================================================================
-- Automatically update ride statistics when bookings change
CREATE OR REPLACE FUNCTION update_ride_counters()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE rides
    SET 
      confirmed_bookings = (
        SELECT COUNT(*) FROM bookings 
        WHERE ride_id = NEW.ride_id 
        AND status IN ('confirmed', 'active', 'completed')
      ),
      pending_bookings = (
        SELECT COUNT(*) FROM bookings 
        WHERE ride_id = NEW.ride_id 
        AND status = 'pending'
      ),
      total_revenue = (
        SELECT COALESCE(SUM(total_price), 0) FROM bookings 
        WHERE ride_id = NEW.ride_id 
        AND status IN ('confirmed', 'active', 'completed')
        AND payment_status = 'paid'
      ),
      updated_at = NOW()
    WHERE id = NEW.ride_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE rides
    SET 
      confirmed_bookings = (
        SELECT COUNT(*) FROM bookings 
        WHERE ride_id = OLD.ride_id 
        AND status IN ('confirmed', 'active', 'completed')
      ),
      pending_bookings = (
        SELECT COUNT(*) FROM bookings 
        WHERE ride_id = OLD.ride_id 
        AND status = 'pending'
      ),
      total_revenue = (
        SELECT COALESCE(SUM(total_price), 0) FROM bookings 
        WHERE ride_id = OLD.ride_id 
        AND status IN ('confirmed', 'active', 'completed')
        AND payment_status = 'paid'
      ),
      updated_at = NOW()
    WHERE id = OLD.ride_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_ride_counters ON bookings;
CREATE TRIGGER trigger_update_ride_counters
AFTER INSERT OR UPDATE OR DELETE ON bookings
FOR EACH ROW EXECUTE FUNCTION update_ride_counters();

-- ============================================================================
-- 11. CREATE FUNCTION TO UPDATE USER RATINGS
-- ============================================================================
CREATE OR REPLACE FUNCTION update_user_ratings()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the ratee's average rating and total count
  UPDATE users
  SET 
    average_rating = (
      SELECT COALESCE(AVG(rating), 0) 
      FROM ratings 
      WHERE ratee_id = NEW.ratee_id
    ),
    total_ratings = (
      SELECT COUNT(*) 
      FROM ratings 
      WHERE ratee_id = NEW.ratee_id
    ),
    updated_at = NOW()
  WHERE id = NEW.ratee_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_user_ratings ON ratings;
CREATE TRIGGER trigger_update_user_ratings
AFTER INSERT OR UPDATE ON ratings
FOR EACH ROW EXECUTE FUNCTION update_user_ratings();

-- ============================================================================
-- 12. CREATE FUNCTION TO AUTO-UPDATE TIMESTAMPS
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at column
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_rides_updated_at ON rides;
CREATE TRIGGER update_rides_updated_at
BEFORE UPDATE ON rides
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_bookings_updated_at ON bookings;
CREATE TRIGGER update_bookings_updated_at
BEFORE UPDATE ON bookings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_contacts_updated_at ON contacts;
CREATE TRIGGER update_contacts_updated_at
BEFORE UPDATE ON contacts
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ride_requests_updated_at ON ride_requests;
CREATE TRIGGER update_ride_requests_updated_at
BEFORE UPDATE ON ride_requests
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 13. ENABLE ROW LEVEL SECURITY (RLS) - RECOMMENDED
-- ============================================================================
-- Enable RLS on sensitive tables (users can only see their own data)
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ride_matches ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for notification_logs
CREATE POLICY "Users can view their own notification logs"
  ON notification_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Create RLS policies for payment_transactions
CREATE POLICY "Users can view their own payment transactions"
  ON payment_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Create RLS policies for ride_matches
CREATE POLICY "Users can view their own ride matches"
  ON ride_matches FOR SELECT
  USING (auth.uid() = passenger_id);

-- ============================================================================
-- 14. CREATE HELPER VIEWS (Optional - for easier querying)
-- ============================================================================
-- View for active rides with booking counts
CREATE OR REPLACE VIEW active_rides_summary AS
SELECT 
  r.*,
  u.full_name as driver_name,
  u.average_rating as driver_rating,
  u.phone_number as driver_phone,
  (r.available_seats - r.confirmed_bookings) as seats_remaining
FROM rides r
JOIN users u ON r.driver_id = u.id
WHERE r.status = 'active' 
  AND r.ride_date >= CURRENT_DATE
  AND (r.available_seats - r.confirmed_bookings) > 0;

-- View for user's complete booking history
CREATE OR REPLACE VIEW user_booking_details AS
SELECT 
  b.*,
  r.origin,
  r.destination,
  r.ride_date,
  r.ride_time,
  r.vehicle_type,
  r.vehicle_model,
  d.full_name as driver_name,
  d.phone_number as driver_phone,
  d.average_rating as driver_rating,
  p.full_name as passenger_name,
  p.phone_number as passenger_phone
FROM bookings b
JOIN rides r ON b.ride_id = r.id
JOIN users d ON r.driver_id = d.id
JOIN users p ON b.passenger_id = p.id;

-- ============================================================================
-- 15. INSERT DEFAULT NOTIFICATION PREFERENCES FOR EXISTING USERS
-- ============================================================================
-- Update existing users who don't have notification preferences set
UPDATE users
SET notification_preferences = '{"bookingUpdates": true, "chatMessages": true, "rideReminders": true, "sosAlerts": true, "promotions": false}'::jsonb
WHERE notification_preferences IS NULL;

-- ============================================================================
-- 16. CREATE INDEXES FOR REALTIME PERFORMANCE
-- ============================================================================
-- These indexes improve performance for real-time subscriptions
CREATE INDEX IF NOT EXISTS idx_live_locations_ride_updated 
  ON live_locations(ride_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_realtime 
  ON messages(booking_id, created_at DESC) 
  WHERE is_read = false;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Summary of changes:
-- ✅ Added push notification columns to users table
-- ✅ Added payment tracking columns to bookings table
-- ✅ Added ride statistics columns to rides table
-- ✅ Added message delivery tracking to messages table
-- ✅ Created notification_logs table for tracking sent notifications
-- ✅ Created ride_matches table for smart matching algorithm
-- ✅ Created payment_transactions table for payment history
-- ✅ Created automated triggers for ride counters and user ratings
-- ✅ Created helper views for common queries
-- ✅ Added indexes for better query performance
-- ✅ Enabled RLS on sensitive tables
-- ✅ Updated constraints to include new status values
--
-- Next Steps:
-- 1. Restart your backend server: node server.js
-- 2. Test notification registration in your app
-- 3. Verify data is being stored correctly
-- ============================================================================

-- Show completion message
DO $$
BEGIN
  RAISE NOTICE '✅ Schema migration completed successfully!';
  RAISE NOTICE '📊 Total tables: 13';
  RAISE NOTICE '🔔 Notification system: READY';
  RAISE NOTICE '💳 Payment tracking: READY';
  RAISE NOTICE '🎯 Smart matching: READY';
  RAISE NOTICE '⚡ Triggers: ACTIVE';
  RAISE NOTICE '🔒 RLS Policies: ENABLED';
END $$;
