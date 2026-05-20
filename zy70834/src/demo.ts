import { ReconciliationAPI } from './api';
import * as path from 'path';

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('       晨检对账系统演示流程');
  console.log('═══════════════════════════════════════════════\n');

  const api = new ReconciliationAPI('2026-05-20');

  const dataDir = path.join(__dirname, 'data');

  console.log('📥 第一步: 导入数据');
  const importResult = await api.importFromFiles(
    path.join(dataDir, 'classList.csv'),
    path.join(dataDir, 'healthCheck.csv'),
    path.join(dataDir, 'medication.json')
  );
  console.log(`   班级名单: ${importResult.students} 人`);
  console.log(`   晨检记录: ${importResult.healthChecks} 条`);
  console.log(`   用药授权: ${importResult.medications} 条\n`);

  console.log('🔍 第二步: 执行自动对账');
  const results = api.performReconciliation();
  console.log(`   完成对账: ${results.length} 条记录\n`);

  console.log('📊 第三步: 查看汇总统计');
  const summary = api.getSummary();
  console.log(`   学生总数: ${summary.totalStudents}`);
  console.log(`   已通过: ${summary.approved}`);
  console.log(`   已驳回: ${summary.rejected}`);
  console.log(`   需补材料: ${summary.needsMoreInfo}`);
  console.log(`   发热病例: ${summary.feverCases}`);
  console.log(`   药品过期: ${summary.overdueMedications}`);
  console.log(`   未获确认: ${summary.unconfirmedMedications}\n`);

  console.log('👨‍⚕️ 第四步: 人工复核处理');

  const rejectedResults = api.getResultsByStatus('REJECTED');
  console.log(`   共 ${rejectedResults.length} 条驳回记录，逐条处理：`);

  for (const result of rejectedResults) {
    const hasFever = result.discrepancies.some(d => d.type === 'FEVER_DETECTED');
    const hasExpiredMed = result.discrepancies.some(d => d.type === 'OVERDUE_MEDICATION');
    const hasUnconfirmed = result.discrepancies.some(d => d.type === 'PARENT_NOT_CONFIRMED');

    if (hasFever) {
      console.log(`   ✅ 确认发热隔离: ${result.studentName}`);
      console.log(`      差异: 体温异常，${hasExpiredMed ? '药品临期，' : ''}${hasUnconfirmed ? '家长未确认' : ''}`);
      api.rejectResult(result.id, '张校医', 
        '发热病例确认：已启动隔离流程，联系家长接回；' + 
        (hasUnconfirmed ? '用药需家长补签字后再给药' : '按规定处理'));
    } else if (hasExpiredMed) {
      console.log(`   ⚠️ 药品临期: ${result.studentName}`);
      console.log(`      差异: ${result.medication?.medicationName} 有效期不足`);
      api.rejectResult(result.id, '张校医', 
        `药品"${result.medication?.medicationName}"临期，已通知家长更换新药或暂停给药`);
    }

    if (hasUnconfirmed) {
      console.log(`   📝 补签确认: ${result.studentName} 家长刚刚完成确认`);
      api.modifyResult(result.id, '张校医', [
        {
          field: 'medication.parentConfirmed',
          oldValue: false,
          newValue: true,
          reason: '家长电话确认同意，后续补纸质签字',
        }
      ]);
    }
  }

  const needsInfoResults = api.getResultsByStatus('NEEDS_MORE_INFO');
  for (const result of needsInfoResults) {
    const hasUnchecked = result.discrepancies.some(d => d.type === 'SYMPTOMS_UNCHECKED');
    if (hasUnchecked) {
      console.log(`   📋 补充症状说明: ${result.studentName}`);
      console.log(`      差异: 有流涕症状但未标注处理措施`);
      api.modifyResult(result.id, '张校医', [
        {
          field: 'healthCheck.notes',
          oldValue: result.healthCheck?.notes || '',
          newValue: '轻微流涕，精神状态良好，已登记观察，无需特殊处理',
          reason: '晨检老师补充说明：症状轻微，不影响入校',
        }
      ]);
    }
  }

  const pendingResults = api.getResultsByStatus('PENDING');
  if (pendingResults.length > 0) {
    console.log(`   批量通过: ${pendingResults.length} 条记录`);
    api.batchApprove(pendingResults.map((r: any) => r.id), '张校医');
  }
  console.log('');

  console.log('📄 第五步: 生成对账报表');
  const textReport = api.getTextReport('张校医');
  console.log(textReport);

  const outputDir = path.join(__dirname, '..', 'output');
  const fs = require('fs');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  api.exportReportText(path.join(outputDir, 'report.txt'), '张校医');
  api.exportReportJSON(path.join(outputDir, 'report.json'), '张校医');
  api.exportReportCSV(path.join(outputDir, 'report.csv'));

  console.log('✅ 对账流程完成！');
  console.log(`   报表已导出至 output 目录`);
  console.log('   - report.txt: 格式化文本报表');
  console.log('   - report.json: JSON格式详细数据');
  console.log('   - report.csv: CSV格式可打开查看');
}

main().catch(console.error);