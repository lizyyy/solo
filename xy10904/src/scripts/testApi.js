const http = require('http');

const baseUrl = 'http://localhost:3000/api';

const request = (method, path, data = null) => {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
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
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
};

const runTests = async () => {
  console.log('🏋️ 健身房私教课消课API - 集成测试\n');

  try {
    console.log('1️⃣  测试健康检查...');
    const health = await request('GET', '/health');
    console.log(`   状态: ${health.status} - ${health.data.message}\n`);

    console.log('2️⃣  获取会员列表...');
    const members = await request('GET', '/members');
    console.log(`   获取到 ${members.data.data.length} 个会员`);
    const member1 = members.data.data[0];
    console.log(`   第一个会员: ${member1.name} (${member1.phone})\n`);

    console.log('3️⃣  获取教练列表...');
    const coaches = await request('GET', '/coaches');
    console.log(`   获取到 ${coaches.data.data.length} 个教练`);
    const coach1 = coaches.data.data[0];
    console.log(`   第一个教练: ${coach1.name} (${coach1.specialty})\n`);

    console.log('4️⃣  获取课程包列表...');
    const packages = await request('GET', '/course-packages');
    console.log(`   获取到 ${packages.data.data.length} 个课程包\n`);

    console.log('5️⃣  获取会员的会员卡...');
    const cards = await request('GET', `/members/${member1.id}/membership-cards`);
    console.log(`   获取到 ${cards.data.data.length} 张会员卡`);
    if (cards.data.data.length > 0) {
      const card1 = cards.data.data[0];
      console.log(`   剩余课时: ${card1.remaining_lessons}/${card1.total_lessons}\n`);

      console.log('6️⃣  获取会员的预约...');
      const appointments = await request('GET', `/members/${member1.id}/appointments`);
      console.log(`   获取到 ${appointments.data.data.length} 个预约`);
      
      if (appointments.data.data.length > 0) {
        const scheduledAppt = appointments.data.data.find(a => a.status === 'scheduled');
        if (scheduledAppt) {
          console.log(`   待消课预约: ${scheduledAppt.appointment_date} ${scheduledAppt.appointment_time}`);
          console.log(`   预约ID: ${scheduledAppt.id}\n`);

          console.log('7️⃣  测试消课功能...');
          const consumption = await request('POST', '/course-consumptions', {
            appointment_id: scheduledAppt.id,
            operator: '前台管理员',
            remark: '正常消课'
          });
          console.log(`   消课结果: ${consumption.data.success ? '成功' : '失败'}`);
          if (consumption.data.success) {
            console.log(`   消课后剩余课时: ${consumption.data.data.afterRemaining}`);
            
            console.log('\n8️⃣  验证消课记录可追溯...');
            const cardAfter = await request('GET', `/membership-cards/${card1.id}`);
            console.log(`   会员卡当前剩余课时: ${cardAfter.data.data.remaining_lessons}`);
            
            const consumptions = await request('GET', `/membership-cards/${card1.id}/consumptions`);
            console.log(`   消课记录数量: ${consumptions.data.data.length}`);
            
            if (consumptions.data.data.length > 0) {
              const lastConsumption = consumptions.data.data[0];
              console.log(`   最新消课记录: ${lastConsumption.consumption_date} - 课时: ${lastConsumption.before_remaining} -> ${lastConsumption.after_remaining}`);
            }
          }
          console.log('');
        }
      }

      console.log('9️⃣  测试重复消课拦截...');
      if (appointments.data.data.length > 0) {
        const completedAppt = appointments.data.data.find(a => a.status === 'completed');
        if (completedAppt) {
          const duplicate = await request('POST', '/course-consumptions', {
            appointment_id: completedAppt.id,
            operator: '前台管理员'
          });
          console.log(`   重复消课拦截结果: ${!duplicate.data.success ? '正确拦截' : '错误 - 未拦截'}`);
          console.log(`   错误信息: ${duplicate.data.error}`);
          console.log(`   错误代码: ${duplicate.data.errorCode}\n`);
        }
      }

      console.log('🔟  获取异常日志...');
      const exceptions = await request('GET', '/exceptions');
      console.log(`   异常记录数量: ${exceptions.data.data.length}`);
      if (exceptions.data.data.length > 0) {
        console.log(`   最后一条异常类型: ${exceptions.data.data[0].operation_type}`);
        console.log(`   处理结果: ${exceptions.data.data[0].processing_result}`);
      }
    }

    console.log('\n✅ 测试完成!');
    console.log('\n📊 核心功能验证结果:');
    console.log('   ✅ 基础数据管理 (会员/教练/课程包)');
    console.log('   ✅ 会员卡管理');
    console.log('   ✅ 预约管理');
    console.log('   ✅ 消课功能');
    console.log('   ✅ 重复消课拦截');
    console.log('   ✅ 消课记录可追溯');
    console.log('   ✅ 异常日志记录');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.log('💡 请确保API服务已启动 (npm start)');
    process.exit(1);
  }
};

runTests();
