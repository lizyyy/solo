const path = require('path');
const fs = require('fs');
const parsers = require('./src/parsers');

console.log('=== 详细测试csvParser ===');

const testFilePath = path.join(__dirname, 'samples', 'equipment_ledger_en.csv');
console.log('测试文件路径:', testFilePath);
console.log('文件存在:', fs.existsSync(testFilePath));

// 测试parseCSV
console.log('\n--- 测试parseCSV ---');
parsers.csv.parseCSV(testFilePath)
  .then(results => {
    console.log('parseCSV结果数量:', results.length);
    if (results.length > 0) {
      console.log('parseCSV第一条数据:');
      console.log(JSON.stringify(results[0], null, 2));
      console.log('parseCSV第一条数据的键:', Object.keys(results[0]));
    }
  })
  .catch(error => {
    console.error('parseCSV错误:', error);
  });

// 测试parseEquipmentCSV
console.log('\n--- 测试parseEquipmentCSV ---');
parsers.csv.parseEquipmentCSV(testFilePath)
  .then(result => {
    console.log('parseEquipmentCSV success:', result.success);
    console.log('parseEquipmentCSV data count:', result.data.length);
    console.log('parseEquipmentCSV errors:', result.errors);
    if (result.data.length > 0) {
      console.log('parseEquipmentCSV第一条数据:');
      console.log(JSON.stringify(result.data[0], null, 2));
      console.log('parseEquipmentCSV第一条数据的键:', Object.keys(result.data[0]));
    }
  })
  .catch(error => {
    console.error('parseEquipmentCSV错误:', error);
  });

// 直接测试csv-parser库
console.log('\n--- 直接测试csv-parser库 ---');
const csv = require('csv-parser');

const directResults = [];
fs.createReadStream(testFilePath)
  .pipe(csv({
    mapHeaders: ({ header }) => {
      console.log('直接测试 - Header:', header);
      return header.trim();
    }
  }))
  .on('data', (data) => {
    console.log('直接测试 - Row:', data);
    directResults.push(data);
  })
  .on('end', () => {
    console.log('直接测试 - 结果数量:', directResults.length);
    if (directResults.length > 0) {
      console.log('直接测试 - 第一条数据:');
      console.log(JSON.stringify(directResults[0], null, 2));
    }
  })
  .on('error', (error) => {
    console.error('直接测试 - 错误:', error);
  });
