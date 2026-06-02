import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../api/db/index.js';
import batchRepository from '../api/repositories/BatchRepository.js';
import detailRepository from '../api/repositories/DetailRepository.js';
import snapshotRepository from '../api/repositories/SnapshotRepository.js';
import workflowService from '../api/services/WorkflowService.js';
import selfCheckService from '../api/services/SelfCheckService.js';
import auditTrailService from '../api/services/AuditTrailService.js';
import exportService from '../api/services/ExportService.js';
import type { ImportRawRow, CurrencyReviewDecision, DetailStatus, CheckType } from '../shared/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs(): { [key: string]: string } {
  const args: { [key: string]: string } = {};
  process.argv.slice(2).forEach(arg => {
    const [key, value] = arg.split('=');
    if (key.startsWith('--')) {
      args[key.slice(2)] = value || 'true';
    } else {
      args._command = arg;
    }
  });
  return args;
}

function findBatchId(batchArg: string): string | null {
  if (!batchArg) {
    const latest = batchRepository.findAll(undefined, 1, 1);
    if (latest.items.length > 0) {
      return latest.items[0].id;
    }
    return null;
  }
  const byNo = batchRepository.findByBatchNo(batchArg);
  if (byNo) return byNo.id;
  const byId = batchRepository.findById(batchArg);
  if (byId) return byId.id;
  return null;
}

async function commandReset(batchArg: string) {
  const batchId = findBatchId(batchArg);
  if (!batchId) {
    console.log('[RESET] 未找到批次，无需重置');
    return;
  }

  const batch = batchRepository.findById(batchId);
  console.log(`[RESET] 正在重置批次: ${batch?.batchNo}`);

  db.transaction(() => {
    db.prepare('DELETE FROM self_check_results WHERE batch_id = ?').run(batchId);
    db.prepare('DELETE FROM audit_logs WHERE batch_id = ?').run(batchId);
    db.prepare('DELETE FROM settlement_details WHERE batch_id = ?').run(batchId);
    db.prepare('DELETE FROM original_snapshots WHERE batch_id = ?').run(batchId);
    db.prepare('DELETE FROM settlement_batches WHERE id = ?').run(batchId);
  })();

  console.log(`[RESET] 批次 ${batch?.batchNo} 已重置`);
}

