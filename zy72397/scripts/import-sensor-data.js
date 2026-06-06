const fs = require('fs');
const path = require('path');
const dataStore = require('../src/store/data-store');
const workflowEngine = require('../src/engine/workflow-engine');

const args = process.argv.slice(2);
let filePath = path.join(__dirname, '../data/sample-sensors.json');

args.forEach((arg, i) => {
  if (arg === '--file' && args[i + 1]) {
    filePath = args[i + 1];
  }
});

console.log('='.repeat(60));
console.log('📥 导入传感器数据');
console.log('='.repeat(60));
console.log('');

try {
  if (!fs.existsSync(filePath)) {
    console.log(`❌ 文件不存在: ${filePath}`);
    console.log('');
    console.log('使用方法: npm run import -- --file=<数据文件路径>');
    console.log('');
    console.log('数据文件格式 (JSON):');
    console.log('[');
    console.log('  {');
    console.log('    "sensor_id": "SEN-001",');
    console.log('    "sensor_name": "传感器名称",');
    console.log('    "turbine_id": "TURBINE-A-01",');
    console.log('    "sampling_time": "2024-06-15T08:00:00.000Z",');
    console.log('    "sampling_start_time": "2024-06-15T08:00:00.000Z",');
    console.log('    "sampling_end_time": "2024-06-15T09:00:00.000Z",');
    console.log('    "efficiency": 92.5,');
    console.log('    "flow_rate": 45.2,');
    console.log('    "head": 38.6,');
    console.log('    "power": 15800');
    console.log('  }');
    console.log(']');
    process.exit(1);
  }
  
  const rawData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  console.log(`读取文件: ${filePath}`);
  console.log(`数据条数: ${rawData.length}`);
  console.log('');
  
  const result = workflowEngine.importSensorData(rawData, 'import-script');
  
  console.log(`✅ 导入成功!`);
  console.log(`   批次号: ${result.batch_id}`);
  console.log(`   记录数: ${result.record_count}`);
  console.log(`   记录ID: ${result.records.join(', ')}`);
  console.log('');
  
  const stats = dataStore.getStatistics();
  console.log(`📊 导入后统计:`);
  console.log(`   总记录数: ${stats.total_records}`);
  console.log(`   需QC复核: ${stats.needs_qc_review}`);
  console.log(`   含边界问题: ${stats.has_boundary_issues}`);
  console.log('');
  
  if (stats.has_boundary_issues > 0) {
    console.log('⚠️  以下记录检测到边界问题:');
    dataStore.getUnifiedView({ needsQcReview: true }).forEach(r => {
      console.log(`   ${r.id} - ${r.sensor_id}`);
      r.boundary_issues.forEach(i => console.log(`     - ${i.message}`));
    });
    console.log('');
  }
  
} catch (e) {
  console.log(`❌ 导入失败: ${e.message}`);
  console.log(e.stack);
  process.exit(1);
}
