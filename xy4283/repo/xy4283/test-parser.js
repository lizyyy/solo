const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

const testCSV = `equipment_code,equipment_type,model,manufacturer,batch_number,production_date,expiration_date,location,status,is_scrapped
MFE-001,干粉灭火器,ABC4kg,永安消防器材厂,Y2023-001,2023-01-15,2028-01-14,办公区A栋1楼,normal,0
MFE-002,干粉灭火器,ABC4kg,永安消防器材厂,Y2023-001,2023-01-15,2028-01-14,办公区A栋2楼,normal,0`;

// 测试1: 直接解析字符串
console.log('=== 测试1: 直接解析字符串 ===');
const results1 = [];
const stream1 = require('stream').PassThrough();
stream1.end(testCSV);

stream1
  .pipe(csv({
    mapHeaders: ({ header }) => {
      console.log('Header:', header);
      return header.trim();
    }
  }))
  .on('data', (data) => {
    console.log('Row:', data);
    results1.push(data);
  })
  .on('end', () => {
    console.log('Results1 count:', results1.length);
    console.log('Results1:', results1[0]);
  })
  .on('error', (error) => {
    console.error('Error1:', error);
  });

// 测试2: 解析文件
console.log('\n=== 测试2: 解析文件 ===');
const results2 = [];
const testFilePath = path.join(__dirname, 'samples', 'equipment_ledger_en.csv');

fs.createReadStream(testFilePath)
  .pipe(csv({
    mapHeaders: ({ header }) => {
      console.log('File Header:', header);
      return header.trim();
    }
  }))
  .on('data', (data) => {
    console.log('File Row:', data);
    results2.push(data);
  })
  .on('end', () => {
    console.log('Results2 count:', results2.length);
    if (results2.length > 0) {
      console.log('Results2[0] keys:', Object.keys(results2[0]));
      console.log('Results2[0]:', results2[0]);
    }
  })
  .on('error', (error) => {
    console.error('Error2:', error);
  });
