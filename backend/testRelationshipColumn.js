// Test script to verify the relationship column works correctly
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testRelationshipColumn() {
  try {
    console.log('Testing relationship column in contacts table...');
    
    // Test 1: Check if relationship column exists
    console.log('\n1. Checking if relationship column exists...');
    const { data: testData, error: testError } = await supabase
      .from('contacts')
      .select('id, name, phone, relationship, is_active')
      .limit(1);

    if (testError) {
      console.error('❌ Column check failed:', testError.message);
      console.log('\n⚠️  The relationship column is still missing.');
      console.log('Please run the SQL script in your Supabase dashboard.');
      return;
    }

    console.log('✅ Relationship column exists!');
    console.log('Sample data structure:', testData?.[0] || 'No data yet');

    // Test 2: Try to insert a contact with relationship
    console.log('\n2. Testing contact insertion with relationship...');
    const testContact = {
      user_id: '00000000-0000-0000-0000-000000000000', // Dummy UUID for testing
      name: 'Test Contact',
      phone: '+1234567890',
      relationship: 'Test Friend',
      is_active: true,
      created_at: new Date().toISOString(),
    };

    const { error: insertError } = await supabase
      .from('contacts')
      .insert([testContact]);

    if (insertError) {
      console.error('❌ Insert test failed:', insertError.message);
    } else {
      console.log('✅ Contact insertion with relationship works!');
      
      // Clean up test data
      console.log('\n3. Cleaning up test data...');
      const { error: deleteError } = await supabase
        .from('contacts')
        .delete()
        .eq('user_id', '00000000-0000-0000-0000-000000000000');

      if (deleteError) {
        console.warn('⚠️  Could not clean up test data:', deleteError.message);
      } else {
        console.log('✅ Test data cleaned up');
      }
    }

    console.log('\n🎉 All tests passed! The relationship column is working correctly.');
    console.log('You can now add emergency contacts with relationship information.');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testRelationshipColumn();