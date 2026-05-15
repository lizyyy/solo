import express from 'express';
import cors from 'cors';
import { initDatabase } from './database';
import routes from './routes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api', routes);

async function startServer() {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log(`SLA Callback Station Server is running on port ${PORT}`);
      console.log(`API endpoint: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
