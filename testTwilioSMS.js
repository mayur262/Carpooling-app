require('dotenv').config();
const twilioService = require('./backend/services/twilioService');
const { createClient } = require('@supabase/supabase-js');

// Reinitialize the service to ensure environment variables are loaded
twilioService.reinitialize();

async function testTwilioSMS() {
  console.log('🧪 Testing Twilio SMS Service...\n');

  try {
    // Test 1: Check Twilio configuration
    console.log('1. Checking Twilio configuration...');
    try {
      twilioService.validateConfig();
      console.log('✅ Twilio configuration is valid');
    } catch (configError) {
      console.log('❌ Twilio configuration error:', configError.message);
      console.log('\n🔧 Please check your .env file and ensure you have:');
      console.log('   - TWILIO_ACCOUNT_SID (starts with AC)');
      console.log('   - TWILIO_AUTH_TOKEN');
      console.log('   - TWILIO_PHONE_NUMBER (starts with +)');
      return;
    }

    // Test 2: Test with a sample contact
    console.log('\n2. Testing SMS sending with sample data...');
    
    const sampleContacts = [
      {
        name: 'Test Contact',
        phone: '+12345678901', // Replace with your test phone number
        relationship: 'Emergency Contact'
      }
    ];

    const userName = 'Test User';
    const latitude = 37.7749;
    const longitude = -122.4194;
    const userPhone = '+1234567890';

    console.log('Sending SOS alert to test contact...');
    
    try {
      const result = await twilioService.sendSOSAlert(
        userName,
        sampleContacts,
        latitude,
        longitude,
        userPhone
      );

      console.log('✅ SMS sent successfully!');
      console.log('Result:', JSON.stringify(result, null, 2));

    } catch (smsError) {
      console.log('❌ SMS sending failed:', smsError.message);
      console.log('Error details:', smsError);
    }

    // Test 3: Test message formatting
    console.log('\n3. Testing message formatting...');
    const location = { latitude: 37.7749, longitude: -122.4194, accuracy: 10 };
    const message = twilioService.createSOSMessage('Test User', location, '+1234567890');
    console.log('Generated message:');
    console.log(message);

    // Test 4: Test phone number formatting
    console.log('\n4. Testing phone number formatting...');
    const testNumbers = [
      '1234567890',
      '123-456-7890',
      '(123) 456-7890',
      '+1 123 456 7890',
      '+11234567890'
    ];

    testNumbers.forEach(number => {
      const formatted = twilioService.formatPhoneNumber(number);
      console.log(`${number} -> ${formatted}`);
    });

    console.log('\n✅ Twilio service test completed!');

  } catch (error) {
    console.error('❌ Unexpected error during testing:', error);
    console.error('Error details:', error.message);
  }
}

// Run the test
testTwilioSMS().catch(console.error);