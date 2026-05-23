import { BatchRepository, AuditLogRepository, AbnormalPhotoRepository } from '../src/repositories';
import { BatchStatus, AuditAction } from '../src/types';
import { BatchService } from '../src/services';

const batchRepo = new BatchRepository();
const auditLogRepo = new AuditLogRepository();
const abnormalPhotoRepo = new AbnormalPhotoRepository();
const batchService = new BatchService();

async function findFailedBatches() {
  const failedBatches = await batchRepo.findByStatus(BatchStatus.FAILED);
  const partialBatches = await batchRepo.findByStatus(BatchStatus.PARTIAL_SUCCESS);

  console.log('\n异常批次列表:');
  console.log('='.repeat(80));
  console.log(`${'状态'.padEnd(18)}${'批次号'.padEnd(20)}${'VIN'.padEnd(20)}${'提交次数'.padEnd(10)}`);
  console.log('-'.repeat(80));

  [...failedBatches, ...partialBatches].forEach(batch => {
    console.log(`${batch.status.padEnd(18)}${batch.batchNo.padEnd(20)}${batch.vin.padEnd(20)}${String(batch.submitCount).padEnd(10)}`);
  });

  console.log('='.repeat(80));
  console.log(`失败批次: ${failedBatches.length} 个, 部分成功: ${partialBatches.length} 个`);

  return [...failedBatches, ...partialBatches];
}

async function findUnreviewedAbnormalPhotos() {
  const batches = await batchRepo.findAll();
  const allUnreviewed: any[] = [];

  for (const batch of batches) {
    const unreviewed = await abnormalPhotoRepo.findUnreviewedByBatchId(batch.id);
    if (unreviewed.length > 0) {
      unreviewed.forEach((p: any) => {
        allUnreviewed.push({
          ...p,
          batchNo: batch.batchNo,
          vin: batch.vin
        });
      });
    }
  }

  console.log('\n未审核的异常照片:');
  console.log('='.repeat(80));
  console.log(`${'批次号'.padEnd(20)}${'类型'.padEnd(15)}${'严重程度'.padEnd(10)}${'上报人'.padEnd(12)}${'上报时间'.padEnd(20)}`);
  console.log('-'.repeat(80));

  allUnreviewed.forEach(p => {
    console.log(`${p.batchNo.padEnd(20)}${p.abnormalType.padEnd(15)}${p.severity.padEnd(10)}${p.reportedBy.padEnd(12)}${new Date(p.reportedAt).toLocaleString().padEnd(20)}`);
    console.log(`  ${p.description}`);
  });

  console.log('='.repeat(80));
  console.log(`共 ${allUnreviewed.length} 张异常照片待审核`);

  return allUnreviewed;
}

async function findRecentAuditLogs(limit: number = 50) {
  const logs = await auditLogRepo.findAll(limit);
  
  console.log(`\n最近 ${limit} 条操作日志:`);
  console.log('='.repeat(100));
  console.log(`${'时间'.padEnd(20)}${'操作人'.padEnd(12)}${'操作类型'.padEnd(25)}${'批次'.padEnd(15)}${'备注'.padEnd(20)}`);
  console.log('-'.repeat(100));

  logs.forEach(log => {
    console.log(
      `${new Date(log.createdAt).toLocaleString().padEnd(20)}${(log.operator || '-').padEnd(12)}${log.action.padEnd(25)}${(log.batchId || '-').substring(0, 13).padEnd(15)}${(log.remark || '-').substring(0, 18).padEnd(20)}`
    );
  });
}

async function replayFailedBatch(batchId: string, operator: string) {
  console.log(`\n正在重放批次: ${batchId}`);
  
  try {
    const batch = await batchRepo.findById(batchId);
    if (!batch) {
      throw new Error('批次不存在');
    }

    const detail = await batchService.getBatchDetail(batchId);
    if (!detail) {
      throw new Error('无法获取批次详情');
    }

    console.log(`  原状态: ${batch.status}`);
    console.log(`  提交次数: ${batch.submitCount}`);
    console.log(`  开始重放...`);

    const submitRequest = {
      batchNo: batch.batchNo,
      vin: batch.vin,
      plateNumber: batch.plateNumber,
      responsiblePerson: batch.responsiblePerson,
      strategy: batch.idempotentStrategy,
      inspectionSheets: detail.inspectionSheets.map((s: any) => ({
        sheetNo: s.sheetNo,
        inspector: s.inspector,
        inspectionDate: s.inspectionDate,
        mileage: s.mileage,
        overallStatus: s.overallStatus,
        items: s.items,
        remarks: s.remarks
      })),
      repairQuotes: detail.repairQuotes.map((q: any) => ({
        quoteNo: q.quoteNo,
        workshop: q.workshop,
        quotedBy: q.quotedBy,
        quoteDate: q.quoteDate,
        totalAmount: q.totalAmount,
        items: q.items,
        laborCost: q.laborCost,
        partsCost: q.partsCost,
        remarks: q.remarks
      })),
      photoItems: detail.photoItems.map((p: any) => ({
        photoNo: p.photoNo,
        category: p.category,
        name: p.name,
        url: p.url,
        thumbnail: p.thumbnail,
        uploadedBy: p.uploadedBy,
        uploadedAt: p.uploadedAt,
        isAbnormal: p.isAbnormal,
        abnormalDesc: p.abnormalDesc
      })),
      smsScreenshots: detail.smsScreenshots.map((s: any) => ({
        smsNo: s.smsNo,
        sender: s.sender,
        receiver: s.receiver,
        content: s.content,
        sentAt: s.sentAt,
        url: s.url,
        uploadedBy: s.uploadedBy,
        uploadedAt: s.uploadedAt
      })),
      operator,
      operatorRole: 'admin'
    };

    const result = await batchService.submitBatch(submitRequest);
    
    console.log(`  重放完成!`);
    console.log(`  新状态: ${result.status}`);
    console.log(`  成功: ${result.successItems}/${result.totalItems} 项`);
    
    if (result.errors.length > 0) {
      console.log(`  错误:`);
      result.errors.forEach(e => console.log(`    - [${e.type}] ${e.field}: ${e.message}`));
    }

    return result;
  } catch (e: any) {
    console.error(`  重放失败: ${e.message}`);
    throw e;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'list';

  console.log('二手车整备验收回放链路服务 - 异常回放工具');
  console.log('='.repeat(50));

  switch (command) {
    case 'list':
      await findFailedBatches();
      await findUnreviewedAbnormalPhotos();
      await findRecentAuditLogs();
      break;

    case 'failed':
      await findFailedBatches();
      break;

    case 'unreviewed':
      await findUnreviewedAbnormalPhotos();
      break;

    case 'logs':
      const limit = parseInt(args[1]) || 50;
      await findRecentAuditLogs(limit);
      break;

    case 'replay':
      const batchId = args[1];
      const operator = args[2] || 'replay-bot';
      if (!batchId) {
        console.error('请指定批次ID: npm run replay -- replay <batchId> [operator]');
        process.exit(1);
      }
      await replayFailedBatch(batchId, operator);
      break;

    default:
      console.log(`
用法:
  npm run replay -- list           # 列出所有异常
  npm run replay -- failed         # 列出失败/部分成功的批次
  npm run replay -- unreviewed     # 列出未审核的异常照片
  npm run replay -- logs [N]       # 查看最近N条操作日志
  npm run replay -- replay <id>    # 重放指定批次
      `);
  }
}

main().catch(console.error);
