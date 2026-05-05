module.exports = {
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || 'localhost'
  },
  database: {
    path: process.env.DB_PATH || './data/database.sqlite'
  },
  validation: {
    defaultSeverity: 'warning',
    maxIssues: 100
  },
  storage: {
    uploadDir: './uploads',
    maxFileSize: 10 * 1024 * 1024 // 10MB
  }
}