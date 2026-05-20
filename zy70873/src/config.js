const path = require('path');

module.exports = {
  port: process.env.PORT || 3000,
  uploadDir: path.join(__dirname, '../data/uploads'),
  dataDir: path.join(__dirname, '../data'),
  supportedFileTypes: {
    csv: ['text/csv', 'application/csv'],
    json: ['application/json']
  },
  maxFileSize: 10 * 1024 * 1024
};
