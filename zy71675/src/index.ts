import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import { AppDataSource } from './data-source';
import routes from './routes';

const PORT = process.env.PORT || 3000;

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api', routes);

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

AppDataSource.initialize()
  .then(() => {
    console.log('Database connected successfully');
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
      console.log(`API Documentation:`);
      console.log(`  GET /api/health - Health check`);
      console.log(`  GET /api/tracks - List all tracks`);
      console.log(`  POST /api/tracks - Create track`);
      console.log(`  GET /api/tracks/:id - Get track details`);
      console.log(`  GET /api/tracks/:id/trace - Get full delivery trace`);
      console.log(`  GET /api/platform-specs - List platform specs`);
      console.log(`  POST /api/platform-specs - Create platform spec`);
      console.log(`  GET /api/delivery-reports - List delivery reports`);
      console.log(`  POST /api/delivery-reports - Create delivery report`);
      console.log(`  GET /api/delivery-reports/:id/export - Export single report as CSV`);
      console.log(`  GET /api/delivery-reports/export/all - Export all reports as CSV`);
      console.log(`  POST /api/delivery-reports/:id/validate - Validate delivery report`);
      console.log(`  POST /api/delivery-reports/:id/approve - Approve delivery report`);
      console.log(`  POST /api/delivery-reports/:id/reject - Reject delivery report`);
      console.log(`  POST /api/delivery-reports/:id/deliver - Mark as delivered`);
      console.log(`  GET /api/anomalies - List anomalies`);
      console.log(`  GET /api/anomalies/summary - Get anomaly summary`);
      console.log(`  POST /api/anomalies/scan - Scan for all anomalies`);
      console.log(`  GET /api/audit/tracks/:trackId - Get full audit history for a track`);
      console.log(`  GET /api/audit/recent - Get recent changes`);
    });
  })
  .catch((error) => {
    console.error('Error connecting to database:', error);
    process.exit(1);
  });
