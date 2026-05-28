/**
 * local server entry file, for local development
 */
import app from './app.js';
import { initDatabase } from './db/init.js';
import { seedDemoData } from './db/seed.js';

/**
 * Initialize database and seed data
 */
console.log('Initializing database...');
initDatabase();
console.log('Database initialized.');

console.log('Seeding demo data...');
try {
  seedDemoData();
} catch (error) {
  console.warn('Seed data warning:', (error as Error).message);
}
console.log('Demo data ready.');

/**
 * start server with port
 */
const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => {
  console.log(`Server ready on port ${PORT}`);
  console.log(`API: http://localhost:${PORT}/api`);
  console.log(`Health: http://localhost:${PORT}/api/health`);
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

export default app;
