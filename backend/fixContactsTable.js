// Script to fix contacts table by adding is_active column
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function fixContactsTable() {
  try {
    console.log('Fixing contacts table - adding is_active column...');
    
    // Use the SQL endpoint to add the column
    const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        'apikey': process.env.SUPABASE_SERVICE_KEY
      },
      body: JSON.stringify({
        query: `
          ALTER TABLE public.contacts 
          ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
          
          UPDATE public.contacts 
          SET is_active = true 
          WHERE is_active IS NULL;
          
          COMMENT ON COLUMN public.contacts.is_active IS 'Whether the contact is active for SOS notifications';
        `
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ SQL execution failed:', response.status, errorText);
      return;
    }

    console.log('✅ Contacts table fixed successfully!');
    
    // Verify the fix
    const { data, error } = await supabase
      .from('contacts')
      .select('id, name, is_active')
      .limit(1);

    if (error) {
      console.error('❌ Verification failed:', error);
    } else {
      console.log('✅ Verification successful:', data);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fixContactsTable();