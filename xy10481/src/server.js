const express = require('express');
const path = require('path');
const treatmentRoutes = require('./routes/treatment');

const app = express();
const PORT = 3005;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({
    name: '医美疗程消耗 API',
    version: '1.0.0',
    description: '用于管理医美门店疗程包购入、消耗、退款和流水追踪',
    endpoints: {
      purchase: 'POST /api/treatment/purchase - 购入疗程包',
      gift: 'POST /api/treatment/gift - 赠送次数',
      appointment: 'POST /api/treatment/appointment - 预约执行',
      consume: 'POST /api/treatment/consume - 医生确认消耗',
      refund: 'POST /api/treatment/refund - 退款',
      remaining: 'GET /api/treatment/remaining/:customerId - 查询客户剩余次数',
      transactions: 'GET /api/treatment/transactions - 流水查询',
      doctorStats: 'GET /api/treatment/stats/doctor/:doctorId - 医生执行量统计',
      refundStats: 'GET /api/treatment/stats/refund-impact - 退款影响统计',
      abnormalStats: 'GET /api/treatment/stats/abnormal - 异常流水查询',
      services: 'GET /api/treatment/services - 服务项目列表',
      doctors: 'GET /api/treatment/doctors - 医生列表',
      customers: 'GET /api/treatment/customers - 客户列表'
    },
    businessRules: [
      '1. 赠送次数优先级高于购买次数，消耗时优先扣赠送',
      '2. 医生未确认的预约不能扣次',
      '3. 退款后剩余次数自动重算（只能退购买次数，已使用的不能退）',
      '4. 同一服务同一日期或同一预约不能重复扣次',
      '5. 剩余次数不足时无法预约和扣次'
    ]
  });
});

app.use('/api/treatment', treatmentRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
    message: err.message
  });
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  医美疗程消耗 API 服务已启动`);
  console.log(`  服务地址: http://localhost:${PORT}`);
  console.log(`  API 基础路径: http://localhost:${PORT}/api/treatment`);
  console.log(`========================================\n`);
  console.log(`预置数据:`);
  console.log(`  - 服务项目: 皮肤管理、脱毛、光电项目，共 9 个项目`);
  console.log(`  - 医生: 张医生、李医生、王医生`);
  console.log(`  - 客户: 王美丽、李小花、张婷婷`);
  console.log(`\n运行测试脚本: node scripts/test-demo.js`);
});

module.exports = app;
