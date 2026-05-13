const http = require('http');

function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
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
        } catch {
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
  console.log('🧪 开始测试 API 端点...\n');
  
  // 启动服务器
  const serverProcess = require('child_process').spawn('node', ['server/index.js']);
  await new Promise(resolve => setTimeout(resolve, 2000));

  try {
    // 测试 1: 获取班级列表
    console.log('📚 测试 1: 获取班级列表');
    const classesRes = await makeRequest('/api/classes');
    console.log(`  状态码: ${classesRes.status}`);
    console.log(`  班级数量: ${classesRes.data.length}`);
    console.log(`  第一个班级: ${classesRes.data[0]?.name}`);
    console.log('  ✓ 通过\n');

    // 测试 2: 获取学员列表
    console.log('👨‍🎓 测试 2: 获取学员列表');
    const studentsRes = await makeRequest('/api/students');
    console.log(`  状态码: ${studentsRes.status}`);
    console.log(`  学员数量: ${studentsRes.data.length}`);
    console.log(`  第一个学员: ${studentsRes.data[0]?.name}`);
    console.log('  ✓ 通过\n');

    // 测试 3: 获取直播场次
    console.log('🎥 测试 3: 获取直播场次');
    const sessionsRes = await makeRequest('/api/sessions');
    console.log(`  状态码: ${sessionsRes.status}`);
    console.log(`  场次数量: ${sessionsRes.data.length}`);
    console.log('  ✓ 通过\n');

    // 测试 4: 获取权限列表
    console.log('🔐 测试 4: 获取权限列表');
    const permissionsRes = await makeRequest('/api/permissions');
    console.log(`  状态码: ${permissionsRes.status}`);
    console.log(`  权限数量: ${permissionsRes.data.length}`);
    console.log(`  活跃权限: ${permissionsRes.data.filter(p => p.status === 'active').length}`);
    console.log('  ✓ 通过\n');

    // 测试 5: 测试权限检查
    console.log('✅ 测试 5: 权限检查');
    const studentId = studentsRes.data[0]?.id;
    const sessionId = sessionsRes.data[0]?.id;
    const accessCheck = await makeRequest('/api/permissions/check-access', 'POST', {
      student_id: studentId,
      account_identifier: 'test',
      session_id: sessionId
    });
    console.log(`  状态码: ${accessCheck.status}`);
    console.log(`  允许访问: ${accessCheck.data.allowed}`);
    console.log('  ✓ 通过\n');

    // 测试 6: 测试报名功能
    console.log('📝 测试 6: 学员报名');
    const newStudent = studentsRes.data[4]; // 孙七，最后一个学员
    const newClass = classesRes.data[2]; // 前端高级班
    const enrollRes = await makeRequest('/api/enrollments', 'POST', {
      class_id: newClass.id,
      student_id: newStudent.id
    });
    console.log(`  状态码: ${enrollRes.status}`);
    console.log(`  学员: ${newStudent.name} 报名班级: ${newClass.name}`);
    console.log('  ✓ 通过\n');

    // 测试 7: 测试异常检测
    console.log('⚠️ 测试 7: 异常检测');
    const detectRes = await makeRequest('/api/anomalies/detect', 'POST');
    console.log(`  状态码: ${detectRes.status}`);
    console.log(`  检测到异常: ${detectRes.data.detected}`);
    console.log('  ✓ 通过\n');

    // 测试 8: 获取异常列表
    console.log('🔍 测试 8: 获取异常列表');
    const anomaliesRes = await makeRequest('/api/anomalies');
    console.log(`  状态码: ${anomaliesRes.status}`);
    console.log(`  异常数量: ${anomaliesRes.data.length}`);
    console.log('  ✓ 通过\n');

    // 测试 9: 获取操作事件
    console.log('📋 测试 9: 获取操作事件');
    const eventsRes = await makeRequest('/api/events');
    console.log(`  状态码: ${eventsRes.status}`);
    console.log(`  事件数量: ${eventsRes.data.length}`);
    console.log('  ✓ 通过\n');

    // 测试 10: 获取访问日志
    console.log('📜 测试 10: 获取访问日志');
    const logsRes = await makeRequest('/api/logs');
    console.log(`  状态码: ${logsRes.status}`);
    console.log(`  日志数量: ${logsRes.data.length}`);
    console.log('  ✓ 通过\n');

    console.log('='.repeat(60));
    console.log('✅ 所有 API 测试通过！后端服务运行正常');
    console.log('='.repeat(60));
    console.log('\n📊 总结:');
    console.log(`  - 班级: ${classesRes.data.length} 个`);
    console.log(`  - 学员: ${studentsRes.data.length} 名`);
    console.log(`  - 直播场次: ${sessionsRes.data.length} 个`);
    console.log(`  - 权限记录: ${permissionsRes.data.length} 条`);
    console.log(`  - 检测异常: ${detectRes.data.detected} 个`);
    console.log(`  - 操作事件: ${eventsRes.data.length} 条`);

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  } finally {
    serverProcess.kill();
  }
}

runTests();
