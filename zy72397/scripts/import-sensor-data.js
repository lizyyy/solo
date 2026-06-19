const fs = require('fs');
const path = require('path');
const { cliBootstrap } = require('../src/cli-bootstrap');
const workflowEngine = require('../src/engine/workflow-engine');

const { dataFile, loadResult, getArg, dataStore } = cliBootstrap();

let filePath = getArg('file') || path.join(__dirname, '../data/sample-sensors.json');

const S = '='.repeat(72);
const D = '-'.repeat(72);

console.log(S);
console.log('📥 导入传感器数据');
console.log(S);
console.log(`数据文件: ${dataFile}`);
if (loadResult && loadResult.loaded) {
  console.log(`已加载: ${loadResult.records} 条记录，${loadResult.audit_logs} 条审计日志`);
} else {
  console.log(`加载状态: ${loadResult ? loadResult.reason : '未知'}（从空开始）`);
}
console.log('');

try {
  if (!fs.existsSync(filePath)) {
    console.log(`❌ 样例数据文件不存在: ${filePath}`);
    console.log('');
    console.log('备用样例入口（随时可重建）:');
    console.log('   - 默认: data/sample-sensors.json （项目内自带）');
    console.log('   - 自定义: npm run import -- --file=<你的json路径>');
    console.log('');
    console.log('💡 想直接看完整返工场景？运行:');
    console.log('   npm run prepare-demo');
    console.log('');
    process.exit(1);
  }

  const rawData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  console.log(`读取样例文件: ${filePath}`);
  console.log(`数据条数: ${rawData.length}`);
  console.log('');

  const result = workflowEngine.importSensorData(rawData, 'import-script');

  console.log(D);
  console.log(`✅ 导入成功!`);
  console.log(`   批次号: ${result.batch_id}`);
  console.log(`   新增记录数: ${result.record_count}`);
  console.log(`   新记录ID: ${result.records.join(', ')}`);
  console.log('');

  const stats = dataStore.getStatistics();
  console.log(`📊 导入后总统计:`);
  console.log(`   总记录数:       ${stats.total_records}`);
  console.log(`   需QC复核:       ${stats.needs_qc_review}`);
  console.log(`   含边界问题:     ${stats.has_boundary_issues}`);
  console.log(`   已终态:         ${stats.finalized_records}`);
  console.log('');

  if (stats.has_boundary_issues > 0) {
    console.log('⚠️  检测到边界问题的记录（采样时间缺半小时等，需质检员复核）:');
    dataStore.getUnifiedView({ hasBoundaryIssues: true }).forEach(r => {
      console.log(`   ${r.id} - ${r.sensor_id}`);
      (r.boundary_issues || []).forEach(i => console.log(`     - [${i.issueType}] ${i.message}`));
    });
    console.log('');
  }

  console.log(`💾 数据已持久化到: ${dataFile}`);
  console.log('   后续 replay / rollback / export / web服务 都能读到这批数据');
  console.log('');

  console.log('下一步建议:');
  console.log('   npm run replay -- --record-id=REC-002   ← 看 REC-002 的审计链');
  console.log('   npm run export -- --needs-qc-review=true ← 导出需QC复核的记录');
  console.log('   npm run prepare-demo                      ← 一键跑到返工场景（推荐）');
  console.log('');

} catch (e) {
  console.log(`❌ 导入失败: ${e.message}`);
  console.log(e.stack);
  process.exit(1);
}
