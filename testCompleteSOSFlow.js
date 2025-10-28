const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const twilioService = require('./backend/services/twilioService');

// Reinitialize the service to ensure environment variables are loaded
twilioService.reinitialize();

// Test configuration
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testCompleteSOSFlow() {
  console.log('🧪 Testing Complete SOS Flow...\n');

  try {
    // Step 1: Check Twilio configuration
    console.log('1. Checking Twilio configuration...');
    try {
      twilioService.validateConfig();
      console.log('✅ Twilio is properly configured');
    } catch (error) {
      console.log('❌ Twilio configuration error:', error.message);
      console.log('   Please follow the TWILIO_SETUP_GUIDE.md to set up Twilio');
      return;
    }

    // Step 2: Test Twilio SMS directly
    console.log('\n2. Testing Twilio SMS service directly...');
    const testContacts = [
      {
        name: 'Test Emergency Contact',
        phone: '+12345678901', // Replace with a real number you can receive SMS on
        relationship: 'Emergency Contact'
      }
    ];

    try {
      const smsResult = await twilioService.sendSOSAlert(
        'Test User',
        testContacts,
        37.7749,
        -122.4194,
        '+1234567890'
      );
      console.log('✅ SMS sent successfully:', JSON.stringify(smsResult, null, 2));
    } catch (smsError) {
      console.log('❌ SMS sending failed:', smsError.message);
      console.log('   This might be due to trial account limitations or invalid phone number');
    }

    // Step 3: Test API endpoint (if server is running)
    console.log('\n3. Testing SOS API endpoint...');
    const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';
    
    try {
      const response = await fetch(`${apiUrl}/api/sos/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'Test Twilio integration'
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ API endpoint is accessible:', result);
      } else {
        console.log('⚠️  API endpoint returned error:', response.status);
      }
    } catch (apiError) {
      console.log('⚠️  Could not reach API endpoint:', apiError.message);
      console.log('   Make sure your server is running with: npm run dev');
    }

    console.log('\n✅ Complete SOS flow test finished!');
    console.log('\n📋 Next Steps:');
    console.log('1. Set up a real Twilio account with valid credentials');
    console.log('2. Add emergency contacts with valid phone numbers');
    console.log('3. Test the SOS button in your app');
    console.log('4. Verify SMS messages are received by emergency contacts');

  } catch (error) {
    console.error('❌ Unexpected error during testing:', error);
  }
}

// Run the test
testCompleteSOSFlow().catch(console.error);