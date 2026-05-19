const express = require('express');
const cors = require('cors');
const { initDatabase, db } = require('./database');
const routes = require('./routes');
const { createDomain } = require('./services/retentionService');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api', routes);

const initSampleData = () => {
  if (db.data_domains.length === 0) {
    const sampleDomains = [
      { name: '用户个人信息', description: '用户姓名、联系方式等个人数据', retentionDays: 1095 },
      { name: '交易记录', description: '订单、支付记录等交易数据', retentionDays: 1825 },
      { name: '行为日志', description: '用户操作、访问记录等行为数据', retentionDays: 365 },
      { name: '营销数据', description: '营销活动、用户偏好等数据', retentionDays: 730 }
    ];

    sampleDomains.forEach(domain => {
      createDomain(domain);
    });

    console.log('初始化示例数据域完成');
  }
};

initDatabase()
  .then(initSampleData)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
      console.log(`API 文档: http://localhost:${PORT}/api/health`);
    });
  })
  .catch(err => {
    console.error('数据库初始化失败:', err);
    process.exit(1);
  });
