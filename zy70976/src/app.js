const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const rentalRoutes = require('./routes/rental');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api/rentals', rentalRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`服务运行在 http://localhost:${PORT}`);
  console.log('健康检查: GET /health');
});

module.exports = app;
