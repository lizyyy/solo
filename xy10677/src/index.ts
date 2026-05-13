import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { initDatabase } from './database/init';
import { DatabaseService } from './services/database';
import { TreatmentService } from './services/treatment';
import { createPatientRouter } from './routes/patients';
import { createBatchRouter } from './routes/batches';
import { createAppointmentRouter } from './routes/appointments';
import { createTodoRouter } from './routes/todos';
import { createExceptionRouter } from './routes/exceptions';
import { createReportRouter } from './routes/reports';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

async function startServer() {
  try {
    const db = await initDatabase();
    const dbService = new DatabaseService(db);
    const treatmentService = new TreatmentService(dbService);

    app.use('/api/patients', createPatientRouter(treatmentService, dbService));
    app.use('/api/batches', createBatchRouter(treatmentService, dbService));
    app.use('/api/appointments', createAppointmentRouter(treatmentService, dbService));
    app.use('/api/todos', createTodoRouter(treatmentService));
    app.use('/api/exceptions', createExceptionRouter(treatmentService));
    app.use('/api/reports', createReportRouter(treatmentService));

    app.post('/api/check-overdue', async (req, res) => {
      try {
        const overdue = await treatmentService.checkOverdueAppointments();
        res.json({ success: true, data: { count: overdue.length, appointments: overdue } });
      } catch (error) {
        res.status(500).json({ success: false, error: (error as Error).message });
      }
    });

    app.get('/api/health', (req, res) => {
      res.json({ success: true, message: 'Orthodontic Treatment System API is running' });
    });

    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
