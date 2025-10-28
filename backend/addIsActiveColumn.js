// Script to add is_active column to contacts table
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function addIsActiveColumn() {
  try {
    console.log('Adding is_active column to contacts table...');
    
    // First, let's check if the column already exists by trying to select it
    const { data: existingData, error: checkError } = await supabase
      .from('contacts')
      .select('is_active')
      .limit(1);

    if (checkError && checkError.code === 'PGRST205') {
      console.log('Column does not exist, adding it...');
      
      // Use raw SQL to add the column
      const { error: alterError } = await supabase.rpc('exec_sql', {
        sql: 'ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;'
      });

      if (alterError) {
        console.error('Error adding column:', alterError);
        return;
      }

      console.log('✅ is_active column added successfully!');
      
      // Update existing records
      const { error: updateError } = await supabase
        .from('contacts')
        .update({ is_active: true })
        .is('is_active', null);

      if (updateError) {
        console.error('Error updating existing records:', updateError);
      } else {
        console.log('✅ Existing records updated with is_active = true');
      }
    } else {
      console.log('✅ is_active column already exists or table is empty');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

addIsActiveColumn();