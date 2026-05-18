const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const TEST_DIR = path.join(__dirname, 'test-data');
const LOG_FILE = path.join(__dirname, '..', '.refund-process-log.json');

function cleanup() {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
  if (fs.existsSync(LOG_FILE)) {
    fs.unlinkSync(LOG_FILE);
  }
  fs.mkdirSync(TEST_DIR, { recursive: true });
}

async function createTestFile(filename, data) {
  const filePath = path.join(TEST_DIR, filename);
  if (data.length > 0) {
    const csvWriter = createCsvWriter({
      path: filePath,
      header: Object.keys(data[0]).map(key => ({ id: key, title: key }))
    });
    await csvWriter.writeRecords(data);
  } else {
    fs.writeFileSync(filePath, '');
  }
  return filePath;
}

async function createNormalTestData() {
  return [
    {
      '订单编号': 'DD202405010001',
      '班次编号': 'BC-XZ-001',
      '乘客姓名': '张三',
      '身份证号': '440101199001011234',
      '联系电话': '13800138001',
      '发车时间': '2024-05-02 08:30:00',
      '终点站': '县城汽车站',
      '票价': '25.00',
      '票种': '成人票',
      '购票时间': '2024-05-01 10:00:00',
      '是否改签': '否',
      '原订单编号': '',
      '退款申请时间': '2024-05-01 14:00:00',
      '处理状态': '待处理'
    },
    {
      '订单编号': 'DD202405010002',
      '班次编号': 'BC-XZ-001',
      '乘客姓名': '张小宝',
      '身份证号': '440101201501011234',
      '联系电话': '13800138001',
      '发车时间': '2024-05-02 08:30:00',
      '终点站': '县城汽车站',
      '票价': '12.50',
      '票种': '儿童票',
      '购票时间': '2024-05-01 10:00:00',
      '是否改签': '否',
      '原订单编号': '',
      '退款申请时间': '2024-05-01 14:00:00',
      '处理状态': '待处理'
    },
    {
      '订单编号': 'DD202405010003',
      '班次编号': 'BC-XZ-002',
      '乘客姓名': '李四',
      '身份证号': '440101198505055678',
      '联系电话': '13900139002',
      '发车时间': '2024-05-03 14:00:00',
      '终点站': '邻镇客运站',
      '票价': '18.00',
      '票种': '成人票',
      '购票时间': '2024-05-01 09:00:00',
      '是否改签': '是',
      '原订单编号': 'DD202404280005',
      '退款申请时间': '2024-05-01 10:30:00',
      '处理状态': '待处理'
    }
  ];
}

async function createMissingColumnsData() {
  const data = await createNormalTestData();
  return data.map(row => {
    const newRow = { ...row };
    delete newRow['身份证号'];
    delete newRow['联系电话'];
    return newRow;
  });
}

async function createDuplicateRowsData() {
  const data = await createNormalTestData();
  return [...data, data[0]];
}

function runTest(name, testFn) {
  console.log(`\n=== 测试: ${name} ===`);
  try {
    testFn();
    console.log('✅ 通过');
    return true;
  } catch (e) {
    console.log('❌ 失败:', e.message);
    return false;
  }
}

