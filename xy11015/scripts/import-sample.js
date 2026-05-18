const path = require('path');
const EvaluationStore = require('../src/stores/EvaluationStore');
const { sampleEvaluations } = require('../data/sample-data');

const store = new EvaluationStore(path.join(__dirname, '../data/evaluations.json'));

console.log('开始导入样例数据...');

const result = store.batchImport(sampleEvaluations);

console.log(`导入完成！总计: ${result.total}, 成功: ${result.success}, 失败: ${result.fail}`);

if (result.results.length > 0) {
  result.results.forEach(r => {
    if (r.success) {
      console.log(`  ✓ 第${r.row}行: 订单${r.orderNo} - 成功`);
    } else {
      console.log(`  ✗ 第${r.row}行: 订单${r.orderNo} - 失败: ${r.errors.join(', ')}`);
    }
  });
}
