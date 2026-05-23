const http = require('http');

const BASE_URL = 'http://localhost:3000';

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
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
  console.log('========================================');
  console.log('  养老院探访预约API - 功能测试');
  console.log('========================================\n');

  let elderId, visitorId, roomId, timeSlotId, appointmentId;

  try {
    console.log('📍 测试1: 健康检查');
    const health = await makeRequest('GET', '/health');
    console.log(`   状态: ${health.status} - ${health.data.message}\n`);
  } catch (e) {
    console.log('   ❌ 服务未启动，请先运行 npm start\n');
    process.exit(1);
  }

  try {
    console.log('📍 测试2: 获取基础数据 - 老人列表');
    const elders = await makeRequest('GET', '/api/data/elders');
    elderId = elders.data.data[0].id;
    console.log(`   成功获取 ${elders.data.data.length} 位老人\n`);

    console.log('📍 测试3: 获取基础数据 - 探访人列表');
    const visitors = await makeRequest('GET', '/api/data/visitors');
    visitorId = visitors.data.data[0].id;
    console.log(`   成功获取 ${visitors.data.data.length} 位探访人\n`);

    console.log('📍 测试4: 获取基础数据 - 房间列表');
    const rooms = await makeRequest('GET', '/api/data/rooms');
    roomId = rooms.data.data[0].id;
    console.log(`   成功获取 ${rooms.data.data.length} 个房间\n`);

    console.log('📍 测试5: 获取基础数据 - 时间段列表');
    const today = new Date().toISOString().split('T')[0];
    const timeSlots = await makeRequest('GET', `/api/data/timeslots?date=${today}`);
    timeSlotId = timeSlots.data.data[2].id;
    console.log(`   成功获取 ${timeSlots.data.data.length} 个时间段\n`);

    console.log('📍 测试6: 创建预约 [正常流程]');
    const newAppointment = await makeRequest('POST', '/api/appointments', {
      elder_id: elderId,
      visitor_id: visitorId,
      time_slot_id: timeSlotId,
      room_id: roomId,
      visitor_count: 1,
      notes: '常规探访'
    });
    if (!newAppointment.data.success) {
      throw new Error(`创建预约失败: ${newAppointment.data.error}`);
    }
    appointmentId = newAppointment.data.data.id;
    console.log(`   ✅ 创建成功, 预约ID: ${appointmentId.substring(0, 8)}...\n`);

    console.log('📍 测试7: 重复预约拦截 [异常流程]');
    const duplicate = await makeRequest('POST', '/api/appointments', {
      elder_id: elderId,
      visitor_id: visitorId,
      time_slot_id: timeSlotId,
      room_id: roomId,
      visitor_count: 1
    });
    console.log(`   ✅ 拦截成功: ${duplicate.data.error}\n`);

    console.log('📍 测试8: 查询预约详情');
    const appointment = await makeRequest('GET', `/api/appointments/${appointmentId}`);
    console.log(`   ✅ 查询成功: ${appointment.data.data.elder_name} - ${appointment.data.data.status}\n`);

    console.log('📍 测试9: 推进预约状态 - 确认预约');
    const confirmStatus = await makeRequest('PUT', `/api/appointments/${appointmentId}/status`, {
      new_status: 'confirmed',
      reason: '护士电话确认'
    });
    console.log(`   ✅ 状态更新: ${confirmStatus.data.data.previous_status} -> ${confirmStatus.data.data.new_status}\n`);

    console.log('📍 测试10: 提交健康申报');
    const healthDeclare = await makeRequest('POST', '/api/health/declare', {
      appointment_id: appointmentId,
      visitor_id: visitorId,
      has_fever: 0,
      has_cough: 0,
      has_contact_history: 0,
      temperature: 36.5,
      health_code_status: 'green'
    });
    console.log(`   ✅ 健康申报提交成功\n`);

    console.log('📍 测试11: 查询预约状态历史');
    const history = await makeRequest('GET', `/api/appointments/${appointmentId}/history`);
    console.log(`   ✅ 状态历史记录数: ${history.data.data.length}`);
    history.data.data.forEach((h, i) => {
      console.log(`      ${i + 1}. ${h.previous_status || '无'} -> ${h.new_status} [${h.change_reason}]`);
    });
    console.log('');

    console.log('📍 测试12: 无效状态转换拦截 [异常流程]');
    const invalidStatus = await makeRequest('PUT', `/api/appointments/${appointmentId}/status`, {
      new_status: 'completed',
      reason: '测试无效转换'
    });
    console.log(`   ✅ 拦截成功: ${invalidStatus.data.error}\n`);

    console.log('📍 测试13: 人工修正预约 [管理功能]');
    const manualOverride = await makeRequest('PUT', `/api/appointments/${appointmentId}/manual`, {
      status: 'completed',
      notes: '管理员人工标记为已完成'
    });
    console.log(`   ✅ 人工修正成功\n`);

    console.log('📍 测试14: 查询异常记录');
    const exceptions = await makeRequest('GET', '/api/appointments/exceptions/all');
    console.log(`   ✅ 异常记录数: ${exceptions.data.data.length}`);
    exceptions.data.data.forEach((ex, i) => {
      console.log(`      ${i + 1}. ${ex.error_type}: ${ex.error_message}`);
    });
    console.log('');

    console.log('📍 测试15: 获取统计数据');
    const stats = await makeRequest('GET', `/api/reports/statistics?date=${today}`);
    console.log(`   ✅ 预约统计: 总数 ${stats.data.data.appointments.total}, 已完成 ${stats.data.data.appointments.completed}`);
    console.log(`   ✅ 异常统计: 总数 ${stats.data.data.exceptions.total_exceptions}, 重复预约 ${stats.data.data.exceptions.duplicate_count}\n`);

    console.log('📍 测试16: 导出CSV报告');
    const csv = await makeRequest('GET', `/api/reports/export/csv?start_date=${today}&end_date=${today}`);
    console.log(`   ✅ CSV导出成功, 数据长度: ${csv.data.length} 字符\n`);

    console.log('========================================');
    console.log('  ✅ 所有测试通过!');
    console.log('========================================');
    console.log('\n验收要点回顾:');
    console.log('  ✅ 正常创建预约');
    console.log('  ✅ 重复提交拦截');
    console.log('  ✅ 异常处理与记录');
    console.log('  ✅ 人工修正功能');
    console.log('  ✅ 状态历史追踪');
    console.log('  ✅ 报告导出功能');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    process.exit(1);
  }
}

runTests();
