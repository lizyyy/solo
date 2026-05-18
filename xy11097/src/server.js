const express = require('express');
const bodyParser = require('body-parser');
const { initTables } = require('./database');
const { seedData } = require('./seed');
const {
  createExchangeOrder,
  getExchangeOrder,
  getExchangeList,
  updateExchangeStatus,
  ExchangeError
} = require('./exchangeService');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '小学校服订购点校服尺码换货API',
    version: '1.0.0',
    endpoints: {
      'POST /api/exchanges': '创建换货申请',
      'GET /api/exchanges': '获取换货列表',
      'GET /api/exchanges/:exchangeNo': '获取换货详情',
      'PUT /api/exchanges/:exchangeNo/status': '更新换货状态'
    },
    exampleData: {
      studentNo: '20240101',
      orderNo: 'ORD202405002',
      toSizeCode: '140'
    }
  });
});

app.post('/api/exchanges', async (req, res) => {
  try {
    const result = await createExchangeOrder(req.body);
    res.json(result);
  } catch (error) {
    if (error instanceof ExchangeError) {
      res.status(400).json(error.toJSON());
    } else {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '服务器内部错误',
          solution: '请稍后重试或联系技术支持',
          details: { errorMessage: error.message }
        }
      });
    }
  }
});

app.get('/api/exchanges', async (req, res) => {
  try {
    const { studentNo, status, page, pageSize } = req.query;
    const result = await getExchangeList({
      studentNo,
      status,
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined
    });
    res.json(result);
  } catch (error) {
    if (error instanceof ExchangeError) {
      res.status(400).json(error.toJSON());
    } else {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '服务器内部错误',
          solution: '请稍后重试或联系技术支持',
          details: { errorMessage: error.message }
        }
      });
    }
  }
});

app.get('/api/exchanges/:exchangeNo', async (req, res) => {
  try {
    const result = await getExchangeOrder(req.params.exchangeNo);
    res.json(result);
  } catch (error) {
    if (error instanceof ExchangeError) {
      res.status(404).json(error.toJSON());
    } else {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '服务器内部错误',
          solution: '请稍后重试或联系技术支持',
          details: { errorMessage: error.message }
        }
      });
    }
  }
});

app.put('/api/exchanges/:exchangeNo/status', async (req, res) => {
  try {
    const { status, rejectReason, supplementaryNotes } = req.body;
    const result = await updateExchangeStatus(req.params.exchangeNo, status, {
      rejectReason,
      supplementaryNotes
    });
    res.json(result);
  } catch (error) {
    if (error instanceof ExchangeError) {
      res.status(400).json(error.toJSON());
    } else {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '服务器内部错误',
          solution: '请稍后重试或联系技术支持',
          details: { errorMessage: error.message }
        }
      });
    }
  }
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ENDPOINT_NOT_FOUND',
      message: '请求的接口不存在',
      solution: '请检查URL是否正确'
    }
  });
});

async function startServer() {
  initTables(async (err) => {
    if (err) {
      console.error('初始化数据库表失败:', err);
      return;
    }
    console.log('✓ 数据库表初始化完成');
    
    try {
      await seedData();
    } catch (e) {
      console.log('种子数据已存在，跳过植入');
    }
    
    app.listen(PORT, () => {
      console.log(`\n🚀 校服换货API服务已启动`);
      console.log(`📍 服务地址: http://localhost:${PORT}`);
      console.log(`\n📋 快速开始:`);
      console.log(`   获取换货列表: GET http://localhost:${PORT}/api/exchanges`);
      console.log(`   获取换货详情: GET http://localhost:${PORT}/api/exchanges/EXC2024052001`);
      console.log(`   创建换货申请: POST http://localhost:${PORT}/api/exchanges`);
      console.log(`\n🔧 示例请求:`);
      console.log(`   curl -X POST http://localhost:${PORT}/api/exchanges \\`);
      console.log(`     -H "Content-Type: application/json" \\`);
      console.log(`     -d '{`);
      console.log(`       "orderNo": "ORD202405002",`);
      console.log(`       "studentNo": "20240101",`);
      console.log(`       "toSizeCode": "140",`);
      console.log(`       "reason": "尺码偏小",`);
      console.log(`       "reasonDetail": "穿着后腰部紧绷，孩子说不舒服",`);
      console.log(`       "contactPhone": "13800138001"`);
      console.log(`     }'`);
      console.log(`\n`);
    });
  });
}

if (require.main === module) {
  startServer().catch(console.error);
}

module.exports = app;
