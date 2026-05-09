const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const connectDB = require('./config/database');
const logRoutes = require('./routes/logRoutes');
const replayRoutes = require('./routes/replayRoutes');
const reportRoutes = require('./routes/reportRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const exportsDir = path.join(__dirname, '../exports');
if (!fs.existsSync(exportsDir)) {
  fs.mkdirSync(exportsDir, { recursive: true });
}

connectDB();

app.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    timestamp: new Date().toISOString(),
    status: 'running'
  });
});

app.use('/api/logs', logRoutes);
app.use('/api/replay', replayRoutes);
app.use('/api/reports', reportRoutes);

app.use('/exports', express.static(exportsDir));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

app.listen(PORT, () => {
  console.log(`Log Analyzer API running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
