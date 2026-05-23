const { generateSecuritySupervisorReport, exportFactsToCSV, exportDirtyRecordsToCSV } = require('../src/services/exportService');

console.log('生成安保主管报告...\n');

async function generateReport() {
  console.log('📊 1. 生成事实数据导出...');
  const factsExport = exportFactsToCSV();
  console.log(`   ✅ 已导出 ${factsExport.record_count} 条记录`);
  console.log(`   📁 文件: ${factsExport.filename}`);
  
  console.log('\n📋 2. 生成脏记录导出...');
  const dirtyExport = exportDirtyRecordsToCSV({ status: 'pending' });
  console.log(`   ✅ 已导出 ${dirtyExport.record_count} 条待处理脏记录`);
  console.log(`   📁 文件: ${dirtyExport.filename}`);
  
  console.log('\n🔐 3. 生成安保主管报告...');
  const report = generateSecuritySupervisorReport();
  console.log(`   ✅ JSON报告: ${report.json_file.split('/').pop()}`);
  console.log(`   ✅ 文本报告: ${report.text_file.split('/').pop()}`);
  
  console.log('\n' + '='.repeat(60));
  console.log('                 安保主管报告摘要');
  console.log('='.repeat(60));
  
  const data = report.report;
  
  console.log('\n📈 队列状态:');
  data.summary.queue_status.forEach(s => {
    console.log(`   ${s.status} (可重试:${s.retryable?'是':'否'}): ${s.count}条`);
  });
  
  console.log('\n💀 死信队列:');
  data.summary.dead_letter.forEach(d => {
    console.log(`   ${d.status === 'dead' ? '待处理' : '已恢复'}: ${d.count}条`);
  });
  
  console.log('\n⚠️  脏数据分类:');
  if (data.dirty_records_breakdown.length > 0) {
    data.dirty_records_breakdown.forEach(d => {
      console.log(`   ${d.dirty_type}: 总计${d.total}, 待处理${d.pending}`);
    });
  } else {
    console.log('   暂无脏数据');
  }
  
  console.log('\n👤 待人工处理:');
  if (data.pending_manual_tasks.length > 0) {
    data.pending_manual_tasks.slice(0, 3).forEach((t, i) => {
      console.log(`   ${i+1}. ${t.record_type} - ${t.record_no}`);
      console.log(`      访客: ${t.visitor_name || '未知'}, 重试: ${t.retry_count}次`);
    });
    if (data.pending_manual_tasks.length > 3) {
      console.log(`      ... 还有 ${data.pending_manual_tasks.length - 3} 条`);
    }
  } else {
    console.log('   暂无待人工处理任务');
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('                    报告生成完成');
  console.log('='.repeat(60));
  console.log('\n📁 报告位置: reports/ 目录');
  console.log('📁 导出位置: exports/ 目录');
}

generateReport().catch(console.error);
