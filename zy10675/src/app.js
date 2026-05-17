const express = require('express');
const { config, validateConfig } = require('./config');
const { initDatabase, db } = require('./database');
const qualificationRoutes = require('./routes/qualificationRoutes');

const app = express();

validateConfig();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/qualifications', qualificationRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '社群运营后台群活动资格补录 API 运行正常' });
});

function seedTestData() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      const members = [
        { member_id: 'M001', member_name: '张三', group_id: 'G001', group_name: 'VIP会员群', is_in_group: 1 },
        { member_id: 'M002', member_name: '李四', group_id: 'G001', group_name: 'VIP会员群', is_in_group: 1 },
        { member_id: 'M003', member_name: '王五', group_id: 'G001', group_name: 'VIP会员群', is_in_group: 0 },
        { member_id: 'M004', member_name: '赵六', group_id: 'G002', group_name: '普通用户群', is_in_group: 1 }
      ];

      const activities = [
        { activity_id: 'A001', activity_name: '2024年春节活动', description: '春节抽奖活动' },
        { activity_id: 'A002', activity_name: '周年庆活动', description: '会员周年庆' }
      ];

      const memberStmt = db.prepare(`INSERT OR IGNORE INTO members (member_id, member_name, group_id, group_name, is_in_group) VALUES (?, ?, ?, ?, ?)`);
      members.forEach(m => {
        memberStmt.run(m.member_id, m.member_name, m.group_id, m.group_name, m.is_in_group);
      });
      memberStmt.finalize();

      const activityStmt = db.prepare(`INSERT OR IGNORE INTO activities (activity_id, activity_name, description) VALUES (?, ?, ?)`);
      activities.forEach(a => {
        activityStmt.run(a.activity_id, a.activity_name, a.description);
      });
      activityStmt.finalize();

      resolve();
    });
  });
}

async function startServer() {
  try {
    await initDatabase();
    await seedTestData();
    
    app.listen(config.port, () => {
      console.log(`社群运营后台群活动资格补录 API 已启动`);
      console.log(`服务端口: ${config.port}`);
      console.log(`数据库路径: ${config.dbPath}`);
      console.log(`健康检查: http://localhost:${config.port}/api/health`);
    });
  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
}

startServer();
