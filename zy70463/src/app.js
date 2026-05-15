const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const reservationRoutes = require('./routes/reservationRoutes');
const inquiryRoutes = require('./routes/inquiryRoutes');
const config = require('./config');

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/reservations', reservationRoutes);
app.use('/api/inquiries', inquiryRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '资源预留服务运行正常' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '服务器内部错误', message: err.message });
});

mongoose.connect(config.mongodb.uri, config.mongodb.options)
  .then(() => {
    console.log('MongoDB 连接成功');
    app.listen(config.server.port, () => {
      console.log(`服务器运行在 http://localhost:${config.server.port}`);
    });
  })
  .catch(err => {
    console.error('MongoDB 连接失败:', err);
    process.exit(1);
  });

module.exports = app;
