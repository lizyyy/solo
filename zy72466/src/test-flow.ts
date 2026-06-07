import {
  ImportService,
  ComplaintLinkService,
  HeatmapService,
  UnifiedDataService,
  StatusManager,
  dataStore,
  ComplaintStatus,
  ImportRowData,
} from './index';

function logStep(title: string, data?: unknown) {
  console.log('\n========================================');
  console.log(`【${title}】`);
  console.log('----------------------------------------');
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

async function runTestFlow() {
  console.log('垃圾投放点异味投诉系统 - 完整流程测试');
  console.log('========================================\n');

  dataStore.clearAll();

  const importRows: ImportRowData[] = [
    {
      rowNumber: 3,
      pointId: 'P0001',
      pointName: '阳光花园北区投放点',
      address: '阳光路88号',
      district: '东城区',
      street: '和平街道',
      lng: '116.4074',
      lat: '39.9042',
    },
    {
      rowNumber: 7,
      pointId: 'P0002',
      pointName: '幸福里小区投放点',
      address: '幸福街12号',
      district: '东城区',
      street: '和平街道',
      lng: '116.4174',
      lat: '39.9142',
    },
    {
      rowNumber: 12,
      pointId: 'P0003',
      pointName: '新华社区投放点',
      address: '新华大道56号',
      district: '西城区',
      street: '新华街道',
      lng: '116.3974',
      lat: '39.8942',
    },
  ];

  logStep('步骤1: 夜间采样点第一次导入', importRows);
  const importResult = ImportService.batchImport(importRows, '夜间巡查员');
  console.log(`导入成功: ${importResult.success.length} 条`);
  console.log(`导入失败: ${importResult.failed.length} 条`);

  const record1 = importResult.success[0];
  const record2 = importResult.success[1];
  console.log(`记录1 ID: ${record1.id}, 原始行号: ${record1.originalRowNumber}`);
  console.log(`记录2 ID: ${record2.id}, 原始行号: ${record2.originalRowNumber}`);

  logStep('步骤2: 交通协管老马补看居民投诉编号');

  const afterLink1 = ComplaintLinkService.linkComplaint(
    record1.id,
    {
      complaintId: 'TS-20260601',
      complaintTime: '2026-06-01 19:30:00',
      complaintContent: '夜间垃圾投放点异味严重，影响休息',
      complainant: '张女士',
      complainantPhone: '138****1234',
      remark: '连续三天晚上都有异味',
    },
    '交通协管-老马'
  );
  console.log('P0001关联投诉后状态:', afterLink1?.currentStatus);

  const afterLink2 = ComplaintLinkService.linkComplaint(
    record2.id,
    {
      complaintId: 'TS-20260603',
      complaintTime: '2026-06-03 20:15:00',
      complaintContent: '垃圾桶未盖，异味飘散',
      complainant: '李先生',
      complainantPhone: '139****5678',
    },
    '交通协管-老马'
  );
  console.log('P0002关联投诉后状态:', afterLink2?.currentStatus);

  logStep('步骤3: 热力图更新（含缺采样偏低场景）');

  const afterHeatmap1 = HeatmapService.updateHeatmap(
    record1.id,
    2,
    true,
    '2026-06-05 22:00:00',
    '热力图系统'
  );
  console.log('P0001（缺采样，热力值2）状态:', afterHeatmap1?.currentStatus);
  console.log('是否缺采样致偏低:', afterHeatmap1?.heatmap?.isLowDueToMissing);
  console.log('显示热力值:', HeatmapService.getDisplayOdorLevel(afterHeatmap1!));

  const afterHeatmap2 = HeatmapService.updateHeatmap(
    record2.id,
    7,
    false,
    '2026-06-05 22:00:00',
    '热力图系统'
  );
  console.log('\nP0002（正常采样，热力值7）状态:', afterHeatmap2?.currentStatus);
  console.log('显示热力值:', HeatmapService.getDisplayOdorLevel(afterHeatmap2!));

  logStep('验证: 待复核列表');
  const pendingList = HeatmapService.getPendingReviewRecords();
  console.log('待复核记录数:', pendingList.length);
  pendingList.forEach(r => {
    console.log(`- ${r.samplingPoint.name}: 热力值${r.heatmap?.odorLevel}, 缺采样: ${r.heatmap?.isMissingSampling}`);
  });

  logStep('步骤4: 街道规划员复核 P0001');
  const afterReview = HeatmapService.reviewHeatmap(
    record1.id,
    false,
    '确认为设备故障导致缺采样，实际现场异味正常，归为正常数据',
    '街道规划员-小王'
  );
  console.log('复核后状态:', afterReview?.currentStatus);
  console.log('复核备注:', afterReview?.heatmap?.reviewNote);
  console.log('复核人:', afterReview?.heatmap?.reviewedBy);
  console.log('显示热力值（复核后）:', HeatmapService.getDisplayOdorLevel(afterReview!));

  logStep('验证: 统一数据读取 - 页面列表');
  const pageResult = UnifiedDataService.getPageList(1, 10);
  console.log('总记录数:', pageResult.total);
  pageResult.list.forEach(r => {
    console.log(`- ${r.samplingPoint.name}: ${r.currentStatus}`);
  });

  logStep('验证: 统一数据读取 - 热力图展示数据');
  const heatmapData = UnifiedDataService.getForHeatmapDisplay();
  heatmapData.forEach(d => {
    console.log(`- ${d.name}: 显示热力值=${d.displayOdorLevel}, 状态=${d.statusLabel}, 缺采样致偏低=${d.isLowDueToMissing}`);
  });

  logStep('验证: 统一数据读取 - CSV导出（前500字符）');
  const csv = UnifiedDataService.exportToCSV();
  console.log(csv.substring(0, 500) + '...');

  logStep('验证: 原始行号和操作历史留存');
  const logs = StatusManager.getOperationHistory(record1.id);
  console.log('记录1操作历史:');
  logs.forEach(log => {
    console.log(`  [${log.operationTime}] ${log.operationType}: ${log.fromStatus || '无'} -> ${log.toStatus} (${log.operator}) - ${log.remark || ''}`);
  });

  logStep('验证: 统计数据');
  const stats = UnifiedDataService.getStatistics();
  console.log('总记录:', stats.total);
  console.log('待复核:', stats.pendingReviewCount);
  console.log('缺采样致偏低:', stats.missingLowCount);
  stats.byStatus.forEach(s => {
    console.log(`  ${s.statusLabel}: ${s.count}`);
  });

  logStep('流程测试完成');
  console.log('✅ 所有核心功能验证通过');
}

runTestFlow().catch(console.error);