async function commandImport(batchArg: string, source: string) {
  console.log('[IMPORT] 开始导入除权日截图数据');

  let rawData: ImportRawRow[];
  
  if (source && fs.existsSync(source)) {
    rawData = JSON.parse(fs.readFileSync(source, 'utf-8'));
  } else {
    rawData = generateSampleData();
    const dataDir = path.resolve(__dirname, '../data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    
    const samplePath = path.join(dataDir, `sample_import_${Date.now()}.json`);
    fs.writeFileSync(samplePath, JSON.stringify(rawData, null, 2));
    console.log(`[IMPORT] 使用示例数据，已保存至: ${samplePath}`);
  }

  const result = await workflowService.step1Import(rawData, 'CLI_OPERATOR', 'PASTE');
  console.log(`[IMPORT] 导入完成，批次号: ${result.batchNo}`);
  console.log(`[IMPORT] 总记录数: ${result.totalRecords}, 异常数: ${result.exceptionRecords}`);
  console.log(`[IMPORT] 批次ID: ${result.id}`);
  
  return result.id;
}

async function commandSelfCheck(batchArg: string, type?: string) {
  const batchId = findBatchId(batchArg);
  if (!batchId) {
    console.log('[SELF-CHECK] 错误：未找到批次');
    return;
  }

  const checkTypes = type ? [type as CheckType] : undefined;
  console.log(`[SELF-CHECK] 开始执行自检: ${type || '全部四项'}`);
  
  const results = await selfCheckService.runAllChecks(batchId, checkTypes);
  
  results.forEach(r => {
    const statusMap: Record<string, string> = { 'PASS': '✅ 通过', 'FAIL': '❌ 失败', 'WARNING': '⚠️  警告' };
    console.log(`  ${statusMap[r.status]} ${r.checkType}: ${r.message}`);
    if (r.affectedDetailIds.length > 0) {
      console.log(`    影响明细数: ${r.affectedDetailIds.length}`);
    }
  });
}

async function commandReplayActions(batchArg: string, step: string) {
  const batchId = findBatchId(batchArg);
  if (!batchId) {
    console.log('[REPLAY] 错误：未找到批次');
    return;
  }

  console.log(`[REPLAY] 重放${step === 'risk_control' ? '风控' : '审计'}操作`);
  
  const actions = auditTrailService.getStepActions(batchId, step as 'risk_control' | 'audit');
  console.log(`[REPLAY] 找到 ${actions.length} 条操作记录`);

  const batch = batchRepository.findById(batchId);
  const operator = step === 'risk_control' ? batch?.riskOperator || 'RISK_REPLAY' : batch?.auditOperator || 'AUDIT_REPLAY';

  if (step === 'risk_control') {
    const details = detailRepository.findByBatchId(batchId);
    const updates: any[] = details.slice(0, 3).map(d => ({
      detailId: d.id,
      taxRate: 0.06,
      taxRateRemark: '重放风控补录 - 标准税费率6%',
      currencyDecision: d.hasMixedCurrency ? ('SUBMIT_REVIEW' as CurrencyReviewDecision) : undefined
    })).filter(u => u.taxRate || u.currencyDecision);

    if (updates.length > 0) {
      const result = await workflowService.step2RiskReview(batchId, operator, updates);
      console.log(`[REPLAY] 重放完成，重算 ${result.recalculatedCount} 条记录`);
    }
  } else {
    const details = detailRepository.findByBatchId(batchId);
    const statusUpdates: Array<{ detailId: string; newStatus: DetailStatus; remark: string }> = details.map(d => ({
      detailId: d.id,
      newStatus: d.hasMixedCurrency ? 'PENDING_REVIEW' : 'APPROVED',
      remark: '重放审计更新'
    }));

    const result = await workflowService.step3AuditUpdate(batchId, operator, statusUpdates);
    console.log(`[REPLAY] 重放完成，更新 ${result.updatedCount} 条记录状态`);
  }
}

async function commandFinalize(batchArg: string, verify: boolean) {
  const batchId = findBatchId(batchArg);
  if (!batchId) {
    console.log('[FINALIZE] 错误：未找到批次');
    return;
  }

  console.log('[FINALIZE] 完成结算批次');
  
  if (verify) {
    await selfCheckService.runAllChecks(batchId);
    const results = await selfCheckService.getCheckResults(batchId);
    const allPassed = results.every(r => r.status === 'PASS');
    console.log(`[FINALIZE] 自检结果: ${allPassed ? '全部通过' : '存在异常'}`);
    
    if (!allPassed) {
      console.log('[FINALIZE] 警告：存在未通过的自检项');
    }
  }

  const result = await workflowService.completeBatch(batchId);
  console.log(`[FINALIZE] 批次 ${result.batchNo} 已完成，状态: ${result.status}`);
}

async function commandExportReport(batchArg: string, format: string) {
  const batchId = findBatchId(batchArg);
  if (!batchId) {
    console.log('[EXPORT] 错误：未找到批次');
    return;
  }

  console.log(`[EXPORT] 导出复盘报告，格式: ${format}`);
  
  const batch = batchRepository.findById(batchId);
  const replayCmd = exportService.generateReplayCommand(batchId);
  
  const exportDir = path.resolve(__dirname, '../data/exports');
  if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });
  
  const reportPath = path.join(exportDir, `report_${batch?.batchNo}_${Date.now()}.${format === 'xlsx' ? 'xlsx' : 'txt'}`);
  
  if (format === 'xlsx') {
    const { buffer, fingerprint } = await exportService.exportToXLSX(batchId);
    fs.writeFileSync(reportPath, buffer);
    console.log(`[EXPORT] Excel报告已导出: ${reportPath}`);
    console.log(`[EXPORT] 数据指纹: ${fingerprint}`);
  } else {
    const report = `
============================================
保险佣金阶梯结算 - 复盘报告
批次号: ${batch?.batchNo}
生成时间: ${new Date().toISOString()}
============================================

1. 批次概览
   - 导入日期: ${batch?.importDate}
   - 导入操作人: ${batch?.importOperator}
   - 风控操作人: ${batch?.riskOperator || '-'}
   - 审计操作人: ${batch?.auditOperator || '-'}
   - 总记录数: ${batch?.totalRecords}
   - 异常记录数: ${batch?.exceptionRecords}
   - 状态: ${batch?.status}

2. 可重跑命令
${replayCmd.command}

3. 命令说明
${replayCmd.description}

4. 预期输出
${replayCmd.expectedOutput}
`;
    fs.writeFileSync(reportPath, report);
    console.log(`[EXPORT] 文本报告已导出: ${reportPath}`);
  }
}

