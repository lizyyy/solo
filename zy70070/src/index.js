const express = require('express');
const bodyParser = require('body-parser');
const config = require('../config.json');
const { initDb } = require('./db/database');

const dormRoutes = require('./routes/dorm.routes');
const transferRoutes = require('./routes/transfers.routes');
const feeRoutes = require('./routes/fees.routes');
const accessRoutes = require('./routes/access.routes');
const historyRoutes = require('./routes/history.routes');
const adminRoutes = require('./routes/admin.routes');

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'campus-dorm-transfer-service',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/dorm', dormRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/fees', feeRoutes);
app.use('/api/access', accessRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/admin', adminRoutes);

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    success: false, 
    message: '服务器内部错误',
    error: err.message 
  });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: '接口不存在' });
});

const startServer = () => {
  initDb();
  
  app.listen(config.server.port, config.server.host, () => {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║     校园宿舍换寝审批服务                                  ║
║     服务已启动                                            ║
║     http://${config.server.host}:${config.server.port}                      ║
╚══════════════════════════════════════════════════════════╝

可用接口:
  GET  /health                          - 健康检查
  
  宿舍管理:
  POST /api/dorm/buildings              - 创建楼栋
  GET  /api/dorm/buildings              - 获取楼栋列表
  POST /api/dorm/rooms                  - 创建房间(含床位)
  GET  /api/dorm/buildings/:id/rooms    - 获取楼栋房间
  GET  /api/dorm/beds/available         - 获取可用床位
  
  学生管理:
  POST /api/dorm/students               - 创建学生
  GET  /api/dorm/students               - 获取学生列表
  POST /api/dorm/students/:id/assign-bed - 分配床位
  
  换寝申请:
  POST /api/transfers/applications      - 提交换寝申请
  GET  /api/transfers/applications      - 获取申请列表
  POST /api/transfers/applications/:id/approve - 辅导员审批
  POST /api/transfers/applications/:id/reject  - 拒绝申请
  POST /api/transfers/applications/:id/withdraw - 撤回申请
  POST /api/transfers/applications/:id/complete-workflow - 执行完整换寝流程
  POST /api/transfers/applications/:id/reverse - 撤回已完成换寝
  POST /api/transfers/backdated         - 补录历史换寝
  
  费用管理:
  GET  /api/fees/students/:id           - 获取学生费用
  GET  /api/fees/adjustments            - 获取费用调整记录
  POST /api/fees/:id/pay                - 标记缴费
  
  门禁管理:
  GET  /api/access/students/:id/card    - 获取学生门禁卡
  POST /api/access/sync/:appId          - 换寝后门禁同步
  GET  /api/access/logs                 - 门禁同步日志
  
  历史与审计:
  GET  /api/history/history/:table/:id  - 获取记录变更历史
  GET  /api/history/operations          - 获取操作日志
  GET  /api/history/audit/student/:id   - 学生审计轨迹
  
  管理与报表:
  GET  /api/admin/consistency/check     - 数据一致性检查
  GET  /api/admin/reports/occupancy     - 宿舍入住报表
  GET  /api/admin/reports/transfers     - 换寝统计
  GET  /api/admin/reports/fees          - 费用报表
  GET  /api/admin/reports/comprehensive - 综合报表
  GET  /api/admin/reports/student/:id   - 学生住宿详情
`);
  });
};

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };