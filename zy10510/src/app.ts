import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import arbitrationRoutes from './routes/arbitrationRoutes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'field-caliber-arbitration-api'
  });
});

app.use('/api/arbitration', arbitrationRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
