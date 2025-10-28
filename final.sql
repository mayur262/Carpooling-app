-- =====================================================
-- ShareMyRide - Complete Final Database Schema
-- =====================================================
-- This file contains the complete database schema for the ShareMyRide carpooling application
-- It includes all tables, indexes, policies, functions, and triggers needed for the app
-- 
-- USAGE:
-- 1. Connect to your Supabase project
-- 2. Run this entire script in the SQL editor
-- 3. All tables, policies, and functions will be created
-- =====================================================

-- =====================================================
-- USERS TABLE (extends Supabase auth.users)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    profile_pic TEXT,
    bio TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'driver', 'both')),
    phone_number TEXT,
    average_rating DECIMAL(3,2) DEFAULT 0.00,
    total_ratings INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- =====================================================
-- RIDES TABLE for driver ride postings
-- =====================================================
CREATE TABLE IF NOT EXISTS public.rides (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    driver_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    origin TEXT NOT NULL,
    origin_coordinates POINT,
    destination TEXT NOT NULL,
    destination_coordinates POINT,
    ride_date DATE NOT NULL,
    ride_time TIME NOT NULL,
    available_seats INTEGER NOT NULL CHECK (available_seats > 0),
    price_per_seat DECIMAL(10,2) NOT NULL CHECK (price_per_seat >= 0),
    vehicle_type TEXT,
    vehicle_model TEXT,
    vehicle_plate TEXT,
    description TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- =====================================================
-- RIDE REQUESTS TABLE for passenger ride requests
-- =====================================================
CREATE TABLE IF NOT EXISTS public.ride_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    passenger_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    origin TEXT NOT NULL,
    origin_coordinates POINT,
    destination TEXT NOT NULL,
    destination_coordinates POINT,
    requested_date DATE NOT NULL,
    requested_time TIME,
    flexible_time BOOLEAN DEFAULT FALSE,
    number_of_passengers INTEGER NOT NULL CHECK (number_of_passengers > 0),
    max_price_per_person DECIMAL(10,2) CHECK (max_price_per_person >= 0),
    description TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
    accepted_by_driver UUID REFERENCES public.users(id) ON DELETE SET NULL,
    accepted_ride_id UUID REFERENCES public.rides(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- =====================================================
-- BOOKINGS TABLE for passenger ride bookings
-- =====================================================
CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ride_id UUID REFERENCES public.rides(id) ON DELETE CASCADE NOT NULL,
    passenger_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    seats_booked INTEGER NOT NULL CHECK (seats_booked > 0),
    total_price DECIMAL(10,2) NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'cancelled')),
    pickup_location TEXT,
    dropoff_location TEXT,
    pickup_coordinates POINT,
    dropoff_coordinates POINT,
    booking_notes TEXT,
    is_rated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(ride_id, passenger_id)
);

-- =====================================================
-- MESSAGES TABLE for in-app communication
-- =====================================================
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'system')),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- =====================================================
-- RATINGS TABLE for user ratings and reviews
-- =====================================================
CREATE TABLE IF NOT EXISTS public.ratings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ride_id UUID REFERENCES public.rides(id) ON DELETE CASCADE NOT NULL,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE NOT NULL,
    rater_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    ratee_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    rating_type TEXT NOT NULL CHECK (rating_type IN ('passenger_to_driver', 'driver_to_passenger')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(ride_id, rater_id, ratee_id)
);

-- =====================================================
-- NOTIFICATIONS TABLE for user notifications
-- =====================================================
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('booking', 'message', 'rating', 'ride_update')),
    is_read BOOLEAN DEFAULT FALSE,
    related_id UUID, -- Can reference booking_id, ride_id, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- =====================================================
-- LIVE LOCATIONS TABLE for real-time tracking
-- =====================================================
CREATE TABLE IF NOT EXISTS public.live_locations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(ride_id, user_id)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- Rides indexes
CREATE INDEX IF NOT EXISTS idx_rides_driver_id ON public.rides(driver_id);
CREATE INDEX IF NOT EXISTS idx_rides_status ON public.rides(status);
CREATE INDEX IF NOT EXISTS idx_rides_date ON public.rides(ride_date);
CREATE INDEX IF NOT EXISTS idx_rides_origin ON public.rides(origin);
CREATE INDEX IF NOT EXISTS idx_rides_destination ON public.rides(destination);

-- Ride requests indexes
CREATE INDEX IF NOT EXISTS idx_ride_requests_passenger_id ON public.ride_requests(passenger_id);
CREATE INDEX IF NOT EXISTS idx_ride_requests_status ON public.ride_requests(status);
CREATE INDEX IF NOT EXISTS idx_ride_requests_requested_date ON public.ride_requests(requested_date);
CREATE INDEX IF NOT EXISTS idx_ride_requests_origin ON public.ride_requests(origin);
CREATE INDEX IF NOT EXISTS idx_ride_requests_destination ON public.ride_requests(destination);

