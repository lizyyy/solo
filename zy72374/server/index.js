const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const sensorRoutes = require('./routes/sensors');
const photoRoutes = require('./routes/photos');
const noteRoutes = require('./routes/notes');
const heatLoadRoutes = require('./routes/heatLoads');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/sensors', sensorRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/heat-loads', heatLoadRoutes);
app.use('/api/heat-load', heatLoadRoutes);

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: '游泳池换热负荷系统运行正常'
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`游泳池换热负荷系统已启动，端口: ${PORT}`);
  console.log(`http://localhost:${PORT}`);
});

module.exports = app;
