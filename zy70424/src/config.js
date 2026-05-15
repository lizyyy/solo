const path = require('path');

module.exports = {
  PORT: process.env.PORT || 3000,
  DATA_DIR: path.join(__dirname, '..', 'data'),
  UPLOAD_DIR: path.join(__dirname, '..', 'data', 'uploads'),
  CACHE_TTL: 5 * 60 * 1000,
  MAX_FILE_SIZE: 10 * 1024 * 1024,
  ALLOWED_FILE_TYPES: ['.pdf', '.doc', '.docx', '.txt', '.md']
};
