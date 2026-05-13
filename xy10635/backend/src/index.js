const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const caseRoutes = require('./routes/caseRoutes');
const lawyerRoutes = require('./routes/lawyerRoutes');
const idempotencyMiddleware = require('./middleware/idempotency');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(idempotencyMiddleware);

app.use('/api/cases', caseRoutes);
app.use('/api/lawyers', lawyerRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '法律咨询冲突分派系统运行正常' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: '服务器错误',
    message: '发生未知错误'
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: '未找到',
    message: '请求的资源不存在'
  });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
