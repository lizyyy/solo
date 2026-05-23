const express = require('express');
const config = require('./config');
const routes = require('./routes');
const { getDatabase } = require('./database');

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api', routes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: '服务器内部错误' });
});

app.listen(config.port, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   民宿保洁排班权限追责台账服务已启动                           ║
║                                                               ║
║   服务地址: http://localhost:${config.port}                            ║
║   API 前缀: http://localhost:${config.port}/api                        ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝

快速开始:
  1. 初始化数据库: npm run init-db
  2. 查看测试命令文档: cat README.md

内置测试用户:
  - admin / 系统管理员 (admin)
  - manager1 / 张店长 (manager)
  - supervisor1 / 李主管 (supervisor)
  - staff1 / 王保洁 (staff)
  - auditor1 / 赵审计 (auditor)
`);
});

process.on('SIGINT', () => {
  console.log('\n正在关闭服务...');
  const { closeDatabase } = require('./database');
  closeDatabase();
  process.exit(0);
});

module.exports = app;
