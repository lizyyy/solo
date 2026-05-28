import app from './app.js';
import { initDatabase } from './db/init.js';
import { insertSampleData } from './db/sampleData.js';

const PORT = process.env.PORT || 3001;

initDatabase();

try {
  insertSampleData();
} catch (e) {
  console.error('Error inserting sample data:', e);
}

const server = app.listen(PORT, () => {
  console.log(`Server ready on port ${PORT}`);
  console.log(`API: http://localhost:${PORT}/api`);
  console.log(`Health: http://localhost:${PORT}/api/health`);
});

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
