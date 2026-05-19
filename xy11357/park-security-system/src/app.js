const express = require('express');
const cors = require('cors');
const path = require('path');
const { errorHandler, requestIdMiddleware } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestIdMiddleware);

app.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    }
  });
});

app.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      name: '园区安保管理系统',
      version: '1.0.0',
      description: '访客预约、临时车牌、黑名单核验管理系统',
      docs: '/api/docs'
    }
  });
});

const visitorRoutes = require('./routes/visitors');
const licensePlateRoutes = require('./routes/licensePlates');
const blacklistRoutes = require('./routes/blacklist');
const gateRoutes = require('./routes/gate');
const auditRoutes = require('./routes/audit');

app.use('/api/visitors', visitorRoutes);
app.use('/api/license-plates', licensePlateRoutes);
app.use('/api/blacklist', blacklistRoutes);
app.use('/api/gate', gateRoutes);
app.use('/api/audit', auditRoutes);

app.get('/api/docs', (req, res) => {
  const docs = {
    visitors: {
      description: '访客管理接口',
      endpoints: [
        { method: 'POST', path: '/api/visitors', description: '创建访客记录' },
        { method: 'GET', path: '/api/visitors', description: '查询访客列表' },
        { method: 'GET', path: '/api/visitors/:id', description: '查询访客详情' },
        { method: 'PUT', path: '/api/visitors/:id', description: '更新访客记录' },
        { method: 'DELETE', path: '/api/visitors/:id', description: '删除访客记录' },
        { method: 'POST', path: '/api/visitors/import/csv', description: '批量导入访客（CSV文件）' },
        { method: 'GET', path: '/api/visitors/import/:batchId', description: '查询导入结果' }
      ]
    },
    licensePlates: {
      description: '车牌管理接口',
      endpoints: [
        { method: 'POST', path: '/api/license-plates', description: '创建车牌记录' },
        { method: 'GET', path: '/api/license-plates', description: '查询车牌列表' },
        { method: 'GET', path: '/api/license-plates/:id', description: '查询车牌详情' },
        { method: 'PUT', path: '/api/license-plates/:id', description: '更新车牌记录' },
        { method: 'DELETE', path: '/api/license-plates/:id', description: '删除车牌记录' },
        { method: 'POST', path: '/api/license-plates/import/json', description: '批量导入车牌（JSON文件）' },
        { method: 'GET', path: '/api/license-plates/import/:batchId', description: '查询导入结果' }
      ]
    },
    blacklist: {
      description: '黑名单管理接口',
      endpoints: [
        { method: 'POST', path: '/api/blacklist', description: '创建黑名单记录' },
        { method: 'GET', path: '/api/blacklist', description: '查询黑名单列表' },
        { method: 'GET', path: '/api/blacklist/:id', description: '查询黑名单详情' },
        { method: 'PUT', path: '/api/blacklist/:id', description: '更新黑名单记录' },
        { method: 'DELETE', path: '/api/blacklist/:id', description: '删除黑名单记录' },
        { method: 'POST', path: '/api/blacklist/check', description: '检查是否在黑名单中' },
        { method: 'POST', path: '/api/blacklist/import/json', description: '批量导入黑名单（JSON文件）' },
        { method: 'GET', path: '/api/blacklist/import/:batchId', description: '查询导入结果' }
      ]
    },
    gate: {
      description: '门禁核验接口',
      endpoints: [
        { method: 'POST', path: '/api/gate/verify/visitor', description: '访客核验' },
        { method: 'POST', path: '/api/gate/verify/vehicle', description: '车辆核验' },
        { method: 'POST', path: '/api/gate/manual/pass', description: '人工放行' },
        { method: 'POST', path: '/api/gate/manual/reject', description: '人工拒绝' },
        { method: 'GET', path: '/api/gate/records', description: '查询门禁记录列表' },
        { method: 'GET', path: '/api/gate/records/:id', description: '查询门禁记录详情' }
      ]
    },
    audit: {
      description: '审计日志接口',
      endpoints: [
        { method: 'GET', path: '/api/audit', description: '查询审计日志列表' },
        { method: 'GET', path: '/api/audit/:id', description: '查询审计日志详情' },
        { method: 'GET', path: '/api/audit/actions/types', description: '获取操作类型列表' },
        { method: 'GET', path: '/api/audit/modules/types', description: '获取模块类型列表' }
      ]
    }
  };

  res.json({
    success: true,
    data: docs
  });
});

app.use(errorHandler);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: '接口不存在'
    }
  });
});

app.listen(PORT, () => {
  console.log(`园区安保管理系统已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`接口文档: http://localhost:${PORT}/api/docs`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
});

module.exports = app;
