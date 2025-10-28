const axios = require('axios');
require('dotenv').config({ path: '../.env' });

// Test the SOS endpoint with detailed error logging
async function debugSOSError() {
  console.log('🧪 Debugging SOS Error...\n');

  // Test configuration
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.31.92:3000';
  const testToken = Buffer.from(JSON.stringify({ 
    userId: 'cbca8cd0-b687-428d-b7f7-db9e6817a733', 
    email: 'test@example.com',
    phone: '+1234567890'
  })).toString('base64');

  console.log('API URL:', apiUrl);
  console.log('Test Token:', testToken);

  try {
    console.log('\n1. Testing connection to backend...');
    const healthResponse = await axios.get(`${apiUrl}/health`);
    console.log('✅ Backend is running:', healthResponse.data);

    console.log('\n2. Testing SOS endpoint...');
    const response = await axios.post(`${apiUrl}/api/sos/trigger`, {
      latitude: 37.7749,
      longitude: -122.4194,
      userPhone: '+1234567890'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testToken}`
      }
    });

    console.log('✅ SOS Response:', response.data);

  } catch (error) {
    console.log('\n❌ Error Details:');
    console.log('Error Message:', error.message);
    
    if (error.response) {
      console.log('Response Status:', error.response.status);
      console.log('Response Data:', error.response.data);
      console.log('Response Headers:', error.response.headers);
    } else if (error.request) {
      console.log('Request made but no response received');
      console.log('Request:', error.request);
    } else {
      console.log('Error setting up request:', error.message);
    }
    
    console.log('\nFull Error Stack:', error.stack);
  }
}

debugSOSError();