-- Bookings indexes
CREATE INDEX IF NOT EXISTS idx_bookings_ride_id ON public.bookings(ride_id);
CREATE INDEX IF NOT EXISTS idx_bookings_passenger_id ON public.bookings(passenger_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_is_rated ON public.bookings(is_rated);

-- Messages indexes
CREATE INDEX IF NOT EXISTS idx_messages_booking_id ON public.messages(booking_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);

-- Ratings indexes
CREATE INDEX IF NOT EXISTS idx_ratings_ride_id ON public.ratings(ride_id);
CREATE INDEX IF NOT EXISTS idx_ratings_ratee_id ON public.ratings(ratee_id);
CREATE INDEX IF NOT EXISTS idx_ratings_rater_id ON public.ratings(rater_id);

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at);

-- Live locations indexes
CREATE INDEX IF NOT EXISTS idx_live_locations_ride_id ON public.live_locations(ride_id);
CREATE INDEX IF NOT EXISTS idx_live_locations_user_id ON public.live_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_live_locations_updated_at ON public.live_locations(updated_at);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================
-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_locations ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------
-- USERS TABLE POLICIES
-- -----------------------------------------------------
CREATE POLICY "Users can view all user profiles" ON public.users FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

-- -----------------------------------------------------
-- RIDES TABLE POLICIES
-- -----------------------------------------------------
CREATE POLICY "Anyone can view active rides" ON public.rides FOR SELECT USING (status = 'active');
CREATE POLICY "Drivers can create rides" ON public.rides FOR INSERT WITH CHECK (auth.uid() = driver_id);
CREATE POLICY "Drivers can update their own rides" ON public.rides FOR UPDATE USING (auth.uid() = driver_id);
CREATE POLICY "Drivers can delete their own rides" ON public.rides FOR DELETE USING (auth.uid() = driver_id);

-- -----------------------------------------------------
-- RIDE REQUESTS TABLE POLICIES
-- -----------------------------------------------------
CREATE POLICY "Anyone can view pending ride requests" ON public.ride_requests FOR SELECT USING (status = 'pending');
CREATE POLICY "Passengers can view their own ride requests" ON public.ride_requests FOR SELECT USING (auth.uid() = passenger_id);
CREATE POLICY "Passengers can create ride requests" ON public.ride_requests FOR INSERT WITH CHECK (auth.uid() = passenger_id);
CREATE POLICY "Passengers can update their own ride requests" ON public.ride_requests FOR UPDATE USING (auth.uid() = passenger_id);
CREATE POLICY "Drivers can accept/reject ride requests" ON public.ride_requests FOR UPDATE USING (auth.uid() IS NOT NULL);

-- -----------------------------------------------------
-- BOOKINGS TABLE POLICIES
-- -----------------------------------------------------
CREATE POLICY "Passengers can view their own bookings" ON public.bookings FOR SELECT USING (auth.uid() = passenger_id);
CREATE POLICY "Drivers can view bookings for their rides" ON public.bookings FOR SELECT USING (auth.uid() IN (SELECT driver_id FROM public.rides WHERE public.rides.id = public.bookings.ride_id));
CREATE POLICY "Passengers can create bookings" ON public.bookings FOR INSERT WITH CHECK (auth.uid() = passenger_id);
CREATE POLICY "Drivers can update bookings for their rides" ON public.bookings FOR UPDATE USING (auth.uid() IN (SELECT driver_id FROM public.rides WHERE public.rides.id = public.bookings.ride_id));
CREATE POLICY "Users can update is_rated for their bookings" ON public.bookings FOR UPDATE USING (auth.uid() = passenger_id OR auth.uid() IN (SELECT driver_id FROM public.rides WHERE public.rides.id = public.bookings.ride_id)) WITH CHECK (auth.uid() = passenger_id OR auth.uid() IN (SELECT driver_id FROM public.rides WHERE public.rides.id = public.bookings.ride_id));

-- -----------------------------------------------------
-- MESSAGES TABLE POLICIES
-- -----------------------------------------------------
CREATE POLICY "Users can view messages in their bookings" ON public.messages FOR SELECT USING (
  auth.uid() IN (SELECT passenger_id FROM public.bookings WHERE public.bookings.id = public.messages.booking_id) OR
  auth.uid() IN (SELECT driver_id FROM public.rides WHERE public.rides.id = (SELECT ride_id FROM public.bookings WHERE public.bookings.id = public.messages.booking_id))
);
CREATE POLICY "Users can send messages in their bookings" ON public.messages FOR INSERT WITH CHECK (
  auth.uid() IN (SELECT passenger_id FROM public.bookings WHERE public.bookings.id = public.messages.booking_id) OR
  auth.uid() IN (SELECT driver_id FROM public.rides WHERE public.rides.id = (SELECT ride_id FROM public.bookings WHERE public.bookings.id = public.messages.booking_id))
);

-- -----------------------------------------------------
-- RATINGS TABLE POLICIES
-- -----------------------------------------------------
CREATE POLICY "Users can view ratings" ON public.ratings FOR SELECT USING (true);
CREATE POLICY "Users can create ratings for completed rides" ON public.ratings FOR INSERT WITH CHECK (
  auth.uid() = rater_id AND
  EXISTS (
    SELECT 1 FROM public.bookings 
    WHERE public.bookings.id = public.ratings.booking_id 
    AND public.bookings.status = 'completed'
    AND (public.bookings.passenger_id = auth.uid() OR public.bookings.passenger_id = ratee_id)
  )
);

