const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { initDatabase } = require('./database/schema');
const PermissionService = require('./services/permissionService');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

let db;
let permissionService;

app.use(async (req, res, next) => {
  req.db = db;
  req.permissionService = permissionService;
  next();
});

app.use('/api/classes', require('./routes/classes'));
app.use('/api/students', require('./routes/students'));
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/enrollments', require('./routes/enrollments'));
app.use('/api/permissions', require('./routes/permissions'));
app.use('/api/logs', require('./routes/logs'));
app.use('/api/anomalies', require('./routes/anomalies'));
app.use('/api/events', require('./routes/events'));

app.use(express.static(path.join(__dirname, '../client/build')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message });
});

async function startServer() {
  try {
    const fs = require('fs');
    const dataDir = path.join(__dirname, '../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    db = await initDatabase();
    permissionService = new PermissionService(db);

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
