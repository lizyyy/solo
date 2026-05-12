const express = require('express');
const cors = require('cors');

const { initDB } = require('./models/database');
const { createTables } = require('./models/schema');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', routes);

app.use(errorHandler);

async function startServer() {
  try {
    console.log('Initializing database...');
    await initDB();
    
    console.log('Creating tables...');
    createTables();
    
    app.listen(PORT, () => {
      console.log('\n========================================');
      console.log('  公益捐赠票据 API 系统启动成功');
      console.log('========================================');
      console.log(`Server running on: http://localhost:${PORT}`);
      console.log(`API Base URL: http://localhost:${PORT}/api`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
      console.log('========================================\n');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
