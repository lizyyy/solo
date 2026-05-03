const path = require('path');

const config = {
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || 'localhost'
  },
  
  database: {
    path: process.env.DB_PATH || path.join(__dirname, '..', 'data', 'checkin.db')
  },
  
  signature: {
    algorithm: 'HS256',
    secret: process.env.SIGNATURE_SECRET || 'workshop-checkin-secret-key-2024',
    expiresIn: '7d'
  },
  
  qrcode: {
    width: 256,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#ffffff'
    }
  },
  
  export: {
    formats: ['markdown', 'csv', 'json'],
    defaultFormat: 'json'
  }
};

module.exports = config;
