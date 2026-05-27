import * as fs from 'fs';
import * as path from 'path';
import reconciliationService from '../src/services/reconciliationService';
import importService from '../src/services/importService';
import reportService from '../src/services/reportService';
import dataStore from '../src/store/dataStore';

async function runDemo() {
  console.log('========================================');
  console.log('  学校后勤对账服务 - 演示流程');
  console.log('========================================\n');

  dataStore.clear();

  console.log('步骤 1: 创建对账批次');
  const batch = reconciliationService.createBatch('2024-05', '系统管理员', '2024年5月对账');
  console.log(`  ✓ 批次创建成功: ${batch.name} (ID: ${batch.id})\n`);

  console.log('步骤 2: 导入补贴名单 (JSON)');
  const subsidyPath = path.join(__dirname, '../examples/subsidy.json');
  const subsidyFile = {
    originalname: 'subsidy.json',
    buffer: fs.readFileSync(subsidyPath),
    size: fs.statSync(subsidyPath).size
  } as Express.Multer.File;
  const subsidyResult = await importService.importSubsidyJson(subsidyFile);
  console.log(`  ✓ 成功导入 ${subsidyResult.records.length} 条补贴记录\n`);

  console.log('步骤 3: 导入刷卡记录 (CSV)');
  const swipePath = path.join(__dirname, '../examples/swipe.csv');
  const swipeContent = fs.readFileSync(swipePath);
  const tempSwipePath = path.join(__dirname, '../uploads/temp_swipe.csv');
  fs.mkdirSync(path.dirname(tempSwipePath), { recursive: true });
  fs.writeFileSync(tempSwipePath, swipeContent);
  const swipeFile = {
    originalname: 'swipe.csv',
    buffer: swipeContent,
    path: tempSwipePath,
    size: fs.statSync(swipePath).size
  } as Express.Multer.File;
  const swipeResult = await importService.importSwipeCsv(swipeFile);
  console.log(`  ✓ 成功导入 ${swipeResult.records.length} 条刷卡记录\n`);

  console.log('步骤 4: 导入退款记录 (CSV)');
  const refundPath = path.join(__dirname, '../examples/refund.csv');
  const refundContent = fs.readFileSync(refundPath);
  const tempRefundPath = path.join(__dirname, '../uploads/temp_refund.csv');
  fs.writeFileSync(tempRefundPath, refundContent);
  const refundFile = {
    originalname: 'refund.csv',
    buffer: refundContent,
    path: tempRefundPath,
    size: fs.statSync(refundPath).size
  } as Express.Multer.File;
  const refundResult = await importService.importRefundCsv(refundFile);
  console.log(`  ✓ 成功导入 ${refundResult.records.length} 条退款记录\n`);

  console.log('步骤 5: 执行自动对账');
  const processedBatch = await reconciliationService.processBatch(batch.id);
  console.log(`  ✓ 对账完成: 共 ${processedBatch?.totalRecords} 条记录`);
  console.log(`     - 匹配通过: ${processedBatch?.matchedRecords} 条`);
  console.log(`     - 存在差异: ${processedBatch?.discrepancyRecords} 条\n`);

  console.log('步骤 6: 查看对账汇总');
  const summary = reconciliationService.getSummary(batch.id);
  if (summary) {
    console.log('  【统计信息】');
    console.log(`     学生总数: ${summary.statistics.totalStudents} 人`);
    console.log(`     有补贴学生: ${summary.statistics.withSubsidy} 人`);
    console.log(`     无补贴学生: ${summary.statistics.withoutSubsidy} 人`);
    console.log('');
    console.log('  【金额汇总】');
    console.log(`     补贴总额度: ¥${summary.amounts.totalSubsidyLimit.toFixed(2)}`);
    console.log(`     刷卡总金额: ¥${summary.amounts.totalSwipe.toFixed(2)}`);
    console.log(`     退餐总金额: ¥${summary.amounts.totalRefund.toFixed(2)}`);
    console.log(`     可补贴金额: ¥${summary.amounts.totalEligible.toFixed(2)}`);
    console.log('');
    if (summary.discrepancyBreakdown.length > 0) {
      console.log('  【差异统计】');
      for (const d of summary.discrepancyBreakdown) {
        console.log(`     ${d.type}: ${d.count}笔, 涉及¥${d.totalAmount.toFixed(2)}`);
      }
    }
    console.log('');
  }

  console.log('步骤 7: 查看差异详情示例');
  const details = dataStore.getDetailsByBatch(batch.id);
  const discrepancyDetails = details.filter(d => d.discrepancies.length > 0);
  
  if (discrepancyDetails.length > 0) {
    const example = discrepancyDetails[0];
    console.log(`  学生: ${example.studentName} (${example.studentId})`);
    console.log(`  补贴上限: ¥${example.totalSubsidyLimit.toFixed(2)}`);
    console.log(`  实际消费: ¥${example.totalSwipeAmount.toFixed(2)}`);
    console.log(`  最终补贴: ¥${example.finalAmount.toFixed(2)}`);
    console.log('  差异原因:');
    for (const d of example.discrepancies) {
      console.log(`     • [${d.severity}] ${d.description}: ${d.detailedExplanation.substring(0, 80)}...`);
    }
    console.log('');
  }

  console.log('步骤 8: 人工复核演示');
  if (discrepancyDetails.length > 0) {
    const detailToReview = discrepancyDetails[0];
    const reviewed = reconciliationService.reviewDetail(
      detailToReview.id,
      '张老师',
      'approve',
      '经核实，情况属实，同意按系统计算结果发放',
    );
    console.log(`  ✓ 已复核: ${reviewed?.studentName} - 状态: ${reviewed?.status}`);
    console.log(`     复核意见: 经核实，情况属实，同意按系统计算结果发放\n`);
  }

  console.log('步骤 9: 生成对账报告 (Excel)');
  try {
    const { filePath, fileName } = await reportService.generateReport(batch.id, 'xlsx');
    console.log(`  ✓ 报告已生成: ${fileName}`);
    console.log(`     文件路径: ${filePath}\n`);
  } catch (e: any) {
    console.log(`  ⚠ 报告生成跳过: ${e.message}\n`);
  }

  console.log('========================================');
  console.log('  演示完成！');
  console.log('========================================');
  console.log('');
  console.log('API 使用说明:');
  console.log('  1. POST /api/reconciliation/batches - 创建对账批次');
  console.log('  2. POST /api/reconciliation/import/subsidy - 导入补贴名单');
  console.log('  3. POST /api/reconciliation/import/swipe - 导入刷卡记录');
  console.log('  4. POST /api/reconciliation/import/refund - 导入退款记录');
  console.log('  5. POST /api/reconciliation/batches/:id/process - 执行对账');
  console.log('  6. GET /api/reconciliation/batches/:id/summary - 获取汇总');
  console.log('  7. GET /api/reconciliation/batches/:id/details - 查看明细');
  console.log('  8. POST /api/reconciliation/details/:id/review - 人工复核');
  console.log('  9. GET /api/reconciliation/batches/:id/report/xlsx - 下载报告');
}

runDemo().catch(console.error);
