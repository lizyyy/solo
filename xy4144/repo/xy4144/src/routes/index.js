const express = require('express');
const router = express.Router();

// 导入各路由模块
const topologyRoutes = require('./topology');
const resourceRoutes = require('./resources');
const planRoutes = require('./plans');
const importRoutes = require('./import');
const exportRoutes = require('./export');
const auditRoutes = require('./audit');

// 根路径信息
router.get('/', (req, res) => {
  res.json({
    service: '封锁点施工冲突审校站 API',
    version: '1.0.0',
    endpoints: {
      topology: '/api/topology - 线路拓扑管理',
      resources: '/api/resources - 资源管理（施工队、接触网等）',
      plans: '/api/plans - 封锁计划管理',
      import: '/api/import - 申请导入',
      export: '/api/export - 排班审计包导出',
      audit: '/api/audit - 审计日志'
    }
  });
});

// 挂载各路由
router.use('/topology', topologyRoutes);
router.use('/resources', resourceRoutes);
router.use('/plans', planRoutes);
router.use('/import', importRoutes);
router.use('/export', exportRoutes);
router.use('/audit', auditRoutes);

module.exports = router;
