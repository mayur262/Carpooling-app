const { networkInterfaces } = require('os');
const http = require('http');

function getLocalIPAddress() {
  const interfaces = networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const interface of interfaces[name]) {
      // Skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
      if (interface.family === 'IPv4' && !interface.internal) {
        return interface.address;
      }
    }
  }
  return 'localhost';
}

function testBackendConnection(host, port = 3000) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: host,
      port: port,
      path: '/health',
      method: 'GET',
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve({ success: true, data: JSON.parse(data) });
        } else {
          resolve({ success: false, error: `Status code: ${res.statusCode}` });
        }
      });
    });

    req.on('error', (error) => {
      resolve({ success: false, error: error.message });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, error: 'Request timeout' });
    });

    req.end();
  });
}

async function main() {
  console.log('🔍 Finding your local IP address...\n');
  
  const localIP = getLocalIPAddress();
  console.log(`🖥️  Your local IP address: ${localIP}`);
  
  console.log('\n🧪 Testing backend connection...\n');
  
  // Test localhost first
  console.log('Testing localhost:3000...');
  const localhostTest = await testBackendConnection('localhost', 3000);
  if (localhostTest.success) {
    console.log('✅ Localhost connection: SUCCESS');
  } else {
    console.log('❌ Localhost connection: FAILED -', localhostTest.error);
  }
  
  // Test local IP
  if (localIP !== 'localhost') {
    console.log(`\nTesting ${localIP}:3000...`);
    const localIPTest = await testBackendConnection(localIP, 3000);
    if (localIPTest.success) {
      console.log('✅ Local IP connection: SUCCESS');
    } else {
      console.log('❌ Local IP connection: FAILED -', localIPTest.error);
    }
  }
  
  console.log('\n📋 Configuration Summary:\n');
  console.log('Update your .env file with:');
  console.log(`EXPO_PUBLIC_API_URL=http://${localIP}:3000`);
  
  console.log('\n📱 For mobile app testing:');
  console.log('1. Make sure your phone is on the same WiFi network');
  console.log(`2. Test this URL in your phone's browser: http://${localIP}:3000/health`);
  console.log('3. If it works, the SOS button should work too!');
  
  console.log('\n🌐 Alternative: Use ngrok for easier testing');
  console.log('Install: npm install -g ngrok');
  console.log('Run: ngrok http 3000');
  console.log('Then use the HTTPS URL in your .env file');
}

main().catch(console.error);