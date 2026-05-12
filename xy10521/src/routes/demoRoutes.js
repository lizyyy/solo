const express = require('express');
const router = express.Router();
const { storage, ORDER_STATUS, EQUIPMENT_STATUS } = require('../utils/storage');

router.get('/info', (req, res) => {
  res.json({
    success: true,
    data: {
      name: '设备租赁押金管理系统 API',
      version: '1.0.0',
      description: '完整的设备租赁押金管理演示系统',
      
      orderStatuses: ORDER_STATUS,
      equipmentStatuses: EQUIPMENT_STATUS,
      
      mainApiEndpoints: {
        equipment: {
          list: 'GET /api/equipment',
          create: 'POST /api/equipment',
          detail: 'GET /api/equipment/:equipmentId',
          statusHistory: 'GET /api/equipment/:equipmentId/status-history'
        },
        order: {
          create: 'POST /api/orders',
          list: 'GET /api/orders',
          detail: 'GET /api/orders/:orderId',
          fullDetail: 'GET /api/orders/:orderId/detail',
          freezeDeposit: 'POST /api/orders/:orderId/freeze-deposit',
          renew: 'POST /api/orders/:orderId/renew',
          return: 'POST /api/orders/:orderId/return',
          assessDamage: 'POST /api/orders/:orderId/assess-damage',
          refund: 'POST /api/orders/:orderId/refund',
          manualAdjust: 'POST /api/orders/:orderId/manual-adjust',
          ledger: 'GET /api/orders/:orderId/ledger',
          fees: 'GET /api/orders/:orderId/fees',
          timeline: 'GET /api/orders/:orderId/timeline'
        },
        report: {
          audit: 'GET /api/audit',
          summary: 'GET /api/reports/orders-summary',
          orderReport: 'GET /api/reports/order/:orderId',
          export: 'GET /api/reports/export'
        },
        demo: {
          runDemo: 'POST /api/demo/run/:scenario',
          listScenarios: 'GET /api/demo/scenarios',
          clearData: 'POST /api/demo/clear'
        }
      }
    }
  });
});

router.get('/scenarios', (req, res) => {
  res.json({
    success: true,
    data: {
      scenarios: [
        {
          id: 'normal-return',
          name: '正常归还',
          description: '用户按时归还设备，无损坏，全额退还押金',
          steps: ['创建设备', '创建订单', '冻结押金', '归还设备', '定损(无损坏)', '退款']
        },
        {
          id: 'overdue-fee',
          name: '逾期扣费',
          description: '用户逾期归还，计算逾期费用后退还剩余押金',
          steps: ['创建设备', '创建订单', '冻结押金', '逾期归还', '定损(无损坏)', '退款(扣除逾期费)']
        },
        {
          id: 'damage-fee',
          name: '损坏扣费',
          description: '用户按时归还但设备损坏，扣除损坏赔偿费后退还押金',
          steps: ['创建设备', '创建订单', '冻结押金', '归还设备', '定损(有损坏)', '退款(扣除损坏费)']
        },
        {
          id: 'renew-then-return',
          name: '续租后归还',
          description: '用户续租后归还，延长到期日，按时归还',
          steps: ['创建设备', '创建订单', '冻结押金', '续租', '归还设备', '定损', '退款']
        },
        {
          id: 'duplicate-refund',
          name: '重复退款',
          description: '演示幂等性，重复调用退款接口不会重复退款',
          steps: ['正常流程', '重复退款(幂等)', '重复回调(幂等)']
        },
        {
          id: 'overdue-and-damage',
          name: '逾期+损坏同时存在',
          description: '用户逾期且设备损坏，同时扣除两部分费用',
          steps: ['创建设备', '创建订单', '冻结押金', '逾期归还', '定损(有损坏)', '退款(扣除两部分)']
        },
        {
          id: 'damage-exceeds-deposit',
          name: '损坏费用超过押金',
          description: '损坏费用超过押金金额，押金全部扣除',
          steps: ['创建设备', '创建订单', '冻结押金', '归还', '定损(高额损坏)', '退款(0元)']
        },
        {
          id: 'manual-adjust',
          name: '人工修正',
          description: '演示人工修正功能，记录前后差异和操作者',
          steps: ['创建订单', '冻结押金', '人工修正押金', '查看审计日志']
        }
      ]
    }
  });
});

router.post('/run/:scenario', async (req, res) => {
  try {
    const scenario = req.params.scenario;
    const demoService = require('../services/demoService');
    const result = await demoService.runScenario(scenario);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/clear', async (req, res) => {
  const demoService = require('../services/demoService');
  await demoService.clearAllData();
  res.json({ success: true, message: '所有数据已清除' });
});

module.exports = router;