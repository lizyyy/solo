import express from 'express';
import cors from 'cors';
import routes from './routes';
import { database } from './database';

const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    console.log('Initializing database...');
    await database.init();
    console.log('Database initialized successfully');

    const app = express();

    app.use(cors());
    app.use(express.json());

    app.use('/api', routes);

    app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: Date.now() });
    });

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`API endpoint: http://localhost:${PORT}/api`);
    });

    process.on('SIGINT', () => {
      console.log('\nShutting down gracefully...');
      database.close();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\nShutting down gracefully...');
      database.close();
      process.exit(0);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
