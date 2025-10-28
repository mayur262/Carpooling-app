// Test script to check contacts table structure
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function testContactsTable() {
  try {
    console.log('Testing contacts table structure...');
    
    // Try to select with is_active column
    const { data, error } = await supabase
      .from('contacts')
      .select('id, name, phone, email, is_active')
      .limit(1);

    if (error) {
      console.error('❌ Error selecting contacts with is_active:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      
      // Try without is_active to see if table exists
      const { data: basicData, error: basicError } = await supabase
        .from('contacts')
        .select('id, name, phone, email')
        .limit(1);
        
      if (basicError) {
        console.error('❌ Even basic contacts select failed:', basicError);
      } else {
        console.log('✅ Basic contacts table exists:', basicData);
        console.log('❌ But is_active column is missing');
      }
    } else {
      console.log('✅ Contacts table with is_active column:', data);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testContactsTable();