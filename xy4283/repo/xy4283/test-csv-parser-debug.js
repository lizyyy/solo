const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');

const testFilePath = path.join(__dirname, 'samples', 'equipment_ledger_en.csv');
console.log('测试文件路径:', testFilePath);
console.log('文件存在:', fs.existsSync(testFilePath));

// 测试1: 最基本的用法
console.log('\n=== 测试1: 最基本的用法 ===');
const results1 = [];
fs.createReadStream(testFilePath)
  .pipe(csv())
  .on('data', (data) => {
    console.log('Row:', Object.keys(data), ':', data);
    results1.push(data);
  })
  .on('end', () => {
    console.log('结果数量:', results1.length);
    if (results1.length > 0) {
      console.log('第一条数据:', results1[0]);
    }
  })
  .on('error', (error) => {
    console.error('错误:', error);
  });

// 测试2: 指定headers: true
console.log('\n=== 测试2: 指定headers: true ===');
const results2 = [];
fs.createReadStream(testFilePath)
  .pipe(csv({ headers: true }))
  .on('data', (data) => {
    console.log('Row:', Object.keys(data), ':', data);
    results2.push(data);
  })
  .on('end', () => {
    console.log('结果数量:', results2.length);
    if (results2.length > 0) {
      console.log('第一条数据:', results2[0]);
    }
  })
  .on('error', (error) => {
    console.error('错误:', error);
  });

// 测试3: 指定separator和skipLines
console.log('\n=== 测试3: 指定separator和skipLines ===');
const results3 = [];
fs.createReadStream(testFilePath)
  .pipe(csv({
    separator: ',',
    skipLines: 0,
    headers: true
  }))
  .on('data', (data) => {
    console.log('Row:', Object.keys(data), ':', data);
    results3.push(data);
  })
  .on('end', () => {
    console.log('结果数量:', results3.length);
    if (results3.length > 0) {
      console.log('第一条数据:', results3[0]);
    }
  })
  .on('error', (error) => {
    console.error('错误:', error);
  });

// 测试4: 模拟parseCSV函数的用法
console.log('\n=== 测试4: 模拟parseCSV函数的用法 ===');
const { PassThrough } = require('stream');

const stream = fs.createReadStream(testFilePath);
const csvOptions = {
  separator: ',',
  skipLines: 0,
  headers: true
};

const results4 = [];
stream
  .pipe(csv(csvOptions))
  .on('data', (data) => {
    console.log('Row:', Object.keys(data), ':', data);
    const hasData = Object.values(data).some(v => v && v.trim() !== '');
    if (hasData) {
      results4.push(data);
    }
  })
  .on('end', () => {
    console.log('结果数量:', results4.length);
    if (results4.length > 0) {
      console.log('第一条数据:', results4[0]);
    }
  })
  .on('error', (error) => {
    console.error('错误:', error);
  });
