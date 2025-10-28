const twilioService = require('./backend/services/twilioService');
require('dotenv').config();

async function checkTwilioStatus() {
  console.log('🔍 Checking Twilio Service Status...\n');

  // Check environment variables
  console.log('1. Environment Variables:');
  console.log(`   TWILIO_ACCOUNT_SID: ${process.env.TWILIO_ACCOUNT_SID ? '✅ Set' : '❌ Missing'}`);
  console.log(`   TWILIO_AUTH_TOKEN: ${process.env.TWILIO_AUTH_TOKEN ? '✅ Set' : '❌ Missing'}`);
  console.log(`   TWILIO_PHONE_NUMBER: ${process.env.TWILIO_PHONE_NUMBER ? '✅ Set' : '❌ Missing'}`);

  // Check if Twilio client is initialized
  console.log('\n2. Twilio Client Status:');
  console.log(`   Client initialized: ${twilioService.client ? '✅ Yes' : '❌ No'}`);

  // Check configuration validation
  console.log('\n3. Configuration Validation:');
  try {
    twilioService.validateConfig();
    console.log('   ✅ Configuration is valid');
  } catch (error) {
    console.log(`   ❌ Configuration error: ${error.message}`);
  }

  // Check service properties
  console.log('\n4. Service Properties:');
  console.log(`   Account SID: ${twilioService.accountSid || 'Not set'}`);
  console.log(`   Phone Number: ${twilioService.phoneNumber || 'Not set'}`);
  console.log(`   Client: ${twilioService.client ? 'Initialized' : 'Not initialized'}`);

  console.log('\n📋 Summary:');
  if (twilioService.client) {
    console.log('✅ Twilio service is properly configured and ready to use!');
  } else {
    console.log('❌ Twilio service is not configured. Please follow the setup guide in TWILIO_SETUP_GUIDE.md');
  }
}

checkTwilioStatus().catch(console.error);