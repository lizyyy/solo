function generateReport(result) {
  const { summary, files } = result;

  console.log('\n========================================');
  console.log('  水产批发档口海鲜温度清洗报告');
  console.log('========================================');
  
  console.log('\n📊 统计汇总:');
  console.log('----------------------------------------');
  console.log(`  总记录数:       ${summary.total_records}`);
  console.log(`  清洗后有效记录: ${summary.clean_records}`);
  console.log('----------------------------------------');
  console.log(`  格式错误数:     ${summary.format_error_count}`);
  console.log(`  时区问题数:     ${summary.timezone_issue_count}`);
  console.log(`  探头换电/变更:  ${summary.probe_battery_change_count}`);
  console.log('----------------------------------------');
  
  const cleanRate = summary.total_records > 0 
    ? ((summary.clean_records / summary.total_records) * 100).toFixed(1) 
    : 0;
  console.log(`  清洗合格率:     ${cleanRate}%`);
  
  console.log('\n📁 生成文件清单:');
  console.log('----------------------------------------');
  const fileDescriptions = {
    '清洗后温度数据': '清洗标准化后的温度数据，稳定排序，可用于diff比较',
    '清洗证据记录': '包含清洗标记的完整证据链，保留所有业务列',
    '格式错误明细': '格式验证不通过的记录及错误详情',
    '时区问题明细': '时区标记或偏移不匹配的记录',
    '探头换电/变更明细': '探头长时间离线或ID变更记录'
  };
  
  Object.entries(files).forEach(([name, path]) => {
    console.log(`  • ${name}`);
    console.log(`    路径: ${path}`);
    if (fileDescriptions[name]) {
      console.log(`    说明: ${fileDescriptions[name]}`);
    }
    console.log();
  });
  
  console.log('========================================');
  console.log('  💡 提示: 使用 diff 工具比较两次运行结果');
  console.log('     例如: diff output1/cleaned-temperature-data.csv output2/cleaned-temperature-data.csv');
  console.log('========================================\n');
}

module.exports = {
  generateReport
};
