require('dotenv').config();

const express = require('express');
const { connectDB } = require('./config/db');
const { errorHandler, notFound } = require('./middleware/error');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/equipment', require('./routes/equipment'));
app.use('/api/hours', require('./routes/hours'));
app.use('/api/maintenance', require('./routes/maintenance'));
app.use('/api/skip', require('./routes/skip'));
app.use('/api/maintenance', require('./routes/catchup'));
app.use('/api/downtime', require('./routes/downtime'));
app.use('/api/query', require('./routes/query'));

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '设备保养超期 API 运行正常',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  await connectDB();
  
  app.listen(PORT, () => {
    console.log(`服务器运行在端口 ${PORT}`);
  });
};

startServer().catch(err => {
  console.error('服务器启动失败:', err);
  process.exit(1);
});

module.exports = app;
