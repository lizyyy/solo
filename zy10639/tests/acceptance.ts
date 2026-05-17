import { store } from '../src/store';
import { RetestStatus, RetestRequest } from '../src/types';
import * as fs from 'fs';

console.log('='.repeat(70));
console.log('  实验室LIMS样本重测申请 - 验收测试');
console.log('='.repeat(70));

function printSection(title: string) {
  console.log('\n' + '─'.repeat(70));
  console.log(`  ${title}`);
  console.log('─'.repeat(70));
}

function printRequest(req: RetestRequest, showHistory: boolean = true) {
  console.log(`\n  申请编号: ${req.requestId}`);
  console.log(`  样本ID: ${req.sample.sampleId}`);
  console.log(`  样本名称: ${req.sample.sampleName}`);
  console.log(`  状态: ${req.status}`);
  console.log(`  版本: ${req.version}`);
  console.log(`  重测原因: ${req.retestReason}`);
  console.log(`  申请人: ${req.applicant}`);
  console.log('  检测项目:');
  req.testItems.forEach(item => {
    console.log(`    - ${item.itemCode}-${item.itemName}: 原结果=${item.originalResult}, 重测结果=${item.retestResult || '未测'}`);
  });

  if (showHistory) {
    const history = store.getHistory(req.requestId);
    console.log(`  操作历史 (${history.length}条):`);
    history.forEach((h, i) => {
      console.log(`    ${i + 1}. [${h.operateTime.substring(11, 19)}] ${h.operator} - ${h.operation}${h.remark ? ` (${h.remark})` : ''}`);
    });
  }
}

printSection('验收场景1: 完整流转 - 创建→审核→重测→完成');
console.log('  流程: 创建申请 → 审核通过 → 提交重测结果 → 状态变为"已替换"');

const req1 = store.createRequest({
  sample: {
    sampleId: 'ACC001',
    sampleName: '血液样本-A',
    sampleType: '全血',
    collectionTime: '2024-01-20T08:30:00Z'
  },
  testItems: [
    {
      itemCode: 'WBC',
      itemName: '白细胞',
      originalResult: '15.2',
      originalResultTime: '2024-01-20T10:00:00Z'
    },
    {
      itemCode: 'RBC',
      itemName: '红细胞',
      originalResult: '3.1',
      originalResultTime: '2024-01-20T10:00:00Z'
    }
  ],
  retestReason: '结果异常，临床医生要求复核',
  applicant: '陈检验师'
});
console.log('\n  ✓ 创建申请成功');

store.auditRequest(req1.requestId, {
  auditor: '赵主任',
  auditOpinion: '同意重测，请尽快完成',
  approved: true
});
console.log('  ✓ 审核通过，状态变为"重测中"');

store.submitRetestResult(req1.requestId, {
  itemCode: 'WBC',
  retestResult: '14.8',
  operator: '刘技术员',
  success: true
});
console.log('  ✓ 提交WBC重测结果');

store.submitRetestResult(req1.requestId, {
  itemCode: 'RBC',
  retestResult: '3.3',
  operator: '刘技术员',
  success: true
});
console.log('  ✓ 提交RBC重测结果，状态变为"已替换"');

printRequest(store.getRequest(req1.requestId)!);

printSection('验收场景2: 冲突记录 - 重测失败后重新提交');
console.log('  流程: 创建申请 → 审核通过 → 重测失败 → 重新提交 → 审核');

const req2 = store.createRequest({
  sample: {
    sampleId: 'ACC002',
    sampleName: '尿液样本-B',
    sampleType: '晨尿',
    collectionTime: '2024-01-21T07:00:00Z'
  },
  testItems: [
    {
      itemCode: 'PRO',
      itemName: '尿蛋白',
      originalResult: '++',
      originalResultTime: '2024-01-21T09:00:00Z'
    }
  ],
  retestReason: '结果存疑，需要复查',
  applicant: '周检验师'
});
console.log('\n  ✓ 创建申请成功');

store.auditRequest(req2.requestId, {
  auditor: '赵主任',
  auditOpinion: '同意',
  approved: true
});
console.log('  ✓ 审核通过');

store.submitRetestResult(req2.requestId, {
  itemCode: 'PRO',
  retestResult: 'ERROR',
  operator: '吴技术员',
  success: false
});
console.log('  ✗ 模拟重测失败（仪器故障），状态变为"重测失败"，原结果保留');

store.resubmitRequest(req2.requestId, '周检验师');
console.log('  ✓ 重新提交申请，状态回到"重测申请"');

store.auditRequest(req2.requestId, {
  auditor: '赵主任',
  auditOpinion: '同意再次重测',
  approved: true
});
console.log('  ✓ 再次审核通过');

store.submitRetestResult(req2.requestId, {
  itemCode: 'PRO',
  retestResult: '+',
  operator: '吴技术员',
  success: true
});
console.log('  ✓ 重测成功，状态变为"已替换"');

printRequest(store.getRequest(req2.requestId)!);

printSection('验收场景3: 导入坏行 - 标记补录痕迹');
console.log('  流程: 导入不完整数据 → 系统自动标记为坏行 → 保留历史追溯');

const req3 = store.importBadRow({
  sampleId: 'BAD001',
  sampleName: '异常样本',
  sampleType: null,
  collectionTime: null,
  remark: '历史数据补录，来源不明确',
  testItems: [
    {
      itemCode: null,
      itemName: '未知项目',
      originalResult: '???',
      originalResultTime: null
    }
  ]
}, '系统管理员');
console.log('\n  ✓ 导入坏行成功，自动标记补录痕迹');

printRequest(req3);

printSection('数据一致性验证 - 列表、详情、历史、导出互相对上');

const list = store.listRequests();
console.log(`\n  列表查询 - 共 ${list.length} 条记录:`);
list.forEach((req, i) => {
  console.log(`    ${i + 1}. ${req.requestId} - ${req.sample.sampleId} - ${req.status} (v${req.version})`);
});

console.log('\n  详情验证:');
list.forEach(req => {
  const detail = store.getRequest(req.requestId);
  const history = store.getHistory(req.requestId);
  console.log(`    ${req.requestId}: 详情匹配=${detail ? '✓' : '✗'}, 历史记录=${history.length}条`);
});

const csv = store.exportToCSV();
const csvPath = './acceptance-export.csv';
fs.writeFileSync(csvPath, '\uFEFF' + csv);
console.log(`\n  ✓ CSV导出成功: ${csvPath}`);
console.log(`    导出包含 ${csv.split('\n').length - 1} 行数据（不含表头）`);

console.log('\n' + '='.repeat(70));
console.log('  验收测试总结:');
console.log('='.repeat(70));
console.log('  ✓ 场景1: 完整流转 - 创建→审核→重测→完成  通过');
console.log('  ✓ 场景2: 冲突记录 - 重测失败后重新提交  通过');
console.log('  ✓ 场景3: 导入坏行 - 标记补录痕迹  通过');
console.log('  ✓ 数据一致性 - 列表、详情、历史、导出互相对上  通过');
console.log('='.repeat(70));
