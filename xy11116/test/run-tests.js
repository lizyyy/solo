const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { parse } = require('csv-parse/sync');

const {
  OUTPUT_COLUMNS,
  separateResults,
  formatSummary,
  normalizeUnit
} = require('../src/converter');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ 测试失败: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

function cleanOutputDir() {
  const outputDir = path.join(__dirname, '../output');
  if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
}

function test1_unitConversion() {
  console.log('\n=== 测试1: 单位转换 ===');
  
  const result1 = normalizeUnit(25, '公斤');
  assert(result1.quantity === 25000 && result1.unit === '克', '公斤转克正确');
  
  const result2 = normalizeUnit(500, '克');
  assert(result2.quantity === 500 && result2.unit === '克', '克保持不变');
  
  const result3 = normalizeUnit(1.5, 'kg');
  assert(result3.quantity === 1500 && result3.unit === '克', 'kg缩写支持');
}

function test2_columnOrder() {
  console.log('\n=== 测试2: 输出列顺序 ===');
  
  const expected = [
    '配方名称', '产品编码', '原料名称', '原料编码',
    '基准用量', '基准单位', '换算比例', '换算后用量',
    '换算后单位', '订单份数', '备注'
  ];
  
  assert(
    JSON.stringify(OUTPUT_COLUMNS) === JSON.stringify(expected),
    '输出列顺序固定正确'
  );
}

function test3_separateResults() {
  console.log('\n=== 测试3: 结果分离 ===');
  
  const testRows = [
    { '配方名称': '测试面包', '产品编码': 'T-001', '原料名称': '面粉', '原料编码': 'F-001', '基准用量': 1000, '基准单位': '克', '备注': '' },
    { '配方名称': '测试面包', '产品编码': 'T-001', '原料名称': '黄油', '原料编码': 'B-001', '基准用量': 0.5, '基准单位': '公斤', '备注': '' }
  ];
  
  const { normal, halfOrder, mixedUnit } = separateResults(testRows, 1, 1);
  assert(normal.length === 2, '正常结果正确');
  assert(halfOrder.length === 0, '无半份订单时正确分离');
  assert(mixedUnit.length === 1, '公斤单位记录正确分离');
}

function test4_halfOrderSeparation() {
  console.log('\n=== 测试4: 半份订单分离 ===');
  
  const testRows = [
    { '配方名称': '测试面包', '产品编码': 'T-001', '原料名称': '面粉', '原料编码': 'F-001', '基准用量': 100, '基准单位': '克', '备注': '' }
  ];
  
  const { normal, halfOrder } = separateResults(testRows, 1, 0.5);
  assert(normal.length === 0, '半份订单不进入正常结果');
  assert(halfOrder.length === 1, '半份订单进入独立分类');
}

function test5_summaryCalculation() {
  console.log('\n=== 测试5: 汇总计算 ===');
  
  const testRows = [
    { '配方名称': 'A', '产品编码': 'A-001', '原料名称': 'R1', '原料编码': 'R-001', '基准用量': 100, '基准单位': '克', '换算比例': 2, '换算后用量': 200, '换算后单位': '克', '订单份数': 1, '备注': '' },
    { '配方名称': 'A', '产品编码': 'A-001', '原料名称': 'R2', '原料编码': 'R-002', '基准用量': 0.5, '基准单位': '公斤', '换算比例': 2, '换算后用量': 1, '换算后单位': '公斤', '订单份数': 1, '备注': '' }
  ];
  
  const summary = formatSummary(testRows, 2, 1);
  assert(summary['配方总数'] === 1, '配方总数正确');
  assert(summary['原料行数'] === 2, '原料行数正确');
  assert(summary['总重量(克)'] === '1200.0', '总重量计算正确');
}

function test6_cliNormalConversion() {
  console.log('\n=== 测试6: CLI正常换算 ===');
  
  cleanOutputDir();
  
  const inputFile = path.join(__dirname, '../samples/烘焙配方_输入.csv');
  
  try {
    execSync(`node ${path.join(__dirname, '../bin/cli.js')} "${inputFile}" --scale 2`, {
      stdio: 'pipe',
      encoding: 'utf-8'
    });
  } catch (e) {
    console.log(e.stdout);
    console.error(e.stderr);
    throw e;
  }
  
  const outputDir = path.join(__dirname, '../output');
  const normalFile = path.join(outputDir, '烘焙配方_输入_normal.csv');
  
  assert(fs.existsSync(normalFile), '正常结果文件生成');
  
  let content = fs.readFileSync(normalFile, 'utf-8');
  content = content.replace(/^\uFEFF/, '');
  const rows = parse(content, { columns: true, skip_empty_lines: true });
  
  assert(rows.length === 21, '输出行数正确');
  assert(rows[0]['配方名称'] === '法式牛角面包', '业务数据正确保留');
  assert(rows[0]['产品编码'] === 'BP-CRO-001', '产品编码正确');
  assert(rows[0]['原料编码'] === 'FLR-001', '原料编码正确');
  assert(rows[0]['换算比例'] === '2', '换算比例正确');
}

function test7_cliJsonOutput() {
  console.log('\n=== 测试7: CLI JSON输出（机器可读） ===');
  
  const inputFile = path.join(__dirname, '../samples/烘焙配方_输入.csv');
  
  const output = execSync(`node ${path.join(__dirname, '../bin/cli.js')} "${inputFile}" --scale 1.5 --json`, {
    encoding: 'utf-8'
  });
  
  const json = JSON.parse(output);
  assert(json.summary !== undefined, '包含summary字段');
  assert(json.results !== undefined, '包含results字段');
  assert(json.warnings !== undefined, '包含warnings字段');
  assert(json.results.length === 21, '结果数量正确');
}

function test8_cliSummaryOnly() {
  console.log('\n=== 测试8: CLI仅汇总模式 ===');
  
  const inputFile = path.join(__dirname, '../samples/烘焙配方_输入.csv');
  
  const output = execSync(`node ${path.join(__dirname, '../bin/cli.js')} "${inputFile}" --summary`, {
    encoding: 'utf-8'
  });
  
  assert(output.includes('烘焙工坊配方换算汇总'), '汇总标题正确');
  assert(output.includes('配方总数'), '包含配方总数');
  assert(output.includes('总重量'), '包含总重量');
}

function runAllTests() {
  console.log('========================================');
  console.log('  烘焙工坊烘焙配方换算 - 自动化测试');
  console.log('========================================');
  
  try {
    test1_unitConversion();
    test2_columnOrder();
    test3_separateResults();
    test4_halfOrderSeparation();
    test5_summaryCalculation();
    test6_cliNormalConversion();
    test7_cliJsonOutput();
    test8_cliSummaryOnly();
    
    console.log('\n🎉 所有测试通过!');
    console.log('\n💡 下一步:');
    console.log('  npm link');
    console.log('  烘焙工坊烘焙配方换算 samples/烘焙配方_输入.csv --scale 2');
  } catch (e) {
    console.error('\n❌ 测试执行出错:', e.message);
    process.exit(1);
  }
}

runAllTests();
