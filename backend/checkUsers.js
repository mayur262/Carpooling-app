const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: __dirname + '/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkUsers() {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, full_name, email')
      .limit(5);

    if (error) {
      console.error('Error fetching users:', error);
      return;
    }

    console.log('Found users:');
    users.forEach(user => {
      console.log(`- ID: ${user.id}, Name: ${user.full_name}, Email: ${user.email}`);
    });

    if (users.length === 0) {
      console.log('No users found in database');
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

checkUsers();