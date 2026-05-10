const path = require('path');
const fs = require('fs');

const defaultConfig = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  paymentWindowSeconds: parseInt(process.env.PAYMENT_WINDOW_SECONDS || '1800', 10),
  dbPath: process.env.DB_PATH || './data/tickets.db',
  cronPaymentTimeout: process.env.CRON_PAYMENT_TIMEOUT || '*/5 * * * *',
  cronQueueProcess: process.env.CRON_QUEUE_PROCESS || '*/2 * * * *',
  maxRetryAttempts: 5,
  retryDelayMs: 1000,
};

const configPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(configPath)) {
  const envContent = fs.readFileSync(configPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    if (line.trim() && !line.startsWith('#')) {
      const [key, ...values] = line.split('=');
      if (key && values.length > 0) {
        process.env[key.trim()] = values.join('=').trim();
      }
    }
  });
}

module.exports = {
  ...defaultConfig,
  paymentWindowSeconds: parseInt(process.env.PAYMENT_WINDOW_SECONDS || defaultConfig.paymentWindowSeconds, 10),
  dbPath: process.env.DB_PATH || defaultConfig.dbPath,
  cronPaymentTimeout: process.env.CRON_PAYMENT_TIMEOUT || defaultConfig.cronPaymentTimeout,
  cronQueueProcess: process.env.CRON_QUEUE_PROCESS || defaultConfig.cronQueueProcess,
};
