import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import db from './database';
import courierCompaniesRouter from './routes/courierCompanies';
import packagesRouter from './routes/packages';
import retentionRulesRouter from './routes/retentionRules';
import settlementsRouter from './routes/settlements';

const app = express();
const PORT = process.env.PORT || 3001;

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

app.use(cors());
app.use(express.json());

app.use('/api/courier-companies', courierCompaniesRouter);
app.use('/api/packages', packagesRouter);
app.use('/api/retention-rules', retentionRulesRouter);
app.use('/api/settlements', settlementsRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '乡村快递共配结算台后端服务运行正常' });
});

async function start() {
  await db.init();
  app.listen(PORT, () => {
    console.log(`🚀 后端服务已启动: http://localhost:${PORT}`);
  });
}

start().catch(console.error);
