import express from 'express';
import cors from 'cors';
import { initDatabase } from './db';
import studentsRouter from './routes/students';
import routesRouter from './routes/routes';
import leavesRouter from './routes/leaves';
import attendanceRouter from './routes/attendance';

const app = express();
const PORT = 4000;

initDatabase();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'School Bus Attendance API is running' });
});

app.use('/api/students', studentsRouter);
app.use('/api/routes', routesRouter);
app.use('/api/leaves', leavesRouter);
app.use('/api/attendance', attendanceRouter);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
