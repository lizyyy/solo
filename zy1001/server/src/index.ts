import express from 'express';
import cors from 'cors';
import ticketsRouter from './routes/tickets';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/tickets', ticketsRouter);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server is running', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Ticket System Server is running on port ${PORT}`);
  console.log(`API: http://localhost:${PORT}/api`);
});
