import express from 'express';
import * as path from 'path';
import ledgerRouter from './api/ledger';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/api', ledgerRouter);

app.get('/api/download/:filename', (req, res) => {
  const exportDir = path.join(process.cwd(), 'data', 'exported');
  const filePath = path.join(exportDir, req.params.filename);
  res.download(filePath, (err) => {
    if (err) {
      res.status(404).json({ success: false, error: '文件不存在' });
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`充电桩巡检权限追责台账 API 服务已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
});

export default app;
