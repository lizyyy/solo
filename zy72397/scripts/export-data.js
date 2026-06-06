const fs = require('fs');
const path = require('path');
const dataStore = require('../src/store/data-store');
const workflowEngine = require('../src/engine/workflow-engine');

const demoData = require('../data/sample-sensors.json');
workflowEngine.importSensorData(demoData, 'export-demo');

const args = process.argv.slice(2);
let format = 'json';
let outputPath = null;

args.forEach((arg, i) => {
  if (arg === '--format' && args[i + 1]) {
    format = args[i + 1];
  }
  if (arg === '--output' && args[i + 1]) {
    outputPath = args[i + 1];
  }
});

console.log('='.repeat(60));
console.log(`📤 导出数据 (格式: ${format})`);
console.log('='.repeat(60));
console.log('');
console.log('💡 说明: 导出数据与页面展示、API返回使用同一份数据源');
console.log('');

try {
  const data = dataStore.getExportData(format);
  const stats = dataStore.getStatistics();
  
  console.log(`📊 导出统计:`);
  console.log(`   总记录数: ${stats.total_records}`);
  console.log(`   需QC复核: ${stats.needs_qc_review}`);
  console.log(`   含边界问题: ${stats.has_boundary_issues}`);
  console.log('');
  
  if (outputPath) {
    fs.writeFileSync(outputPath, format === 'csv' ? '\uFEFF' + data : data);
    console.log(`✅ 已导出到: ${outputPath}`);
  } else {
    if (format === 'json') {
      console.log('📋 数据预览 (前2条):');
      const jsonData = JSON.parse(data);
      console.log(JSON.stringify(jsonData.slice(0, 2), null, 2));
    } else {
      const lines = data.split('\n');
      console.log('📋 数据预览 (前5行):');
      lines.slice(0, 5).forEach(line => console.log(line));
    }
    console.log('');
    console.log('使用 --output=<路径> 可保存到文件');
  }
  console.log('');
  
} catch (e) {
  console.log(`❌ 导出失败: ${e.message}`);
  process.exit(1);
}
