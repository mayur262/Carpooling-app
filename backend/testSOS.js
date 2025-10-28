// Test script for SOS functionality
const twilioService = require('./services/twilioService');

async function testSOS() {
  console.log('Testing SOS functionality...');
  
  // Test configuration validation
  console.log('\n1. Testing configuration validation:');
  try {
    const validation = twilioService.validateConfiguration();
    console.log('Configuration validation:', validation);
  } catch (error) {
    console.log('Configuration error:', error.message);
  }
  
  // Test message creation
  console.log('\n2. Testing message creation:');
  const testLocation = {
    latitude: 37.7749,
    longitude: -122.4194,
    accuracy: 10
  };
  
  const message = twilioService.createSOSMessage('John Doe', testLocation);
  console.log('Generated message:');
  console.log(message);
  
  // Test phone number formatting
  console.log('\n3. Testing phone number formatting:');
  const testNumbers = [
    '5551234567',
    '(555) 123-4567',
    '+15551234567',
    '555-123-4567'
  ];
  
  testNumbers.forEach(number => {
    const formatted = twilioService.formatPhoneNumber(number);
    console.log(`${number} -> ${formatted}`);
  });
  
  console.log('\n✅ Test completed!');
}

// Run the test
testSOS().catch(console.error);