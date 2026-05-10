const { initDatabase } = require('../src/database');

async function run() {
  await initDatabase();
  
  const auditService = require('../src/services/auditService');
  const permissionService = require('../src/services/permissionService');
  const refundService = require('../src/services/refundService');

  const dateArg = process.argv[2];
  const date = dateArg || new Date().toISOString().split('T')[0];

console.log('='.repeat(70));
console.log('客服退款权限系统 - 审计日报');
console.log('='.repeat(70));
console.log('');
console.log(`报告日期: ${date}`);
console.log('');

const report = auditService.generateDailyReport(date);

console.log('【1. 操作汇总】');
console.log('-'.repeat(50));

const opSummary = report.summary;
const allOps = {
  'REFUND_REQUEST_CREATE': ['创建退款请求', 'success', 'failed'],
  'REFUND_COMPLETE': ['完成退款', 'success', 'failed'],
  'REFUND_CANCEL': ['取消退款', 'success', 'failed'],
  'REFUND_MANUAL_FIX': ['人工修正', 'success', 'failed'],
  'APPROVAL_APPROVE': ['审批通过', 'success', 'failed'],
  'APPROVAL_REJECT': ['审批拒绝', 'success', 'failed'],
  'OVERRIDE_ATTEMPT': ['越权尝试', 'blocked', 'failed']
};

for (const [key, [label, ...results]] of Object.entries(allOps)) {
  const counts = results.map(r => `${r}:${opSummary[`${key}_${r}`] || 0}`).join(', ');
  if (Object.keys(opSummary).some(k => k.startsWith(key))) {
    console.log(`  ${label}: ${counts}`);
  }
}

const totalOps = report.by_operator.reduce((sum, op) => sum + op.total_ops, 0);
console.log(`\n  总操作数: ${totalOps}`);

console.log('');
console.log('【2. 按操作员统计】');
console.log('-'.repeat(50));

if (report.by_operator.length > 0) {
  console.log('  操作员ID'.padEnd(18) + '等级'.padEnd(12) + '操作数'.padEnd(8) + '失败数'.padEnd(8));
  console.log('  ' + '-'.repeat(50));
  
  for (const op of report.by_operator) {
    const staff = permissionService.getStaffById(op.operator_id);
    const name = staff ? staff.name : '未知';
    console.log(
      `  ${op.operator_id}`.padEnd(18) +
      `${op.operator_level || '-'} - ${name}`.padEnd(20) +
      `${op.total_ops}`.padEnd(8) +
      `${op.failed_count}`.padEnd(8)
    );
  }
} else {
  console.log('  (无数据)');
}

console.log('');
console.log('【3. 越权尝试记录】');
console.log('-'.repeat(50));

if (report.override_attempts.length > 0) {
  console.log('  时间'.padEnd(20) + '操作员'.padEnd(20) + '详情');
  console.log('  ' + '-'.repeat(60));
  
  for (const attempt of report.override_attempts) {
    try {
      const detail = typeof attempt.detail === 'string' ? JSON.parse(attempt.detail) : attempt.detail;
      const time = new Date(attempt.created_at * 1000).toLocaleString('zh-CN');
      const reason = detail?.reason || attempt.detail;
      console.log(`  ${time}`.padEnd(22) + `${attempt.operator_name}`.padEnd(20) + reason);
    } catch {
      console.log(`  ${attempt.created_at}`.padEnd(22) + `${attempt.operator_name}`.padEnd(20) + attempt.detail);
    }
  }
} else {
  console.log('  (无越权尝试记录)');
}

console.log('');
console.log('【4. 业务状态概览】');
console.log('-'.repeat(50));

const statuses = ['pending', 'awaiting_approval', 'approved', 'completed', 'rejected', 'cancelled'];
const statusLabels = {
  pending: '待处理',
  awaiting_approval: '待审批',
  approved: '已批准',
  completed: '已完成',
  rejected: '已拒绝',
  cancelled: '已取消'
};

for (const status of statuses) {
  const result = refundService.listRefundRequests({ status, page_size: 1 });
  const count = result.pagination.total;
  if (count > 0) {
    console.log(`  ${statusLabels[status]}: ${count} 笔`);
  }
}

console.log('');
console.log('='.repeat(70));
console.log('');
console.log('【下一步操作建议】');
console.log('-'.repeat(50));
console.log('  • 有越权尝试记录 → 查看 /api/audit/override-attempts');
console.log('  • 审批数较多 → 查看 /api/approvals/pending');
console.log('  • 需要追踪某笔退款 → GET /api/refunds/{requestId} 查看完整时间线');
console.log('  • 需要排查问题 → 查看日志文件 logs/app.log');
console.log('');
}

run().catch(err => {
  console.error('执行失败:', err.message);
  process.exit(1);
});
