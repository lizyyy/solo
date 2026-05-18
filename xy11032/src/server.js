const express = require('express');
const bodyParser = require('body-parser');
const apiRoutes = require('./routes/api');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  res.json({
    服务名称: '牙科器材库器械借用归还系统 API',
    版本: '1.0.0',
    API接口说明: {
      单条操作: {
        'POST /api/borrow': '登记借用',
        'POST /api/return': '登记归还',
        'POST /api/sterilize': '登记消毒'
      },
      批量操作: {
        'POST /api/batch-import': '批量补录借还记录'
      },
      校验检查: {
        'GET /api/check-consistency': '借还明细一致性检查',
        'GET /api/check-borrow/:器械编号': '借用前置条件检查'
      },
      数据导出: {
        'GET /api/records': '查询借还明细',
        'GET /api/export/json': '导出JSON格式',
        'GET /api/export/csv': '导出CSV表格格式'
      },
      数据查询: {
        'GET /api/equipment': '器械列表',
        'GET /api/equipment/:编号': '器械详情及借还记录',
        'GET /api/stats': '统计概览'
      }
    },
    业务字段说明: '所有接口使用中文业务字段，便于与台账核对',
    数据格式: '支持 JSON 和 CSV 导出'
  });
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  牙科器材库器械借用归还系统已启动`);
  console.log(`  服务地址: http://localhost:${PORT}`);
  console.log(`  API路径: http://localhost:${PORT}/api`);
  console.log(`========================================\n`);
});

module.exports = app;
