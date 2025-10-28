-- Fix booking status constraint to match app expectations
-- The app uses 'confirmed' but schema only allows 'approved'

-- Drop the existing constraint
ALTER TABLE public.bookings 
DROP CONSTRAINT IF EXISTS bookings_status_check;

-- Add the correct constraint that includes both 'approved' and 'confirmed'
-- We'll keep 'approved' for backward compatibility and add 'confirmed'
ALTER TABLE public.bookings 
ADD CONSTRAINT bookings_status_check 
CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'confirmed'::text, 'rejected'::text, 'completed'::text, 'cancelled'::text]));

-- Verify the constraint was updated
SELECT conname, conbin 
FROM pg_constraint 
WHERE conrelid = 'public.bookings'::regclass 
AND conname LIKE '%bookings_status_check%';

-- Test that both 'approved' and 'confirmed' work
-- These should now both work:
-- UPDATE public.bookings SET status = 'approved' WHERE id = 1;
-- UPDATE public.bookings SET status = 'confirmed' WHERE id = 1;