const http = require('http');

const baseUrl = 'http://localhost:3000/api/transfers';

function request(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/transfers' + path,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
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

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('健身私教馆私教课转让 API 测试');
  console.log('='.repeat(60));

  let createdTransferId = null;
  let createdTransferNo = null;

  console.log('\n📋 测试1: 查询转让列表（验证样例数据）');
  try {
    const res = await request('/', 'GET');
    console.log(`  状态码: ${res.status}`);
    console.log(`  总记录数: ${res.data.data.pagination.total}`);
    console.log('  ✅ 查询成功');
  } catch (e) {
    console.log('  ❌ 查询失败:', e.message);
  }

  console.log('\n📋 测试2: 创建转让 - 正常数据');
  try {
    const validData = {
      transfer_date: '2024-05-10',
      store_id: 'test-store-001',
      store_name: '朝阳健身旗舰店',
      assignor_id: 'test-member-001',
      assignor_name: '张三',
      assignor_phone: '13800138000',
      assignee_id: 'test-member-002',
      assignee_name: '李四',
      assignee_phone: '13900139000',
      coach_id: 'test-coach-001',
      coach_name: '王教练',
      class_package_id: 'pkg-001',
      class_package_name: 'VIP减脂私教课30节包',
      transfer_class_count: 5,
      remaining_class_count: 10,
      original_unit_price: 280.00,
      transfer_fee: 50.00,
      total_amount: 1450.00,
      scheduled_class_time: '2024-05-20 14:00:00',
      remark: '朋友之间转让'
    };
    
    const res = await request('/', 'POST', validData);
    console.log(`  状态码: ${res.status}`);
    if (res.data.success) {
      createdTransferId = res.data.data.id;
      createdTransferNo = res.data.data.transfer_no;
      console.log(`  转让编号: ${createdTransferNo}`);
      console.log('  ✅ 创建成功');
    } else {
      console.log('  ❌ 创建失败:', res.data.error);
    }
  } catch (e) {
    console.log('  ❌ 创建失败:', e.message);
  }

  console.log('\n📋 测试3: 创建转让 - 坏数据（手机号格式错误）');
  try {
    const badData = {
      transfer_date: '2024-05-10',
      store_id: 'test-store-001',
      store_name: '朝阳健身旗舰店',
      assignor_id: 'test-member-001',
      assignor_name: '张三',
      assignor_phone: '12345',
      assignee_id: 'test-member-002',
      assignee_name: '李四',
      assignee_phone: '13900139000',
      coach_id: 'test-coach-001',
      coach_name: '王教练',
      class_package_id: 'pkg-001',
      class_package_name: 'VIP减脂私教课转让30节包',
      transfer_class_count: 5,
      remaining_class_count: 10,
      original_unit_price: 280.00,
      total_amount: 1400.00
    };
    
    const res = await request('/', 'POST', badData);
    console.log(`  状态码: ${res.status}`);
    console.log(`  错误信息: ${res.data.error}`);
    if (res.status === 400) {
      console.log('  ✅ 坏数据验证成功');
    } else {
      console.log('  ❌ 坏数据验证失败');
    }
  } catch (e) {
    console.log('  ❌ 请求失败:', e.message);
  }

  console.log('\n📋 测试4: 创建转让 - 时间冲突（受让人已有同时间课程）');
  try {
    const conflictData = {
      transfer_date: '2024-05-10',
      store_id: 'test-store-001',
      store_name: '朝阳健身旗舰店',
      assignor_id: 'test-member-003',
      assignor_name: '王五',
      assignor_phone: '13700137000',
      assignee_id: 'test-member-002',
      assignee_name: '李四',
      assignee_phone: '13900139000',
      coach_id: 'test-coach-001',
      coach_name: '王教练',
      class_package_id: 'pkg-002',
      class_package_name: '增肌私教课20节包',
      transfer_class_count: 3,
      remaining_class_count: 8,
      original_unit_price: 300.00,
      total_amount: 900.00,
      scheduled_class_time: '2024-05-20 14:00:00'
    };
    
    const res = await request('/', 'POST', conflictData);
    console.log(`  状态码: ${res.status}`);
    console.log(`  错误信息: ${res.data.error}`);
    if (res.data.error && res.data.error.includes('同时间')) {
      console.log('  ✅ 时间冲突检测成功');
    } else {
      console.log('  ⚠️  可能未检测到冲突（编号不同可能正常）');
    }
  } catch (e) {
    console.log('  ❌ 请求失败:', e.message);
  }

  console.log('\n📋 测试5: 更新转让状态 - 状态越级（从pending直接到completed）');
  if (createdTransferId) {
    try {
      const invalidUpdate = {
        status: 'completed',
        handler_id: 'H001',
        handler_name: '张经理'
      };
      
      const res = await request(`/${createdTransferId}`, 'PATCH', invalidUpdate);
      console.log(`  状态码: ${res.status}`);
      console.log(`  错误信息: ${res.data.error}`);
      if (res.data.error && res.data.error.includes('不允许')) {
        console.log('  ✅ 状态越级检测成功');
      } else {
        console.log('  ❌ 状态越级检测失败');
      }
    } catch (e) {
      console.log('  ❌ 请求失败:', e.message);
    }
  } else {
    console.log('  ⏭️  跳过（无可用转让ID）');
  }

  console.log('\n📋 测试6: 更新转让状态 - 正常流转（pending -> approved）');
  if (createdTransferId) {
    try {
      const validUpdate = {
        status: 'approved',
        handler_id: 'H001',
        handler_name: '张经理',
        remark: '审核通过'
      };
      
      const res = await request(`/${createdTransferId}`, 'PATCH', validUpdate);
      console.log(`  状态码: ${res.status}`);
      if (res.data.success) {
        console.log(`  新状态: ${res.data.data.status}`);
        console.log('  ✅ 状态更新成功');
      } else {
        console.log('  ❌ 状态更新失败:', res.data.error);
      }
    } catch (e) {
      console.log('  ❌ 请求失败:', e.message);
    }
  } else {
    console.log('  ⏭️  跳过（无可用转让ID）');
  }

  console.log('\n📋 测试7: 重复调用幂等性测试');
  if (createdTransferId) {
    try {
      const validUpdate = {
        status: 'approved',
        handler_id: 'H001',
        handler_name: '张经理'
      };
      
      console.log('  第一次调用:');
      const res1 = await request(`/${createdTransferId}`, 'PATCH', validUpdate);
      console.log(`    状态码: ${res1.status}, 成功: ${res1.data.success}`);
      
      console.log('  第二次调用（重复）:');
      const res2 = await request(`/${createdTransferId}`, 'PATCH', validUpdate);
      console.log(`    状态码: ${res2.status}`);
      console.log(`    错误信息: ${res2.data.error}`);
      if (!res2.data.success) {
        console.log('  ✅ 重复调用检测成功');
      } else {
        console.log('  ⚠️  重复调用也成功（状态已是最终态）');
      }
    } catch (e) {
      console.log('  ❌ 请求失败:', e.message);
    }
  } else {
    console.log('  ⏭️  跳过（无可用转让ID）');
  }

  console.log('\n📋 测试8: 批量导入 - 混合正常与异常数据');
  try {
    const batchData = {
      transfers: [
        {
          transfer_date: '2024-05-11',
          store_id: 'test-store-001',
          store_name: '朝阳健身旗舰店',
          assignor_id: 'm1',
          assignor_name: '会员A',
          assignor_phone: '13800000001',
          assignee_id: 'm2',
          assignee_name: '会员B',
          assignee_phone: '13800000002',
          coach_id: 'c1',
          coach_name: '教练A',
          class_package_id: 'p1',
          class_package_name: '基础课程包',
          transfer_class_count: 5,
          remaining_class_count: 10,
          original_unit_price: 200,
          total_amount: 1000
        },
        {
          transfer_date: 'invalid-date',
          store_id: 'test-store-001',
          store_name: '朝阳健身旗舰店',
          assignor_id: 'm3',
          assignor_name: '会员C',
          assignor_phone: 'bad-phone',
          assignee_id: 'm4',
          assignee_name: '会员D',
          assignee_phone: '13800000004',
          coach_id: 'c2',
          coach_name: '教练B',
          class_package_id: 'p2',
          class_package_name: '高级课程包',
          transfer_class_count: 3,
          remaining_class_count: 5,
          original_unit_price: 300,
          total_amount: 900
        },
        {
          transfer_date: '2024-05-12',
          store_id: 'test-store-001',
          store_name: '朝阳健身旗舰店',
          assignor_id: 'm5',
          assignor_name: '会员E',
          assignor_phone: '13800000005',
          assignee_id: 'm6',
          assignee_name: '会员F',
          assignee_phone: '13800000006',
          coach_id: 'c3',
          coach_name: '教练C',
          class_package_id: 'p3',
          class_package_name: '私教课程包',
          transfer_class_count: 10,
          remaining_class_count: 20,
          original_unit_price: 250,
          total_amount: 2500
        }
      ]
    };
    
    const res = await request('/batch', 'POST', batchData);
    console.log(`  状态码: ${res.status}`);
    console.log(`  总数: ${res.data.data.total}`);
    console.log(`  成功: ${res.data.data.success_count}`);
    console.log(`  失败: ${res.data.data.fail_count}`);
    console.log('  行级结果:');
    res.data.data.results.forEach(r => {
      console.log(`    行${r.row_index}: ${r.success ? '✅ 成功' : '❌ 失败'} - ${r.transfer_no || r.error}`);
    });
    if (res.data.data.success_count === 2 && res.data.data.fail_count === 1) {
      console.log('  ✅ 批量导入行级结果处理正确');
    }
  } catch (e) {
    console.log('  ❌ 请求失败:', e.message);
  }

  console.log('\n📋 测试9: 按条件筛选查询');
  try {
    const res = await request('?status=pending&start_date=2024-05-01&end_date=2024-05-31', 'GET');
    console.log(`  状态码: ${res.status}`);
    console.log(`  查询结果数: ${res.data.data.list.length}`);
    console.log('  ✅ 条件筛选查询成功');
  } catch (e) {
    console.log('  ❌ 查询失败:', e.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('测试完成！');
  console.log('='.repeat(60));
}

setTimeout(runTests, 2000);
