module.exports = {
  port: Number(process.env.PORT) || 3000,
  dbPath: process.env.DB_PATH || 'data/qa-reconcile.db',
  uploadDir: process.env.UPLOAD_DIR || 'data/uploads',
  reportDir: process.env.REPORT_DIR || 'data/reports',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  logLevel: process.env.LOG_LEVEL || 'info'
};
