import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { responseHandler } from './middleware/responseHandler';
import { idempotentMiddleware } from './middleware/idempotent';
import studentsRouter from './routes/students';
import attendanceRouter from './routes/attendance';
import examScoresRouter from './routes/examScores';
import retakeRecordsRouter from './routes/retakeRecords';
import certificatesRouter from './routes/certificates';
import historyRouter from './routes/history';
import statisticsRouter from './routes/statistics';
import exportRouter from './routes/export';
import { db } from './database';
import sampleData from './sampleData';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json());
app.use(responseHandler);

app.use('/api/students', studentsRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/exam-scores', examScoresRouter);
app.use('/api/retake-records', retakeRecordsRouter);
app.use('/api/certificates', certificatesRouter);
app.use('/api/history', historyRouter);
app.use('/api/statistics', statisticsRouter);
app.use('/api/export', exportRouter);

app.post('/api/idempotent-test', idempotentMiddleware, (req, res) => {
  res.success({ message: '幂等测试成功' });
});

sampleData.initialize();

app.listen(PORT, () => {
  console.log(`培训证书资格发放系统后端服务已启动: http://localhost:${PORT}`);
});
