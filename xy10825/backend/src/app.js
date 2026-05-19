const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const invoiceRoutes = require('./routes/invoiceRoutes');
const { errorHandler } = require('./middleware/errorHandler');
const invoiceService = require('./services/invoiceService');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api/invoices', invoiceRoutes);

app.use(errorHandler);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const TIMEOUT_CHECK_INTERVAL = 60 * 1000;
let timeoutCheckJob = null;

function startTimeoutCheck() {
  if (timeoutCheckJob) clearInterval(timeoutCheckJob);
  timeoutCheckJob = setInterval(() => {
    const timeoutInvoices = invoiceService.checkTimeoutInvoices();
    if (timeoutInvoices.length > 0) {
      console.log(`[自动超时检查] 发现 ${timeoutInvoices.length} 个超时单据，已标记为待复核`);
    }
  }, TIMEOUT_CHECK_INTERVAL);
  console.log(`[定时任务] 自动超时检查已启动，间隔${TIMEOUT_CHECK_INTERVAL / 1000}秒`);
}

const server = app.listen(PORT, () => {
  console.log(`发票回调复核台后端服务运行在端口 ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
  startTimeoutCheck();
});

process.on('SIGTERM', () => {
  if (timeoutCheckJob) clearInterval(timeoutCheckJob);
  server.close(() => console.log('服务已关闭'));
});

module.exports = app;
