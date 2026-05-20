const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const http = require('http');

const BASE_URL = 'localhost';
const PORT = 3000;

function uploadTest() {
  console.log('🧪 开始测试4S店车辆管理API...\n');
  console.log('📋 测试场景:');
  console.log('   - 违章回执1: 车牌存在 + 有借车记录 (京C11111, 王五借车期间)');
  console.log('   - 违章回执2: 车牌不在车辆清单 (京X99999)');
  console.log('   - 违章回执3: 无车牌号信息\n');

  const form = new FormData();
  
  form.append('batchId', 'test_batch_violation_v3');
  form.append('borrowReturnCsv', fs.createReadStream(path.join(__dirname, '../test-data/borrow_return.csv')));
  form.append('vehiclesJson', fs.createReadStream(path.join(__dirname, '../test-data/vehicles.json')));
  form.append('violationReceipts', fs.createReadStream(path.join(__dirname, '../test-data/violation_receipt_1.json')));
  form.append('violationReceipts', fs.createReadStream(path.join(__dirname, '../test-data/violation_receipt_2_unknown_plate.json')));
  form.append('violationReceipts', fs.createReadStream(path.join(__dirname, '../test-data/violation_receipt_3_no_plate.json')));

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
      console.log('📊 测试结果:');
      console.log('='.repeat(80));
      const result = JSON.parse(data);
      console.log(JSON.stringify(result, null, 2));
      console.log('\n' + '='.repeat(80));
      
      if (result.success && result.data) {
        const summary = result.data.summary;
        console.log('\n📈 统计汇总:');
        console.log(`  总计: ${summary.total} 条`);
        console.log(`  ✅ 正常: ${summary.normal} 条`);
        console.log(`  ⚠️  待确认: ${summary.pending} 条`);
        console.log(`  ❌ 失败: ${summary.failed} 条`);
        
        const confirmedViolations = result.data.normalItems.filter(i => i.type === 'violation' && i.ownershipConfirmed);
        if (confirmedViolations.length > 0) {
          console.log('\n✅ 违章归属已确认:');
          confirmedViolations.forEach((item, idx) => {
            console.log(`  ${idx + 1}. ${item.detail}`);
            if (item.matchedInfo) {
              console.log(`     车辆: ${item.matchedInfo.vehicleBrand} ${item.matchedInfo.vehicleModel}`);
              console.log(`     借车人: ${item.matchedInfo.borrower}`);
              console.log(`     借车时间: ${item.matchedInfo.borrowTime}`);
            }
          });
        }
        
        if (result.data.pendingItems.length > 0) {
          console.log('\n⚠️  待确认项详情:');
          result.data.pendingItems.forEach((item, idx) => {
            const prefix = item.type === 'violation' ? '违章-' : '';
            console.log(`  ${idx + 1}. [${prefix}${item.type}] ${item.warnings[0].message}`);
          });
        }
        
        if (result.data.failedItems.length > 0) {
          console.log('\n❌ 失败项详情:');
          result.data.failedItems.forEach((item, idx) => {
            console.log(`  ${idx + 1}. ${item.errors[0].message}`);
            console.log(`     建议: ${item.suggestion}`);
          });
        }
      }
      
      console.log('\n🎉 测试完成!');
    });
  });

  req.on('error', (error) => {
    console.error('❌ 请求失败:', error.message);
    console.log('\n💡 提示: 请先启动服务器 (npm start)');
  });

  form.pipe(req);
}

uploadTest();
