/**
 * 演示脚本 - 展示完整的物业装修审批流程
 */

const store = require('../src/models/store');
const approvalService = require('../src/services/approvalService');
const rulesEngine = require('../src/services/rulesEngine');
const fileReader = require('../src/services/fileReader');
const path = require('path');

function printSeparator(title) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('='.repeat(60));
}

function printResult(label, data) {
  console.log(`\n  ${label}:`);
  console.log(`  ${JSON.stringify(data, null, 4).split('\n').join('\n  ')}`);
}

async function main() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║     物业装修验收、违规扣款和押金退还审批系统演示     ║');
  console.log('╚══════════════════════════════════════════════════════╝');

  // ========== 步骤1: 加载扣款规则 ==========
  printSeparator('步骤1: 加载扣款规则');
  const rulesPath = path.join(__dirname, '..', 'data', 'deduction_rules.json');
  const rulesResult = await approvalService.processDeductionRulesFile(rulesPath);
  console.log(`  ✓ 已加载 ${rulesResult.count} 条扣款规则`);
  rulesResult.rules.forEach(r => {
    console.log(`    - ${r.name} [${r.type}] 优先级:${r.priority}`);
  });

  // ========== 步骤2: 导入装修申请 CSV ==========
  printSeparator('步骤2: 导入装修申请 CSV');
  const csvPath = path.join(__dirname, '..', 'data', 'decoration_applications.csv');
  const decorationResult = await approvalService.processDecorationFile(csvPath, 'csv');

  if (decorationResult.duplicate) {
    console.log('  ⚠ 批次已处理，不会重复生效');
    console.log(`    批次信息: ${JSON.stringify(decorationResult.batchInfo)}`);
  } else {
    console.log(`  ✓ 批次ID: ${decorationResult.batchId}`);
    console.log(`  ✓ 批次指纹: ${decorationResult.batchFingerprint}`);
    console.log(`  ✓ 解析错误: ${decorationResult.parseErrors.length} 条`);
    console.log(`\n  分类统计:`);
    console.log(`    ✓ 正常项: ${decorationResult.summary.normal} 条`);
    console.log(`    ⚠ 待确认项: ${decorationResult.summary.pending_confirmation} 条`);
    console.log(`    ✗ 失败项: ${decorationResult.summary.failed} 条`);
  }

  // ========== 步骤3: 查看失败项详情 ==========
  printSeparator('步骤3: 失败项详情（保留原始字段和建议处理方式）');
  if (decorationResult.failed && decorationResult.failed.length > 0) {
    decorationResult.failed.forEach(item => {
      console.log(`\n  ── ${item.ownerName} (${item.address}) ──`);
      console.log(`  建议: ${item.suggestion}`);
      console.log(`  押金: ${item.depositAmount}元, 状态: ${item.acceptanceStatus}`);
      if (item.failedChecks.length > 0) {
        console.log(`  失败原因:`);
        item.failedChecks.forEach(check => {
          console.log(`    ✗ [${check.type}] ${check.message}`);
        });
      }
      console.log(`  原始字段: ${JSON.stringify(item.originalData, null, 2).split('\n').join('\n    ')}`);
    });
  }

  // ========== 步骤4: 导入巡检记录 ==========
  printSeparator('步骤4: 导入巡检 JSON');
  const inspectionPath = path.join(__dirname, '..', 'data', 'inspection_records.json');
  const inspectionResult = await approvalService.processInspectionFile(inspectionPath);
  console.log(`  ✓ 已导入 ${inspectionResult.count} 条巡检记录`);
  inspectionResult.results.forEach(r => {
    const icon = r.result === 'passed' ? '✓' : '✗';
    console.log(`    ${icon} ${r.applicationId} - ${r.result}${r.impact ? ' - 需要复查' : ''}`);
  });

  // ========== 步骤5: 对 APP-002 创建退款审批 ==========
  printSeparator('步骤5: 创建退款审批 - APP-002 (李四)');
  const refundResult = rulesEngine.createRefundApproval(
    'APP-002',
    8000,
    '财务张经理',
    '装修验收通过，申请退还押金'
  );

  if (refundResult.success) {
    console.log(`  ✓ 退款审批已创建`);
    console.log(`    审批ID: ${refundResult.approval.id}`);
    console.log(`    金额: ${refundResult.approval.amount} 元`);
    console.log(`    状态: ${refundResult.approval.status}`);
  } else {
    console.log(`  ✗ 退款审批失败: ${refundResult.error}`);
  }

  // ========== 步骤6: 对 APP-007 创建退款审批 ==========
  printSeparator('步骤6: 创建退款审批 - APP-007 (周九)');
  const refundResult2 = rulesEngine.createRefundApproval(
    'APP-007',
    9000,
    '财务张经理',
    '正常退款申请'
  );

  if (refundResult2.success) {
    console.log(`  ✓ 退款审批已创建`);
    console.log(`    审批ID: ${refundResult2.approval.id}`);
  }

  // ========== 步骤7: 确认退款 - APP-002 ==========
  printSeparator('步骤7: 确认退款执行 - APP-002');
  const refundId = refundResult.approval.id;
  const confirmResult = rulesEngine.confirmRefund(refundId, '财务张经理');

  if (confirmResult.success) {
    console.log(`  ✓ ${confirmResult.message}`);
    console.log(`    退款后押金余额: ${confirmResult.application.depositBalance} 元`);
  } else {
    console.log(`  ✗ 退款确认失败: ${confirmResult.error}`);
  }

  // ========== 步骤8: 重复退款检测 ==========
  printSeparator('步骤8: 重复退款检测 - 再次尝试退款 APP-002');
  const duplicateRefund = rulesEngine.createRefundApproval(
    'APP-002',
    8000,
    '测试用户',
    '测试重复退款'
  );

  if (!duplicateRefund.success) {
    console.log(`  ✓ 重复退款检测生效:`);
    console.log(`    ${duplicateRefund.error}`);
    console.log(`    已有退款记录:`);
    if (duplicateRefund.details && duplicateRefund.details.existingRecords) {
      duplicateRefund.details.existingRecords.forEach(r => {
        console.log(`      - ${r.id}: ${r.amount}元 (${r.status})`);
      });
    }
  }

  // ========== 步骤9: 退款历史追踪 - 重点功能 ==========
  printSeparator('步骤9: 退款历史追踪 - 从历史追到来源');
  const traceResult = approvalService.getRefundTrace(refundId);

  if (traceResult.success) {
    const trace = traceResult.trace;
    console.log(`  ✓ 退款审批: ${trace.refund.id}`);
    console.log(`    金额: ${trace.refund.amount}元, 状态: ${trace.refund.status}`);
    console.log(`    审批人: ${trace.refund.approver}`);

    console.log(`\n  关联装修申请:`);
    console.log(`    业主: ${trace.application.ownerName} (${trace.application.ownerId})`);
    console.log(`    地址: ${trace.application.address}`);
    console.log(`    押金: ${trace.application.depositAmount}元, 余额: ${trace.application.depositBalance}元`);
    console.log(`    验收状态: ${trace.application.acceptanceStatus}`);

    if (trace.inspections.length > 0) {
      console.log(`\n  巡检记录:`);
      trace.inspections.forEach(i => {
        console.log(`    ${i.id}: ${i.inspector} - ${i.result}`);
      });
    }

    if (trace.violations.length > 0) {
      console.log(`\n  违规记录:`);
      trace.violations.forEach(v => {
        console.log(`    ${v.id}: ${v.ruleName} - ${v.description}`);
      });
    }

    console.log(`\n  完整时间线（追溯来源）:`);
    trace.timeline.forEach(event => {
      const icon = {
        'application': '📋',
        'violation': '⚠',
        'freeze': '🔒',
        'inspection': '🔍',
        'acceptance': '✓',
        'deduction': '💰',
        'refund': '⬅'
      }[event.type] || '•';
      console.log(`    ${icon} [${event.time}] ${event.title}: ${event.description}`);
    });
  }

  // ========== 步骤10: 批次去重演示 ==========
  printSeparator('步骤10: 批次去重演示 - 再次提交相同数据');
  const rawData = [
    { id: 'APP-001', ownerId: 'O001', ownerName: '张三', address: '1号楼1单元101', depositAmount: 5000, acceptanceStatus: 'approved', wallType: 'normal' }
  ];
  const firstResult = approvalService.processRawData(rawData, 'decoration');
  console.log(`  首次提交: batchId=${firstResult.batchId || '已存在'}`);

  // 再次提交相同数据
  const secondResult = approvalService.processRawData(rawData, 'decoration');
  if (secondResult.duplicate) {
    console.log(`  ✓ 去重生效: ${secondResult.message}`);
    console.log(`    首次处理时间: ${secondResult.batchInfo.processedAt}`);
    console.log(`    处理记录数: ${secondResult.batchInfo.recordCount}`);
  }

  // ========== 步骤11: 统计信息 ==========
  printSeparator('步骤11: 系统统计');
  const stats = approvalService.getCategoryStats();
  const refunds = approvalService.getAllRefundHistory();

  console.log(`  装修申请总数: ${stats.total}`);
  console.log(`  退款记录数: ${refunds.count}`);
  console.log(`  扣款规则数: ${store.getActiveRules().length}`);

  if (refunds.refunds.length > 0) {
    console.log(`\n  所有退款记录:`);
    refunds.refunds.forEach(r => {
      console.log(`    ${r.id}: ${r.amount}元 - ${r.status} (${r.createdAt})`);
    });
  }

  // ========== 完成 ==========
  printSeparator('演示完成');
  console.log('\n  本地运行说明:');
  console.log('  ─────────────');
  console.log('  1. 安装依赖: npm install');
  console.log('  2. 启动服务: npm start  或  npm run dev');
  console.log('  3. 运行演示: npm run test');
  console.log('  4. 服务地址: http://localhost:3000');
  console.log('');
  console.log('  示例数据位于 data/ 目录:');
  console.log('    - decoration_applications.csv  装修申请CSV');
  console.log('    - inspection_records.json      巡检记录JSON');
  console.log('    - deduction_rules.json         扣款规则JSON');
  console.log('');
  console.log('  API 快速调用:');
  console.log('    curl -X POST http://localhost:3000/api/decoration/upload -F "file=@data/decoration_applications.csv"');
  console.log('    curl -X POST http://localhost:3000/api/inspection/upload -F "file=@data/inspection_records.json"');
  console.log('    curl http://localhost:3000/api/refund');
  console.log('    curl http://localhost:3000/api/refund/<refund_id>/trace');
  console.log('');
}

main().catch(console.error);
