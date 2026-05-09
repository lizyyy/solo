export const config = {
  port: process.env.PORT || 3000,
  dbPath: process.env.DB_PATH || './data/events.db',
  maxRetries: 5,
  retryDelay: 1000
};
