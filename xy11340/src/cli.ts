import path from 'path';
import { WarehouseDB } from './database';
import { ImportService } from './importService';
import { BusinessService } from './businessService';
import { ExportService } from './exportService';

async function main() {
  const db = new WarehouseDB();
  await db.init();
  
  const importService = new ImportService(db);
  const businessService = new BusinessService(db);
  const exportService = new ExportService(db);

  const [, , command, subcommand, ...args] = process.argv;

  try {
    switch (command) {
      case 'import':
        await handleImport(importService, subcommand, args);
        break;
      case 'process':
        await handleProcess(businessService);
        break;
      case 'review':
        await handleReview(businessService, db, subcommand, args);
        break;
      case 'export':
        await handleExport(exportService, subcommand, args);
        break;
      case 'status':
        await handleStatus(businessService, db);
        break;
      case 'history':
        await handleHistory(db);
        break;
      case 'errors':
        await handleErrors(db, args);
        break;
      case 'unmatched':
        await handleUnmatched(businessService);
        break;
      default:
        printHelp();
    }
  } finally {
    await db.close();
  }
}

async function handleImport(importService: ImportService, type: string, args: string[]) {
  const filePath = args[0];
  if (!filePath) {
    console.log('请指定文件路径');
    return;
  }

  const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);

  let result;
  switch (type) {
    case 'parts':
      result = await importService.importPartsCsv(absolutePath);
      console.log(`领件单导入完成: 总 ${result.total}, 成功 ${result.success}, 失败 ${result.errors}`);
      console.log(`批次号: ${result.batch}`);
      break;
    case 'repair':
      result = await importService.importRepairJson(absolutePath);
      console.log(`返修单导入完成: 总 ${result.total}, 成功 ${result.success}, 失败 ${result.errors}`);
      console.log(`批次号: ${result.batch}`);
      break;
    case 'rules':
      result = await importService.importRulesJson(absolutePath);
      console.log(`索赔规则导入完成: 总 ${result.total}, 成功 ${result.success}, 失败 ${result.errors}`);
      console.log(`批次号: ${result.batch}`);
      break;
    default:
      console.log('支持的导入类型: parts (领件单CSV), repair (返修单JSON), rules (索赔规则JSON)');
  }
}

async function handleProcess(businessService: BusinessService) {
  const result = await businessService.processClaims();
  console.log(`索赔处理完成:`);
  console.log(`  处理返修单: ${result.total}`);
  console.log(`  生成索赔记录: ${result.created}`);
  console.log(`  跳过: ${result.skipped}`);
}

async function handleReview(businessService: BusinessService, db: WarehouseDB, action: string, args: string[]) {
  const reviewer = args[0] || 'admin';

  if (action === 'all') {
    const approveResult = await businessService.reviewAllPending('approve', reviewer);
    console.log(`批量审核完成: 总 ${approveResult.total}, 已处理 ${approveResult.processed}`);
    return;
  }

  if (action === 'approve' || action === 'reject') {
    const claimId = parseInt(args[1]);
    if (isNaN(claimId)) {
      console.log('请指定索赔记录ID');
      return;
    }
    const reason = args.slice(2).join(' ');
    const success = await businessService.reviewClaim(claimId, action, reviewer, reason);
    console.log(success ? '审核成功' : '审核失败（记录不存在或状态不正确）');
    return;
  }

  const pending = await db.getPendingClaims();
  console.log(`待审核索赔记录 (${pending.length}):`);
  pending.forEach(claim => {
    console.log(`  [${claim.id}] ${claim.claimNo} - ${claim.partCode} - ¥${claim.claimAmount}`);
  });
}

async function handleExport(exportService: ExportService, type: string, args: string[]) {
  const exportDir = exportService.ensureExportDir();
  let outputPath;

  switch (type) {
    case 'claims':
      const status = args[0];
      outputPath = path.join(exportDir, `claims_${Date.now()}.csv`);
      await exportService.exportClaimsToCsv(outputPath, status);
      console.log(`索赔记录已导出到: ${outputPath}`);
      break;
    case 'parts':
      outputPath = path.join(exportDir, `part_orders_${Date.now()}.csv`);
      await exportService.exportPartOrdersToCsv(outputPath);
      console.log(`领件单已导出到: ${outputPath}`);
      break;
    case 'repair':
      outputPath = path.join(exportDir, `repair_orders_${Date.now()}.json`);
      await exportService.exportRepairOrdersToJson(outputPath);
      console.log(`返修单已导出到: ${outputPath}`);
      break;
    case 'errors':
      const batch = args[0];
      outputPath = path.join(exportDir, `import_errors_${Date.now()}.csv`);
      await exportService.exportImportErrorsToCsv(outputPath, batch);
      console.log(`导入错误已导出到: ${outputPath}`);
      break;
    case 'summary':
      outputPath = path.join(exportDir, `claim_summary_${Date.now()}.json`);
      await exportService.exportClaimSummaryToJson(outputPath);
      console.log(`索赔汇总已导出到: ${outputPath}`);
      break;
    default:
      console.log('支持的导出类型: claims, parts, repair, errors, summary');
  }
}

