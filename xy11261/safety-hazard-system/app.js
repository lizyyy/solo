const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/exports', express.static(path.join(__dirname, 'exports')));

const dataDir = path.join(__dirname, 'data');
const uploadsDir = path.join(__dirname, 'uploads');
const exportsDir = path.join(__dirname, 'exports');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
if (!fs.existsSync(exportsDir)) fs.mkdirSync(exportsDir);

const { initTables, initSampleData } = require('./src/models/database');
initTables();
initSampleData();

const hazardRoutes = require('./src/routes/hazards');
const exportRoutes = require('./src/routes/export');

app.use('/api/hazards', hazardRoutes);
app.use('/api/export', exportRoutes);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '安全隐患闭环管理系统运行正常', timestamp: new Date().toISOString() });
});

app.get('/api/docs', (req, res) => {
  const docs = {
    base_url: `http://localhost:${PORT}/api`,
    endpoints: {
      'GET /hazards': '获取隐患列表，支持筛选和分页',
      'GET /hazards/stats': '获取统计数据',
      'GET /hazards/:id': '获取单条隐患详情（含规则日志和状态历史）',
      'POST /hazards': '创建新隐患（支持上传巡检照片）',
      'PUT /hazards/:id/assign': '分配整改任务',
      'PUT /hazards/:id/rectify': '提交整改',
      'PUT /hazards/:id/recheck': '提交复查',
      'PUT /hazards/:id/merge': '合并重复隐患',
      'DELETE /hazards/:id': '删除隐患',
      'GET /export/hazards': '导出隐患台账为Excel',
      'GET /export/rule-logs': '获取规则执行日志'
    },
    filters: {
      rectifier: '按整改责任人筛选',
      status: '按状态筛选 (pending, rectifying, rechecking, closed, escalated)',
      hazard_level: '按风险等级筛选 (low, medium, high, critical)',
      start_time: '开始时间 (ISO格式)',
      end_time: '结束时间 (ISO格式)',
      location: '按位置模糊搜索'
    },
    pagination: {
      page: '页码，默认1',
      page_size: '每页数量，默认20'
    },
    business_rules: {
      photo_required: '巡检、整改、复查都必须上传照片才能通过',
      overdue_escalation: '高等级隐患逾期未整改会自动升级',
      duplicate_detection: '同位置30天内的隐患会提示重复并支持合并',
      deadline_validation: '整改截止时间必须晚于巡检时间，且根据风险等级有最长限制'
    },
    examples: {
      normal_usage: [
        '1. 创建隐患: POST /api/hazards',
        '2. 分配整改: PUT /api/hazards/1/assign',
        '3. 提交整改: PUT /api/hazards/1/rectify',
        '4. 提交复查: PUT /api/hazards/1/recheck (结果pass即为闭环)'
      ],
      curl_examples: [
        'curl http://localhost:3000/api/hazards?status=pending&rectifier=张三',
        'curl -X POST http://localhost:3000/api/hazards -H "Content-Type: application/json" -d \'{"location":"A栋1楼","description":"消防通道堵塞","hazard_level":"high","inspector":"李四","inspector_time":"2024-01-15T10:00:00Z"}\'',
        'curl http://localhost:3000/api/export/hazards?status=closed -o 闭环隐患.xlsx'
      ]
    }
  };
  
  res.json({ success: true, data: docs });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: '接口不存在' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  安全隐患闭环管理系统启动成功!`);
  console.log(`  服务地址: http://localhost:${PORT}`);
  console.log(`  接口文档: http://localhost:${PORT}/api/docs`);
  console.log(`  健康检查: http://localhost:${PORT}/api/health`);
  console.log(`========================================\n`);
  console.log(`  样例数据已加载，包含5条隐患记录`);
  console.log(`  支持按负责人、状态、时间、等级等筛选`);
  console.log(`  支持导出Excel报告`);
  console.log(`  所有规则执行都有日志可追溯\n`);
});
