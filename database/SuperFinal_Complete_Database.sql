-- =============================================
-- SHAREMYRIDE COMPLETE DATABASE SCHEMA
-- =============================================
-- This file contains ALL database tables, policies, indexes, and constraints
-- for the ShareMyRide ride-sharing application
-- =============================================

-- =============================================
-- CORE TABLES
-- =============================================

-- Users table (managed by Supabase Auth)
-- Profiles table extends user information
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT,
    phone TEXT,
    avatar_url TEXT,
    is_driver BOOLEAN DEFAULT FALSE,
    driver_verified BOOLEAN DEFAULT FALSE,
    vehicle_info JSONB,
    license_plate TEXT,
    car_model TEXT,
    car_color TEXT,
    rating DECIMAL(3,2) DEFAULT 0.00,
    total_rides INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rides table - available rides offered by drivers
CREATE TABLE IF NOT EXISTS public.rides (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    driver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    start_location TEXT NOT NULL,
    end_location TEXT NOT NULL,
    start_latitude DECIMAL(10,8) NOT NULL,
    start_longitude DECIMAL(11,8) NOT NULL,
    end_latitude DECIMAL(10,8) NOT NULL,
    end_longitude DECIMAL(11,8) NOT NULL,
    departure_time TIMESTAMP WITH TIME ZONE NOT NULL,
    available_seats INTEGER NOT NULL CHECK (available_seats > 0),
    price_per_seat DECIMAL(10,2) NOT NULL CHECK (price_per_seat >= 0),
    vehicle_type TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bookings table - passenger bookings for rides
CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ride_id UUID REFERENCES public.rides(id) ON DELETE CASCADE,
    passenger_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    seats_booked INTEGER NOT NULL CHECK (seats_booked > 0),
    total_price DECIMAL(10,2) NOT NULL CHECK (total_price >= 0),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'pending_confirmation', 'pending_completion')),
    pickup_location TEXT,
    dropoff_location TEXT,
    pickup_latitude DECIMAL(10,8),
    pickup_longitude DECIMAL(11,8),
    dropoff_latitude DECIMAL(10,8),
    dropoff_longitude DECIMAL(11,8),
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    payment_intent_id TEXT,
    stripe_payment_id TEXT,
    payment_method_id TEXT,
    fare_breakdown JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages table - chat messages between users
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications table - user notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- SOS FEATURE TABLES
-- =============================================

-- Emergency contacts table
CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    push_token TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SOS events table - records of emergency alerts
CREATE TABLE IF NOT EXISTS public.sos_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    trip_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'cancelled', 'sent', 'partially_sent', 'failed')),
    sms_results JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- RIDE REQUESTS & OFFERS
-- =============================================

-- Ride requests from passengers
CREATE TABLE IF NOT EXISTS public.ride_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    passenger_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    start_location TEXT NOT NULL,
    end_location TEXT NOT NULL,
    start_latitude DECIMAL(10,8) NOT NULL,
    start_longitude DECIMAL(11,8) NOT NULL,
    end_latitude DECIMAL(10,8) NOT NULL,
    end_longitude DECIMAL(11,8) NOT NULL,
    departure_time TIMESTAMP WITH TIME ZONE NOT NULL,
    seats_needed INTEGER NOT NULL CHECK (seats_needed > 0),
    budget DECIMAL(10,2) CHECK (budget >= 0),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- RATINGS & REVIEWS
-- =============================================

-- Ride ratings and reviews
CREATE TABLE IF NOT EXISTS public.ratings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
    ride_id UUID REFERENCES public.rides(id) ON DELETE CASCADE,
    reviewer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    reviewee_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- NOTIFICATION PREFERENCES
-- =============================================

CREATE TABLE IF NOT EXISTS public.notification_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email_alerts BOOLEAN DEFAULT true,
    sms_alerts BOOLEAN DEFAULT false,
    push_alerts BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_driver ON public.profiles(is_driver);
CREATE INDEX IF NOT EXISTS idx_profiles_rating ON public.profiles(rating);

-- Rides indexes
CREATE INDEX IF NOT EXISTS idx_rides_driver ON public.rides(driver_id);
CREATE INDEX IF NOT EXISTS idx_rides_status ON public.rides(status);
CREATE INDEX IF NOT EXISTS idx_rides_departure ON public.rides(departure_time);
CREATE INDEX IF NOT EXISTS idx_rides_locations ON public.rides(start_location, end_location);

