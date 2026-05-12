import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';
import { seedData } from './seedData.js';
import { processPendingSubscriptions, expireSubscriptions } from './services/rateService.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    name: 'API Rate Limiting Platform',
    version: '1.0.0',
    endpoints: {
      customers: '/customers',
      plans: '/plans',
      health: '/health'
    }
  });
});

app.use('/api', routes);

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

async function startServer() {
  try {
    console.log('Seeding initial data...');
    const seedResult = seedData();
    console.log('Seed result:', seedResult);

    setInterval(() => {
      try {
        const activated = processPendingSubscriptions();
        if (activated.length > 0) {
          console.log(`Processed ${activated.length} pending subscriptions`);
        }
        const expired = expireSubscriptions();
        if (expired.length > 0) {
          console.log(`Expired ${expired.length} subscriptions`);
        }
      } catch (e) {
        console.error('Error in periodic tasks:', e);
      }
    }, 60000);

    app.listen(PORT, () => {
      console.log(`API Rate Platform backend running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
