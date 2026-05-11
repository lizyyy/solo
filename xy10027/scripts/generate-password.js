const bcrypt = require('bcryptjs');

const password = process.argv[2] || 'password123';

bcrypt.hash(password, 10, (err, hash) => {
  if (err) {
    console.error('Error generating hash:', err);
    process.exit(1);
  }
  
  console.log(`Password: ${password}`);
  console.log(`Hash: ${hash}`);
  console.log(`\nUse this in SQL:`);
  console.log(`'${hash}'`);
});
