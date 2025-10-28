-- Manual SQL script to add the missing 'relationship' column to the contacts table
-- Run this in your Supabase dashboard SQL editor

-- Add relationship column to contacts table
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS relationship TEXT;

-- Update existing contacts to have a default relationship
UPDATE public.contacts 
SET relationship = 'Emergency Contact' 
WHERE relationship IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.contacts.relationship IS 'Relationship of the contact to the user (e.g., Parent, Friend, Spouse)';

-- Verify the change
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'contacts' AND table_schema = 'public' 
ORDER BY ordinal_position;

-- Test query to verify everything works
SELECT id, name, phone, relationship, is_active 
FROM public.contacts 
LIMIT 5;