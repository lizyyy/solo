const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const departmentRoutes = require('./routes/departments');
const materialRoutes = require('./routes/materials');
const treatmentRoutes = require('./routes/treatments');
const consumptionRoutes = require('./routes/consumption');
const replenishmentRoutes = require('./routes/replenishment');
const dashboardRoutes = require('./routes/dashboard');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/departments', departmentRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/treatments', treatmentRoutes);
app.use('/api/consumption', consumptionRoutes);
app.use('/api/replenishment', replenishmentRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use(express.static(path.join(__dirname, '../client/dist')));

app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    timestamp: new Date().toISOString(),
    service: 'dental-supply-replenishment',
    version: '1.0.0'
  });
});

app.get('/api/status-flow', (req, res) => {
  res.json({
    success: true,
    data: {
      replenishment: {
        PENDING: {
          label: '待审核',
          color: '#e6a23c',
          next: ['APPROVED', 'REJECTED']
        },
        APPROVED: {
          label: '已通过',
          color: '#67c23a',
          next: ['FULFILLED']
        },
        REJECTED: {
          label: '已拒绝',
          color: '#f56c6c',
          next: []
        },
        FULFILLED: {
          label: '已补货',
          color: '#409eff',
          next: []
        }
      },
      stock: {
        NORMAL: { label: '正常', color: '#67c23a' },
        LOW_STOCK: { label: '库存不足', color: '#e6a23c' },
        OUT_OF_STOCK: { label: '已断货', color: '#f56c6c' },
        OVER_STOCK: { label: '库存过量', color: '#909399' }
      }
    }
  });
});

app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: '牙科椅旁耗材补货台 API',
    endpoints: {
      departments: '/api/departments',
      materials: '/api/materials',
      treatments: '/api/treatments',
      consumption: '/api/consumption',
      replenishment: '/api/replenishment',
      dashboard: '/api/dashboard'
    }
  });
});

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ success: false, error: '接口不存在' });
  } else {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  }
});

app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || '服务器内部错误'
  });
});

app.listen(PORT, () => {
  console.log(`\n  ✨ 牙科椅旁耗材补货台后端服务已启动`);
  console.log(`  🚀 服务地址: http://localhost:${PORT}`);
  console.log(`  📚 API文档: http://localhost:${PORT}/api`);
  console.log(`\n  启动命令: npm start`);
  console.log(`  初始化数据库: npm run init-db`);
  console.log(`  导入样例数据: npm run seed-data\n`);
});
