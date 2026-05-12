const express = require('express');
const path = require('path');
const errorHandler = require('./middleware/errorHandler');
const claimRoutes = require('./routes/claimRoutes');
const materialRoutes = require('./routes/materialRoutes');
const reminderRoutes = require('./routes/reminderRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/claims', claimRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/reminders', reminderRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '保险理赔材料补齐 API 服务正常运行',
    timestamp: new Date().toISOString()
  });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`
=========================================
  保险理赔材料补齐 API 服务
  服务地址: http://localhost:${PORT}
  健康检查: http://localhost:${PORT}/api/health
  启动时间: ${new Date().toLocaleString()}
=========================================
  `);
});

module.exports = app;
