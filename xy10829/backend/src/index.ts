import express from 'express';
import cors from 'cors';
import { initDatabase } from './database';
import routes from './routes';
import { startRetryScanner, stopRetryScanner } from './services';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.post('/webhook/notify', (req, res) => {
  console.log('Received webhook notify:', JSON.stringify(req.body, null, 2));
  res.json({ status: 'success', message: 'Notification received' });
});

app.post('/webhook/alert', (req, res) => {
  console.log('Received webhook alert:', JSON.stringify(req.body, null, 2));
  res.json({ status: 'success', message: 'Alert received' });
});

app.use('/api', routes);

async function startServer() {
  try {
    await initDatabase();
    const server = app.listen(PORT, () => {
      console.log(`SLA Callback Station Server is running on port ${PORT}`);
      console.log(`API endpoint: http://localhost:${PORT}/api`);
      console.log(`Test webhooks available at: http://localhost:${PORT}/webhook/notify and /alert`);
    });
    
    startRetryScanner();

    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully');
      stopRetryScanner();
      server.close(() => process.exit(0));
    });

    process.on('SIGINT', () => {
      console.log('SIGINT received, shutting down gracefully');
      stopRetryScanner();
      server.close(() => process.exit(0));
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
