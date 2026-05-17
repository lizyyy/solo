const express = require('express');
const fs = require('fs');
const path = require('path');

const configPath = path.join(process.cwd(), '.env');
const configExamplePath = path.join(process.cwd(), '.env.example');

let config = {};
let configErrors = [];

if (fs.existsSync(configPath)) {
  try {
    const envContent = fs.readFileSync(configPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && !key.startsWith('#') && valueParts.length > 0) {
        config[key.trim()] = valueParts.join('=').trim();
      }
    });
  } catch (e) {
    configErrors.push('无法读取 .env 文件');
  }
} else {
  configErrors.push('.env 文件不存在，请从 .env.example 复制配置');
}

const PORT = config.PORT || 3000;
const HOST = config.HOST || 'localhost';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    configErrors: configErrors.length > 0 ? configErrors : undefined,
    message: configErrors.length > 0 ? '存在配置问题' : '服务运行正常'
  });
});

app.get('/api', (req, res) => {
  res.json({
    name: '资产管理系统 - 逾期催还服务',
    version: '1.0.0',
    description: '提供资产借用逾期催还的完整服务闭环',
    endpoints: {
      'GET /api/borrows': '借用记录列表',
      'GET /api/borrows/:id': '借用记录详情',
      'GET /api/reminders': '催还记录列表',
      'POST /api/reminders': '创建催还通知（带冲突检测）',
      'POST /api/reminders/force': '强制创建催还通知',
      'POST /api/borrows/:id/return': '处理归还',
      'GET /api/statistics': '统计数据',
      'GET /api/export/borrows': '导出借用记录',
      'GET /api/export/reminders': '导出催还记录',
      'GET /api/export/files': '获取导出文件列表',
      'POST /api/import/test-bad-rows': '导入测试坏行',
      'GET /api/import/errors': '获取导入错误'
    },
    status: 'running'
  });
});

const overdueReminderRoutes = require('./routes/overdueReminder');
app.use('/api', overdueReminderRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    code: 500,
    message: '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    timestamp: new Date().toISOString()
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    code: 404,
    message: '接口不存在',
    path: req.path,
    timestamp: new Date().toISOString()
  });
});

const { initTestData } = require('./data/initTestData');
initTestData();

app.listen(PORT, HOST, () => {
  console.log('\n' + '='.repeat(60));
  console.log('  资产管理系统 - 逾期催还服务');
  console.log('='.repeat(60));
  console.log(`  服务地址: http://${HOST}:${PORT}`);
  console.log(`  API 根路径: http://${HOST}:${PORT}/api`);
  console.log(`  健康检查: http://${HOST}:${PORT}/health`);
  console.log('='.repeat(60));
  
  if (configErrors.length > 0) {
    console.log('\n  ⚠️  配置警告:');
    configErrors.forEach(err => console.log(`    - ${err}`));
    console.log(`    请参考 ${configExamplePath} 进行配置`);
  }
  
  console.log('\n  📋 验收场景说明:');
  console.log('    1. 完整流转: 借用中 -> 逾期 -> 催还中 -> 已归还');
  console.log('    2. 冲突记录: 借用人转部门后催还通知冲突');
  console.log('    3. 导入坏行: 模拟导入错误数据');
  console.log('    4. 列表/详情/历史/导出 互相对照');
  console.log('\n  🚀 服务已启动，开始测试吧！\n');
});
