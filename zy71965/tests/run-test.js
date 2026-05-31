#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function run(cmd, description) {
  console.log(`\n\x1b[36m▶ ${description}\x1b[0m`);
  console.log(`  $ ${cmd}`);
  try {
    const output = execSync(cmd, { encoding: 'utf8', timeout: 30000 });
    console.log(output.split('\n').slice(0, 15).join('\n'));
    if (output.split('\n').length > 15) {
      console.log('  ... (truncated)');
    }
    return true;
  } catch (e) {
    console.log(`  \x1b[31m✗ 失败: ${e.message}\x1b[0m`);
    return false;
  }
}

console.log('\x1b[35m');
console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║           图像缺陷复核工具 - 完整工作流测试                 ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log('\x1b[0m');

const dataDir = path.join(__dirname, '..', 'data');
if (fs.existsSync(dataDir)) {
  fs.rmSync(dataDir, { recursive: true });
  console.log('  已清理旧数据\n');
}

const tests = [
  () => run('node src/index.js --help', '显示帮助'),
  () => run('node src/index.js status', '查看初始状态'),
  () => run('node src/index.js import tests/samples/training_logs.json', '导入训练日志'),
  () => run('node src/index.js import tests/samples/annotations.json', '导入标注样本'),
  () => run('node src/index.js import tests/samples/evaluation_results.json', '导入评估结果'),
  () => run('node src/index.js status --details --consistency', '查看完整状态和一致性检查'),
  () => run('node src/index.js fix --check', '检查数据问题'),
  () => run('node src/index.js export summary -f md', '导出汇总报告(Markdown)'),
  () => run('node src/index.js export defects -f json --status pending', '导出待复核缺陷(JSON)'),
  () => run('node src/index.js export full -f json', '导出完整数据'),
  () => run('ls -la data/exports/', '查看导出文件'),
];

let passed = 0;
tests.forEach((test, i) => {
  console.log(`\n[${i + 1}/${tests.length}]`);
  if (test()) passed++;
});

console.log('\n');
console.log('\x1b[35m' + '═'.repeat(60) + '\x1b[0m');
console.log(`测试完成: ${passed}/${tests.length} 通过`);

if (passed === tests.length) {
  console.log('\x1b[32m✓ 所有测试通过!\x1b[0m');
  console.log(`
  数据文件位置:
    - 缺陷记录: data/defects/defects.json
    - 标注样本: data/defects/annotations.json  
    - 训练日志: data/logs/training_logs.json
    - 复核历史: data/reviews/review_history.json
    - 导出文件: data/exports/

  下一步:
    1. 开始复核: node src/index.js review
    2. 检查问题: node src/index.js fix
    3. 查看历史: node src/index.js history
  `);
} else {
  console.log('\x1b[31m✗ 部分测试失败，请检查错误\x1b[0m');
}
