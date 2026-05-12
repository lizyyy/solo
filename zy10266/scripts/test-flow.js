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

function getFutureTime(seconds = 5) {
  return new Date(Date.now() + seconds * 1000).toISOString();
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
  
  const rooms = roomsRes.data.data;
  const student1 = studentsRes.data.data[0];
  const student2 = studentsRes.data.data[1];
  
  rooms.forEach((room, i) => {
    printResult(`房间${i + 1}: ${room.name} (ID: ${room.id})`);
  });
  printResult(`学生1: ${student1.name} (ID: ${student1.id})`);
  printResult(`学生2: ${student2.name} (ID: ${student2.id})`);

  printStep(2, '创建预约 - 人数不足的情况');
  const startTime1 = getFutureTime(120);
  const endTime1 = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();

  const bookingRes1 = await request('POST', '/bookings', {
    roomId: rooms[0].id,
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

    printStep(5, '取消预约演示（预约开始前2分钟，满足30秒提前要求）');
    const cancelRes = await request('POST', `/bookings/${booking1.id}/cancel`, {
      cancelledBy: student1.id
    });
    if (cancelRes.status === 200) {
      printResult(cancelRes.data.message);
    } else {
      printError(`取消预约失败: ${cancelRes.data.error}`);
    }
  }

  printStep(6, '创建新预约（使用房间2）- 用于演示爽约');
  const startTime2 = getFutureTime(3);
  const endTime2 = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  const bookingRes2 = await request('POST', '/bookings', {
    roomId: rooms[1].id,
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

  printStep(11, '连续爽约 - 直到触发黑名单');
  console.log('  模拟连续爽约，直到被列入黑名单...');
  
  let currentCredit = creditRes1.data.data.creditScore;
  let bookingCount = 1;
  let roomIndex = 2;
  let isBlocked = false;
  
  while (roomIndex < rooms.length && !isBlocked) {
    const room = rooms[roomIndex];
    const futureStart = getFutureTime(3);
    const futureEnd = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    
    console.log(`\n  第${bookingCount}次爽约测试，使用房间: ${room.name}`);
    console.log(`  预约开始时间: ${futureStart}`);
    
    const tempBookingRes = await request('POST', '/bookings', {
      roomId: room.id,
      bookerId: student1.id,
      startTime: futureStart,
      endTime: futureEnd,
      purpose: '测试',
      memberIds: [student2.id]
    });
    
    if (tempBookingRes.status === 201) {
      printResult(`  预约创建成功，等待爽约时间...`);
      await sleep(15000);
      
      const noShowResult = await request('POST', `/bookings/${tempBookingRes.data.data.id}/no-show`);
      if (noShowResult.status === 200) {
        bookingCount++;
        printResult(`  爽约处理成功`);
      } else {
        printError(`  爽约处理失败: ${noShowResult.data.error}`);
      }
      
      const updatedCredit = await request('GET', `/students/${student1.id}/credit`);
      currentCredit = updatedCredit.data.data.creditScore;
      isBlocked = updatedCredit.data.data.isBlacklisted;
      printResult(`  当前信誉分: ${currentCredit}, 黑名单状态: ${isBlocked}`);
      
      if (isBlocked) {
        printResult(`  ✅ 已触发黑名单！`);
      }
    } else {
      printError(`  预约被拒绝: ${tempBookingRes.data.error}`);
      const updatedCredit = await request('GET', `/students/${student1.id}/credit`);
      isBlocked = updatedCredit.data.data.isBlacklisted;
      if (isBlocked) {
        printResult(`  ✅ 预约被拒绝是因为已被列入黑名单（预期行为）`);
      }
      break;
    }
    roomIndex++;
  }

  printStep(12, '查看最终信誉分和黑名单状态');
  const finalCreditRes = await request('GET', `/students/${student1.id}/credit`);
  printResult(`最终信誉分状态:`, finalCreditRes.data.data);

  printStep(13, '黑名单成员测试1：创建预约时把黑名单学生作为成员');
  const futureStart3 = getFutureTime(120);
  const futureEnd3 = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
  
  const memberBlockedRes = await request('POST', '/bookings', {
    roomId: rooms[0].id,
    bookerId: student2.id,
    startTime: futureStart3,
    endTime: futureEnd3,
    purpose: '测试黑名单成员',
    memberIds: [student1.id]
  });
  
  printResult(`创建预约结果: ${memberBlockedRes.data.error || '成功'}`);
  if (memberBlockedRes.status !== 201) {
    printResult('✅ 预期结果：成员是黑名单学生，预约被成功拒绝！');
  } else {
    printError('❌ 意外结果：黑名单学生作为成员被允许');
  }

  printStep(14, '黑名单成员测试2：创建正常预约后，添加黑名单学生');
  const futureStart4 = getFutureTime(120);
  const futureEnd4 = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
  
  const normalBookingRes = await request('POST', '/bookings', {
    roomId: rooms[0].id,
    bookerId: student2.id,
    startTime: futureStart4,
    endTime: futureEnd4,
    purpose: '正常预约',
    memberIds: []
  });
  
  if (normalBookingRes.status === 201) {
    const normalBooking = normalBookingRes.data.data;
    printResult(`正常预约创建成功（${normalBooking.status}）`);
    
    const addBlockedMemberRes = await request('POST', `/bookings/${normalBooking.id}/members`, {
      studentId: student1.id
    });
    
    printResult(`添加黑名单成员结果: ${addBlockedMemberRes.data.error || '成功'}`);
    if (addBlockedMemberRes.status !== 200) {
      printResult('✅ 预期结果：添加黑名单学生被成功拒绝！');
    } else {
      printError('❌ 意外结果：黑名单学生被允许加入');
    }
  } else {
    printError(`创建正常预约失败: ${normalBookingRes.data.error}`);
  }

  printStep(15, '黑名单发起人测试：黑名单学生作为预约发起人');
  const futureStart5 = getFutureTime(120);
  const futureEnd5 = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
  
  const bookerBlockedRes = await request('POST', '/bookings', {
    roomId: rooms[0].id,
    bookerId: student1.id,
    startTime: futureStart5,
    endTime: futureEnd5,
    purpose: '测试黑名单发起人',
    memberIds: [student2.id]
  });
  
  printResult(`预约结果: ${bookerBlockedRes.data.error || '成功'}`);
  if (bookerBlockedRes.status !== 201) {
    printResult('✅ 预期结果：黑名单学生作为发起人，预约被成功拒绝！');
  } else {
    printError('❌ 意外结果：黑名单学生作为发起人被允许');
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('✅ 测试流程完成！');
  console.log(`${'='.repeat(60)}`);
  console.log('\n📋 总结:');
  console.log('  1. 人数不足时预约处于 pending 状态');
  console.log('  2. 成员足够后自动确认');
  console.log('  3. 只能在预约开始后5秒内签到');
  console.log('  4. 取消需提前30秒');
  console.log('  5. 爽约扣除20分信誉分');
  console.log('  6. 信誉分0或黑名单无法预约（作为发起人）');
  console.log('  7. 黑名单学生也不能作为成员加入预约');
  console.log('  8. 重复操作不会重复计算');
  console.log('  9. 3次爽约自动加入黑名单7天');
}

runTestFlow().catch(err => {
  console.error('测试过程出错:', err);
  process.exit(1);
});