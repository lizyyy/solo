require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/tax_attachment_service',
  logLevel: process.env.LOG_LEVEL || 'info',
  uploadDir: './uploads'
};