async function main() {
  console.log('开始运行乡镇客运站客运班次退款CLI测试...');
  cleanup();
  
  let passed = 0;
  let failed = 0;
  
  const normalData = await createNormalTestData();
  const missingColsData = await createMissingColumnsData();
  const duplicateData = await createDuplicateRowsData();
  
  const normalFile = await createTestFile('normal.csv', normalData);
  const missingColsFile = await createTestFile('missing-cols.csv', missingColsData);
  const duplicateFile = await createTestFile('duplicate.csv', duplicateData);
  const emptyFile = await createTestFile('empty.csv', []);
  
  passed += runTest('正常数据处理', () => {
    const output = path.join(TEST_DIR, 'normal-output.csv');
    const result = execSync(`node bin/refund.js process ${normalFile} -o ${output} -r`, { encoding: 'utf8' });
    if (!result.includes('成功处理 3 条记录')) {
      throw new Error('应该成功处理3条记录');
    }
    if (!fs.existsSync(output)) {
      throw new Error('输出文件应该存在');
    }
  }) ? 1 : 0;
  
  passed += runTest('儿童票全额退款', () => {
    const output = path.join(TEST_DIR, 'normal-output.csv');
    const content = fs.readFileSync(output, 'utf8');
    if (!content.includes('儿童票全额退款')) {
      throw new Error('儿童票应该有全额退款备注');
    }
    if (!content.includes('12.50')) {
      throw new Error('儿童票退款金额应该是12.50');
    }
  }) ? 1 : 0;
  
  passed += runTest('改签后退票额外扣费', () => {
    const output = path.join(TEST_DIR, 'normal-output.csv');
    const content = fs.readFileSync(output, 'utf8');
    if (!content.includes('改签后退票额外扣5%')) {
      throw new Error('改签后退票应该有额外扣费备注');
    }
  }) ? 1 : 0;
  
  cleanup();
  await createTestFile('normal.csv', normalData);
  await createTestFile('empty.csv', []);
  
  passed += runTest('空文件处理', () => {
    const output = path.join(TEST_DIR, 'empty-output.csv');
    const result = execSync(`node bin/refund.js process ${emptyFile} -o ${output} -r`, { encoding: 'utf8' });
    if (!result.includes('空文件')) {
      throw new Error('应该报告空文件');
    }
  }) ? 1 : 0;
  
  cleanup();
  await createTestFile('missing-cols.csv', missingColsData);
  
  passed += runTest('缺少列处理', () => {
    const output = path.join(TEST_DIR, 'missing-output.csv');
    const result = execSync(`node bin/refund.js process ${missingColsFile} -o ${output} -r`, { encoding: 'utf8' });
    if (!result.includes('缺少列')) {
      throw new Error('应该报告缺少列');
    }
  }) ? 1 : 0;
  
  cleanup();
  await createTestFile('duplicate.csv', duplicateData);
  
  passed += runTest('重复行处理', () => {
    const output = path.join(TEST_DIR, 'dup-output.csv');
    const result = execSync(`node bin/refund.js process ${duplicateFile} -o ${output} -r`, { encoding: 'utf8' });
    if (!result.includes('重复订单')) {
      throw new Error('应该报告重复订单');
    }
  }) ? 1 : 0;
  
  cleanup();
  const file1 = await createTestFile('batch1.csv', normalData.slice(0, 2));
  const file2 = await createTestFile('batch2.csv', normalData.slice(2));
  
  passed += runTest('断点续跑', () => {
    const output = path.join(TEST_DIR, 'continue-output.csv');
    
    let result = execSync(`node bin/refund.js process ${file1} -o ${output}`, { encoding: 'utf8' });
    if (!result.includes('成功处理 2 条记录')) {
      throw new Error('第一次应该处理2条记录');
    }
    
    result = execSync(`node bin/refund.js process ${file1} ${file2} -o ${output} --continue`, { encoding: 'utf8' });
    if (!result.includes('跳过已处理文件')) {
      throw new Error('应该跳过已处理文件');
    }
    if (!result.includes('成功处理 1 条记录')) {
      throw new Error('第二次应该处理1条记录');
    }
  }) ? 1 : 0;
  
  passed += runTest('结果排序', () => {
    const output = path.join(TEST_DIR, 'continue-output.csv');
    const lines = fs.readFileSync(output, 'utf8').split('\n').filter(l => l.trim());
    const headers = lines[0].split(',');
    const orderIdIdx = headers.indexOf('订单编号');
    const shiftIdIdx = headers.indexOf('班次编号');
    
    if (shiftIdIdx === -1 || orderIdIdx === -1) {
      throw new Error('应该有班次编号和订单编号列');
    }
    
    const rows = lines.slice(1).map(l => l.split(','));
    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1];
      const curr = rows[i];
      if (prev[shiftIdIdx] > curr[shiftIdIdx]) {
        throw new Error('班次编号应该排序');
      }
      if (prev[shiftIdIdx] === curr[shiftIdIdx] && prev[orderIdIdx] > curr[orderIdIdx]) {
        throw new Error('同班次订单编号应该排序');
      }
    }
  }) ? 1 : 0;
  
  passed += runTest('status命令', () => {
    const result = execSync(`node bin/refund.js status`, { encoding: 'utf8' });
    if (!result.includes('已处理文件数') || !result.includes('已处理记录数')) {
      throw new Error('status命令应该显示统计信息');
    }
  }) ? 1 : 0;
  
  passed += runTest('example命令', () => {
    const exampleFile = path.join(TEST_DIR, 'test-example.csv');
    execSync(`node bin/refund.js example -o ${exampleFile}`, { encoding: 'utf8' });
    if (!fs.existsSync(exampleFile)) {
      throw new Error('示例文件应该生成');
    }
    const content = fs.readFileSync(exampleFile, 'utf8');
    if (!content.includes('儿童票') || !content.includes('是否改签')) {
      throw new Error('示例文件应该包含业务相关列');
    }
  }) ? 1 : 0;
  
  console.log(`\n=== 测试总结 ===`);
  console.log(`通过: ${passed}`);
  console.log(`失败: ${11 - passed}`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(console.error);