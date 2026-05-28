/**
 * local server entry file, for local development
 */
import app from './app.js';

const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => {
  console.log(`Server ready on port ${PORT}`);
  console.log(`API Routes:`);
  console.log(`  GET    /api/health`);
  console.log(`  GET    /api/galleries`);
  console.log(`  POST   /api/galleries`);
  console.log(`  GET    /api/galleries/:id`);
  console.log(`  PUT    /api/galleries/:id`);
  console.log(`  DELETE /api/galleries/:id`);
  console.log(`  GET    /api/light-sources`);
  console.log(`  POST   /api/light-sources`);
  console.log(`  GET    /api/artworks`);
  console.log(`  POST   /api/artworks`);
  console.log(`  GET    /api/samplings`);
  console.log(`  POST   /api/samplings`);
  console.log(`  GET    /api/exhibitions`);
  console.log(`  POST   /api/exhibitions`);
  console.log(`  GET    /api/reports`);
  console.log(`  POST   /api/reports`);
  console.log(`  GET    /api/risks`);
  console.log(`  POST   /api/risks`);
  console.log(`  POST   /api/risks/detect`);
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