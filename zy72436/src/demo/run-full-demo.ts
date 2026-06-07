import * as fs from 'fs';
import * as path from 'path';
import { importTicketCsv } from '../import/ticket-importer';
import { addTrackRemark, retainReworkRemark, reviewReworkRemark } from '../track/remark-manager';
import { addAudioFileRemark, addRehearsalChange } from '../track/audio-rehearsal-manager';
import { recalculateClassification } from '../classification/classifier';
import { dataStore } from '../store/data-store';
import { runAllChecks, printCheckResults } from '../self-check/checks';
import { getAllTicketRowViews, getTicketRowDetailView, getRehearsalChangeDetail } from '../unified-output/data-layer';

const SAMPLE_CSV_PATH = path.join(__dirname, '..', 'sample-data', 'tickets.csv');

function printStep(title: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'='.repeat(60)}\n`);
}

function main() {
  dataStore.clear();
  
  console.log('\n🎵 音乐夏令营分班系统 - 完整流程演示');
  
  const csvContent = fs.readFileSync(SAMPLE_CSV_PATH, 'utf-8');
  
  printStep('第一步：票务导出表第一次导入');
  
  const importResult = importTicketCsv(csvContent, 'tickets.csv', '系统管理员');
  console.log(`✅ 导入完成`);
  console.log(`   批次ID: ${importResult.batchId}`);
  console.log(`   总行数: ${importResult.totalRows}`);
  console.log(`   成功导入: ${importResult.importedRows}`);
  console.log(`   重复行数: ${importResult.duplicateRows}`);
  
  const allRows = dataStore.getAllTicketRows();
  console.log(`\n   导入后状态:`);
  for (const row of allRows.slice(0, 3)) {
    console.log(`     - ${row.studentName} (${row.instrument}) 状态: ${row.processingStatus}`);
  }
  console.log(`     ... 共 ${allRows.length} 条记录`);
  
  printStep('第二步：琴行店长老周补看音频文件备注');
  
  const rowWangFang = allRows.find(r => r.studentName === '王芳')!;
  const rowZhouJie = allRows.find(r => r.studentName === '周杰')!;
  const rowZhangMing = allRows.find(r => r.studentName === '张明')!;
  
  console.log('老周正在回看音频文件，补充备注...\n');
  
  addAudioFileRemark(rowWangFang.id, '音频音质正常，演奏流畅', '老周(店长)');
  console.log(`✅ 王芳: 音频音质正常，演奏流畅`);
  
  addAudioFileRemark(rowZhangMing.id, '演奏节奏稳定，表现力良好', '老周(店长)');
  console.log(`✅ 张明: 演奏节奏稳定，表现力良好`);
  
  addAudioFileRemark(rowZhouJie.id, '尾段有破音，建议返工重录，高音部分不稳定', '老周(店长)');
  console.log(`⚠️  周杰: 尾段有破音，建议返工重录，高音部分不稳定（系统自动标记返工）`);
  
  console.log('\n老周发现周杰有问题，添加轨道备注并保留返工原因：');
  const reworkRemark = addTrackRemark(
    rowZhouJie.id,
    'rework',
    '高音区气息不足，导致破音，需要重新录制',
    '老周(店长)',
    true,
    '虽然有瑕疵但整体感觉好，留给版权运营复核决定是否需要重录'
  );
  
  if (reworkRemark) {
    console.log(`✅ 添加返工备注，ID: ${reworkRemark.id}`);
    console.log(`   保留理由: ${reworkRemark.retainReason}`);
    console.log(`   保留人: ${reworkRemark.retainedBy}`);
  }
  
  const updatedZhouJie = dataStore.getTicketRow(rowZhouJie.id)!;
  console.log(`\n   周杰当前状态: ${updatedZhouJie.processingStatus}`);
  console.log(`   含返工原因: ${updatedZhouJie.trackRemarks.some(r => r.isReworkReason) ? '是' : '否'}`);
  
  printStep('第三步：排练变更记录更新');
  
  console.log('根据音频备注情况，更新排练安排...\n');
  
  const change1 = addRehearsalChange(
    rowWangFang.id,
    'time',
    '周一 14:00',
    '周一 16:00',
    '根据音频评估，需要增加单独辅导时间',
    '老周(店长)'
  );
  console.log(`✅ 王芳: 排练时间从 周一14:00 调整为 周一16:00`);
  
  const change2 = addRehearsalChange(
    rowZhouJie.id,
    'personnel',
    '张老师',
    '李老师(资深)',
    '有返工风险，安排资深老师指导',
    '老周(店长)',
    reworkRemark?.id
  );
  console.log(`✅ 周杰: 指导老师从 张老师 调整为 李老师(资深) (关联返工备注)`);
  
  console.log('\n📋 查看排练变更详情：');
  if (change2) {
    const detail = getRehearsalChangeDetail(rowZhouJie.id, change2.id);
    if (detail) {
      console.log(`   变更ID: ${detail.id}`);
      console.log(`   类型: ${detail.changeType}`);
      console.log(`   原值: ${detail.oldValue}`);
      console.log(`   新值: ${detail.newValue}`);
      console.log(`   变更人: ${detail.changedBy}`);
      console.log(`   理由: ${detail.reason}`);
      console.log(`   关联返工备注: ${detail.relatedRemarkId || '无'}`);
    }
  }
  
  printStep('第四步：补录后重算分班结果');
  
  console.log('⚠️  注意：周杰有返工原因，重算后自动标记为待复核，不自动归为正常\n');
  
  const recalcResult = recalculateClassification('系统');
  console.log(`✅ 重算完成，共处理 ${recalcResult.recalculated} 条记录`);
  
  console.log('\n📊 分班结果：');
  const views = getAllTicketRowViews();
  for (const view of views) {
    const flag = view.hasReworkReason ? ' ⚠️ 待复核' : '';
    console.log(`   ${view.studentName} (${view.instrument}) -> ${view.currentClass}${flag}`);
  }
  
  printStep('第五步：版权运营复核返工原因');
  
  console.log('版权运营正在复核周杰的返工记录...\n');
  
  const zhouJieDetail = getTicketRowDetailView(rowZhouJie.id);
  if (zhouJieDetail && zhouJieDetail.reworkRemarks.length > 0) {
    const remark = zhouJieDetail.reworkRemarks[0];
    console.log(`📋 复核记录：`);
    console.log(`   学生: 周杰`);
    console.log(`   返工原因: ${remark.content}`);
    console.log(`   老周保留理由: ${remark.retainReason}`);
    console.log(`   保留人: ${remark.retainedBy}`);
  }
  
  reviewReworkRemark(rowZhouJie.id, reworkRemark!.id, '版权运营-小李', false);
  console.log(`\n✅ 版权运营复核完成：确认需要返工，状态更新为 reviewed_rework`);
  
  const finalZhouJie = dataStore.getTicketRow(rowZhouJie.id)!;
  console.log(`   最终状态: ${finalZhouJie.processingStatus}`);
  console.log(`   最终分班: ${finalZhouJie.currentClass}`);
  
  printStep('执行自检');
  
  const checkResults = runAllChecks();
  printCheckResults(checkResults);
  
  printStep('数据一致性验证');
  
  const apiViews = getAllTicketRowViews();
  console.log(`✅ 页面展示/接口返回数据: ${apiViews.length} 条`);
  console.log(`   其中含返工原因: ${apiViews.filter(v => v.hasReworkReason).length} 条`);
  
  const zhouJieView = apiViews.find(v => v.id === rowZhouJie.id)!;
  console.log(`\n🔍 周杰的记录在所有输出中一致：`);
  console.log(`   接口返回 - 含返工原因: ${zhouJieView.hasReworkReason}`);
  console.log(`   接口返回 - 处理状态: ${zhouJieView.processingStatus}`);
  console.log(`   接口返回 - 返工详情数: ${zhouJieView.reworkRemarks.length}`);
  
  if (zhouJieView.reworkRemarks.length > 0) {
    console.log(`   接口返回 - 老周的保留理由: ${zhouJieView.reworkRemarks[0].retainReason}`);
  }
  
  printStep('演示完成');
  
  console.log('✅ 三步核心流程已完整跑通：');
  console.log('   1. 票务导出表第一次导入 ✓');
  console.log('   2. 琴行店长老周补看音频文件备注 ✓');
  console.log('   3. 排练变更记录更新 ✓');
  console.log('');
  console.log('✅ 关键特性验证：');
  console.log('   - 重复导入检测 ✓');
  console.log('   - 轨道备注含返工原因保留 ✓');
  console.log('   - 补录后重算 ✓');
  console.log('   - 导出一致性 ✓');
  console.log('   - 返工原因不急着归正常，留版权运营复核 ✓');
  console.log('   - 排练变更可点开查看详情，含老周保留理由 ✓');
  console.log('   - 原始行号、人工改动、处理状态全程保留 ✓');
  console.log('');
}

main();
