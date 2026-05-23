const fs = require('fs');
const path = require('path');
const { createObjectCsvWriter } = require('csv-writer');
const XLSX = require('xlsx');
const { normalizeSize, validateRow, mergeDuplicates, summarizeByClassAndSize, mapHeaders, parseFile } = require('./processor');
const { exportAll } = require('./exporter');

let passedCount = 0;
let failedCount = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    passedCount++;
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   错误: ${error.message}`);
    failedCount++;
  }
}

function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(`${message} 期望: ${expected}, 实际: ${actual}`);
  }
}

function assertTrue(condition, message = '') {
  if (!condition) {
    throw new Error(message || '断言失败');
  }
}

async function createTestCSV() {
  const testDir = path.join(__dirname, '..', 'test-data');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  const csvPath = path.join(testDir, 'test-data.csv');
  
  const csvWriter = createObjectCsvWriter({
    path: csvPath,
    header: [
      { id: 'name', title: '姓名' },
      { id: 'className', title: '班级' },
      { id: 'size', title: '尺码' },
      { id: 'supplement', title: '增补' },
      { id: 'remark', title: '备注' },
    ],
  });

  const records = [
    { name: '张三', className: '高一1班', size: '160cm', supplement: '', remark: '' },
    { name: '李四', className: '高一1班', size: '165', supplement: '', remark: '' },
    { name: '王五', className: '高一2班', size: 'XL', supplement: '是', remark: '' },
    { name: '赵六', className: '高一2班', size: '170', supplement: '', remark: '' },
    { name: '张三', className: '高一1班', size: '160', supplement: '', remark: '重复记录' },
    { name: '', className: '高一2班', size: '175', supplement: '', remark: '缺姓名' },
    { name: '孙七', className: '', size: '180', supplement: '', remark: '缺班级' },
    { name: '周八', className: '高一1班', size: '', supplement: '', remark: '缺尺码' },
    { name: '吴九', className: '高一1班', size: '加大', supplement: '', remark: '' },
    { name: '郑十', className: '高一2班', size: '中号', supplement: '', remark: '' },
  ];

  await csvWriter.writeRecords(records);
  return csvPath;
}

function createTestExcel() {
  const testDir = path.join(__dirname, '..', 'test-data');
  const excelPath = path.join(testDir, 'test-data.xlsx');

  const data = [
    ['姓名', '班级', '校服尺码', '增补', '备注'],
    ['张三', '高一1班', '160cm', '', ''],
    ['李四', '高一1班', '165', '', ''],
    ['王五', '高一2班', 'XL', '是', ''],
    ['赵六', '高一2班', '170', '', ''],
    ['张三', '高一1班', '160', '', '重复记录'],
    ['', '高一2班', '175', '', '缺姓名'],
    ['孙七', '', '180', '', '缺班级'],
    ['周八', '高一1班', '', '', '缺尺码'],
    ['吴九', '高一1班', '加大', '', ''],
    ['郑十', '高一2班', '中号', '', ''],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  XLSX.writeFile(workbook, excelPath);
  
  return excelPath;
}

async function runTests() {
  console.log('🧪 测试 1: 尺码标准化');
  
  await test('数字尺码标准化', () => {
    assertEqual(normalizeSize('160cm'), '160');
    assertEqual(normalizeSize('170'), '170');
  });
  
  await test('字母尺码标准化', () => {
    assertEqual(normalizeSize('xl'), 'XL');
    assertEqual(normalizeSize('XL'), 'XL');
    assertEqual(normalizeSize('m'), 'M');
  });
  
  await test('中文尺码标准化', () => {
    assertEqual(normalizeSize('加大'), 'XL');
    assertEqual(normalizeSize('中号'), 'M');
    assertEqual(normalizeSize('大号'), 'L');
  });

  console.log('\n🧪 测试 2: 表头识别');
  
  await test('识别中文表头', () => {
    const headers = ['姓名', '班级', '校服尺码', '增补', '备注'];
    const mapping = mapHeaders(headers);
    assertEqual(mapping['姓名'], 'name');
    assertEqual(mapping['班级'], 'className');
    assertEqual(mapping['校服尺码'], 'size');
    assertEqual(mapping['增补'], 'supplement');
    assertEqual(mapping['备注'], 'remark');
  });

  console.log('\n🧪 测试 3: 数据校验');
  
  await test('完整数据校验通过', () => {
    const result = validateRow({ name: '张三', className: '高一1班', size: '160' }, 1);
    assertTrue(result.valid, '应该是有效的');
    assertEqual(result.errors.length, 0, '不应该有错误');
  });
  
  await test('缺失字段校验失败', () => {
    const result = validateRow({ name: '', className: '高一1班', size: '160' }, 1);
    assertTrue(!result.valid, '应该是无效的');
    assertTrue(result.errors.length > 0, '应该有错误');
  });

  console.log('\n🧪 测试 4: 重复记录合并');
  
  await test('合并重复学生', () => {
    const data = [
      { name: '张三', className: '高一1班', size: '160', originalRow: 1, remark: '' },
      { name: '张三', className: '高一1班', size: '160', originalRow: 5, remark: '重复' },
      { name: '李四', className: '高一1班', size: '170', originalRow: 2, remark: '' },
    ];
    const { mergedData, duplicates } = mergeDuplicates(data);
    assertEqual(mergedData.length, 2, '合并后应该有2条记录');
    assertEqual(duplicates.length, 1, '应该检测到1条重复');
  });
  
  await test('尺码冲突标记', () => {
    const data = [
      { name: '张三', className: '高一1班', size: '160', originalRow: 1, remark: '' },
      { name: '张三', className: '高一1班', size: '170', originalRow: 5, remark: '' },
    ];
    const { mergedData } = mergeDuplicates(data);
    assertTrue(mergedData[0].remark.includes('尺码冲突'), '应该标记尺码冲突');
  });

  console.log('\n🧪 测试 5: 汇总统计');
  
  await test('按班级和尺码汇总', () => {
    const data = [
      { name: '张三', className: '高一1班', size: '160' },
      { name: '李四', className: '高一1班', size: '160' },
      { name: '王五', className: '高一2班', size: '170' },
      { name: '赵六', className: '高一2班', size: '160' },
    ];
    const summary = summarizeByClassAndSize(data);
    assertEqual(summary.byClass['高一1班'].total, 2);
    assertEqual(summary.byClass['高一2班'].total, 2);
    assertEqual(summary.bySize['160'], 3);
    assertEqual(summary.bySize['170'], 1);
  });

  console.log('\n🧪 测试 6: CSV文件解析');
  
  const csvPath = await createTestCSV();
  await test('CSV文件解析成功', async () => {
    const result = await parseFile(csvPath);
    assertEqual(result.data.length, 10, '应该读取10条记录');
    assertTrue(result.badRows.length > 0, '应该检测到坏行');
  });

  console.log('\n🧪 测试 7: Excel文件解析');
  
  const excelPath = createTestExcel();
  await test('Excel文件解析成功', async () => {
    const result = await parseFile(excelPath);
    assertEqual(result.data.length, 10, '应该读取10条记录');
  });

  console.log('\n🧪 测试 8: 完整处理流程');
  
  await test('完整流程 - 解析、合并、汇总', async () => {
    const result = await parseFile(csvPath);
    const { mergedData, duplicates } = mergeDuplicates(result.data);
    const summary = summarizeByClassAndSize(mergedData);
    
    assertTrue(mergedData.length < result.data.length, '合并后记录应减少');
    assertTrue(Object.keys(summary.byClass).length > 0, '应该有班级统计');
    assertTrue(Object.keys(summary.bySize).length > 0, '应该有尺码统计');
  });

  console.log('\n🧪 测试 9: 文件导出功能');
  
  await test('导出所有格式', async () => {
    const result = await parseFile(csvPath);
    const { mergedData, duplicates } = mergeDuplicates(result.data);
    const summary = summarizeByClassAndSize(mergedData);
    const fullResult = { ...result, mergedData, duplicates, summary };
    
    const outputDir = path.join(__dirname, '..', 'test-output');
    const exportResult = await exportAll(fullResult, outputDir);
    
    assertTrue(fs.existsSync(outputDir), '输出目录应该存在');
    assertTrue(exportResult.outputs.length >= 4, '应该导出至少4个文件');
  });

  console.log('\n🧪 测试 10: 边界情况处理');
  
  await test('空数据处理', () => {
    const { mergedData, duplicates } = mergeDuplicates([]);
    assertEqual(mergedData.length, 0);
    assertEqual(duplicates.length, 0);
    
    const summary = summarizeByClassAndSize([]);
    assertEqual(Object.keys(summary.byClass).length, 0);
    assertEqual(Object.keys(summary.bySize).length, 0);
  });
  
  await test('异常尺码保留原始值', () => {
    const result = validateRow({ name: '张三', className: '高一1班', size: '超大号' }, 1);
    assertTrue(result.warnings.length > 0, '应该有警告');
  });

  console.log('\n🧪 测试 11: 导出功能完整性');
  
  await test('导出包含所有实际尺码（不限于VALID_SIZES）', async () => {
    const result = await parseFile(csvPath);
    const { mergedData, duplicates } = mergeDuplicates(result.data);
    const summary = summarizeByClassAndSize(mergedData);
    
    const testData = {
      ...result,
      mergedData: [
        { name: '测试1', className: '高一1班', size: '165' },
        { name: '测试2', className: '高一1班', size: '175' },
        { name: '测试3', className: '高一2班', size: '165' },
      ],
      duplicates: [],
      summary: summarizeByClassAndSize([
        { name: '测试1', className: '高一1班', size: '165' },
        { name: '测试2', className: '高一1班', size: '175' },
        { name: '测试3', className: '高一2班', size: '165' },
      ]),
    };
    
    const outputDir = path.join(__dirname, '..', 'test-output-verify');
    const exportResult = await exportAll(testData, outputDir);
    
    const summaryPath = path.join(outputDir, 'statistics.json');
    const stats = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    
    assertTrue(Object.keys(stats.summary.bySize).includes('165'), '统计应包含165尺码');
    assertTrue(Object.keys(stats.summary.bySize).includes('175'), '统计应包含175尺码');
    assertEqual(stats.summary.bySize['165'], 2, '165尺码应为2套');
    assertEqual(stats.summary.bySize['175'], 1, '175尺码应为1套');
    
    const csvPath2 = path.join(outputDir, 'class-size-summary.csv');
    const csvContent = fs.readFileSync(csvPath2, 'utf8');
    assertTrue(csvContent.includes('165'), 'CSV导出应包含165列');
    assertTrue(csvContent.includes('175'), 'CSV导出应包含175列');
  });

  console.log('\n' + '═'.repeat(50));
  console.log(`测试结果: 通过 ${passedCount}, 失败 ${failedCount}`);
  console.log('═'.repeat(50));

  return failedCount === 0;
}

module.exports = {
  run: runTests,
};
