const http = require('http');

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            data: JSON.parse(data)
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            data: data
          });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runTests() {
  const baseOptions = {
    hostname: 'localhost',
    port: 3000,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  console.log('='.repeat(60));
  console.log('小学校服订购点校服尺码换货API - 功能测试');
  console.log('='.repeat(60));
  console.log('');

  console.log('📋 测试1: 获取换货列表');
  console.log('-'.repeat(40));
  try {
    const result = await makeRequest({
      ...baseOptions,
      path: '/api/exchanges',
      method: 'GET'
    });
    console.log('状态码:', result.statusCode);
    if (result.data.success) {
      console.log('✅ 成功获取换货列表');
      console.log('   总数量:', result.data.data.pagination.total);
      result.data.data.list.forEach(item => {
        console.log(`   - ${item.exchangeNo} | ${item.student.name} | ${item.status}`);
      });
    } else {
      console.log('❌ 获取失败:', result.data.error.message);
    }
  } catch (e) {
    console.log('❌ 请求失败:', e.message);
  }
  console.log('');

  console.log('📋 测试2: 获取换货详情 (EXC2024052001)');
  console.log('-'.repeat(40));
  try {
    const result = await makeRequest({
      ...baseOptions,
      path: '/api/exchanges/EXC2024052001',
      method: 'GET'
    });
    console.log('状态码:', result.statusCode);
    if (result.data.success) {
      console.log('✅ 成功获取换货详情');
      const data = result.data.data;
      console.log('   换货单号:', data.exchangeNo);
      console.log('   学生:', data.student.name);
      console.log('   商品:', data.product);
      console.log('   原尺码:', data.fromSize.name);
      console.log('   目标尺码:', data.toSize.name);
      console.log('   状态:', data.status);
    } else {
      console.log('❌ 获取失败:', result.data.error.message);
    }
  } catch (e) {
    console.log('❌ 请求失败:', e.message);
  }
  console.log('');

  console.log('📋 测试3: 创建换货申请 - 正常流程');
  console.log('-'.repeat(40));
  try {
    const postData = JSON.stringify({
      orderNo: 'ORD202405002',
      studentNo: '20240101',
      toSizeCode: '140',
      reason: '尺码偏小',
      reasonDetail: '孩子穿了说裤腰太紧，蹲下不方便',
      contactPhone: '13800138999'
    });
    const result = await makeRequest({
      ...baseOptions,
      path: '/api/exchanges',
      method: 'POST'
    }, postData);
    console.log('状态码:', result.statusCode);
    if (result.data.success) {
      console.log('✅ 成功创建换货申请');
      console.log('   新换货单号:', result.data.data.exchangeNo);
      console.log('   当前状态:', result.data.data.status);
    } else {
      console.log('❌ 创建失败:', result.data.error.message);
      console.log('   解决方案:', result.data.error.solution);
    }
  } catch (e) {
    console.log('❌ 请求失败:', e.message);
  }
  console.log('');

  console.log('📋 测试4: 创建换货申请 - 异常测试 (重复申请)');
  console.log('-'.repeat(40));
  try {
    const postData = JSON.stringify({
      orderNo: 'ORD202409001',
      studentNo: '20240101',
      toSizeCode: '150',
      reason: '外套偏小',
      reasonDetail: '穿毛衣后拉不上拉链',
      contactPhone: '13800138999'
    });
    const result = await makeRequest({
      ...baseOptions,
      path: '/api/exchanges',
      method: 'POST'
    }, postData);
    console.log('状态码:', result.statusCode);
    if (!result.data.success) {
      console.log('✅ 正确拦截了异常请求');
      console.log('   错误代码:', result.data.error.code);
      console.log('   错误信息:', result.data.error.message);
      console.log('   解决方案:', result.data.error.solution);
      if (result.data.error.details) {
        console.log('   详细信息:', JSON.stringify(result.data.error.details, null, 2).replace(/\n/g, '\n   '));
      }
    } else {
      console.log('⚠️  未拦截到异常');
    }
  } catch (e) {
    console.log('❌ 请求失败:', e.message);
  }
  console.log('');

  console.log('📋 测试5: 创建换货申请 - 异常测试 (库存不足)');
  console.log('-'.repeat(40));
  try {
    const postData = JSON.stringify({
      orderNo: 'ORD202405003',
      studentNo: '20240102',
      toSizeCode: '999',
      reason: '测试库存不足',
      contactPhone: '13800138002'
    });
    const result = await makeRequest({
      ...baseOptions,
      path: '/api/exchanges',
      method: 'POST'
    }, postData);
    console.log('状态码:', result.statusCode);
    if (!result.data.success) {
      console.log('✅ 正确拦截了异常请求');
      console.log('   错误代码:', result.data.error.code);
      console.log('   错误信息:', result.data.error.message);
      console.log('   解决方案:', result.data.error.solution);
    } else {
      console.log('⚠️  未拦截到异常');
    }
  } catch (e) {
    console.log('❌ 请求失败:', e.message);
  }
  console.log('');

  console.log('📋 测试6: 更新换货状态 - 从待审核到正常');
  console.log('-'.repeat(40));
  try {
    const postData = JSON.stringify({
      status: '正常'
    });
    const result = await makeRequest({
      ...baseOptions,
      path: '/api/exchanges/EXC2024090801/status',
      method: 'PUT'
    }, postData);
    console.log('状态码:', result.statusCode);
    if (result.data.success) {
      console.log('✅ 成功更新状态');
      console.log('   换货单号:', result.data.data.exchangeNo);
      console.log('   新状态:', result.data.data.status);
    } else {
      console.log('❌ 更新失败:', result.data.error.message);
    }
  } catch (e) {
    console.log('❌ 请求失败:', e.message);
  }
  console.log('');

  console.log('📋 测试7: 按状态筛选换货单');
  console.log('-'.repeat(40));
  try {
    const statuses = ['已完成', '正常', '驳回', '补录', '待审核'];
    for (const status of statuses) {
      const result = await makeRequest({
        ...baseOptions,
        path: `/api/exchanges?status=${encodeURIComponent(status)}`,
        method: 'GET'
      });
      if (result.data.success) {
        const count = result.data.data.pagination.total;
        console.log(`   ${status}: ${count} 单`);
        if (count > 0) {
          result.data.data.list.slice(0, 2).forEach(item => {
            console.log(`     - ${item.exchangeNo} | ${item.student.name}`);
          });
        }
      }
    }
    console.log('✅ 状态筛选测试完成');
  } catch (e) {
    console.log('❌ 请求失败:', e.message);
  }
  console.log('');

  console.log('📋 测试8: 获取不存在的换货单');
  console.log('-'.repeat(40));
  try {
    const result = await makeRequest({
      ...baseOptions,
      path: '/api/exchanges/EXC99999999',
      method: 'GET'
    });
    console.log('状态码:', result.statusCode);
    if (!result.data.success) {
      console.log('✅ 正确返回不存在提示');
      console.log('   错误代码:', result.data.error.code);
      console.log('   错误信息:', result.data.error.message);
      console.log('   解决方案:', result.data.error.solution);
    }
  } catch (e) {
    console.log('❌ 请求失败:', e.message);
  }
  console.log('');

  console.log('='.repeat(60));
  console.log('✅ 所有测试用例执行完毕');
  console.log('='.repeat(60));
  console.log('');
  console.log('💡 提示:');
  console.log('   1. 错误信息都包含解决方案，调用方能据此补材料或转人工');
  console.log('   2. 同一学生多次换码会被拦截，避免占用库存');
  console.log('   3. 换货状态转换有严格校验，保证数据一致性');
  console.log('');
}

runTests().catch(console.error);
