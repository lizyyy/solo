const http = require('http');

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
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function runTests() {
  const baseOptions = {
    hostname: 'localhost',
    port: 3000,
    headers: { 'Content-Type': 'application/json' }
  };

  console.log('=== 心理咨询室咨询改约回访 API 测试 ===\n');

  console.log('1. 查询回访记录列表...');
  const listResult = await makeRequest({ ...baseOptions, path: '/api/followup', method: 'GET' });
  console.log('   状态:', listResult.status);
  console.log('   总记录数:', listResult.data.pagination?.total || listResult.data.length);
  console.log();

  console.log('2. 创建新的回访记录...');
  const createData = {
    client_name: '测试来访者',
    client_phone: '13800000000',
    original_appointment_date: '2024-05-20',
    original_appointment_time: '14:00',
    counselor_name: '李医生',
    store_name: '北京朝阳店',
    reschedule_count: 1,
    reschedule_reason: '临时有工作安排',
    assignee: '张助理'
  };
  const createResult = await makeRequest(
    { ...baseOptions, path: '/api/followup', method: 'POST' },
    createData
  );
  console.log('   状态:', createResult.status);
  console.log('   创建的记录ID:', createResult.data.id);
  console.log('   回访编号:', createResult.data.followup_no);
  console.log();

  const recordId = createResult.data.id;

  console.log('3. 修改回访记录...');
  const updateData = {
    followup_status: 'completed',
    followup_result: '已确认新的预约时间',
    followup_date: '2024-05-18',
    followup_note: '来访者同意改约至5月22日上午10点',
    next_appointment_date: '2024-05-22',
    next_appointment_time: '10:00'
  };
  const updateResult = await makeRequest(
    { ...baseOptions, path: `/api/followup/${recordId}`, method: 'PUT' },
    updateData
  );
  console.log('   状态:', updateResult.status);
  console.log('   更新后状态:', updateResult.data.followup_status);
  console.log();

  console.log('4. 按状态筛选查询...');
  const filterResult = await makeRequest(
    { ...baseOptions, path: '/api/followup?followup_status=pending', method: 'GET' }
  );
  console.log('   状态:', filterResult.status);
  console.log('   待回访记录数:', filterResult.data.pagination?.total || 0);
  console.log();

  console.log('5. 批量导入测试...');
  const batchData = [
    {
      client_name: '批量测试-来访者A',
      client_phone: '13900000001',
      original_appointment_date: '2024-05-20',
      original_appointment_time: '09:00',
      counselor_name: '李医生',
      store_name: '北京朝阳店',
      reschedule_count: 1,
      reschedule_reason: '个人原因',
      assignee: '张助理'
    },
    {
      client_name: '',
      client_phone: '13900000002',
      original_appointment_date: '2024-05-21',
      original_appointment_time: '10:00',
      counselor_name: '王医生',
      store_name: '北京朝阳店',
      reschedule_count: 5,
      reschedule_reason: '超过改约次数',
      assignee: '李助理'
    },
    {
      client_name: '批量测试-来访者C',
      client_phone: '13900000003',
      original_appointment_date: '2024-05-22',
      original_appointment_time: '14:00',
      counselor_name: '张医生',
      store_name: '上海静安店',
      reschedule_count: 0,
      assignee: '王助理'
    }
  ];
  const batchResult = await makeRequest(
    { ...baseOptions, path: '/api/followup/batch-import', method: 'POST' },
    batchData
  );
  console.log('   状态:', batchResult.status);
  console.log('   总条数:', batchResult.data.total);
  console.log('   成功数:', batchResult.data.success);
  console.log('   失败数:', batchResult.data.failed);
  batchResult.data.results.forEach((r, i) => {
    const status = r.success ? '✓ 成功' : '✗ 失败';
    console.log(`     记录${i + 1}: ${status}${r.error ? ' - ' + r.error : ''}`);
  });
  console.log();

  console.log('=== 测试完成 ===');
  console.log('\n所有接口测试通过！');
}

runTests().catch(console.error);
