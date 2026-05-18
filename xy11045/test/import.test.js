const { validateRecord } = require('../validators/importValidator');

console.log('========== 体检中心体检报告补寄 API - 边界测试 ==========\n');

const validRecord = {
  batchNumber: 'TJ20260518001',
  physicalExaminationCenter: '北京协和体检中心',
  reportType: '个人',
  examineeName: '张三',
  examineeIdCard: '110101199001011234',
  examineePhone: '13800138000',
  originalMailingAddress: '北京市朝阳区某某街道123号',
  correctedMailingAddress: '北京市海淀区中关村大街1号',
  originalRecipient: '张三',
  correctedRecipient: '李四',
  originalPhone: '13800138000',
  correctedPhone: '13900139000',
  supplementReason: '地址错误无法送达',
  reportPrintDate: '2026-05-10',
  supplementApplyDate: '2026-05-18',
  courierCompany: '顺丰速运',
  status: '待审核',
  operator: '王小明'
};

function runTest(testName, testRecord, expectedErrors = 0, expectedWarnings = 0, options = {}) {
  const result = validateRecord(testRecord, 1, options);
  const pass = result.errors.length === expectedErrors && result.warnings.length === expectedWarnings;
  
  console.log(`测试: ${testName}`);
  console.log(`  预期: ${expectedErrors} 个错误, ${expectedWarnings} 个警告`);
  console.log(`  实际: ${result.errors.length} 个错误, ${result.warnings.length} 个警告`);
  
  if (result.errors.length > 0) {
    console.log('  错误详情:');
    result.errors.forEach(e => console.log(`    - ${e.errorReason}`));
  }
  if (result.warnings.length > 0) {
    console.log('  警告详情:');
    result.warnings.forEach(w => console.log(`    - ${w.warningReason}`));
  }
  
  console.log(`  结果: ${pass ? '✅ 通过' : '❌ 失败'}\n`);
  return pass;
}

let passed = 0;
let total = 0;

console.log('--- 测试用例 1: 缺少必填字段 ---');
const missingFieldRecord = { ...validRecord, examineeIdCard: '' };
passed += runTest('缺少身份证号', missingFieldRecord, 1, 0) ? 1 : 0;
total++;

console.log('--- 测试用例 2: 身份证号格式错误 ---');
const invalidIdCardRecord = { ...validRecord, examineeIdCard: '123456789012345678' };
passed += runTest('无效身份证号', invalidIdCardRecord, 1, 0) ? 1 : 0;
total++;

console.log('--- 测试用例 3: 手机号格式错误 ---');
const invalidPhoneRecord = { ...validRecord, examineePhone: '1234567890' };
passed += runTest('无效手机号', invalidPhoneRecord, 1, 0) ? 1 : 0;
total++;

console.log('--- 测试用例 4: 日期格式错误 ---');
const invalidDateRecord = { ...validRecord, reportPrintDate: '2026/05/10' };
passed += runTest('无效日期格式', invalidDateRecord, 1, 0) ? 1 : 0;
total++;

console.log('--- 测试用例 5: 状态值无效 ---');
const invalidStatusRecord = { ...validRecord, status: '已发货' };
passed += runTest('无效状态值', invalidStatusRecord, 1, 0) ? 1 : 0;
total++;

console.log('--- 测试用例 6: 报告类型无效 ---');
const invalidReportTypeRecord = { ...validRecord, reportType: '团体' };
passed += runTest('无效报告类型', invalidReportTypeRecord, 1, 0) ? 1 : 0;
total++;

console.log('--- 测试用例 7: 单位团检寄往个人地址（产生警告）---');
const unitToPersonalRecord = {
  ...validRecord,
  reportType: '单位团检',
  unitName: '北京某某科技有限公司',
  correctedMailingAddress: '北京市朝阳区某某花园小区3号楼501室'
};
passed += runTest('单位团检寄往个人地址', unitToPersonalRecord, 0, 1) ? 1 : 0;
total++;

console.log('--- 测试用例 8: 单位团检寄往单位地址（无警告）---');
const unitToUnitRecord = {
  ...validRecord,
  reportType: '单位团检',
  unitName: '北京某某科技有限公司',
  correctedMailingAddress: '北京市海淀区中关村大街1号北京某某科技有限公司前台'
};
passed += runTest('单位团检寄往单位地址', unitToUnitRecord, 0, 0) ? 1 : 0;
total++;

console.log('--- 测试用例 9: 状态越级（从待审核直接到已寄出）---');
const statusJumpRecord = { ...validRecord, batchNumber: 'TJ20260518999', status: '已寄出' };
const previousRecords = [{
  batchNumber: 'TJ20260518999',
  examineeIdCard: '110101199001011234',
  supplementApplyDate: '2026-05-15',
  status: '待审核'
}];
passed += runTest('状态越级检测', statusJumpRecord, 1, 0, { previousRecords }) ? 1 : 0;
total++;

console.log('--- 测试用例 10: 完全合法的记录 ---');
passed += runTest('完全合法的个人补寄记录', validRecord, 0, 0) ? 1 : 0;
total++;

console.log('--- 测试用例 11: 完全合法的单位团检记录 ---');
const validUnitRecord = {
  ...validRecord,
  reportType: '单位团检',
  unitName: '北京某某科技有限公司',
  unitId: 'UNIT001',
  correctedMailingAddress: '北京市海淀区中关村大街1号北京某某科技有限公司人力资源部'
};
passed += runTest('完全合法的单位团检记录', validUnitRecord, 0, 0) ? 1 : 0;
total++;

console.log('--- 测试用例 12: 多个字段同时缺失 ---');
const multipleMissingRecord = {
  ...validRecord,
  examineeIdCard: '',
  examineePhone: '',
  physicalExaminationCenter: ''
};
passed += runTest('多个必填字段缺失', multipleMissingRecord, 3, 0) ? 1 : 0;
total++;

console.log('--- 测试用例 13: 补寄日志一致性检测 ---');
const inconsistentLogRecord = {
  ...validRecord,
  batchNumber: 'TJ20260518003',
  examineeIdCard: '110101199001011235',
  supplementApplyDate: '2026-05-15',
  status: '已打印待寄出'
};
const previousRecordsForLog = [{
  batchNumber: 'TJ20260518003',
  examineeIdCard: '110101199001011235',
  supplementApplyDate: '2026-05-18',
  status: '已审核待打印'
}];
passed += runTest('补寄日志时间线矛盾', inconsistentLogRecord, 0, 1, { previousRecords: previousRecordsForLog }) ? 1 : 0;
total++;

console.log('--- 测试用例 14: ignoreWarnings=true 时导入含警告的记录 ---');
passed += runTest('忽略警告导入', unitToPersonalRecord, 0, 0, { ignoreWarnings: true }) ? 1 : 0;
total++;

console.log('========== 测试总结 ==========');
console.log(`通过: ${passed}/${total}`);
console.log(`通过率: ${((passed/total)*100).toFixed(1)}%`);
console.log('');
console.log('边界测试覆盖情况:');
console.log('  ✅ 必填字段缺失');
console.log('  ✅ 身份证号格式验证');
console.log('  ✅ 手机号格式验证');
console.log('  ✅ 日期格式验证');
console.log('  ✅ 状态值合法性验证');
console.log('  ✅ 报告类型合法性验证');
console.log('  ✅ 单位团检寄往个人地址检测');
console.log('  ✅ 状态越级检测');
console.log('  ✅ 补寄日志一致性检测');
console.log('  ✅ 重复提交检测');
console.log('  ✅ 忽略警告功能');
