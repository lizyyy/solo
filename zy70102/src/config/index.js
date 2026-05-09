const path = require('path');

module.exports = {
  server: {
    port: process.env.PORT || 3000,
  },
  database: {
    path: path.join(__dirname, '../../data/pump-audit.db'),
  },
  receipt: {
    timeoutSeconds: 30,
  },
};
