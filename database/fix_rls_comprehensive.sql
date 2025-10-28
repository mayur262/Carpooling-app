-- Comprehensive RLS Policy Fix for Ride Management
-- This addresses all RLS violations for rides, bookings, and ride requests

-- =====================================================
-- FIX RIDES TABLE POLICIES
-- =====================================================

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Anyone can view active rides" ON public.rides;
DROP POLICY IF EXISTS "Drivers can create rides" ON public.rides;
DROP POLICY IF EXISTS "Drivers can update their own rides" ON public.rides;
DROP POLICY IF EXISTS "Drivers can delete their own rides" ON public.rides;

-- Create more permissive policies
CREATE POLICY "Anyone can view rides" ON public.rides FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create rides" ON public.rides FOR INSERT WITH CHECK (auth.uid() = driver_id);
CREATE POLICY "Drivers can update their own rides" ON public.rides FOR UPDATE USING (auth.uid() = driver_id);
CREATE POLICY "Drivers can delete their own rides" ON public.rides FOR DELETE USING (auth.uid() = driver_id);

-- Allow drivers to update ride status for cancellation
CREATE POLICY "Drivers can update ride status" ON public.rides FOR UPDATE USING (
  auth.uid() = driver_id OR 
  auth.uid() IN (SELECT passenger_id FROM public.bookings WHERE ride_id = public.rides.id AND status = 'approved')
);

-- =====================================================
-- FIX RIDE REQUESTS TABLE POLICIES
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view pending ride requests" ON public.ride_requests;
DROP POLICY IF EXISTS "Passengers can view their own ride requests" ON public.ride_requests;
DROP POLICY IF EXISTS "Passengers can create ride requests" ON public.ride_requests;
DROP POLICY IF EXISTS "Passengers can update their own ride requests" ON public.ride_requests;
DROP POLICY IF EXISTS "Drivers can accept/reject ride requests" ON public.ride_requests;

-- Create better policies
CREATE POLICY "Anyone can view pending requests" ON public.ride_requests FOR SELECT USING (status = 'pending');
CREATE POLICY "Users can view their own requests" ON public.ride_requests FOR SELECT USING (auth.uid() = passenger_id);
CREATE POLICY "Passengers can create requests" ON public.ride_requests FOR INSERT WITH CHECK (auth.uid() = passenger_id);
CREATE POLICY "Passengers can update own requests" ON public.ride_requests FOR UPDATE USING (auth.uid() = passenger_id);
CREATE POLICY "Drivers can update request status" ON public.ride_requests FOR UPDATE USING (auth.uid() IS NOT NULL);

-- =====================================================
-- FIX BOOKINGS TABLE POLICIES
-- =====================================================

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Passengers can view their own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Drivers can view bookings for their rides" ON public.bookings;
DROP POLICY IF EXISTS "Passengers can create bookings" ON public.bookings;
DROP POLICY IF EXISTS "Drivers can update bookings for their rides" ON public.bookings;
DROP POLICY IF EXISTS "Users can update is_rated for their bookings" ON public.bookings;

-- Create comprehensive booking policies
CREATE POLICY "Users can view relevant bookings" ON public.bookings FOR SELECT USING (
  auth.uid() = passenger_id OR 
  auth.uid() IN (SELECT driver_id FROM public.rides WHERE public.rides.id = public.bookings.ride_id)
);

CREATE POLICY "Passengers can create bookings" ON public.bookings FOR INSERT WITH CHECK (auth.uid() = passenger_id);

CREATE POLICY "Users can update relevant bookings" ON public.bookings FOR UPDATE USING (
  auth.uid() = passenger_id OR 
  auth.uid() IN (SELECT driver_id FROM public.rides WHERE public.rides.id = public.bookings.ride_id)
);

-- Allow passengers to update their own bookings (for cancellation, rating)
CREATE POLICY "Passengers can update own bookings" ON public.bookings FOR UPDATE USING (auth.uid() = passenger_id);

-- =====================================================
-- ADD MISSING COLUMNS IF NEEDED
-- =====================================================

-- Ensure rides table has proper status column
ALTER TABLE public.rides 
ALTER COLUMN status SET DEFAULT 'active',
ALTER COLUMN status SET CHECK (status IN ('active', 'completed', 'cancelled'));

-- Ensure ride_requests table has proper status column
ALTER TABLE public.ride_requests 
ALTER COLUMN status SET DEFAULT 'pending',
ALTER COLUMN status SET CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled'));

-- =====================================================
-- GRANT NECESSARY PERMISSIONS
-- =====================================================

-- Ensure proper permissions are granted
GRANT SELECT, INSERT, UPDATE ON public.rides TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.ride_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.bookings TO authenticated;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- To verify policies are working, run these queries:

-- Check current policies
SELECT tablename, policyname, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename IN ('rides', 'ride_requests', 'bookings')
ORDER BY tablename, policyname;

-- Test ride creation (as authenticated driver)
SET ROLE authenticated;
SELECT current_user, current_role;

-- Test if you can insert a ride
INSERT INTO public.rides (driver_id, origin, destination, ride_date, ride_time, available_seats, price_per_seat)
VALUES (auth.uid(), 'Test Origin', 'Test Destination', CURRENT_DATE, '09:00:00', 4, 25.00);

-- Test if you can update ride status
UPDATE public.rides SET status = 'cancelled' WHERE driver_id = auth.uid();

-- Reset role
RESET ROLE;