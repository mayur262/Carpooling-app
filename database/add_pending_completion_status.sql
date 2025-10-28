-- idempotent: allow 'pending_completion' in bookings.status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'pending_completion'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'booking_status')
  ) THEN
    EXECUTE 'ALTER TYPE booking_status ADD VALUE ''pending_completion'' ';
  END IF;
END
$$;