-- -----------------------------------------------------
-- NOTIFICATIONS TABLE POLICIES
-- -----------------------------------------------------
CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- -----------------------------------------------------
-- LIVE LOCATIONS TABLE POLICIES
-- -----------------------------------------------------
CREATE POLICY "Drivers can update their own location" ON public.live_locations FOR ALL USING (
    auth.uid() = user_id AND 
    EXISTS (
        SELECT 1 FROM public.rides 
        WHERE id = public.live_locations.ride_id AND driver_id = auth.uid()
    )
);
CREATE POLICY "Passengers can view live locations" ON public.live_locations FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.bookings 
        WHERE ride_id = public.live_locations.ride_id 
        AND passenger_id = auth.uid() 
        AND status = 'approved'
    )
);

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================
-- Function to automatically update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at columns
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rides_updated_at BEFORE UPDATE ON public.rides
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ride_requests_updated_at BEFORE UPDATE ON public.ride_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON public.bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update user average rating
CREATE OR REPLACE FUNCTION update_user_average_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.users 
    SET average_rating = (
        SELECT AVG(rating)::DECIMAL(3,2) 
        FROM public.ratings 
        WHERE ratee_id = NEW.ratee_id
    ),
    total_ratings = (
        SELECT COUNT(*) 
        FROM public.ratings 
        WHERE ratee_id = NEW.ratee_id
    )
    WHERE id = NEW.ratee_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updating user rating
CREATE TRIGGER update_user_rating AFTER INSERT OR UPDATE ON public.ratings
    FOR EACH ROW EXECUTE FUNCTION update_user_average_rating();

-- Function to mark notifications as read
CREATE OR REPLACE FUNCTION mark_notification_as_read(notification_id UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.notifications 
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
    INSERT INTO public.notifications (user_id, title, message, type, related_id)
    VALUES (target_user_id, notification_title, notification_message, notification_type, related_uuid)
    RETURNING id INTO new_notification_id;
    
    RETURN new_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get unread notification count
CREATE OR REPLACE FUNCTION get_unread_notification_count(user_uuid UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*) FROM public.notifications WHERE user_id = user_uuid AND is_read = FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;
GRANT SELECT ON public.users TO anon;
GRANT SELECT, INSERT, UPDATE ON public.rides TO authenticated;
GRANT SELECT ON public.rides TO anon;
GRANT SELECT, INSERT, UPDATE ON public.ride_requests TO authenticated;
GRANT SELECT ON public.ride_requests TO anon;
GRANT SELECT, INSERT, UPDATE ON public.bookings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;
GRANT SELECT, INSERT ON public.ratings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.live_locations TO authenticated;

-- =====================================================
-- ENABLE REALTIME FOR REAL-TIME FEATURES
-- =====================================================
ALTER TABLE public.live_locations REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- =====================================================
-- TABLE RELATIONSHIPS DOCUMENTATION
-- =====================================================
-- users -> rides (one-to-many, driver_id)
-- users -> ride_requests (one-to-many, passenger_id)
-- users -> bookings (one-to-many, passenger_id)  
-- rides -> bookings (one-to-many, ride_id)
-- rides -> ride_requests (one-to-many, accepted_ride_id)
-- bookings -> messages (one-to-many, booking_id)
-- users -> messages (one-to-many, sender_id)
-- rides -> ratings (one-to-many, ride_id)
-- users -> ratings (one-to-many, ratee_id)
-- users -> notifications (one-to-many, user_id)
-- rides -> live_locations (one-to-many, ride_id)
-- users -> live_locations (one-to-many, user_id)

-- =====================================================
-- NOTIFICATION TYPES
-- =====================================================
-- 'booking' - When someone books your ride, or your booking is accepted/rejected
-- 'message' - When you receive a new message in a booking chat
-- 'rating' - When someone rates you after a ride
-- 'ride_update' - When a ride you're booked on is updated or cancelled

-- =====================================================
-- OPTIONAL: SAMPLE DATA (uncomment if needed)
-- =====================================================
/*
-- Insert sample users (these would normally be created through auth.signup)
INSERT INTO public.users (id, full_name, email, bio, role, phone_number) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'John Doe', 'john@example.com', 'I love road trips!', 'both', '+1234567890'),
('660e8400-e29b-41d4-a716-446655440001', 'Jane Smith', 'jane@example.com', 'Safe driver, love music', 'driver', '+1234567891'),
('770e8400-e29b-41d4-a716-446655440002', 'Bob Johnson', 'bob@example.com', 'New to carpooling', 'user', '+1234567892');

-- Insert sample rides
INSERT INTO public.rides (driver_id, origin, destination, ride_date, ride_time, available_seats, price_per_seat, vehicle_type, vehicle_model, description) VALUES
('660e8400-e29b-41d4-a716-446655440001', 'New York, NY', 'Boston, MA', '2024-01-15', '09:00:00', 3, 25.00, 'Sedan', 'Toyota Camry', 'Comfortable ride with music');
*/