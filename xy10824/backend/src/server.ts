import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import reservationRoutes from './routes/reservation';
import inventoryRoutes from './routes/inventory';
import adminRoutes from './routes/admin';
import { getDb } from './database/db';
import { StateMachineService } from './services/StateMachineService';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const TIMEOUT_SCAN_INTERVAL = process.env.TIMEOUT_SCAN_INTERVAL 
  ? parseInt(process.env.TIMEOUT_SCAN_INTERVAL) 
  : 60000;

app.use(cors());
app.use(express.json());

app.use('/api/reservations', reservationRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/admin', adminRoutes);

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    autoTimeoutScan: 'enabled',
    scanIntervalMs: TIMEOUT_SCAN_INTERVAL
  });
});

let timeoutScanInterval: NodeJS.Timeout | null = null;

function startTimeoutScanner() {
  const stateMachineService = new StateMachineService();
  
  console.log(`Starting automatic timeout scanner (interval: ${TIMEOUT_SCAN_INTERVAL}ms)`);
  
  timeoutScanInterval = setInterval(async () => {
    try {
      const processedCount = await stateMachineService.processTimeoutTasks();
      if (processedCount > 0) {
        console.log(`[${new Date().toISOString()}] Auto timeout scanner processed ${processedCount} expired reservations`);
      }
    } catch (error) {
      console.error('Error in timeout scanner:', error);
    }
  }, TIMEOUT_SCAN_INTERVAL);
}

function stopTimeoutScanner() {
  if (timeoutScanInterval) {
    clearInterval(timeoutScanInterval);
    timeoutScanInterval = null;
    console.log('Timeout scanner stopped');
  }
}

const server = app.listen(PORT, async () => {
  console.log(`Inventory Reservation State Machine running on port ${PORT}`);
  try {
    await getDb();
    console.log('Database connected successfully');
    startTimeoutScanner();
  } catch (error) {
    console.error('Database connection failed:', error);
  }
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  stopTimeoutScanner();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  stopTimeoutScanner();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;