const fs = require('fs');
const path = require('path');
const { 
  validatePackage, 
  ANOMALY_TYPES,
  VALIDATION_RESULT 
} = require('../index');

const samplesDir = path.join(__dirname, '..', 'samples');

const tests = [
  {
    name: '正常样例 - 应返回 valid',
    file: 'normal_package.json',
    expected: {
      result: VALIDATION_RESULT.VALID,
      totalAnomalies: 0
    }
  },
  {
    name: '先签收后揽收 - 应返回 error，检测到 SIGNED_BEFORE_COLLECT',
    file: 'anomaly_signed_before_collect.json',
    expected: {
      result: VALIDATION_RESULT.ERROR,
      hasAnomalyType: ANOMALY_TYPES.SIGNED_BEFORE_COLLECT
    }
  },
  {
    name: '跨城市跳点 - 应返回 error，检测到 CITY_JUMP',
    file: 'anomaly_city_jump.json',
    expected: {
      result: VALIDATION_RESULT.ERROR,
      hasAnomalyType: ANOMALY_TYPES.CITY_JUMP
    }
  },
  {
    name: '重复扫描 - 应返回 warning，检测到 DUPLICATE_SCAN',
    file: 'anomaly_duplicate_scan.json',
    expected: {
      result: VALIDATION_RESULT.WARNING,
      hasAnomalyType: ANOMALY_TYPES.DUPLICATE_SCAN
    }
  },
  {
    name: '时间倒流 - 应返回 warning，检测到 TIME_REVERSAL',
    file: 'anomaly_time_reversal.json',
    expected: {
      result: VALIDATION_RESULT.WARNING,
      hasAnomalyType: ANOMALY_TYPES.TIME_REVERSAL
    }
  }
];

function runTests() {
  console.log('========================================');
  console.log('  物流轨迹异常归因 CLI - 测试套件');
  console.log('========================================');
  console.log('');
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    const filePath = path.join(samplesDir, test.file);
    
    if (!fs.existsSync(filePath)) {
      console.log(`✗ [跳过] ${test.name}`);
      console.log(`    原因: 文件不存在 ${filePath}`);
      continue;
    }
    
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(content);
      const traces = data.traces || [];
      
      const result = validatePackage(traces);
      const success = validateResult(result, test.expected);
      
      if (success) {
        console.log(`✓ [通过] ${test.name}`);
        passed++;
      } else {
        console.log(`✗ [失败] ${test.name}`);
        console.log(`    期望结果: ${JSON.stringify(test.expected)}`);
        console.log(`    实际结果: result=${result.result}, anomalies=${result.anomalies.map(a => a.type).join(', ')}`);
        failed++;
      }
    } catch (err) {
      console.log(`✗ [失败] ${test.name}`);
      console.log(`    错误: ${err.message}`);
      failed++;
    }
  }
  
  console.log('');
  console.log('========================================');
  console.log(`  测试结果: ${passed} 通过, ${failed} 失败`);
  console.log('========================================');
  
  process.exit(failed > 0 ? 1 : 0);
}

function validateResult(result, expected) {
  if (expected.result !== undefined && result.result !== expected.result) {
    return false;
  }
  
  if (expected.totalAnomalies !== undefined && result.summary.total !== expected.totalAnomalies) {
    return false;
  }
  
  if (expected.hasAnomalyType) {
    const hasAnomaly = result.anomalies.some(a => a.type === expected.hasAnomalyType);
    if (!hasAnomaly) {
      return false;
    }
  }
  
  return true;
}

runTests();
