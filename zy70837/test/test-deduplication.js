const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const http = require('http');

const BASE_URL = 'localhost';
const PORT = 3000;

function makeRequest(form, testName) {
  return new Promise((resolve) => {
    const options = {
      hostname: BASE_URL,
      port: PORT,
      path: '/api/upload',
      method: 'POST',
      headers: form.getHeaders()
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ success: false, error: data });
        }
      });
    });

    req.on('error', (error) => {
      resolve({ success: false, error: error.message });
    });

    form.pipe(req);
  });
}

async function testDeduplication() {
  console.log('🧪 开始测试去重功能...\n');
  
  console.log('='.repeat(80));
  console.log('测试1: 首次提交 (不带batchId)');
  console.log('='.repeat(80));
  
  const form1 = new FormData();
  form1.append('borrowReturnCsv', fs.createReadStream(path.join(__dirname, '../test-data/borrow_return.csv')));
  form1.append('vehiclesJson', fs.createReadStream(path.join(__dirname, '../test-data/vehicles.json')));
  
  const result1 = await makeRequest(form1, '首次提交');
  console.log('结果:', result1.success ? '✅ 成功' : '❌ 失败');
  if (result1.success) {
    console.log('batchId:', result1.data.batchId);
    console.log('fileHash:', result1.data.fileHash?.substring(0, 20) + '...');
  } else {
    console.log('消息:', result1.message || result1.error);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('测试2: 相同文件再次提交 (不带batchId) - 应该被拒绝');
  console.log('='.repeat(80));
  
  const form2 = new FormData();
  form2.append('borrowReturnCsv', fs.createReadStream(path.join(__dirname, '../test-data/borrow_return.csv')));
  form2.append('vehiclesJson', fs.createReadStream(path.join(__dirname, '../test-data/vehicles.json')));
  
  const result2 = await makeRequest(form2, '重复提交');
  console.log('结果:', !result2.success ? '✅ 正确拒绝' : '❌ 未被拒绝（bug!）');
  console.log('去重类型:', result2.duplicateType);
  console.log('消息:', result2.message);
  if (result2.existingBatchId) {
    console.log('对应已有批次:', result2.existingBatchId);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('测试3: 提交不同文件 (不带batchId) - 应该成功');
  console.log('='.repeat(80));
  
  const form3 = new FormData();
  form3.append('borrowReturnCsv', fs.createReadStream(path.join(__dirname, '../test-data/borrow_return.csv')));
  
  const result3 = await makeRequest(form3, '不同文件');
  console.log('结果:', result3.success ? '✅ 成功' : '❌ 失败');
  if (result3.success) {
    console.log('batchId:', result3.data.batchId);
    console.log('fileHash:', result3.data.fileHash?.substring(0, 20) + '...');
  } else {
    console.log('消息:', result3.message || result3.error);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('测试4: 带batchId首次提交 (含违章回执1)');
  console.log('='.repeat(80));
  
  const form4 = new FormData();
  form4.append('batchId', 'test_dedup_batch_001');
  form4.append('borrowReturnCsv', fs.createReadStream(path.join(__dirname, '../test-data/borrow_return.csv')));
  form4.append('violationReceipts', fs.createReadStream(path.join(__dirname, '../test-data/violation_receipt_1.json')));
  
  const result4 = await makeRequest(form4, '带batchId提交');
  console.log('结果:', result4.success ? '✅ 成功' : '❌ 失败');
  if (result4.success) {
    console.log('batchId:', result4.data.batchId);
  } else {
    console.log('消息:', result4.message || result4.error);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('测试5: 相同batchId再次提交 - 应该被拒绝');
  console.log('='.repeat(80));
  
  const form5 = new FormData();
  form5.append('batchId', 'test_dedup_batch_001');
  form5.append('borrowReturnCsv', fs.createReadStream(path.join(__dirname, '../test-data/borrow_return.csv')));
  form5.append('violationReceipts', fs.createReadStream(path.join(__dirname, '../test-data/violation_receipt_1.json')));
  
  const result5 = await makeRequest(form5, '相同batchId重复提交');
  console.log('结果:', !result5.success ? '✅ 正确拒绝' : '❌ 未被拒绝（bug!）');
  console.log('去重类型:', result5.duplicateType);
  console.log('消息:', result5.message);
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 测试总结');
  console.log('='.repeat(80));
  
  const allPassed = 
    result1.success && 
    !result2.success && result2.duplicateType === 'fileContent' &&
    result3.success &&
    result4.success &&
    !result5.success && result5.duplicateType === 'batchId';
  
  if (allPassed) {
    console.log('✅ 所有去重测试通过!');
    console.log('   - batchId去重: 正常工作');
    console.log('   - 文件内容去重: 正常工作');
  } else {
    console.log('❌ 部分测试失败，请检查输出');
  }
  
  console.log('\n🎉 去重测试完成!');
}

testDeduplication();
