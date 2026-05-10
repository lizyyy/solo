module.exports = {
  port: process.env.PORT || 3000,
  db: {
    path: process.env.DB_PATH || './data/tickets.db'
  },
  limit: {
    perIdCard: 2,
    perAccount: 4,
    perPayment: 2
  },
  risk: {
    maxOrdersPerHour: 10,
    maxQueuePerUser: 3
  },
  compensation: {
    maxRetries: 5,
    retryDelayMs: 60000
  }
};
