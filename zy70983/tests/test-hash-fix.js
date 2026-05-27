const crypto = require('crypto');

function deepSort(obj) {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(deepSort);
  }
  if (typeof obj === 'object') {
    const sorted = {};
    const keys = Object.keys(obj).sort();
    for (const key of keys) {
      sorted[key] = deepSort(obj[key]);
    }
    return sorted;
  }
  return obj;
}

function calculateMaterialHashFixed(material) {
  const sortedMaterial = deepSort(material);
  const sortedData = JSON.stringify(sortedMaterial);
  return crypto.createHash('sha256').update(sortedData).digest('hex');
}

function calculateMaterialHashBuggy(material) {
  const sortedData = JSON.stringify(material, Object.keys(material).sort());
  return crypto.createHash('sha256').update(sortedData).digest('hex');
}

console.log('='.repeat(70));
console.log('哈希计算 Bug 修复验证测试');
console.log('='.repeat(70));

const material1 = {
  batch_no: 'BATCH-001',
  source: '市政运维中心',
  records: [
    { record_no: 'REC-001', streetlight_id: 'SL-10001', alarm_type: 'power_failure' },
    { record_no: 'REC-002', streetlight_id: 'SL-10002', alarm_type: 'communication_error' }
  ]
};

const material2 = {
  batch_no: 'BATCH-001',
  source: '市政运维中心',
  records: [
    { record_no: 'REC-001', streetlight_id: 'SL-10001', alarm_type: 'bulb_burnout' },
    { record_no: 'REC-002', streetlight_id: 'SL-10002', alarm_type: 'controller_fault' }
  ]
};

console.log('\n[材料 1] records[0].alarm_type = power_failure');
console.log('[材料 2] records[0].alarm_type = bulb_burnout');
console.log('两批材料批号、来源、记录数相同，但记录内容不同');

const hash1Buggy = calculateMaterialHashBuggy(material1);
const hash2Buggy = calculateMaterialHashBuggy(material2);

console.log('\n--- 有 Bug 的哈希计算 ---');
console.log('材料 1 哈希:', hash1Buggy);
console.log('材料 2 哈希:', hash2Buggy);
console.log('是否相同:', hash1Buggy === hash2Buggy);
console.log('结果:', hash1Buggy === hash2Buggy ? '❌ 错误：不同材料被判定为相同！' : '✅ 正确');

const hash1Fixed = calculateMaterialHashFixed(material1);
const hash2Fixed = calculateMaterialHashFixed(material2);

console.log('\n--- 修复后的哈希计算 ---');
console.log('材料 1 哈希:', hash1Fixed);
console.log('材料 2 哈希:', hash2Fixed);
console.log('是否相同:', hash1Fixed === hash2Fixed);
console.log('结果:', hash1Fixed === hash2Fixed ? '❌ 错误：不同材料被判定为相同！' : '✅ 正确：不同材料哈希不同');

console.log('\n--- 验证相同材料哈希一致 ---');
const hash1Again = calculateMaterialHashFixed(material1);
console.log('材料 1 再次计算哈希:', hash1Again);
console.log('与第一次是否相同:', hash1Again === hash1Fixed);
console.log('结果:', hash1Again === hash1Fixed ? '✅ 正确：相同材料哈希一致' : '❌ 错误');

console.log('\n--- 验证序列化内容 ---');
console.log('有 Bug 的序列化结果:');
console.log('  ', JSON.stringify(material1, Object.keys(material1).sort()));
console.log('修复后的序列化结果:');
console.log('  ', JSON.stringify(deepSort(material1)));

console.log('\n' + '='.repeat(70));
console.log('测试完成');
console.log('='.repeat(70));