-- Bookings indexes
CREATE INDEX IF NOT EXISTS idx_bookings_ride ON public.bookings(ride_id);
CREATE INDEX IF NOT EXISTS idx_bookings_passenger ON public.bookings(passenger_id);
CREATE INDEX IF NOT EXISTS idx_bookings_driver ON public.bookings(driver_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_payment ON public.bookings(payment_status);

-- Messages indexes
CREATE INDEX IF NOT EXISTS idx_messages_booking ON public.messages(booking_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON public.messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON public.messages(created_at);

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at);

-- SOS indexes
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON public.contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON public.contacts(email);
CREATE INDEX IF NOT EXISTS idx_sos_events_user_id ON public.sos_events(user_id);
CREATE INDEX IF NOT EXISTS idx_sos_events_trip_id ON public.sos_events(trip_id);
CREATE INDEX IF NOT EXISTS idx_sos_events_status ON public.sos_events(status);
CREATE INDEX IF NOT EXISTS idx_sos_events_timestamp ON public.sos_events(created_at);

-- Ride requests indexes
CREATE INDEX IF NOT EXISTS idx_ride_requests_passenger ON public.ride_requests(passenger_id);
CREATE INDEX IF NOT EXISTS idx_ride_requests_status ON public.ride_requests(status);

-- Ratings indexes
CREATE INDEX IF NOT EXISTS idx_ratings_booking ON public.ratings(booking_id);
CREATE INDEX IF NOT EXISTS idx_ratings_reviewee ON public.ratings(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_ratings_rating ON public.ratings(rating);

-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sos_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PROFILES POLICIES
-- =============================================

-- Users can view all profiles
CREATE POLICY "Anyone can view profiles" ON public.profiles
    FOR SELECT USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- =============================================
-- RIDES POLICIES
-- =============================================

-- Anyone can view active rides
CREATE POLICY "Anyone can view active rides" ON public.rides
    FOR SELECT USING (status = 'active');

-- Drivers can view their own rides (all statuses)
CREATE POLICY "Drivers can view own rides" ON public.rides
    FOR SELECT USING (auth.uid() = driver_id);

-- Drivers can create rides
CREATE POLICY "Drivers can create rides" ON public.rides
    FOR INSERT WITH CHECK (auth.uid() = driver_id);

-- Drivers can update their own rides
CREATE POLICY "Drivers can update own rides" ON public.rides
    FOR UPDATE USING (auth.uid() = driver_id);

-- Drivers can delete their own rides
CREATE POLICY "Drivers can delete own rides" ON public.rides
    FOR DELETE USING (auth.uid() = driver_id);

-- =============================================
-- BOOKINGS POLICIES
-- =============================================

-- Users can view their own bookings
CREATE POLICY "Users can view own bookings" ON public.bookings
    FOR SELECT USING (auth.uid() = passenger_id OR auth.uid() = driver_id);

-- Users can create bookings
CREATE POLICY "Users can create bookings" ON public.bookings
    FOR INSERT WITH CHECK (auth.uid() = passenger_id);

-- Drivers can update bookings for their rides
CREATE POLICY "Drivers can update ride bookings" ON public.bookings
    FOR UPDATE USING (auth.uid() = driver_id);

-- Passengers can update their own bookings
CREATE POLICY "Passengers can update own bookings" ON public.bookings
    FOR UPDATE USING (auth.uid() = passenger_id);

-- =============================================
-- MESSAGES POLICIES
-- =============================================

-- Users can view messages where they are sender or receiver
CREATE POLICY "Users can view chat messages" ON public.messages
    FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Users can send messages
CREATE POLICY "Users can send messages" ON public.messages
    FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- =============================================
-- NOTIFICATIONS POLICIES
-- =============================================

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications" ON public.notifications
    FOR SELECT USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications" ON public.notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- System can create notifications for users
CREATE POLICY "System can create notifications" ON public.notifications
    FOR INSERT WITH CHECK (true);

-- =============================================
-- SOS FEATURE POLICIES
-- =============================================

-- Users can view their own contacts
CREATE POLICY "Users can view own contacts" ON public.contacts
    FOR SELECT USING (auth.uid() = user_id);

-- Users can create their own contacts
CREATE POLICY "Users can create own contacts" ON public.contacts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own contacts
CREATE POLICY "Users can update own contacts" ON public.contacts
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own contacts
CREATE POLICY "Users can delete own contacts" ON public.contacts
    FOR DELETE USING (auth.uid() = user_id);

-- Users can view their own SOS events
CREATE POLICY "Users can view own SOS events" ON public.sos_events
    FOR SELECT USING (auth.uid() = user_id);

-- Users can create SOS events
CREATE POLICY "Users can create SOS events" ON public.sos_events
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =============================================
-- RIDE REQUESTS POLICIES
-- =============================================

-- Users can view their own ride requests
CREATE POLICY "Users can view own ride requests" ON public.ride_requests
    FOR SELECT USING (auth.uid() = passenger_id);

-- Users can create ride requests
CREATE POLICY "Users can create ride requests" ON public.ride_requests
    FOR INSERT WITH CHECK (auth.uid() = passenger_id);

-- Users can update their own ride requests
CREATE POLICY "Users can update own ride requests" ON public.ride_requests
    FOR UPDATE USING (auth.uid() = passenger_id);

-- Users can delete their own ride requests
CREATE POLICY "Users can delete own ride requests" ON public.ride_requests
    FOR DELETE USING (auth.uid() = passenger_id);

-- =============================================
-- RATINGS POLICIES
-- =============================================

-- Users can view ratings for rides they participated in
CREATE POLICY "Users can view ride ratings" ON public.ratings
    FOR SELECT USING (auth.uid() = reviewer_id OR auth.uid() = reviewee_id);

-- Users can create ratings for completed rides
CREATE POLICY "Users can create ratings" ON public.ratings
    FOR INSERT WITH CHECK (auth.uid() = reviewer_id);

-- =============================================
-- NOTIFICATION PREFERENCES POLICIES
-- =============================================

-- Users can view their own preferences
CREATE POLICY "Users can view own preferences" ON public.notification_preferences
    FOR SELECT USING (auth.uid() = user_id);

-- Users can manage their own preferences
CREATE POLICY "Users can manage own preferences" ON public.notification_preferences
    FOR ALL USING (auth.uid() = user_id);

-- =============================================
-- FUNCTIONS & TRIGGERS
-- =============================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rides_updated_at BEFORE UPDATE ON public.rides
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON public.bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_preferences_updated_at BEFORE UPDATE ON public.notification_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to increment ride counters
CREATE OR REPLACE FUNCTION increment_ride_counters()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' THEN
        UPDATE public.profiles 
        SET total_rides = total_rides + 1 
        WHERE id = NEW.driver_id;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for ride completion counter
CREATE TRIGGER increment_ride_counter
    AFTER UPDATE ON public.rides
    FOR EACH ROW
    WHEN (OLD.status != 'completed' AND NEW.status = 'completed')
    EXECUTE FUNCTION increment_ride_counters();

-- =============================================
-- SAMPLE DATA INSERTION QUERIES
-- =============================================

-- Example: Add emergency contact
-- INSERT INTO public.contacts (user_id, name, phone, email) 
-- VALUES ('user-uuid', 'Emergency Contact Name', '+1234567890', 'emergency@example.com');

-- Example: Create SOS event
-- INSERT INTO public.sos_events (user_id, trip_id, latitude, longitude, status)
-- VALUES ('user-uuid', 'trip-uuid', 37.7749, -122.4194, 'active');

-- Example: Insert notification preferences
-- INSERT INTO public.notification_preferences (user_id, email_alerts, sms_alerts, push_alerts)
-- VALUES ('user-uuid', true, false, true);

-- =============================================
-- GRANTS AND PERMISSIONS
-- =============================================

-- Grant necessary permissions to authenticated users
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Grant select permissions to anon users (for public data)
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.rides TO anon;
GRANT SELECT ON public.bookings TO anon;

-- =============================================
-- REALTIME SUBSCRIPTIONS
-- =============================================

-- Enable realtime for key tables
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.bookings REPLICA IDENTITY FULL;
ALTER TABLE public.rides REPLICA IDENTITY FULL;
ALTER TABLE public.sos_events REPLICA IDENTITY FULL;

-- =============================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================

COMMENT ON TABLE public.profiles IS 'User profiles extending auth.users with ride-sharing specific data';
COMMENT ON TABLE public.rides IS 'Available rides offered by drivers';
COMMENT ON TABLE public.bookings IS 'Passenger bookings for rides';
COMMENT ON TABLE public.messages IS 'Chat messages between users in bookings';
COMMENT ON TABLE public.notifications IS 'User notifications system';
COMMENT ON TABLE public.contacts IS 'Emergency contacts for SOS feature';
COMMENT ON TABLE public.sos_events IS 'SOS emergency events with location data';
COMMENT ON TABLE public.ride_requests IS 'Ride requests from passengers to drivers';
COMMENT ON TABLE public.ratings IS 'User ratings and reviews for completed rides';
COMMENT ON TABLE public.notification_preferences IS 'User preferences for notification delivery';

-- =============================================
-- VERIFICATION QUERIES
-- =============================================

-- Check all tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check all indexes
SELECT tablename, indexname FROM pg_indexes 
WHERE schemaname = 'public' 
ORDER BY tablename, indexname;

-- Check all policies
SELECT tablename, policyname FROM pg_policies 
ORDER BY tablename, policyname;

-- Check table row counts
SELECT 
    schemaname,
    tablename,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes,
    n_live_tup as live_rows
FROM pg_stat_user_tables 
WHERE schemaname = 'public'
ORDER BY tablename;