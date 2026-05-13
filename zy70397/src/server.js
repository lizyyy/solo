const express = require('express');
const { idempotencyMiddleware } = require('./middleware/idempotency');
const userController = require('./controllers/userController');
const reportController = require('./controllers/reportController');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(idempotencyMiddleware);

app.post('/api/user/profile', userController.updateUserProfile);

app.get('/api/compatibility/report', reportController.getCompatibilityReport);

app.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'API兼容性服务运行正常',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`API兼容性服务已启动: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log(`用户资料更新接口: POST http://localhost:${PORT}/api/user/profile`);
  console.log(`兼容报告接口: GET http://localhost:${PORT}/api/compatibility/report`);
});
