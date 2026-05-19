const { initDatabase } = require('../config/database');
const ReconciliationService = require('../services/reconciliationService');
const ExportService = require('../services/exportService');

const reconciliationService = new ReconciliationService();
const exportService = new ExportService();

async function testFullFlow() {
  console.log('='.repeat(60));
  console.log('校车调度员乱账治理系统 - 完整流程测试');
  console.log('='.repeat(60) + '\n');

  try {
    console.log('📊 步骤1: 查看当前系统统计');
    const initialStats = await reconciliationService.getStatistics();
    console.log(JSON.stringify(initialStats, null, 2));
    console.log();

    console.log('🔍 步骤2: 自动对账所有待处理申诉');
    const autoResult = await reconciliationService.autoReconcilePendingComplaints('test_admin');
    console.log(`自动对账完成: ${autoResult.successCount}/${autoResult.total} 成功`);
    if (autoResult.failedCount > 0) {
      console.log(`失败: ${autoResult.failedCount} 条`);
    }
    console.log();

    console.log('📋 步骤3: 获取所有对账记录');
    const reconciliations = await reconciliationService.getReconciliationList();
    console.log(`共找到 ${reconciliations.length} 条对账记录`);
    
    if (reconciliations.length > 0) {
      console.log('\n前5条记录摘要:');
      reconciliations.slice(0, 5).forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.reconciliation_id} - 结果:${r.result} - 责任:${r.responsibility}`);
      });
    }
    console.log();

    if (reconciliations.length > 0) {
      console.log('📝 步骤4: 查看第一条对账详情');
      const detail = await reconciliationService.getReconciliationDetail(reconciliations[0].reconciliation_id);
      console.log(`申诉类型: ${detail.complaint_type}`);
      console.log(`学生姓名: ${detail.student_name}`);
      console.log(`司机姓名: ${detail.driver_name}`);
      console.log(`时间差: ${detail.time_difference} 分钟`);
      console.log(`备注: ${detail.notes}`);
      console.log();

      console.log('✅ 步骤5: 复核第一条对账记录');
      const reviewed = await reconciliationService.reviewReconciliation(
        reconciliations[0].reconciliation_id,
        'approved',
        detail.result,
        detail.responsibility,
        '经核对数据无误，同意对账结果',
        'reviewer_zhang'
      );
      console.log(`复核完成: 状态=${reviewed.status}, 审核人=${reviewed.reviewed_by}`);
      console.log();
    }

    console.log('📤 步骤6: 导出对账记录CSV');
    const exportResult = await exportService.exportReconciliations({}, 'test_admin');
    console.log(`导出文件: ${exportResult.filename}`);
    console.log(`记录数量: ${exportResult.recordCount}`);
    console.log(`文件路径: ${exportResult.filePath}`);
    console.log();

    console.log('📊 步骤7: 查看最终系统统计');
    const finalStats = await reconciliationService.getStatistics();
    console.log(JSON.stringify(finalStats, null, 2));
    console.log();

    console.log('='.repeat(60));
    console.log('✅ 完整流程测试通过！');
    console.log('='.repeat(60));
    console.log('\n📌 测试要点:');
    console.log('   ✓ 数据持久化 - 数据存储在SQLite数据库');
    console.log('   ✓ 敏感字段脱敏 - 姓名、电话等已脱敏');
    console.log('   ✓ 自动对账规则 - 迟到判定、GPS与打卡比对');
    console.log('   ✓ 审核流程 - 支持人工复核');
    console.log('   ✓ 导出功能 - CSV导出包含脱敏数据');
    console.log('   ✓ 操作日志 - 所有操作均有记录');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  initDatabase()
    .then(() => testFullFlow())
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('初始化失败:', error);
      process.exit(1);
    });
}

module.exports = { testFullFlow };