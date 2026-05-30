import app from './app.js';
import { initDb } from './db.js';

initDb();

const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => {
  console.log(`Server ready on port ${PORT}`);
});

process.on('SIGTERM', () => {
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  server.close(() => {
    process.exit(0);
  });
});

export default app;