function generateSampleData(): ImportRawRow[] {
  return [
    { lineNo: 1, policyNo: 'POL-001', productName: '终身寿险A款', commissionAmount: '1250000', currency: 'HKD 港币' },
    { lineNo: 2, policyNo: 'POL-002', productName: '重大疾病保险B款', commissionAmount: '¥85000', currency: '人民币 ¥' },
    { lineNo: 3, policyNo: 'POL-003', productName: '年金保险C款', commissionAmount: 'HK$320000', currency: '港币HKD / 人民币CNY' },
    { lineNo: 4, policyNo: 'POL-004', productName: '意外伤害保险D款', commissionAmount: '56000', currency: 'CNY' },
    { lineNo: 5, policyNo: 'POL-005', productName: '百万医疗险E款', commissionAmount: 'HKD 180000', currency: '港币' },
    { lineNo: 6, policyNo: 'POL-006', productName: '终身寿险F款', commissionAmount: '¥ 680000', currency: '¥/HK$' },
    { lineNo: 7, policyNo: 'POL-007', productName: '教育年金G款', commissionAmount: '250000', currency: 'RMB' },
    { lineNo: 8, policyNo: 'POL-008', productName: '养老年金H款', commissionAmount: 'HK$ 950000', currency: 'HKD / 人民币' },
  ];
}

async function main() {
  const args = parseArgs();
  const command = args._command;

  try {
    switch (command) {
      case 'reset':
        await commandReset(args.batch);
        break;
      case 'import':
        await commandImport(args.batch, args.source);
        break;
      case 'self-check':
        await commandSelfCheck(args.batch, args.type);
        break;
      case 'replay-actions':
        await commandReplayActions(args.batch, args.step || 'risk_control');
        break;
      case 'finalize':
        await commandFinalize(args.batch, args.verify === 'true');
        break;
      case 'export-report':
        await commandExportReport(args.batch, args.format || 'xlsx');
        break;
      default:
        console.log(`
保险佣金阶梯结算 - 命令行工具
======================================
可用命令:
  npm run settlement:reset -- --batch=<批次号>
  npm run settlement:import -- --batch=<批次号> --source=<数据文件路径>
  npm run settlement:self-check -- --batch=<批次号> --type=<DUPLICATE_IMPORT|MIXED_CURRENCY|RECALC_AFTER_SUPPLEMENT|EXPORT_CONSISTENCY>
  npm run settlement:replay-actions -- --batch=<批次号> --step=<risk_control|audit>
  npm run settlement:finalize -- --batch=<批次号> --verify
  npm run settlement:export-report -- --batch=<批次号> --format=<xlsx|txt>
        `);
    }
    process.exit(0);
  } catch (error) {
    console.error('命令执行失败:', error);
    process.exit(1);
  }
}

main();
