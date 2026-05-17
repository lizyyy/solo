import 'reflect-metadata';
import express from 'express';
import { DataSource } from 'typeorm';
import { Survey } from './models/Survey';
import { QuotaGroup } from './models/QuotaGroup';
import { Sample } from './models/Sample';
import { ResampleReason } from './models/ResampleReason';
import { OperationLog } from './models/OperationLog';
import surveyRoutes from './routes/surveys';
import quotaRoutes from './routes/quotas';
import sampleRoutes from './routes/samples';
import resampleRoutes from './routes/resamples';

export const AppDataSource = new DataSource({
  type: 'sqlite',
  database: './survey_quota.db',
  entities: [Survey, QuotaGroup, Sample, ResampleReason, OperationLog],
  synchronize: true,
  logging: false,
});

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/surveys', surveyRoutes);
app.use('/api/quotas', quotaRoutes);
app.use('/api/samples', sampleRoutes);
app.use('/api/resamples', resampleRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function bootstrap() {
  try {
    await AppDataSource.initialize();
    console.log('Database connected successfully');
    
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  bootstrap();
}

export default app;