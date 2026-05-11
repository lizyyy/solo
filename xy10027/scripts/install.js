// Post-install script - creates logs directory
const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, '../logs');

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
  console.log('Created logs directory');
}
