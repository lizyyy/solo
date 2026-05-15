import express from 'express';
import cors from 'cors';
import reservationRoutes from './routes/reservation';
import inventoryRoutes from './routes/inventory';
import adminRoutes from './routes/admin';
import { getDb } from './database/db';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/reservations', reservationRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/admin', adminRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, async () => {
  console.log(`Inventory Reservation State Machine running on port ${PORT}`);
  try {
    await getDb();
    console.log('Database connected successfully');
  } catch (error) {
    console.error('Database connection failed:', error);
  }
});

export default app;