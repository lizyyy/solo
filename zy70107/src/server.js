const express = require('express');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const boatsRoute = require('./routes/boats');
const crewRoute = require('./routes/crew');
const noFishingZonesRoute = require('./routes/noFishingZones');
const declarationsRoute = require('./routes/declarations');
const statsRoute = require('./routes/stats');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/boats', boatsRoute);
app.use('/api/crew', crewRoute);
app.use('/api/no-fishing-zones', noFishingZonesRoute);
app.use('/api/declarations', declarationsRoute);
app.use('/api/stats', statsRoute);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`渔船出港申报 API 服务已启动: http://localhost:${PORT}`);
});

module.exports = app;
