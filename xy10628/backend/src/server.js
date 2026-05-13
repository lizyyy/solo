const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initDatabase } = require('./database');
const { initSampleData } = require('./sampleData');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

app.use('/api/heartbeats', require('./routes/deviceHeartbeats'));
app.use('/api/orders', require('./routes/chargingOrders'));
app.use('/api/restarts', require('./routes/remoteRestarts'));
app.use('/api/tickets', require('./routes/repairTickets'));
app.use('/api/payment-failures', require('./routes/paymentFailures'));
app.use('/api/refunds', require('./routes/refundProgress'));
app.use('/api/logs', require('./routes/operationLogs'));
app.use('/api/reports', require('./routes/reports'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const startServer = async () => {
  try {
    await initDatabase();
    await initSampleData();
    
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
