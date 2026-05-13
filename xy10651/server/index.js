const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const screeningRoutes = require('./routes/screenings');
const cleaningRoutes = require('./routes/cleaning');
const staffRoutes = require('./routes/staff');
const inspectionRoutes = require('./routes/inspections');
const shiftRoutes = require('./routes/shifts');
const positionRoutes = require('./routes/positions');
const reportRoutes = require('./routes/reports');

app.use('/api/screenings', screeningRoutes);
app.use('/api/cleaning', cleaningRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/inspections', inspectionRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/positions', positionRoutes);
app.use('/api/reports', reportRoutes);

app.use(express.static(path.join(__dirname, '../client/dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
