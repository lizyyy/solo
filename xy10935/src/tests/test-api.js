const http = require('http');

const baseURL = 'localhost';
const port = 3000;

const request = (method, path, data = null) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: baseURL,
      port: port,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(body)
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: body
          });
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
};

const today = new Date().toISOString().split('T')[0];

const runTests = async () => {
  console.log('========================================');
  console.log('儿童托管接送API测试');
  console.log('========================================\n');

  try {
    console.log('1. 测试获取学生列表...');
    const studentsRes = await request('GET', '/api/students');
    console.log(`   状态: ${studentsRes.status}`);
    console.log(`   学生数量: ${studentsRes.data.data?.length || 0}\n`);

    console.log('2. 测试创建学生（正常）...');
    const newStudent = {
      name: '测试学生',
      grade: '四年级',
      class_name: '1班',
      parent_name: '测试家长',
      parent_phone: '13900139000'
    };
    const createRes = await request('POST', '/api/students', newStudent);
    console.log(`   状态: ${createRes.status}`);
    console.log(`   成功: ${createRes.data.success}`);
    const studentId = createRes.data.data?.id;
    console.log();

    console.log('3. 测试创建学生（重复提交）...');
    const duplicateRes = await request('POST', '/api/students', newStudent);
    console.log(`   状态: ${duplicateRes.status}`);
    console.log(`   预期错误: ${duplicateRes.status === 409 ? '正确拦截重复提交' : '未正确拦截'}`);
    console.log();

    console.log('4. 测试创建接送人...');
    const guardianRes = await request('POST', '/api/guardians', {
      student_id: studentId,
      name: '测试家长',
      relation: '父亲',
      phone: '13900139000',
      is_primary: 1
    });
    console.log(`   状态: ${guardianRes.status}`);
    console.log(`   成功: ${guardianRes.data.success}`);
    const guardianId = guardianRes.data.data?.id;
    console.log();

    console.log('5. 测试创建授权...');
    const authRes = await request('POST', '/api/authorizations', {
      student_id: studentId,
      guardian_id: guardianId,
      date: today,
      start_time: '16:00',
      end_time: '18:00',
      created_by: 'test'
    });
    console.log(`   状态: ${authRes.status}`);
    console.log(`   成功: ${authRes.data.success}`);
    console.log();

    console.log('6. 测试接送记录（正常）...');
    const pickupRes = await request('POST', '/api/pickups', {
      student_id: studentId,
      guardian_id: guardianId,
      date: today,
      pickup_time: '16:30',
      scheduled_time: '16:00',
      verified_by: 'test'
    });
    console.log(`   状态: ${pickupRes.status}`);
    console.log(`   成功: ${pickupRes.data.success}`);
    const pickupId = pickupRes.data.data?.pickup?.id;
    console.log();

    console.log('7. 测试接送记录（异常拦截 - 重复接送）...');
    const duplicatePickupRes = await request('POST', '/api/pickups', {
      student_id: studentId,
      guardian_id: guardianId,
      date: today,
      pickup_time: '16:45',
      verified_by: 'test'
    });
    console.log(`   状态: ${duplicatePickupRes.status}`);
    console.log(`   预期错误: ${duplicatePickupRes.status === 400 ? '正确拦截重复接送' : '未正确拦截'}`);
    console.log();

    console.log('8. 测试接送记录（异常拦截 - 无授权）...');
    const unauthorizedPickupRes = await request('POST', '/api/pickups', {
      student_id: 999,
      guardian_id: 999,
      date: today,
      pickup_time: '17:00',
      verified_by: 'test'
    });
    console.log(`   状态: ${unauthorizedPickupRes.status}`);
    console.log(`   预期错误: ${unauthorizedPickupRes.status === 400 ? '正确拦截无授权' : '未正确拦截'}`);
    console.log();

    console.log('9. 测试请假申请...');
    const leaveRes = await request('POST', '/api/leaves', {
      student_id: studentId,
      date: '2024-12-31',
      leave_type: '病假',
      reason: '身体不适'
    });
    console.log(`   状态: ${leaveRes.status}`);
    console.log(`   成功: ${leaveRes.data.success}`);
    const leaveId = leaveRes.data.data?.id;
    console.log();

    console.log('10. 测试请假审批...');
    const approveRes = await request('PUT', `/api/leaves/${leaveId}/approve`, {
      approved_by: 'admin'
    });
    console.log(`   状态: ${approveRes.status}`);
    console.log(`   成功: ${approveRes.data.success}`);
    console.log();

    console.log('11. 测试人工修正...');
    const correctionRes = await request('POST', '/api/admin/corrections', {
      record_type: 'student',
      record_id: studentId,
      field_name: 'class_name',
      new_value: '2班',
      reason: '班级调整',
      corrected_by: 'admin'
    });
    console.log(`   状态: ${correctionRes.status}`);
    console.log(`   成功: ${correctionRes.data.success}`);
    console.log();

    console.log('12. 测试状态变更历史...');
    const historyRes = await request('GET', '/api/admin/status-history?record_type=student&record_id=' + studentId);
    console.log(`   状态: ${historyRes.status}`);
    console.log(`   历史记录数量: ${historyRes.data.data?.length || 0}`);
    console.log();

    console.log('13. 测试异常日志...');
    const exceptionsRes = await request('GET', '/api/admin/exceptions');
    console.log(`   状态: ${exceptionsRes.status}`);
    console.log(`   异常记录数量: ${exceptionsRes.data.data?.length || 0}`);
    console.log();

    console.log('14. 测试日报表导出...');
    const dailyReportRes = await request('GET', `/api/reports/daily?date=${today}`);
    console.log(`   状态: ${dailyReportRes.status}`);
    console.log(`   接送记录: ${dailyReportRes.data.data?.summary?.total_pickups || 0}`);
    console.log();

    console.log('15. 测试人工修正查询...');
    const correctionsRes = await request('GET', '/api/admin/corrections');
    console.log(`   状态: ${correctionsRes.status}`);
    console.log(`   修正记录数量: ${correctionsRes.data.data?.length || 0}`);
    console.log();

    console.log('========================================');
    console.log('测试完成！');
    console.log('========================================');
    console.log('\n验收要点:');
    console.log('- 正常创建: 学生、接送人、授权、接送记录都能正常创建');
    console.log('- 重复提交: 重复创建学生、重复接送都能被正确拦截');
    console.log('- 异常拦截: 无授权、不存在的学生/接送人都能被验证拦截');
    console.log('- 状态历史: 状态变更都有历史记录可追溯');
    console.log('- 人工修正: 可以手动修正数据并留下修正记录');
    console.log('- 导出报告: 可以导出日报表，数据完整');
    console.log('- 异常日志: 所有异常请求都被记录在异常日志中');

  } catch (error) {
    console.error('测试出错:', error.message);
    console.log('\n请确保API服务已启动: npm start');
    process.exit(1);
  }
};

runTests();
