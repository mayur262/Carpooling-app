require('dotenv').config();
const twilioService = require('./backend/services/twilioService');

console.log('🔍 Detailed Twilio Debug Information\n');

// Reinitialize the service to ensure environment variables are loaded
twilioService.reinitialize();

// Check raw environment variables
console.log('1. Raw Environment Variables:');
console.log(`   process.env.TWILIO_ACCOUNT_SID: "${process.env.TWILIO_ACCOUNT_SID}"`);
console.log(`   process.env.TWILIO_AUTH_TOKEN: "${process.env.TWILIO_AUTH_TOKEN ? 'Set (hidden)' : 'Not set'}"`);
console.log(`   process.env.TWILIO_PHONE_NUMBER: "${process.env.TWILIO_PHONE_NUMBER}"`);

// Check service properties
console.log('\n2. TwilioService Properties:');
console.log(`   twilioService.accountSid: "${twilioService.accountSid}"`);
console.log(`   twilioService.authToken: "${twilioService.authToken ? 'Set (hidden)' : 'Not set'}"`);
console.log(`   twilioService.phoneNumber: "${twilioService.phoneNumber}"`);

// Check validation conditions
console.log('\n3. Validation Checks:');
const hasAccountSid = !!twilioService.accountSid;
const hasAuthToken = !!twilioService.authToken;
const hasPhoneNumber = !!twilioService.phoneNumber;
const accountSidValid = twilioService.accountSid && twilioService.accountSid.startsWith('AC');
const phoneNumberValid = twilioService.phoneNumber && twilioService.phoneNumber.startsWith('+');
const notPlaceholderSid = twilioService.accountSid !== 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
const notPlaceholderPhone = twilioService.phoneNumber !== '+1234567890';

console.log(`   Has Account SID: ${hasAccountSid}`);
console.log(`   Has Auth Token: ${hasAuthToken}`);
console.log(`   Has Phone Number: ${hasPhoneNumber}`);
console.log(`   Account SID starts with AC: ${accountSidValid}`);
console.log(`   Phone Number starts with +: ${phoneNumberValid}`);
console.log(`   Not placeholder SID: ${notPlaceholderSid}`);
console.log(`   Not placeholder phone: ${notPlaceholderPhone}`);

console.log('\n4. Client Initialization Check:');
console.log(`   Client initialized: ${twilioService.client ? 'Yes' : 'No'}`);

// Test validation
console.log('\n5. Validation Test:');
try {
  twilioService.validateConfig();
  console.log('   ✅ Configuration validation passed');
} catch (error) {
  console.log(`   ❌ Configuration validation failed: ${error.message}`);
}

console.log('\n6. Manual Client Test:');
if (hasAccountSid && hasAuthToken && accountSidValid) {
  try {
    const twilio = require('twilio');
    const client = twilio(twilioService.accountSid, twilioService.authToken);
    console.log('   ✅ Manual client creation successful');
  } catch (error) {
    console.log(`   ❌ Manual client creation failed: ${error.message}`);
  }
} else {
  console.log('   ⚠️  Skipping manual client test - credentials invalid');
}