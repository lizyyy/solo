const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { sequelize } = require('./models');

const roomsRouter = require('./routes/rooms');
const devicesRouter = require('./routes/devices');
const interpretersRouter = require('./routes/interpreters');
const conferencesRouter = require('./routes/conferences');
const channelsRouter = require('./routes/channels');
const schedulesRouter = require('./routes/schedules');
const reportsRouter = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

app.use('/api/rooms', roomsRouter);
app.use('/api/devices', devicesRouter);
app.use('/api/interpreters', interpretersRouter);
app.use('/api/conferences', conferencesRouter);
app.use('/api/channels', channelsRouter);
app.use('/api/schedules', schedulesRouter);
app.use('/api/reports', reportsRouter);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Conference Interpreter API is running' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: err.message || 'Internal server error'
    }
  });
});

async function startServer() {
  try {
    const fs = require('fs');
    const path = require('path');
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    await sequelize.sync({ force: false });
    console.log('Database synchronized');

    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
      console.log('API endpoints:');
      console.log('  - Rooms:        http://localhost:3000/api/rooms');
      console.log('  - Devices:      http://localhost:3000/api/devices');
      console.log('  - Interpreters: http://localhost:3000/api/interpreters');
      console.log('  - Conferences:  http://localhost:3000/api/conferences');
      console.log('  - Channels:     http://localhost:3000/api/channels');
      console.log('  - Schedules:    http://localhost:3000/api/schedules');
      console.log('  - Reports:      http://localhost:3000/api/reports/dashboard');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
