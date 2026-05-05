const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { initDatabase } = require('./database/database');
const { seedDatabase } = require('./database/seeds');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const leadsRouter = require('./routes/leads');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    error: {
      message: '请求过于频繁，请稍后再试',
      code: 'RATE_LIMIT_EXCEEDED'
    }
  }
});

app.use('/api', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    }
  });
});

app.use('/api/leads', leadsRouter);

app.use(notFoundHandler);

app.use(errorHandler);

const startServer = async () => {
  try {
    await initDatabase();
    await seedDatabase();
    
    app.listen(PORT, () => {
      console.log(`\n======================================`);
      console.log(`  课程顾问线索管理系统`);
      console.log(`======================================`);
      console.log(`\n  后端服务已启动:`);
      console.log(`  - 服务地址: http://localhost:${PORT}`);
      console.log(`  - API地址: http://localhost:${PORT}/api`);
      console.log(`  - 健康检查: http://localhost:${PORT}/health`);
      console.log(`\n  前端地址: http://localhost:5173`);
      console.log(`\n======================================\n`);
    });
  } catch (error) {
    console.error('服务器启动失败:', error.message);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer, initDatabase };
