import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import './database';
import {
  createBooking,
  checkInBooking,
  releaseLateBooking,
  extendBooking,
  changeRoom,
  completeBooking,
  cancelBooking,
  checkRoomAvailability
} from './services/bookingService';
import {
  getAllStores,
  getAllRooms,
  getAllCustomers,
  getBookings,
  getBookingById,
  getStatusLogs,
  getStatistics,
  addRevenueRecord
} from './services/dataService';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

app.get('/api/stores', async (req, res) => {
  try {
    const stores = await getAllStores();
    res.json(stores);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/rooms', async (req, res) => {
  try {
    const { storeId } = req.query;
    const rooms = await getAllRooms(storeId as string);
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/customers', async (req, res) => {
  try {
    const customers = await getAllCustomers();
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/bookings', async (req, res) => {
  try {
    const { storeId, roomId, status, startDate, endDate, customerName, customerPhone } = req.query;
    const params: any = {};
    if (storeId) params.storeId = storeId;
    if (roomId) params.roomId = roomId;
    if (status) params.status = Array.isArray(status) ? status : [status];
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (customerName) params.customerName = customerName;
    if (customerPhone) params.customerPhone = customerPhone;
    
    const bookings = await getBookings(params);
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/bookings/:id', async (req, res) => {
  try {
    const booking = await getBookingById(req.params.id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    res.json(booking);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/bookings/:id/logs', async (req, res) => {
  try {
    const logs = await getStatusLogs(req.params.id);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/bookings', async (req, res) => {
  try {
    const booking = await createBooking(req.body);
    res.status(201).json(booking);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.post('/api/bookings/:id/checkin', async (req, res) => {
  try {
    const booking = await checkInBooking(req.params.id);
    res.json(booking);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.post('/api/bookings/:id/release-late', async (req, res) => {
  try {
    const booking = await releaseLateBooking(req.params.id);
    res.json(booking);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.post('/api/bookings/:id/extend', async (req, res) => {
  try {
    const { extendMinutes } = req.body;
    const booking = await extendBooking(req.params.id, extendMinutes);
    res.json(booking);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.post('/api/bookings/:id/change-room', async (req, res) => {
  try {
    const { newRoomId } = req.body;
    const booking = await changeRoom(req.params.id, newRoomId);
    res.json(booking);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.post('/api/bookings/:id/complete', async (req, res) => {
  try {
    const booking = await completeBooking(req.params.id);
    res.json(booking);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.post('/api/bookings/:id/cancel', async (req, res) => {
  try {
    const { reason } = req.body;
    const booking = await cancelBooking(req.params.id, reason);
    res.json(booking);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.get('/api/rooms/:roomId/availability', async (req, res) => {
  try {
    const { startTime, endTime, excludeBookingId } = req.query;
    const isAvailable = await checkRoomAvailability(
      req.params.roomId,
      startTime as string,
      endTime as string,
      excludeBookingId as string
    );
    res.json({ available: isAvailable });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/statistics', async (req, res) => {
  try {
    const { start, end } = req.query;
    let dateRange: { start: string; end: string } | undefined;
    
    if (start && end) {
      dateRange = { start: start as string, end: end as string };
    }
    
    const stats = await getStatistics(dateRange);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/revenue', async (req, res) => {
  try {
    const record = await addRevenueRecord(req.body);
    res.status(201).json(record);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