async function handleStatus(businessService: BusinessService, db: WarehouseDB) {
  const summary = await businessService.getClaimSummary();
  const partOrders = await db.getAllPartOrders();
  const repairOrders = await db.getAllRepairOrders();
  const rules = await db.getAllClaimRules();
  
  console.log('=== 系统状态 ===');
  console.log(`领件单数量: ${partOrders.length}`);
  console.log(`返修单数量: ${repairOrders.length}`);
  console.log(`索赔规则数量: ${rules.length}`);
  console.log('');
  console.log('=== 索赔统计 ===');
  console.log(`  待审核: ${summary.pending}`);
  console.log(`  已通过: ${summary.approved}`);
  console.log(`  已驳回: ${summary.rejected}`);
  console.log(`  总金额: ¥${summary.totalAmount.toFixed(2)}`);
  console.log(`  已通过金额: ¥${summary.approvedAmount.toFixed(2)}`);
}

async function handleHistory(db: WarehouseDB) {
  const history = await db.getImportHistory();
  console.log(`导入历史 (${history.length}):`);
  history.forEach(h => {
    console.log(`  ${h.createdAt} - ${h.importBatch}`);
    console.log(`    类型: ${h.importType}, 文件: ${h.sourceFile}`);
    console.log(`    总计: ${h.totalRecords}, 成功: ${h.successCount}, 失败: ${h.errorCount}`);
  });
}

async function handleErrors(db: WarehouseDB, args: string[]) {
  const batch = args[0];
  const errors = await db.getImportErrors(batch);
  console.log(`导入错误 (${errors.length}):`);
  errors.forEach(error => {
    console.log(`  [${error.id}] ${error.importType} - 行 ${error.rowNumber}`);
    console.log(`    错误: ${error.errorMessage}`);
    console.log(`    建议: ${error.suggestion}`);
    console.log(`    原始数据: ${error.rawData}`);
  });
}

async function handleUnmatched(businessService: BusinessService) {
  const unmatched = await businessService.getUnmatchedRepairs();
  console.log(`无法匹配索赔的返修单 (${unmatched.length}):`);
  unmatched.forEach(item => {
    console.log(`  ${item.repairNo} (工单: ${item.workOrderNo}, 故障: ${item.faultType})`);
    item.parts.forEach((p: any) => {
      console.log(`    - ${p.partCode} ${p.partName}: ${p.reason}`);
    });
  });
}

function printHelp() {
  console.log(`
家电售后仓库管理系统 - 使用说明

导入数据:
  npm run import:parts <文件路径>   - 导入领件单CSV
  npm run import:repair <文件路径>  - 导入返修单JSON
  npm run import:rules <文件路径>   - 导入索赔规则JSON

处理索赔:
  npm run dev process               - 处理返修单，生成索赔记录

审核:
  npm run review                    - 查看待审核列表
  npm run review approve <ID> [原因] - 通过审核
  npm run review reject <ID> [原因]  - 驳回审核
  npm run review all                - 批量通过所有待审核

导出:
  npm run export claims [状态]      - 导出索赔记录CSV
  npm run export parts              - 导出领件单CSV
  npm run export repair             - 导出返修单JSON
  npm run export errors [批次]      - 导出导入错误CSV
  npm run export summary            - 导出索赔汇总JSON

查询:
  npm run dev status                - 查看系统状态
  npm run dev history               - 查看导入历史
  npm run dev errors [批次]         - 查看导入错误
  npm run dev unmatched             - 查看无法匹配的返修单

示例:
  npm run import:parts samples/part_orders.csv
  npm run import:repair samples/repair_orders.json
  npm run import:rules samples/claim_rules.json
  npm run dev process
  npm run review
  npm run export claims approved
  `);
}

main().catch(console.error);
