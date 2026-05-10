const fs = require('fs');
const path = require('path');

const artifactService = require('../services/artifactService');
const signatureService = require('../services/signatureService');
const scanService = require('../services/scanService');
const approvalService = require('../services/approvalService');
const promotionService = require('../services/promotionService');
const rollbackService = require('../services/rollbackService');
const gateRuleService = require('../services/gateRuleService');
const reportService = require('../services/reportService');
const { DB_PATH } = require('../config/database');

console.log('========================================');
console.log('  制品仓库晋级门禁服务 - 演示流程');
console.log('========================================\n');

if (!fs.existsSync(DB_PATH)) {
  console.log('数据库不存在，请先运行: npm run init-db');
  process.exit(1);
}

console.log('--- 场景1: 创建制品但缺少签名、扫描、审批，晋级被拦截 ---');
console.log('');

const artifact1 = artifactService.createArtifact(
  'order-service',
  '2.0.0',
  'test-repo',
  { buildNumber: '1024', commitHash: 'abc123def', buildTime: new Date().toISOString() },
  'builder-zhangsan'
);
console.log(`[1] 创建制品: ${artifact1.name}@${artifact1.version}`);
console.log(`    阶段: ${artifact1.stage}`);
console.log(`    ID: ${artifact1.id}`);
console.log('');

const gateCheck1 = gateRuleService.evaluateGate(artifact1.id);
console.log(`[2] 门禁检查结果:`);
console.log(`    全部通过: ${gateCheck1.summary.allPassed}`);
console.log(`    通过规则: ${gateCheck1.summary.passedRules}/${gateCheck1.summary.totalRules}`);
console.log(`    失败规则: ${gateCheck1.summary.failedRuleNames.join(', ')}`);
console.log('');

try {
  const promotion1 = promotionService.createPromotionRequest(
    artifact1.id,
    'production',
    'ops-lisi'
  );
  console.log(`[3] 晋级请求状态: ${promotion1.status}`);
  console.log(`    失败原因: ${promotion1.failure_reason}`);
} catch (e) {
  console.log(`[3] 晋级失败: ${e.message}`);
}
console.log('');

console.log('--- 场景2: 逐步补齐条件，最终成功晋级 ---');
console.log('');

console.log('[4] 添加数字签名...');
const signature = signatureService.addSignature(
  artifact1.id,
  'jenkins-ci@example.com',
  'sig_' + Date.now(),
  'sha256',
  'jenkins-bot'
);
signatureService.verifySignature(signature.id, true, 'verifier-wangwu');
console.log(`    签名已添加并验证通过`);
console.log('');

console.log('[5] 记录安全扫描结果（无致命/高危漏洞）...');
scanService.recordScan(
  artifact1.id,
  'trivy-v0.48.0',
  {
    scanTime: new Date().toISOString(),
    critical: 0,
    high: 0,
    medium: 2,
    low: 5,
    passed: true,
    reportUrl: 'http://scan-server/reports/1024'
  },
  'scanner-bot'
);
console.log(`    扫描结果已记录: 致命0, 高危0, 通过`);
console.log('');

console.log('[6] 发起并完成审批...');
const approval = approvalService.requestApproval(
  artifact1.id,
  'developer-zhangsan',
  '功能测试通过，准备上线'
);
approvalService.approve(approval.id, 'ops-manager', '同意上线');
console.log(`    审批已通过: ${approval.status} -> approved`);
console.log('');

const gateCheck2 = gateRuleService.evaluateGate(artifact1.id);
console.log(`[7] 再次检查门禁:`);
console.log(`    全部通过: ${gateCheck2.summary.allPassed}`);
gateCheck2.rules.forEach(r => {
  console.log(`    - ${r.ruleName}: ${r.isPassed ? '通过' : '失败'} - ${r.message}`);
});
console.log('');

const promotion2 = promotionService.createPromotionRequest(
  artifact1.id,
  'production',
  'ops-lisi'
);
console.log(`[8] 晋级请求状态: ${promotion2.status}`);
const updatedArtifact = artifactService.getArtifactById(artifact1.id);
console.log(`    制品当前阶段: ${updatedArtifact.stage}`);
console.log('');

console.log('--- 场景3: 查看完整报告和审计追踪 ---');
console.log('');

