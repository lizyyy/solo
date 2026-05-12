const express = require('express');
const config = require('./config');
const Database = require('./database');
const HealthChecker = require('./healthChecker');
const NotificationService = require('./notificationService');
const routes = require('./routes');

class App {
  constructor() {
    this.app = express();
    this.db = null;
    this.healthChecker = null;
    this.notificationService = null;
    this.server = null;
  }

  async init() {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    this.db = new Database(config.database.path);
    await this.db.init();

    this.notificationService = new NotificationService(config.notification, this.db);
    this.healthChecker = new HealthChecker(config.healthCheck, this.db, this.notificationService);
    
    this.app.use((req, res, next) => {
      req.db = this.db;
      req.healthChecker = this.healthChecker;
      req.notificationService = this.notificationService;
      next();
    });

    this.app.use('/', routes);

    this.app.use((err, req, res, next) => {
      console.error('Error:', err);
      res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
      });
    });
  }

  async start() {
    await this.init();
    
    this.server = this.app.listen(config.server.port, () => {
      console.log(`Server running on port ${config.server.port}`);
      console.log(`Health checker API ready`);
    });

    await this.healthChecker.start();
  }

  async stop() {
    if (this.healthChecker) {
      await this.healthChecker.stop();
    }
    if (this.server) {
      this.server.close();
    }
    if (this.db) {
      await this.db.close();
    }
  }
}

const app = new App();

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await app.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await app.stop();
  process.exit(0);
});

app.start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

module.exports = App;