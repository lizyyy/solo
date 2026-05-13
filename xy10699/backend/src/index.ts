import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import releaseRequestRoutes from './routes/releaseRequest';
import affectedServiceRoutes from './routes/affectedService';
import approvalOpinionRoutes from './routes/approvalOpinion';
import grayBatchRoutes from './routes/grayBatch';
import rollbackActionRoutes from './routes/rollbackAction';
import releaseReportRoutes from './routes/releaseReport';
import statisticsRoutes from './routes/statistics';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cloud-release-approval')
  .then(() => console.log('MongoDB connected successfully'))
  .catch((err) => console.error('MongoDB connection error:', err));

app.use('/api/release-requests', releaseRequestRoutes);
app.use('/api/affected-services', affectedServiceRoutes);
app.use('/api/approval-opinions', approvalOpinionRoutes);
app.use('/api/gray-batches', grayBatchRoutes);
app.use('/api/rollback-actions', rollbackActionRoutes);
app.use('/api/release-reports', releaseReportRoutes);
app.use('/api/statistics', statisticsRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
