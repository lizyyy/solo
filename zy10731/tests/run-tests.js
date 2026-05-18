const LeaseConflictChecker = require('../src/index');
const fs = require('fs');
const path = require('path');

const tests = [
  {
    name: '空目录测试',
    dir: './tests/test-data/empty',
    expected: { formatErrors: 1 }
  },
  {
    name: '正常路径测试 - 包含续租重复、租期重叠、手动续租、扣款失败',
    dir: './tests/test-data/normal',
    expected: { 
      formatErrors: 0,
      duplicateRenewals: 1,
      overlappingLeases: 4,
      manualRenewals: 1,
      paymentFailures: 1
    }
  },
  {
    name: '缺列测试',
    dir: './tests/test-data/missing-columns',
    expected: { formatErrors: 1 }
  },
  {
    name: '重复行和格式错误测试',
    dir: './tests/test-data/duplicate-rows',
    expected: { formatErrors: 1 }
  },
  {
    name: '部分文件损坏测试',
    dir: './tests/test-data/corrupted',
    expected: { formatErrors: 6 }
  }
];

async function runTests() {
  console.log('=== 租赁订单文件自动续租冲突 CLI 验收测试 ===\n');
  
  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    console.log(`测试: ${test.name}`);
    console.log(`  输入目录: ${test.dir}`);
    
    try {
      const outputFile = `./tests/test-results/${test.name.replace(/\s+/g, '-')}-report.json`;
      fs.mkdirSync(path.dirname(outputFile), { recursive: true });
      
      const checker = new LeaseConflictChecker({ outputFile, overwrite: true });
      const result = await checker.check(test.dir);
      
      console.log(`  工具名称: ${result.toolName}`);
      console.log(`  摘要:`);
      console.log(`    - 处理文件数: ${result.summary.totalFiles}`);
      console.log(`    - 有效记录数: ${result.summary.validRecords}`);
      console.log(`    - 格式错误: ${result.summary.formatErrors}`);
      console.log(`    - 续租重复: ${result.summary.duplicateRenewals}`);
      console.log(`    - 租期重叠: ${result.summary.overlappingLeases}`);
      console.log(`    - 手动续租: ${result.summary.manualRenewals}`);
      console.log(`    - 扣款失败: ${result.summary.paymentFailures}`);
      
      let allPassed = true;
      for (const [key, value] of Object.entries(test.expected)) {
        const actual = result.summary[key] || result.issues[key]?.length;
        if (actual !== undefined && actual !== value) {
          console.log(`  ✗ 断言失败: ${key} 期望 ${value}, 实际 ${actual}`);
          allPassed = false;
        }
      }
      
      if (allPassed) {
        console.log('  ✓ 通过\n');
        passed++;
      } else {
        console.log('  ✗ 失败\n');
        failed++;
      }
      
    } catch (error) {
      console.log(`  ✗ 异常: ${error.message}\n`);
      failed++;
    }
  }

  console.log('=== 稳定性测试 - 重复运行同一批输入 ===');
  const stableOutput1 = './tests/test-results/stable-run-1.json';
  const stableOutput2 = './tests/test-results/stable-run-2.json';
  
  const checker1 = new LeaseConflictChecker({ outputFile: stableOutput1, overwrite: true });
  const result1 = await checker1.check('./tests/test-data/normal');
  
  const checker2 = new LeaseConflictChecker({ outputFile: stableOutput2, overwrite: true });
  const result2 = await checker2.check('./tests/test-data/normal');
  
  const isStable = result1.summary.validRecords === result2.summary.validRecords &&
                    result1.summary.totalIssues === result2.summary.totalIssues;
  
  console.log(`  第一次运行: ${result1.summary.totalIssues} 个问题`);
  console.log(`  第二次运行: ${result2.summary.totalIssues} 个问题`);
  console.log(`  结果稳定: ${isStable ? '✓ 是' : '✗ 否'}`);
  
  if (isStable) passed++;
  else failed++;

  console.log('\n=== 测试结果详情 ===');
  const reportFile = './tests/test-results/正常路径测试---包含续租重复、租期重叠、手动续租、扣款失败-report.json';
  const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
  
  console.log('\n问题详情示例:');
  
  if (report.issues.manualRenewals.length > 0) {
    const mr = report.issues.manualRenewals[0];
    console.log(`  手动续租: ${mr.租赁订单编号} (文件: ${mr.原始文件}, 行号: ${mr.行号})`);
  }
  
  if (report.issues.paymentFailures.length > 0) {
    const pf = report.issues.paymentFailures[0];
    console.log(`  扣款失败: ${pf.租赁订单编号} (文件: ${pf.原始文件}, 行号: ${pf.行号})`);
  }
  
  if (report.issues.duplicateRenewals.length > 0) {
    const dr = report.issues.duplicateRenewals[0];
    console.log(`  续租重复: ${dr.租客姓名} - ${dr.房源地址} (${dr.重复续租数}次)`);
    for (const order of dr.涉及订单) {
      console.log(`    - ${order.租赁订单编号} (文件: ${order.原始文件}, 行号: ${order.行号})`);
    }
  }
  
  if (report.issues.overlappingLeases.length > 0) {
    const ol = report.issues.overlappingLeases[0];
    console.log(`  租期重叠: ${ol.房源地址}`);
    for (const lease of ol.重叠租期) {
      console.log(`    - ${lease.租赁订单编号} (${lease.租客姓名}, 文件: ${lease.原始文件}, 行号: ${lease.行号})`);
    }
  }

  console.log(`\n=== 最终结果 ===`);
  console.log(`通过: ${passed}, 失败: ${failed}`);
  console.log(`测试报告已保存到: ./tests/test-results/`);
  
  return failed === 0;
}

runTests().then(success => {
  process.exit(success ? 0 : 1);
});