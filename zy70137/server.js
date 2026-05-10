const express = require('express');
const path = require('path');
const frequencyRoutes = require('./routes/frequency');
const messageRoutes = require('./routes/message');
const activityRoutes = require('./routes/activity');
const statisticsRoutes = require('./routes/statistics');
const compensationRoutes = require('./routes/compensation');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/api/rules', frequencyRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/statistics', statisticsRoutes);
app.use('/api/compensation', compensationRoutes);

app.get('/', (req, res) => {
  res.json({
    message: '推送频控后端服务运行中',
    service: '推送频控后端服务',
    docs: {
      '/api/rules': '频控规则管理',
      '/api/messages': '消息发送与频控检查',
      '/api/activities': '活动管理',
      '/api/statistics': '发送统计',
      '/api/compensation': '失败补偿'
    }
  });
});

app.listen(PORT, () => {
  console.log(`推送频控后端服务已启动: http://localhost:${PORT}`);
});
