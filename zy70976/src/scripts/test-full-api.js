const http = require('http');
const fs = require('fs');
const path = require('path');

function request(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: { 'Content-Type': 'application/json', ...headers }
    };
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(typeof data === 'string' ? data : JSON.stringify(data));
    req.end();
  });
}

function requestMultipart(method, reqPath, fields, filePath) {
  return new Promise((resolve, reject) => {
    const boundary = '----TestBoundary' + Date.now();
    const fileBuffer = fs.readFileSync(filePath);
    const filename = path.basename(filePath);
    
    let body = '';
    for (const key in fields) {
      body += `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${fields[key]}\r\n`;
    }
    body += `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: text/csv\r\n\r\n`;
    const tail = `\r\n--${boundary}--\r\n`;
    
    const totalLength = Buffer.byteLength(body) + fileBuffer.length + Buffer.byteLength(tail);
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: reqPath,
      method: method,
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': totalLength
      }
    };
    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => responseBody += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(responseBody) });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseBody });
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.write(fileBuffer);
    req.write(tail);
    req.end();
  });
}

async function runFullTests() {
  console.log('=== 完整 API 测试 ===\n');
  let testBatchId = null;
  let testRentalId = null;

  try {
    console.log('--- 基础检查 ---');
    const health = await request('GET', '/health');
    console.log('1. 健康检查:', health.status === 200 ? '✓ 通过' : '✗ 失败');

    console.log('\n--- 批次管理 ---');
    const batchResp = await request('POST', '/api/rentals/batches', {
      batch_name: '测试批次-' + Date.now(),
      total_count: 5,
      operator: '测试员'
    });
    if (batchResp.data && batchResp.data.data) {
      testBatchId = batchResp.data.data.batch_id;
      console.log('2. 创建批次:', batchResp.status === 200 ? `✓ 成功 (${testBatchId})` : '✗ 失败');
    } else {
      console.log('2. 创建批次: ✗ 失败 -', JSON.stringify(batchResp.data));
    }

    const batchesResp = await request('GET', '/api/rentals/batches');
    console.log('3. 获取批次列表:', batchesResp.data && batchesResp.data.data ? `✓ ${batchesResp.data.data.length} 条` : '✗ 失败');

    console.log('\n--- 数据导入 ---');
    const csvPath = path.join(__dirname, '../../sample-data/rental_sample.csv');
    const importResp = await requestMultipart('POST', '/api/rentals/import/rental-csv', {
      batch_id: testBatchId,
      operator: '测试员'
    }, csvPath);
    console.log('4. 导入租赁 CSV:', importResp.data && importResp.data.data ? `✓ 导入 ${importResp.data.data.count} 条` : '✗ 失败');

    const repairResp = await request('POST', '/api/rentals/import/repair-json', {
      repairs: [
        {
          device_serial: 'EQ-2024-003',
          repair_type: '测试维修',
          repair_description: 'API测试-通过设备序列号关联',
          repair_cost: 500.00,
          is_customer_fault: true,
          fault_reason: '测试用户过错',
          report_date: '2024-05-15',
          repair_date: '2024-05-16'
        }
      ]
    });
    console.log('5. 导入维修 JSON (通过设备序列号关联):', repairResp.data && repairResp.data.data ? '✓ 成功' : '✗ 失败');

    const ruleResp = await request('POST', '/api/rentals/import/deposit-rules', {
      rules: [{
        device_type: '测试设备',
        device_model: 'T-001',
        deposit_amount: 1000.00,
        overdue_rate: 0.1
      }]
    });
    console.log('6. 导入押金规则:', ruleResp.data && ruleResp.data.data ? '✓ 成功' : '✗ 失败');

    console.log('\n--- 查询功能 ---');
    const searchResp = await request('GET', '/api/rentals/search?status=pending');
    console.log('7. 搜索待处理记录:', searchResp.data && searchResp.data.count ? `✓ ${searchResp.data.count} 条` : '✗ 失败');

    const deviceResp = await request('GET', '/api/rentals/device/EQ-2024-002');
    if (deviceResp.data && deviceResp.data.data) {
      console.log('8. 按设备序列号查询:', `✓ 租赁${deviceResp.data.data.rentals.length}条, 维修${deviceResp.data.data.repairs.length}条`);
    } else {
      console.log('8. 按设备序列号查询: ✗ 失败');
    }

    const depositResp = await request('GET', '/api/rentals/deposit-flow/DEP-2024-0501-001');
    console.log('9. 按押金流水查询:', depositResp.data && depositResp.data.data ? '✓ 找到' : '✗ 失败');

    console.log('\n--- 记录处理 ---');
    const pendingList = await request('GET', '/api/rentals/search?status=pending&device_serial=EQ-2024-004');
    if (pendingList.data && pendingList.data.data && pendingList.data.data.length > 0) {
      testRentalId = pendingList.data.data[0].id;
      
      const processResp = await request('POST', `/api/rentals/${testRentalId}/process`, {
        operator: '测试审核员',
        reason: 'API测试-标记处理通过',
        status: 'approved'
      });
      console.log('10. 标记处理:', processResp.data && processResp.data.success ? '✓ 成功' : '✗ 失败');

      const returnResp = await request('POST', `/api/rentals/${testRentalId}/return`, {
        operator: '测试主管',
        reason: 'API测试-退回修改（需要补充材料）'
      });
      console.log('11. 退回修改:', returnResp.data && returnResp.data.success ? '✓ 成功' : '✗ 失败');

      const detailsResp = await request('GET', `/api/rentals/${testRentalId}/details`);
      if (detailsResp.data && detailsResp.data.data) {
        console.log('12. 获取记录详情:', '✓ 成功');
        console.log(`    - 操作日志: ${detailsResp.data.data.operation_logs.length}条`);
      } else {
        console.log('12. 获取记录详情: ✗ 失败');
      }
    } else {
      console.log('10-12. 记录处理: 跳过（无待处理记录）');
    }

    console.log('\n--- 异常与日志 ---');
    const exceptResp = await request('GET', '/api/rentals/exceptions/unresolved');
    if (exceptResp.data && exceptResp.data.data) {
      console.log('13. 未解决异常:', `✓ ${exceptResp.data.data.length}条`);
      exceptResp.data.data.forEach((ex, i) => {
        console.log(`    ${i + 1}. ${ex.exception_type}: ${ex.description}`);
      });
    } else {
      console.log('13. 未解决异常: ✗ 失败');
    }

    const logsResp = await request('GET', '/api/rentals/operation-logs');
    console.log('14. 操作日志:', logsResp.data && logsResp.data.data ? `✓ ${logsResp.data.data.length}条` : '✗ 失败');

    const repairListResp = await request('GET', '/api/rentals/repairs');
    console.log('15. 维修记录:', repairListResp.data && repairListResp.data.data ? `✓ ${repairListResp.data.data.length}条` : '✗ 失败');

    const rulesListResp = await request('GET', '/api/rentals/deposit-rules');
    console.log('16. 押金规则:', rulesListResp.data && rulesListResp.data.data ? `✓ ${rulesListResp.data.data.length}条` : '✗ 失败');

    console.log('\n--- 数据导出 ---');
    const exportResp = await new Promise((resolve, reject) => {
      http.get('http://localhost:3000/api/rentals/export?status=approved', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          const lines = data.split('\n').filter(l => l.trim());
          resolve({ 
            status: res.statusCode, 
            headerLines: lines.length > 0 ? 1 : 0,
            dataLines: lines.length > 1 ? lines.length - 1 : 0,
            totalLines: lines.length 
          });
        });
      }).on('error', reject);
    });
    console.log('17. 导出 CSV:', exportResp.status === 200 ? `✓ 成功 (数据行: ${exportResp.dataLines})` : '✗ 失败');

    console.log('\n--- 验证 actual_return_date ---');
    const eq2002Resp = await request('GET', '/api/rentals/search?device_serial=EQ-2024-002');
    if (eq2002Resp.data && eq2002Resp.data.data && eq2002Resp.data.data.length > 0) {
      const record = eq2002Resp.data.data[0];
      console.log('18. 验证 actual_return_date:', record.actual_return_date ? `✓ 存在: ${record.actual_return_date}` : '✗ 丢失');
    } else {
      console.log('18. 验证 actual_return_date: ✗ 记录不存在');
    }

    console.log('\n--- 验证维修关联 ---');
    const eq2003Resp = await request('GET', '/api/rentals/search?device_serial=EQ-2024-003');
    if (eq2003Resp.data && eq2003Resp.data.data && eq2003Resp.data.data.length > 0) {
      const record = eq2003Resp.data.data[0];
      console.log('19. 验证维修关联:', record.has_repair === 1 ? `✓ 已关联 (维修费: ¥${record.repair_fee})` : '✗ 未关联');
    } else {
      console.log('19. 验证维修关联: ✗ 记录不存在');
    }

    console.log('\n=== 测试完成 ===');
    console.log('所有核心接口已覆盖: 创建批次、CSV导入、维修JSON导入、押金规则导入、');
    console.log('搜索查询、标记处理、退回修改、获取详情、异常查询、操作日志、数据导出');

  } catch (err) {
    console.error('测试失败:', err.message);
    console.log('请确保服务已启动: npm start');
  }
}

runFullTests();
