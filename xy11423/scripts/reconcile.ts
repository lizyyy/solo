import { BatchRepository, InspectionSheetRepository, RepairQuoteRepository, PhotoItemRepository, AbnormalPhotoRepository, SmsScreenshotRepository, AuditLogRepository } from '../src/repositories';
import { BatchStatus } from '../src/types';

const batchRepo = new BatchRepository();
const inspectionRepo = new InspectionSheetRepository();
const repairQuoteRepo = new RepairQuoteRepository();
const photoItemRepo = new PhotoItemRepository();
const abnormalPhotoRepo = new AbnormalPhotoRepository();
const smsRepo = new SmsScreenshotRepository();
const auditLogRepo = new AuditLogRepository();

interface ReconcileResult {
  batchNo: string;
  vin: string;
  status: string;
  inspectionSheets: number;
  repairQuotes: number;
  photoItems: number;
  abnormalPhotos: number;
  smsScreenshots: number;
  auditLogs: number;
  submitCount: number;
  issues: string[];
}

async function reconcileBatch(batchId: string): Promise<ReconcileResult> {
  const batch = await batchRepo.findById(batchId);
  if (!batch) {
    throw new Error(`批次 ${batchId} 不存在`);
  }

  const issues: string[] = [];

  const inspectionSheets = await inspectionRepo.findByBatchId(batchId);
  const repairQuotes = await repairQuoteRepo.findByBatchId(batchId);
  const photoItems = await photoItemRepo.findByBatchId(batchId);
  const abnormalPhotos = await abnormalPhotoRepo.findByBatchId(batchId);
  const smsScreenshots = await smsRepo.findByBatchId(batchId);
  const auditLogs = await auditLogRepo.findByBatchId(batchId);

  if (inspectionSheets.length === 0) {
    issues.push('缺少检测单数据');
  }

  if (repairQuotes.length === 0) {
    issues.push('缺少维修报价数据');
  }

  if (photoItems.length === 0) {
    issues.push('缺少照片数据');
  }

  const abnormalPhotoItems = photoItems.filter((p: any) => p.isAbnormal);
  if (abnormalPhotoItems.length !== abnormalPhotos.length) {
    issues.push(`异常照片数量不匹配: 照片标记异常${abnormalPhotoItems.length}张, 异常表记录${abnormalPhotos.length}条`);
  }

  const submitLogs = auditLogs.filter((l: any) => l.action === 'batch_submitted' || l.action === 'batch_re_submitted');
  if (submitLogs.length !== batch.submitCount) {
    issues.push(`提交次数不匹配: 数据库记录${batch.submitCount}次, 审计日志记录${submitLogs.length}次`);
  }

  if (batch.frozen && batch.status !== BatchStatus.FROZEN && batch.status !== BatchStatus.EXPORTED) {
    issues.push('状态异常: 已冻结但状态不是frozen/exported');
  }

  return {
    batchNo: batch.batchNo,
    vin: batch.vin,
    status: batch.status,
    inspectionSheets: inspectionSheets.length,
    repairQuotes: repairQuotes.length,
    photoItems: photoItems.length,
    abnormalPhotos: abnormalPhotos.length,
    smsScreenshots: smsScreenshots.length,
    auditLogs: auditLogs.length,
    submitCount: batch.submitCount,
    issues
  };
}

async function reconcileByVin(vin: string) {
  const batches = await batchRepo.findByVin(vin);
  console.log(`\nVIN: ${vin} 的所有批次对账结果:`);
  console.log('='.repeat(80));

  let totalCost = 0;
  const results = [];
  
  for (const batch of batches) {
    const result = await reconcileBatch(batch.id);
    const quotes = await repairQuoteRepo.findByBatchId(batch.id);
    const batchCost = quotes.reduce((sum: number, q: any) => sum + q.totalAmount, 0);
    totalCost += batchCost;
    results.push({ ...result, totalCost: batchCost });
  }

  results.forEach((r: any, i: number) => {
    console.log(`\n[${i + 1}] 批次: ${r.batchNo}`);
    console.log(`    状态: ${r.status}`);
    console.log(`    检测单: ${r.inspectionSheets} 份`);
    console.log(`    报价单: ${r.repairQuotes} 份 (费用: ¥${r.totalCost.toFixed(2)})`);
    console.log(`    照片: ${r.photoItems} 张 (异常: ${r.abnormalPhotos} 张)`);
    console.log(`    短信: ${r.smsScreenshots} 条`);
    console.log(`    提交次数: ${r.submitCount} 次`);
    console.log(`    审计日志: ${r.auditLogs} 条`);
    if (r.issues.length > 0) {
      console.log(`    ⚠️  问题:`);
      r.issues.forEach((issue: string) => console.log(`       - ${issue}`));
    } else {
      console.log(`    ✅ 数据一致性检查通过`);
    }
  });

  console.log('\n' + '='.repeat(80));
  console.log(`同一车辆历史总整备费用: ¥${totalCost.toFixed(2)}`);
  console.log(`共 ${batches.length} 次返厂记录`);

  return results;
}

async function reconcileAll() {
  const batches = await batchRepo.findAll();
  console.log(`\n所有批次对账 (共 ${batches.length} 个批次):`);
  console.log('='.repeat(100));
  console.log(`${'批次号'.padEnd(20)}${'VIN'.padEnd(20)}${'状态'.padEnd(15)}${'检测单'.padEnd(8)}${'报价单'.padEnd(8)}${'照片'.padEnd(8)}${'问题'.padEnd(8)}`);
  console.log('-'.repeat(100));

  let totalIssues = 0;
  for (const batch of batches) {
    const result = await reconcileBatch(batch.id);
    const hasIssue = result.issues.length > 0 ? '是' : '否';
    if (result.issues.length > 0) totalIssues++;
    console.log(`${result.batchNo.padEnd(20)}${result.vin.padEnd(20)}${result.status.padEnd(15)}${String(result.inspectionSheets).padEnd(8)}${String(result.repairQuotes).padEnd(8)}${String(result.photoItems).padEnd(8)}${hasIssue.padEnd(8)}`);
  }

  console.log('='.repeat(100));
  console.log(`存在问题的批次: ${totalIssues}/${batches.length}`);
}

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || 'all';
  const param = args[1];

  console.log('二手车整备验收回放链路服务 - 对账工具');
  console.log('='.repeat(50));

  switch (mode) {
    case 'vin':
      if (!param) {
        console.error('请指定VIN码: npm run reconcile -- vin <VIN>');
        process.exit(1);
      }
      await reconcileByVin(param);
      break;
    case 'batch':
      if (!param) {
        console.error('请指定批次号: npm run reconcile -- batch <batchId>');
        process.exit(1);
      }
      const result = await reconcileBatch(param);
      console.log(JSON.stringify(result, null, 2));
      break;
    case 'all':
    default:
      await reconcileAll();
  }
}

main().catch(console.error);
