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

async function runDuplicateTest() {
  console.log('='.repeat(60));
  console.log('重复运行测试 - 数据血缘服务字段下线订阅通知');
  console.log('='.repeat(60));
  console.log('');

  try {
    const testRecords = [
      {
        tableName: 'dup_test_table',
        fieldName: 'dup_test_field',
        downstreamTask: 'dup_task_1',
        notifier: 'tester1@example.com'
      },
      {
        tableName: 'dup_test_table',
        fieldName: 'dup_test_field',
        downstreamTask: 'dup_task_2',
        notifier: 'tester2@example.com'
      },
      {
        tableName: 'dup_test_table',
        fieldName: 'dup_test_field',
        downstreamTask: 'dup_task_3',
        notifier: 'tester3@example.com'
      }
    ];

    console.log('测试 1: 第一次批量导入');
    const firstImport = await request('/api/deprecation/import', 'POST', { records: testRecords });
    console.log('  状态码:', firstImport.status);
    console.log('  总数:', firstImport.data.data.total);
    console.log('  成功:', firstImport.data.data.success);
    console.log('  失败:', firstImport.data.data.failed);
    console.log('  预期: 全部成功');
    console.log('  结果:', firstImport.data.data.success === 3 ? '通过' : '失败');
    console.log('');

    console.log('测试 2: 重复导入相同记录');
    const secondImport = await request('/api/deprecation/import', 'POST', { records: testRecords });
    console.log('  状态码:', secondImport.status);
    console.log('  总数:', secondImport.data.data.total);
    console.log('  成功:', secondImport.data.data.success);
    console.log('  失败:', secondImport.data.data.failed);
    console.log('  预期: 全部失败（重复记录）');
    console.log('  结果:', secondImport.data.data.failed === 3 ? '通过' : '失败');
    
    const dupErrors = secondImport.data.data.results.filter(r => !r.success);
    console.log('  错误原因统计:');
    dupErrors.forEach((r, i) => {
      console.log(`    记录${i + 1}: ${r.error} - ${r.message}`);
    });
    console.log('');

    console.log('测试 3: 部分重复导入');
    const partialRecords = [
      ...testRecords.slice(0, 2),
      {
        tableName: 'dup_test_table',
        fieldName: 'dup_test_field',
        downstreamTask: 'dup_task_NEW',
        notifier: 'tester_new@example.com'
      }
    ];
    const partialImport = await request('/api/deprecation/import', 'POST', { records: partialRecords });
    console.log('  状态码:', partialImport.status);
    console.log('  总数:', partialImport.data.data.total);
    console.log('  成功:', partialImport.data.data.success);
    console.log('  失败:', partialImport.data.data.failed);
    console.log('  预期: 1成功, 2失败');
    console.log('  结果:', partialImport.data.data.success === 1 && 
                           partialImport.data.data.failed === 2 ? '通过' : '失败');
    console.log('');

    console.log('测试 4: 重复确认同一条记录');
    console.log('  先导入一条新记录...');
    const newRecordImport = await request('/api/deprecation/import', 'POST', {
      records: [{
        tableName: 'confirm_dup_test',
        fieldName: 'confirm_field',
        downstreamTask: 'confirm_task',
        notifier: 'tester@example.com'
      }]
    });
    const recordId = newRecordImport.data.data.results[0].data.id;
    console.log('  记录ID:', recordId);

    console.log('  第一次确认...');
    const firstConfirm = await request(`/api/deprecation/${recordId}/confirm`, 'POST', {
      confirmedBy: 'tester@example.com',
      notes: '第一次确认'
    });
    console.log('  第一次确认状态:', firstConfirm.status);
    console.log('  确认后状态:', firstConfirm.data.data.status);

    console.log('  第二次确认（重复确认）...');
    const secondConfirm = await request(`/api/deprecation/${recordId}/confirm`, 'POST', {
      confirmedBy: 'tester@example.com',
      notes: '第二次确认'
    });
    console.log('  第二次确认状态:', secondConfirm.status);
    console.log('  最终状态:', secondConfirm.data?.data?.status || secondConfirm.data?.error);
    console.log('  说明: 已确认状态的记录再次确认状态不变');
    console.log('');

    console.log('测试 5: 多次发布校验结果一致');
    console.log('  导入一条未确认记录...');
    const publishTestImport = await request('/api/deprecation/import', 'POST', {
      records: [{
        tableName: 'publish_dup_test',
        fieldName: 'publish_field',
        downstreamTask: 'publish_task',
        notifier: 'tester@example.com'
      }]
    });
    console.log('  导入成功:', publishTestImport.status === 200);

    console.log('  第一次发布校验...');
    const validate1 = await request(
      `/api/deprecation/validate-publish?tableName=publish_dup_test&fieldName=publish_field`
    );
    console.log('  状态码:', validate1.status);
    console.log('  可发布:', validate1.data.data.canPublish);
    console.log('  未确认数:', validate1.data.data.unconfirmedCount);

    console.log('  第二次发布校验...');
    const validate2 = await request(
      `/api/deprecation/validate-publish?tableName=publish_dup_test&fieldName=publish_field`
    );
    console.log('  状态码:', validate2.status);
    console.log('  可发布:', validate2.data.data.canPublish);
    console.log('  未确认数:', validate2.data.data.unconfirmedCount);

    console.log('  第三次发布校验...');
    const validate3 = await request(
      `/api/deprecation/validate-publish?tableName=publish_dup_test&fieldName=publish_field`
    );
    console.log('  状态码:', validate3.status);
    console.log('  可发布:', validate3.data.data.canPublish);
    console.log('  未确认数:', validate3.data.data.unconfirmedCount);

    const resultsConsistent = 
      validate1.status === validate2.status && 
      validate2.status === validate3.status &&
      validate1.data.data.canPublish === validate2.data.data.canPublish &&
      validate2.data.data.canPublish === validate3.data.data.canPublish;
    
    console.log('  预期: 三次结果完全一致');
    console.log('  结果:', resultsConsistent ? '通过' : '失败');
    console.log('');

    console.log('测试 6: 确认后发布校验结果变化');
    const publishRecordId = publishTestImport.data.data.results[0].data.id;
    
    console.log('  确认该记录...');
    const confirmForPublish = await request(`/api/deprecation/${publishRecordId}/confirm`, 'POST', {
      confirmedBy: 'tester@example.com'
    });
    console.log('  确认成功:', confirmForPublish.status === 200);

    console.log('  确认后发布校验...');
    const validateAfterConfirm = await request(
      `/api/deprecation/validate-publish?tableName=publish_dup_test&fieldName=publish_field`
    );
    console.log('  状态码:', validateAfterConfirm.status);
    console.log('  可发布:', validateAfterConfirm.data.data.canPublish);
    console.log('  未确认数:', validateAfterConfirm.data.data.unconfirmedCount);
    console.log('  预期: 200 OK, canPublish=true');
    console.log('  结果:', validateAfterConfirm.status === 200 && 
                           validateAfterConfirm.data.data.canPublish === true ? '通过' : '失败');
    console.log('');

    console.log('测试 7: 查看最终统计信息');
    const finalStats = await request('/api/deprecation/statistics');
    console.log('  总记录数:', finalStats.data.data.total);
    console.log('  待确认:', finalStats.data.data.pending);
    console.log('  已确认:', finalStats.data.data.confirmed);
    console.log('  已撤回:', finalStats.data.data.revoked);
    console.log('');

    console.log('='.repeat(60));
    console.log('重复运行测试完成！');
    console.log('='.repeat(60));
    console.log('');
    console.log('人工复核提示:');
    console.log('1. 检查重复导入时是否正确检测重复并返回 DUPLICATE_RECORD');
    console.log('2. 确认状态变更后是否幂等（多次确认结果一致）');
    console.log('3. 发布校验结果是否稳定且准确');
    console.log('4. 统计数字是否符合预期');

  } catch (error) {
    console.error('测试失败:', error.message);
    console.error('请确保服务已启动: npm start');
    process.exit(1);
  }
}

runDuplicateTest();