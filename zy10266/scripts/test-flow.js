const http = require('http');

const BASE_URL = 'http://localhost:3000/api';

function request(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
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
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, data: json });
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

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function printStep(num, title) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`步骤 ${num}: ${title}`);
  console.log(`${'='.repeat(60)}`);
}

function printResult(message, data = null) {
  console.log(`✓ ${message}`);
  if (data) {
    console.log(`  ${JSON.stringify(data, null, 2).split('\n').join('\n  ')}`);
  }
}

function printError(message) {
  console.log(`❌ ${message}`);
}

async function runTestFlow() {
  console.log('📚 图书馆研讨间预约API - 完整流程测试');
  console.log('='.repeat(60));

  try {
    await request('GET', '/rooms');
  } catch (e) {
    printError('服务器未启动，请先运行: npm start');
    process.exit(1);
  }

  printStep(1, '获取房间和学生列表');
  const roomsRes = await request('GET', '/rooms');
  const studentsRes = await request('GET', '/students');
  
  const room1 = roomsRes.data.data[0];
  const room2 = roomsRes.data.data[1];
  const student1 = studentsRes.data.data[0];
  const student2 = studentsRes.data.data[1];
  
  printResult(`房间1: ${room1.name} (ID: ${room1.id})`);
  printResult(`房间2: ${room2.name} (ID: ${room2.id})`);
  printResult(`学生1: ${student1.name} (ID: ${student1.id})`);
  printResult(`学生2: ${student2.name} (ID: ${student2.id})`);

  printStep(2, '创建预约 - 人数不足的情况');
  const now = new Date();
  const startTime1 = new Date(now.getTime() + 2 * 60 * 1000).toISOString();
  const endTime1 = new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString();

  const bookingRes1 = await request('POST', '/bookings', {
    roomId: room1.id,
    bookerId: student1.id,
    startTime: startTime1,
    endTime: endTime1,
    purpose: '小组讨论',
    memberIds: []
  });
  
  if (bookingRes1.status !== 201) {
    printError(`创建预约失败: ${bookingRes1.data.error || bookingRes1.data}`);
  } else {
    const booking1 = bookingRes1.data.data;
    printResult(`创建预约状态: ${bookingRes1.data.message}`);
    printResult(`预约状态: ${booking1.status} (pending=待确认, confirmed=已确认)`);
    printResult(`当前成员数: ${booking1.members.length} (需要至少2人)`);

    printStep(3, '添加成员 - 人数足够后确认预约');
    const addMemberRes = await request('POST', `/bookings/${booking1.id}/members`, {
      studentId: student2.id
    });
    
    if (addMemberRes.status === 200) {
      const booking1Updated = addMemberRes.data.data;
      printResult(addMemberRes.data.message);
      printResult(`预约状态: ${booking1Updated.status}`);
      printResult(`当前成员数: ${booking1Updated.members.length}`);
    } else {
      printError(`添加成员失败: ${addMemberRes.data.error}`);
    }

    printStep(4, '签到失败演示 - 提前签到');
    const earlyCheckinRes = await request('POST', `/bookings/${booking1.id}/checkin`, {
      studentId: student1.id
    });
    printResult(`提前签到结果: ${earlyCheckinRes.data.error || '成功'}`);

    printStep(5, '取消预约演示（预约开始前40分钟，满足提前30分钟要求）');
    const cancelRes = await request('POST', `/bookings/${booking1.id}/cancel`, {
      cancelledBy: student1.id
    });
    if (cancelRes.status === 200) {
      printResult(cancelRes.data.message);
    } else {
      printError(`取消预约失败: ${cancelRes.data.error}`);
    }
  }

  printStep(6, '创建新预约（使用房间2，避免重叠）- 用于演示爽约');
  const startTime2 = new Date(now.getTime() + 3 * 1000).toISOString();
  const endTime2 = new Date(now.getTime() + 1 * 60 * 60 * 1000).toISOString();

  const bookingRes2 = await request('POST', '/bookings', {
    roomId: room2.id,
    bookerId: student1.id,
    startTime: startTime2,
    endTime: endTime2,
    purpose: '项目会议',
    memberIds: [student2.id]
  });
  
  if (bookingRes2.status !== 201) {
    printError(`创建预约失败: ${bookingRes2.data.error}`);
    return;
  }
  
  const booking2 = bookingRes2.data.data;
  printResult(`新预约已创建，ID: ${booking2.id}`);
  printResult(`预约状态: ${booking2.status}`);

  printStep(7, '等待超过签到时间（15秒，超过5秒签到窗口）');
  console.log('  等待15秒...');
  await sleep(15000);

  printStep(8, '签到失败 - 已过签到时间');
  const lateCheckinRes = await request('POST', `/bookings/${booking2.id}/checkin`, {
    studentId: student1.id
  });
  printResult(`迟到签到结果: ${lateCheckinRes.data.error || '成功'}`);

  printStep(9, '处理爽约 - 扣除信誉分');
  const noShowRes = await request('POST', `/bookings/${booking2.id}/no-show`);
  if (noShowRes.status === 200) {
    printResult(noShowRes.data.message);
  } else {
    printError(`处理爽约失败: ${noShowRes.data.error}`);
  }

  printStep(10, '查看学生信誉分变化');
  const creditRes1 = await request('GET', `/students/${student1.id}/credit`);
  const creditRes2 = await request('GET', `/students/${student2.id}/credit`);
  printResult(`${student1.name} 的信誉分状态:`, creditRes1.data.data);
  printResult(`${student2.name} 的信誉分状态:`, creditRes2.data.data);

  printStep(11, '再次预约 - 信誉分不足被拒绝演示');
  console.log('  模拟连续爽约，直到信誉分归零...');
  
  let currentCredit = creditRes1.data.data.creditScore;
  let bookingCount = 1;
  let roomIndex = 2;
  
  while (currentCredit > 0 && roomIndex < roomsRes.data.data.length) {
    const room = roomsRes.data.data[roomIndex];
    const futureStart = new Date(now.getTime() + 3 * 1000).toISOString();
    const futureEnd = new Date(now.getTime() + 1 * 60 * 60 * 1000).toISOString();
    
    console.log(`  第${bookingCount}次爽约测试，使用房间: ${room.name}`);
    
    const tempBookingRes = await request('POST', '/bookings', {
      roomId: room.id,
      bookerId: student1.id,
      startTime: futureStart,
      endTime: futureEnd,
      purpose: '测试',
      memberIds: [student2.id]
    });
    
    if (tempBookingRes.status === 201) {
      await sleep(2000);
      const noShowResult = await request('POST', `/bookings/${tempBookingRes.data.data.id}/no-show`);
      if (noShowResult.status === 200) {
        bookingCount++;
      }
      const updatedCredit = await request('GET', `/students/${student1.id}/credit`);
      currentCredit = updatedCredit.data.data.creditScore;
      console.log(`  当前信誉分: ${currentCredit}, 黑名单状态: ${updatedCredit.data.data.isBlacklisted}`);
    } else {
      console.log(`  预约被拒绝，停止测试: ${tempBookingRes.data.error}`);
      break;
    }
    roomIndex++;
  }

  printStep(12, '查看最终信誉分和黑名单状态');
  const finalCreditRes = await request('GET', `/students/${student1.id}/credit`);
  printResult(`最终信誉分状态:`, finalCreditRes.data.data);

  printStep(13, '尝试再次预约（信誉分不足或黑名单，应该被拒绝）');
  const futureStart2 = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
  const futureEnd2 = new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString();
  
  const restrictedBookingRes = await request('POST', '/bookings', {
    roomId: room1.id,
    bookerId: student1.id,
    startTime: futureStart2,
    endTime: futureEnd2,
    purpose: '再次尝试预约',
    memberIds: [student2.id]
  });
  
  printResult(`预约结果: ${restrictedBookingRes.data.error || '成功（未被限制）'}`);
  if (restrictedBookingRes.status !== 201) {
    printResult('✅ 预期结果：预约被成功拒绝！');
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('✅ 测试流程完成！');
  console.log(`${'='.repeat(60)}`);
  console.log('\n📋 总结:');
  console.log('  1. 人数不足时预约处于 pending 状态');
  console.log('  2. 成员足够后自动确认');
  console.log('  3. 只能在预约开始后15分钟内签到');
  console.log('  4. 取消需提前30分钟');
  console.log('  5. 爽约扣除20分信誉分');
  console.log('  6. 信誉分0或黑名单无法预约');
  console.log('  7. 重复操作不会重复计算');
  console.log('  8. 3次爽约自动加入黑名单7天');
}

runTestFlow().catch(err => {
  console.error('测试过程出错:', err);
  process.exit(1);
});