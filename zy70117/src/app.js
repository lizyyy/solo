const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

const bookingRoutes = require('./routes/booking');
const backgroundJob = require('./services/background-job');

app.use(express.json());

app.use('/api/bookings', bookingRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '宴会预订资源锁 API 运行中' });
});

app.get('/job-status', (req, res) => {
  res.json({
    success: true,
    data: backgroundJob.getJobStats()
  });
});

app.post('/run-job', async (req, res) => {
  try {
    await backgroundJob.runManually();
    res.json({
      success: true,
      message: '后台任务已手动触发执行'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  backgroundJob.start();
});

module.exports = app;
