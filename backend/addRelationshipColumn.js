// Script to add relationship column to contacts table using direct SQL
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in environment variables');
  console.log('Please ensure SUPABASE_URL and SUPABASE_SERVICE_KEY are set in your .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addRelationshipColumn() {
  try {
    console.log('Adding relationship column to contacts table...');
    
    // First, let's check if the column already exists
    const { data: existingData, error: checkError } = await supabase
      .from('contacts')
      .select('relationship')
      .limit(1);

    if (!checkError) {
      console.log('✅ Relationship column already exists!');
      console.log('Test query successful:', existingData);
      return;
    }

    console.log('Column check failed (expected if column doesn\'t exist):', checkError.message);
    console.log('Proceeding to add the column...');

    // Since we can't use exec_sql, let's try a different approach
    // We'll create a simple test to verify the column exists after manual addition
    console.log('\n⚠️  Please run the following SQL in your Supabase dashboard:');
    console.log('--- Copy and paste this SQL ---');
    console.log('ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS relationship TEXT;');
    console.log('UPDATE public.contacts SET relationship = \'Emergency Contact\' WHERE relationship IS NULL;');
    console.log('COMMENT ON COLUMN public.contacts.relationship IS \'Relationship of the contact to the user (e.g., Parent, Friend, Spouse)\';');
    console.log('--- End of SQL ---\n');

    console.log('After running the SQL above, this feature will work correctly.');
    console.log('The relationship column allows storing how the contact is related to the user.');

  } catch (error) {
    console.error('❌ Error in script:', error);
    process.exit(1);
  }
}

// Run the script
addRelationshipColumn();