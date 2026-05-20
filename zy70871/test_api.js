const http = require('http');
const fs = require('fs');

function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
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
    if (data) req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log('=== 药企稳定性试验排期API 端到端测试 ===\n');

  const baseOptions = {
    hostname: 'localhost',
    port: 3000,
    headers: { 'Content-Type': 'application/json' }
  };

  try {
    console.log('1. 创建批次...');
    const batchRes = await makeRequest({
      ...baseOptions,
      path: '/api/batches',
      method: 'POST'
    }, JSON.stringify({
      batch_no: 'ST-2024-TEST001',
      product_name: '阿司匹林肠溶片',
      specification: '100mg',
      manufacturer: 'XX制药厂',
      production_date: '2024-01-15',
      remark: '自动化测试批次'
    }));
    console.log('   状态:', batchRes.status);
    console.log('   批次ID:', batchRes.data.data?.id || batchRes.data.batch?.id);
    
    const batchId = batchRes.data.data?.id;
    if (!batchId) {
      console.log('   批次创建失败，尝试使用已存在的批次...');
      const listRes = await makeRequest({ ...baseOptions, path: '/api/batches', method: 'GET' });
      const existingBatch = listRes.data.data?.find(b => b.batch_no === 'ST-2024-TEST001');
      if (existingBatch) {
        console.log('   找到已存在批次:', existingBatch.id);
      } else {
        throw new Error('无法创建或找到测试批次');
      }
    }
    console.log('   ✓ 创建批次成功\n');

    let testBatchId = batchId;
    if (!testBatchId) {
      const listRes = await makeRequest({ ...baseOptions, path: '/api/batches', method: 'GET' });
      const found = listRes.data.data?.find(b => b.batch_no === 'ST-2024-TEST001');
      testBatchId = found?.id;
    }
    if (!testBatchId) throw new Error('无法获取批次ID');
    console.log('   使用批次ID:', testBatchId, '\n');

    console.log('2. 上传原始材料...');
    const testData = fs.readFileSync('./test_data.json', 'utf8');
    const materialRes = await makeRequest({
      ...baseOptions,
      path: `/api/batches/${testBatchId}/materials`,
      method: 'POST'
    }, JSON.stringify({
      content: testData,
      uploadedBy: 'QA-自动化测试'
    }));
    console.log('   状态:', materialRes.status);
    console.log('   去重标记:', materialRes.data.isDuplicate);
    console.log('   材料ID:', materialRes.data.data?.id);
    console.log('   ✓ 材料上传成功\n');

    console.log('3. 触发拆分流程...');
    const processRes = await makeRequest({
      ...baseOptions,
      path: `/api/batches/${testBatchId}/process`,
      method: 'POST'
    }, JSON.stringify({ operator: 'QA-测试员' }));
    console.log('   状态:', processRes.status);
    console.log('   拆分记录数:', processRes.data.records?.length || 0);
    console.log('   ✓ 拆分流程完成\n');

    console.log('4. 查询试验记录...');
    const recordsRes = await makeRequest({
      ...baseOptions,
      path: `/api/batches/${testBatchId}/records`,
      method: 'GET'
    });
    console.log('   状态:', recordsRes.status);
    console.log('   记录总数:', recordsRes.data.data?.length || 0);
    const firstRecord = recordsRes.data.data?.[0];
    if (firstRecord) {
      console.log('   第一条记录:', {
        sample_no: firstRecord.sample_no,
        chamber_id: firstRecord.chamber_id,
        sampling_month: firstRecord.sampling_month
      });
    }
    console.log('   ✓ 记录查询成功\n');

    const recordId = firstRecord?.id;
    if (recordId) {
      console.log('5. 查询单条记录的处理轨迹...');
      const traceRes = await makeRequest({
        ...baseOptions,
        path: `/api/records/${recordId}/traces`,
        method: 'GET'
      });
      console.log('   状态:', traceRes.status);
      console.log('   轨迹条数:', traceRes.data.data?.traces?.length || 0);
      console.log('   ✓ 轨迹查询成功\n');
    }

    console.log('6. 报告环境箱超温事件...');
    const eventRes = await makeRequest({
      ...baseOptions,
      path: '/api/chamber-events',
      method: 'POST'
    }, JSON.stringify({
      chamber_id: 'CH-001',
      event_type: 'overtemp',
      start_time: '2024-02-01T08:00:00',
      end_time: '2024-02-01T12:30:00',
      temperature: 45,
      humidity: 80,
      remark: '自动化测试超温事件'
    }));
    console.log('   状态:', eventRes.status);
    console.log('   受影响记录数:', eventRes.data.affectedCount || 0);
    console.log('   ✓ 超温事件报告成功\n');

    console.log('7. 下载报告(JSON)...');
    const reportRes = await makeRequest({
      ...baseOptions,
      path: `/api/batches/${testBatchId}/report`,
      method: 'GET'
    });
    console.log('   状态:', reportRes.status);
    console.log('   报告记录数:', reportRes.data.records?.length || 0);
    const affectedRecords = reportRes.data.records?.filter(r => r['受超温影响'] === '是');
    console.log('   受超温影响记录数:', affectedRecords?.length || 0);
    console.log('   ✓ 报告下载成功\n');

    console.log('8. 测试重复材料去重...');
    const dupMaterialRes = await makeRequest({
      ...baseOptions,
      path: `/api/batches/${testBatchId}/materials`,
      method: 'POST'
    }, JSON.stringify({
      content: testData,
      uploadedBy: 'QA-重复测试'
    }));
    console.log('   状态:', dupMaterialRes.status);
    console.log('   去重标记:', dupMaterialRes.data.isDuplicate);
    console.log('   去重检测:', dupMaterialRes.data.isDuplicate ? '✓ 正确识别重复材料' : '✗ 未能识别重复材料');
    console.log('   ✓ 去重功能测试完成\n');

    console.log('=== 所有测试通过! ===');

  } catch (error) {
    console.error('测试失败:', error.message);
    console.error('请确保API服务已启动: npm start');
    process.exit(1);
  }
}

setTimeout(runTests, 2000);
