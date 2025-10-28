-- Test Realtime Messages Functionality
-- Run these tests to verify realtime messaging is working correctly

-- Test 1: Check if realtime is enabled for messages table
SELECT 
    schemaname,
    tablename,
    pubname,
    attname
FROM pg_publication_tables 
WHERE tablename = 'messages';

-- Test 2: Check RLS policies for messages
SELECT 
    polname,
    polcmd,
    polqual,
    polwithcheck
FROM pg_policies 
WHERE tablename = 'messages';

-- Test 3: Check if publication exists for realtime
SELECT * FROM pg_publication WHERE pubname LIKE '%messages%';

-- Test 4: Test message visibility between users
-- This simulates what the RLS policy should allow
WITH test_booking AS (
    SELECT b.id as booking_id, b.passenger_id, r.driver_id
    FROM bookings b
    JOIN rides r ON b.ride_id = r.id
    WHERE b.id = 'your_test_booking_id' -- Replace with actual booking ID
)
SELECT 
    'Passenger can see messages' as test_case,
    EXISTS (
        SELECT 1 FROM messages m
        WHERE m.booking_id = (SELECT booking_id FROM test_booking)
        AND auth.uid() = (SELECT passenger_id FROM test_booking)
    ) as result
UNION ALL
SELECT 
    'Driver can see messages' as test_case,
    EXISTS (
        SELECT 1 FROM messages m
        WHERE m.booking_id = (SELECT booking_id FROM test_booking)
        AND auth.uid() = (SELECT driver_id FROM test_booking)
    ) as result;

-- Test 5: Check replication identity
SELECT 
    schemaname,
    tablename,
    replident
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relname = 'messages';

-- Test 6: Verify realtime subscription can work
-- This checks if the channel setup is correct
SELECT 
    'Booking channel exists' as test,
    EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE tablename = 'messages'
    ) as result
UNION ALL
SELECT 
    'RLS allows message access' as test,
    EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'messages' 
        AND polcmd = 'SELECT'
    ) as result;