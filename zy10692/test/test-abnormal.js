const http = require('http');

const BASE_URL = 'http://localhost:3000';

function request(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
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
          resolve({
            status: res.statusCode,
            data: JSON.parse(body)
          });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function runAbnormalTest() {
  console.log('='.repeat(60));
  console.log('异常流程测试 - 数据血缘服务字段下线订阅通知');
  console.log('='.repeat(60));
  console.log('');

  try {
    console.log('测试 1: 批量导入 - 空数组');
    const emptyImport = await request('/api/deprecation/import', 'POST', { records: [] });
    console.log('  状态码:', emptyImport.status);
    console.log('  错误码:', emptyImport.data.error);
    console.log('  预期: 400 INVALID_INPUT');
    console.log('  结果:', emptyImport.status === 400 ? '通过' : '失败');
    console.log('');

    console.log('测试 2: 批量导入 - 缺少必填字段');
    const missingFieldImport = await request('/api/deprecation/import', 'POST', {
      records: [{ tableName: 'test', fieldName: 'test' }]
    });
    console.log('  状态码:', missingFieldImport.status);
    console.log('  错误码:', missingFieldImport.data.error);
    console.log('  预期: 400 MISSING_FIELDS');
    console.log('  结果:', missingFieldImport.status === 400 ? '通过' : '失败');
    console.log('');

    console.log('测试 3: 确认不存在的记录');
    const confirmNotExist = await request('/api/deprecation/not-exist-id/confirm', 'POST', {
      confirmedBy: 'test@example.com'
    });
    console.log('  状态码:', confirmNotExist.status);
    console.log('  错误码:', confirmNotExist.data.error);
    console.log('  预期: 404 RECORD_NOT_FOUND');
    console.log('  结果:', confirmNotExist.status === 404 ? '通过' : '失败');
    console.log('');

    console.log('测试 4: 确认 - 缺少确认人');
    const missingConfirmBy = await request('/api/deprecation/some-id/confirm', 'POST', {});
    console.log('  状态码:', missingConfirmBy.status);
    console.log('  错误码:', missingConfirmBy.data.error);
    console.log('  预期: 400 MISSING_CONFIRMED_BY');
    console.log('  结果:', missingConfirmBy.status === 400 ? '通过' : '失败');
    console.log('');

    console.log('测试 5: 撤回不存在的记录');
    const revokeNotExist = await request('/api/deprecation/not-exist-id/revoke', 'POST', {
      reason: 'test'
    });
    console.log('  状态码:', revokeNotExist.status);
    console.log('  错误码:', revokeNotExist.data.error);
    console.log('  预期: 404 RECORD_NOT_FOUND');
    console.log('  结果:', revokeNotExist.status === 404 ? '通过' : '失败');
    console.log('');

    console.log('测试 6: 发布校验 - 缺少参数');
    const missingValidateParams = await request('/api/deprecation/validate-publish');
    console.log('  状态码:', missingValidateParams.status);
    console.log('  错误码:', missingValidateParams.data.error);
    console.log('  预期: 400 MISSING_PARAMS');
    console.log('  结果:', missingValidateParams.status === 400 ? '通过' : '失败');
    console.log('');

    console.log('测试 7: 未确认阻止发布（核心功能）');
    console.log('  先导入一条记录不确认...');
    const testImport = await request('/api/deprecation/import', 'POST', {
      records: [{
        tableName: 'test_table_abnormal',
        fieldName: 'test_field_abnormal',
        downstreamTask: 'test_task_abnormal',
        notifier: 'tester@example.com'
      }]
    });
    console.log('  导入成功:', testImport.status === 200);
    
    console.log('  尝试发布校验...');
    const unconfirmedValidate = await request(
      `/api/deprecation/validate-publish?tableName=test_table_abnormal&fieldName=test_field_abnormal`
    );
    console.log('  状态码:', unconfirmedValidate.status);
    console.log('  错误码:', unconfirmedValidate.data.error);
    console.log('  可发布:', unconfirmedValidate.data.data?.canPublish);
    console.log('  未确认数量:', unconfirmedValidate.data.data?.unconfirmedCount);
    console.log('  预期: 403 UNCONFIRMED_DOWNSTREAMS, canPublish=false');
    console.log('  结果:', unconfirmedValidate.status === 403 && 
                           unconfirmedValidate.data.data.canPublish === false ? '通过' : '失败');
    console.log('');

    console.log('测试 8: 查询不存在的记录');
    const getNotExist = await request('/api/deprecation/not-exist-id');
    console.log('  状态码:', getNotExist.status);
    console.log('  错误码:', getNotExist.data.error);
    console.log('  预期: 404 RECORD_NOT_FOUND');
    console.log('  结果:', getNotExist.status === 404 ? '通过' : '失败');
    console.log('');

    console.log('测试 9: 不存在的接口');
    const notFoundApi = await request('/api/non-existent');
    console.log('  状态码:', notFoundApi.status);
    console.log('  错误码:', notFoundApi.data.error);
    console.log('  预期: 404 NOT_FOUND');
    console.log('  结果:', notFoundApi.status === 404 ? '通过' : '失败');
    console.log('');

    console.log('测试 10: 已撤回的记录不能确认');
    console.log('  先导入一条记录...');
    const revokeTestImport = await request('/api/deprecation/import', 'POST', {
      records: [{
        tableName: 'revoke_test',
        fieldName: 'revoke_field',
        downstreamTask: 'revoke_task',
        notifier: 'tester@example.com'
      }]
    });
    const revokeTestRecord = revokeTestImport.data.data.results[0].data;
    console.log('  导入记录ID:', revokeTestRecord.id);

    console.log('  撤回该记录...');
    const revokeResult = await request(`/api/deprecation/${revokeTestRecord.id}/revoke`, 'POST', {
      reason: '测试撤回'
    });
    console.log('  撤回成功:', revokeResult.status === 200);
    console.log('  新状态:', revokeResult.data.data.status);

    console.log('  尝试确认已撤回的记录...');
    const confirmRevoked = await request(`/api/deprecation/${revokeTestRecord.id}/confirm`, 'POST', {
      confirmedBy: 'tester@example.com'
    });
    console.log('  状态码:', confirmRevoked.status);
    console.log('  错误码:', confirmRevoked.data.error);
    console.log('  预期: 400 RECORD_REVOKED');
    console.log('  结果:', confirmRevoked.status === 400 ? '通过' : '失败');
    console.log('');

    console.log('='.repeat(60));
    console.log('异常流程测试完成！');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('测试失败:', error.message);
    console.error('请确保服务已启动: npm start');
    process.exit(1);
  }
}

runAbnormalTest();