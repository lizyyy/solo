const express = require('express');
const path = require('path');
const { initDb } = require('./db');
const { initSchema } = require('./db/schema');
const { authenticate } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const batchRoutes = require('./routes/batches');
const dirtyRecordRoutes = require('./routes/dirtyRecords');
const exportRoutes = require('./routes/export');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

app.use('/api/auth', authRoutes);

app.use('/api/batches', authenticate, batchRoutes);
app.use('/api/dirty-records', authenticate, dirtyRecordRoutes);
app.use('/api/export', authenticate, exportRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'used-car-prep-status-machine'
  });
});

app.get('/api', (req, res) => {
  res.json({
    name: '二手车整备异常回执状态机 API',
    version: '1.0.0',
    endpoints: {
      auth: {
        'POST /api/auth/login': '用户登录',
        'GET /api/auth/me': '获取当前用户信息'
      },
      batches: {
        'GET /api/batches': '获取批次列表',
        'POST /api/batches': '创建批次',
        'GET /api/batches/:id': '获取批次详情',
        'GET /api/batches/:id/history': '获取状态历史',
        'GET /api/batches/:id/transitions': '获取可用状态转换',
        'POST /api/batches/:id/submit': '提交审核',
        'POST /api/batches/:id/review/start': '开始复核',
        'POST /api/batches/:id/review/approve': '复核通过',
        'POST /api/batches/:id/review/reject': '复核驳回',
        'POST /api/batches/:id/freeze': '冻结批次',
        'POST /api/batches/:id/unfreeze': '解冻批次',
        'POST /api/batches/:id/archive': '归档批次',
        'POST /api/batches/:id/cancel': '撤销批次',
        'POST /api/batches/:id/settle': '结算批次',
        'POST /api/batches/:id/return': '添加返厂记录',
        'POST /api/batches/:id/inspections': '添加检测单',
        'POST /api/batches/:id/quotes': '添加维修报价',
        'POST /api/batches/:id/photos': '添加照片',
        'POST /api/batches/:id/scans': '添加扫码明细'
      },
      'dirty-records': {
        'GET /api/dirty-records': '获取脏记录列表',
        'GET /api/dirty-records/:id': '获取脏记录详情',
        'POST /api/dirty-records/:id/resolve': '处理脏记录'
      },
      export: {
        'GET /api/export/batch/:id': '导出单个批次CSV',
        'GET /api/export/batches': '导出批次汇总CSV',
        'GET /api/export/batch/:id/summary': '获取批次汇总数据'
      }
    },
    roles: {
      entry: '录入员 - 创建、编辑、提交批次，上传附件',
      reviewer: '复核员 - 查看、复核、编辑批次，处理脏记录',
      manager: '主管 - 拥有所有权限，冻结/解冻批次',
      readonly: '只读 - 查看批次和历史，导出汇总'
    }
  });
});

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ error: '服务器内部错误', message: err.message });
});

app.use((req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

async function startServer() {
  try {
    await initDb();
    console.log('数据库初始化完成');
    
    initSchema();
    console.log('数据库Schema初始化完成');
    
    app.listen(PORT, () => {
      console.log(`\n🚀 服务器启动成功!`);
      console.log(`📍 服务地址: http://localhost:${PORT}`);
      console.log(`📚 API文档: http://localhost:${PORT}/api`);
      console.log(`💡 健康检查: http://localhost:${PORT}/api/health`);
      console.log(`\n🔐 默认账号:`);
      console.log(`   录入员: entry_user / entry123`);
      console.log(`   复核员: reviewer_user / reviewer123`);
      console.log(`   主管:   manager_user / manager123`);
      console.log(`   只读:   readonly_user / readonly123`);
    });
  } catch (err) {
    console.error('启动失败:', err);
    process.exit(1);
  }
}

startServer();
