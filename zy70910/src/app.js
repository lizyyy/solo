const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: '新能源对账服务运行正常',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

module.exports = app;
