-- Fix RLS policies to allow proper ride management
-- This addresses the "new row violates row-level security policy" errors

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Anyone can view active rides" ON rides;
DROP POLICY IF EXISTS "Drivers can update their own rides" ON rides;

-- Create more permissive policies for rides
CREATE POLICY "Anyone can view rides" ON rides FOR SELECT USING (true);
CREATE POLICY "Drivers can update their own rides" ON rides FOR UPDATE USING (auth.uid() = driver_id);

-- Allow drivers to update ride status (including cancellation)
CREATE POLICY "Drivers can update ride status" ON rides FOR UPDATE USING (
  auth.uid() = driver_id OR 
  auth.uid() IN (SELECT passenger_id FROM bookings WHERE ride_id = rides.id)
);

-- Fix bookings policies to allow status updates
DROP POLICY IF EXISTS "Drivers can update bookings for their rides" ON bookings;
DROP POLICY IF EXISTS "Passengers can view their own bookings" ON bookings;

-- More permissive booking policies
CREATE POLICY "Users can view relevant bookings" ON bookings FOR SELECT USING (
  auth.uid() = passenger_id OR 
  auth.uid() IN (SELECT driver_id FROM rides WHERE rides.id = bookings.ride_id)
);

CREATE POLICY "Users can update relevant bookings" ON bookings FOR UPDATE USING (
  auth.uid() = passenger_id OR 
  auth.uid() IN (SELECT driver_id FROM rides WHERE rides.id = bookings.ride_id)
);

-- Allow passengers to update their own bookings (for cancellation, rating status)
CREATE POLICY "Passengers can update their bookings" ON bookings FOR UPDATE USING (auth.uid() = passenger_id);