const report = reportService.getArtifactFullReport(artifact1.id);
console.log('[9] 制品完整报告摘要:');
console.log(`    名称: ${report.artifact.name}@${report.artifact.version}`);
console.log(`    当前阶段: ${report.artifact.currentStage}`);
console.log(`    有效签名: ${report.signatures.valid}/${report.signatures.total}`);
console.log(`    通过扫描: ${report.securityScans.passed}/${report.securityScans.total}`);
console.log(`    审批通过: ${report.approvals.approved}/${report.approvals.total}`);
console.log(`    晋级成功: ${report.promotionHistory.passed}/${report.promotionHistory.total}`);
console.log(`    是否可继续晋级: ${report.summary.canPromote}`);
console.log('');

console.log('--- 场景4: 执行回滚操作 ---');
console.log('');

const rollback = rollbackService.createRollback(
  artifact1.id,
  promotion2.id,
  '发现生产环境性能问题，回滚至上一版本',
  'sre-lead'
);
console.log(`[10] 回滚执行完成:`);
console.log(`    从阶段: ${rollback.from_stage}`);
console.log(`    回退到: ${rollback.to_stage}`);
console.log(`    原因: ${rollback.rollback_reason}`);
console.log('');

const afterRollback = artifactService.getArtifactById(artifact1.id);
console.log(`    制品当前阶段: ${afterRollback.stage}`);
console.log('');

console.log('--- 场景5: 有漏洞的制品无法通过 ---');
console.log('');

const artifact2 = artifactService.createArtifact(
  'payment-service',
  '1.5.0',
  'test-repo',
  { buildNumber: '2048', commitHash: 'xyz789' },
  'builder-zhangsan'
);
console.log(`[11] 创建制品: ${artifact2.name}@${artifact2.version}`);

signatureService.verifySignature(
  signatureService.addSignature(
    artifact2.id,
    'jenkins-ci@example.com',
    'sig_' + Date.now(),
    'sha256',
    'jenkins-bot'
  ).id,
  true,
  'verifier-wangwu'
);
console.log(`    已添加有效签名`);

scanService.recordScan(
  artifact2.id,
  'trivy-v0.48.0',
  {
    scanTime: new Date().toISOString(),
    critical: 1,
    high: 2,
    medium: 3,
    passed: false,
    reportUrl: 'http://scan-server/reports/2048'
  },
  'scanner-bot'
);
console.log(`    扫描结果: 致命1, 高危2, 未通过`);

const approval2 = approvalService.requestApproval(
  artifact2.id,
  'developer-lisi',
  '紧急修复版本'
);
approvalService.approve(approval2.id, 'ops-manager', '紧急审批');
console.log(`    已获得审批`);
console.log('');

const promotion3 = promotionService.createPromotionRequest(
  artifact2.id,
  'production',
  'ops-lisi'
);
console.log(`[12] 晋级结果:`);
console.log(`    状态: ${promotion3.status}`);
console.log(`    失败原因: ${promotion3.failure_reason}`);
const artifact2Stage = artifactService.getArtifactById(artifact2.id);
console.log(`    制品阶段: ${artifact2Stage.stage} (仍在测试仓，未晋级)`);
console.log('');

console.log('--- 查看系统规则配置（可复查）---');
console.log('');

const rules = gateRuleService.getAllRules();
console.log('[13] 当前门禁规则:');
rules.forEach(r => {
  console.log(`    - ${r.name} (${r.rule_type})`);
  console.log(`      优先级: ${r.priority}, 启用: ${r.is_enabled ? '是' : '否'}`);
  console.log(`      配置: ${JSON.stringify(r.config)}`);
});
console.log('');

console.log('--- 仪表盘概览 ---');
console.log('');

const dashboard = reportService.getDashboardSummary();
console.log('[14] 系统概览:');
console.log(`    测试仓制品: ${dashboard.artifacts.test}`);
console.log(`    生产仓制品: ${dashboard.artifacts.production}`);
console.log(`    晋级请求总数: ${dashboard.promotions.total}`);
console.log(`    晋级成功率: ${dashboard.promotions.successRate}%`);
console.log(`    待处理审批: ${dashboard.approvals.pending}`);
console.log(`    门禁规则: ${dashboard.gateRules.enabled}/${dashboard.gateRules.total} 启用`);
console.log('');

console.log('========================================');
console.log('  演示流程完成');
console.log('========================================');
console.log('');
console.log('验收要点:');
console.log('1. 缺少签名/扫描/审批任一条件时，晋级被明确拦截');
console.log('2. 每次门禁检查都记录了具体规则名称和详细信息');
console.log('3. 所有操作（创建、签名、扫描、审批、晋级、回滚）均可追踪');
console.log('4. 回滚操作正确标记并修改制品阶段');
console.log('5. 规则配置存储在数据库中，可随时查看和修改');
console.log('6. 完整报告聚合了所有相关数据，可用于审计');
