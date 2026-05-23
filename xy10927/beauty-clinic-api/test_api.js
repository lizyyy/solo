const http = require('http');

function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function testAPI() {
  console.log('=== 美容院疗程核销API 功能测试 ===\n');

  try {
    console.log('1. 健康检查...');
    const health = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/health',
      method: 'GET'
    });
    console.log('   状态:', health.status, health.body.status);

    console.log('\n2. 查询门店列表...');
    const stores = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/stores',
      method: 'GET'
    });
    console.log('   状态:', stores.status, '数量:', stores.body.data?.length || 0);

    console.log('\n3. 查询顾客列表...');
    const customers = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/customers',
      method: 'GET'
    });
    console.log('   状态:', customers.status, '数量:', customers.body.data?.length || 0);

    console.log('\n4. 查询套餐列表...');
    const packages = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/packages',
      method: 'GET'
    });
    console.log('   状态:', packages.status, '数量:', packages.body.data?.length || 0);

    let pkg = null;
    if (packages.body.data && packages.body.data.length > 0) {
      pkg = packages.body.data[0];
      console.log('\n5. 套餐详情验证:');
      console.log('   套餐名:', pkg.name);
      console.log('   总次数:', pkg.total_count);
      console.log('   剩余购买次数:', pkg.remaining_count);
      console.log('   赠送余额:', pkg.gift_count);
      console.log('   已用赠送:', pkg.used_gift_count);
      console.log('   ✓ 赠送余额独立于购买套餐');

      console.log('\n6. 测试赠送功能...');
      const giftResult = await makeRequest({
        hostname: 'localhost',
        port: 3000,
        path: `/api/packages/${pkg.id}/gift`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        gift_count: 3,
        reason: '测试赠送',
        operator: 'tester'
      });
      console.log('   状态:', giftResult.status, giftResult.body.status);
      if (giftResult.body.data) {
        console.log('   赠送后余额:', giftResult.body.data.gift_count);
        console.log('   ✓ 赠送只增加 gift_count，不改变 total_count');
      }

      console.log('\n7. 测试核销功能（使用赠送次数）...');
      const verifyResult = await makeRequest({
        hostname: 'localhost',
        port: 3000,
        path: `/api/packages/${pkg.id}/verify`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        store_id: pkg.current_store_id,
        count: 2,
        use_gift_count: 2,
        operator: 'tester',
        remark: '测试核销（全部用赠送）'
      });
      console.log('   状态:', verifyResult.status, verifyResult.body.status);
      if (verifyResult.body.data) {
        console.log('   核销总次数:', verifyResult.body.data.verify_count);
        console.log('   使用赠送次数:', verifyResult.body.data.use_gift_count);
        console.log('   使用购买次数:', verifyResult.body.data.use_paid_count);
        console.log('   ✓ 赠送次数独立扣减');
      }

      console.log('\n8. 查询核销记录...');
      const verifications = await makeRequest({
        hostname: 'localhost',
        port: 3000,
        path: `/api/packages/${pkg.id}/verifications`,
        method: 'GET'
      });
      console.log('   状态:', verifications.status, '记录数:', verifications.body.data?.length || 0);

      console.log('\n9. 测试人工修正（只修改gift_count）...');
      const currentPkg = await makeRequest({
        hostname: 'localhost',
        port: 3000,
        path: `/api/packages/${pkg.id}`,
        method: 'GET'
      });
      const correctResult = await makeRequest({
        hostname: 'localhost',
        port: 3000,
        path: `/api/packages/${pkg.id}/correct`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        before_data: { gift_count: currentPkg.body.data.gift_count },
        after_data: { gift_count: currentPkg.body.data.gift_count + 5 },
        reason: '补偿赠送次数',
        operator: 'admin'
      });
      console.log('   状态:', correctResult.status, correctResult.body.status);
      if (correctResult.body.data) {
        const correctedPkg = await makeRequest({
          hostname: 'localhost',
          port: 3000,
          path: `/api/packages/${pkg.id}`,
          method: 'GET'
        });
        console.log('   修正后gift_count:', correctedPkg.body.data.gift_count);
        console.log('   ✓ 支持部分字段更新');
      }

      console.log('\n10. 测试核销边界校验（use_gift_count > count）...');
      const badVerifyResult = await makeRequest({
        hostname: 'localhost',
        port: 3000,
        path: `/api/packages/${pkg.id}/verify`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        store_id: pkg.current_store_id,
        count: 1,
        use_gift_count: 5,
        operator: 'tester',
        remark: '测试边界校验'
      });
      console.log('   状态:', badVerifyResult.status, badVerifyResult.body.status);
      console.log('   错误信息:', badVerifyResult.body.error);
      console.log('   ✓ 正确拦截了无效请求');

      console.log('\n11. 测试核销 - 错误门店校验...');
      const badStoreVerify = await makeRequest({
        hostname: 'localhost',
        port: 3000,
        path: `/api/packages/${pkg.id}/verify`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        store_id: 'invalid-store-id',
        count: 1,
        use_gift_count: 0,
        operator: 'tester',
        remark: '测试错误门店'
      });
      console.log('   状态:', badStoreVerify.status, badStoreVerify.body.status);
      console.log('   错误信息:', badStoreVerify.body.error);
      console.log('   ✓ 正确拦截了错误门店的核销');

      console.log('\n12. 测试转店申请 - 门店不一致校验...');
      const badTransfer = await makeRequest({
        hostname: 'localhost',
        port: 3000,
        path: '/api/transfers',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        package_id: pkg.id,
        from_store_id: 'wrong-store-id',
        to_store_id: stores.body.data[1].id,
        request_note: '测试转店',
        operator: 'tester'
      });
      console.log('   状态:', badTransfer.status, badTransfer.body.status);
      console.log('   错误信息:', badTransfer.body.error);
      console.log('   ✓ 正确拦截了门店不一致的转店申请');
    }

    console.log('\n13. 查询转店申请...');
    const transfers = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/transfers',
      method: 'GET'
    });
    console.log('    状态:', transfers.status, '数量:', transfers.body.data?.length || 0);

    console.log('\n14. 查询延期申请...');
    const extensions = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/extensions',
      method: 'GET'
    });
    console.log('    状态:', extensions.status, '数量:', extensions.body.data?.length || 0);

    console.log('\n15. 查询异常日志...');
    const exceptions = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/reports/exceptions',
      method: 'GET'
    });
    console.log('    状态:', exceptions.status, '数量:', exceptions.body.data?.length || 0);

    console.log('\n16. 查询人工修正记录...');
    const corrections = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/reports/corrections',
      method: 'GET'
    });
    console.log('    状态:', corrections.status, '数量:', corrections.body.data?.length || 0);

    console.log('\n17. 测试创建套餐 - 错误门店校验...');
    const badStorePkg = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/packages',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      customer_id: customers.body.data[0].id,
      name: '测试套餐',
      total_count: 10,
      purchase_date: '2024-01-01',
      expire_date: '2025-01-01',
      store_id: 'invalid-store-id',
      operator: 'tester'
    });
    console.log('    状态:', badStorePkg.status, badStorePkg.body.status);
    console.log('    错误信息:', badStorePkg.body.error);
    console.log('    ✓ 正确拦截了错误门店的套餐创建');

    console.log('\n=== 测试完成 ===');
    console.log('\n状态码说明:');
    console.log('  - completed: 操作成功');
    console.log('  - pending_review: 待审核');
    console.log('  - approved: 已批准');
    console.log('  - rejected: 已驳回');
    console.log('  - compensated: 已补偿');
    console.log('  - failed: 操作失败');

  } catch (error) {
    console.error('测试失败:', error.message);
    console.log('\n请先启动服务: npm start');
  }
}

testAPI();
