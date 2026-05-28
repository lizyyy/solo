/**
 * local server entry file, for local development
 */
import { initDatabase } from './db/index.js';

/**
 * Initialize database first BEFORE importing any DAO modules
 * Use dynamic import to ensure DB is ready before loading app modules
 */
async function startServer() {
  try {
    initDatabase();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  }

  // Dynamic import after DB is ready
  const { default: app } = await import('./app.js');

  /**
   * start server with port
   */
  const PORT = process.env.PORT || 3001;

  const server = app.listen(PORT, () => {
    console.log(`Server ready on port ${PORT}`);
  });

  /**
   * close server
   */
  process.on('SIGTERM', () => {
    console.log('SIGTERM signal received');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('SIGINT signal received');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
}

startServer().catch(console.error);