const express = require('express');
const router = express.Router();
const dataStore = require('../dataStore');

router.get('/steps', (req, res) => {
  res.json({
    demoPath: [
      { step: 1, name: '巡检导入', description: '系统已初始化演示数据，3个队伍共6条记录', endpoint: 'GET /api/inspections' },
      { step: 2, name: '风险评分', description: '对所有记录计算风险分数和等级', endpoint: 'POST /api/risk/calculate' },
      { step: 3, name: '检测重复', description: '发现同一井盖的多次报修并分组', endpoint: 'POST /api/merge/detect' },
      { step: 4, name: '确认合并', description: '选择主记录，合并重复记录并重新评分', endpoint: 'POST /api/merge/:id/confirm' }
    ],
    errorPath: [
      { step: 1, name: '无效导入', description: '导入缺少必要字段的记录', endpoint: 'POST /api/inspections (缺少team或location)' },
      { step: 2, name: '无效合并', description: '尝试合并不存在的记录', endpoint: 'POST /api/merge/invalid-id/confirm' },
      { step: 3, name: '撤回已合并', description: '尝试操作已撤回的记录', scenario: '撤回记录后尝试查询历史' }
    ]
  });
});

router.post('/run-demo', async (req, res) => {
  dataStore.resetData();
  
  const results = [];
  
  results.push({
    step: 1,
    action: '查看导入数据',
    data: { count: dataStore.getAllInspections().length, records: dataStore.getAllInspections() }
  });
  
  const riskResults = dataStore.calculateAllRisks('demo-operator');
  results.push({
    step: 2,
    action: '执行风险评分',
    data: riskResults
  });
  
  const duplicates = dataStore.detectDuplicates(5, 'demo-operator');
  results.push({
    step: 3,
    action: '检测重复记录',
    data: { groupCount: duplicates.length, groups: duplicates }
  });
  
  if (duplicates.length > 0) {
    const group = duplicates[0];
    const mergeResult = dataStore.confirmMerge(group.id, group.suggestedPrimary, 'demo-operator');
    results.push({
      step: 4,
      action: '确认合并第一组',
      data: mergeResult
    });
  }
  
  res.json({
    message: '演示路径执行完成',
    steps: results,
    finalStatus: {
      currentStep: dataStore.getCurrentStep(),
      totalInspections: dataStore.getAllInspections().length,
      highRiskCount: dataStore.getHighRiskCount(),
      pendingMerges: dataStore.getPendingMerges().length
    }
  });
});

router.post('/run-error', (req, res) => {
  dataStore.resetData();
  const errors = [];
  
  try {
    dataStore.addInspection({ description: '缺少team和location' });
  } catch (err) {
    errors.push({
      step: 1,
      type: 'validation_error',
      message: '新增记录失败',
      error: '缺少必要字段: team, location',
      expected: 'POST /api/inspections 需要 team 和 location'
    });
  }
  
  const invalidMerge = dataStore.confirmMerge('non-existent-id', 'fake-id', 'error-demo');
  if (!invalidMerge) {
    errors.push({
      step: 2,
      type: 'not_found',
      message: '合并操作失败',
      error: '合并组不存在或已处理',
      expected: '需要先通过 /api/merge/detect 创建合并组'
    });
  }
  
  const inspection = dataStore.getAllInspections()[0];
  if (inspection) {
    dataStore.withdrawInspection(inspection.id, 'error-demo', '测试撤回');
    const afterWithdraw = dataStore.getInspectionById(inspection.id);
    errors.push({
      step: 3,
      type: 'data_change',
      message: '撤回记录后的数据状态',
      originalExisted: true,
      afterWithdrawExists: !!afterWithdraw,
      historyAvailable: dataStore.getHistory('inspection', inspection.id).length > 0,
      note: '记录已删除但历史可追踪'
    });
  }
  
  res.json({
    message: '异常路径演示完成',
    errors
  });
});

router.post('/reset', (req, res) => {
  dataStore.resetData();
  res.json({ message: '数据已重置为初始状态' });
});

module.exports = router;
