-- Add is_active column to contacts table
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Update existing contacts to be active by default
UPDATE public.contacts 
SET is_active = true 
WHERE is_active IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.contacts.is_active IS 'Whether the contact is active for SOS notifications';

-- Verify the change
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'contacts' AND column_name = 'is_active';