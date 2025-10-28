-- Add ride counters to users (idempotent)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS rides_offered INT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS rides_taken   INT NOT NULL DEFAULT 0;