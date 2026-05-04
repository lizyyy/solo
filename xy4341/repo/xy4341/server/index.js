const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { initDatabase } = require('./database/db');

const floorsRouter = require('./routes/floors');
const exitsRouter = require('./routes/exits');
const personsRouter = require('./routes/persons');
const drillsRouter = require('./routes/drills');
const exportsRouter = require('./routes/exports');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api/floors', floorsRouter);
app.use('/api/exits', exitsRouter);
app.use('/api/persons', personsRouter);
app.use('/api/drills', drillsRouter);
app.use('/api/exports', exportsRouter);

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Fire Evacuation Simulator API is running',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/reset', async (req, res) => {
  try {
    const fs = require('fs');
    const DB_PATH = path.join(__dirname, 'data', 'fire_drill.db');
    
    if (fs.existsSync(DB_PATH)) {
      fs.unlinkSync(DB_PATH);
    }
    
    await initDatabase();
    
    res.json({
      success: true,
      message: 'Database reset successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

async function startServer() {
  try {
    await initDatabase();
    console.log('Database initialized successfully');
    
    app.listen(PORT, () => {
      console.log(`Fire Evacuation Simulator Server is running on port ${PORT}`);
      console.log(`API endpoint: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
