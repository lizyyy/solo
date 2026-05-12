const http = require('http');

const BASE_URL = 'localhost';
const PORT = 3000;

function request(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      port: PORT,
      path: `/api${path}`,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (res.statusCode >= 400) {
            reject(new Error(json.message || '请求失败'));
          } else {
            resolve(json.data);
          }
        } catch (e) {
          resolve(body);
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

function printStep(step, message) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`步骤 ${step}: ${message}`);
  console.log(`${'='.repeat(60)}`);
}

function printResult(title, data) {
  console.log(`\n▶ ${title}:`);
  console.log(JSON.stringify(data, null, 2));
}

async function runReassignDemo() {
  console.log('\n' + '🔄'.repeat(20));
  console.log('  重派技师场景演示');
  console.log('  (验证重派不会重复扣减会员权益)');
  console.log('🔄'.repeat(20));

  try {
    printStep(1, '查看初始会员权益');
    const membershipBefore = await request('GET', '/membership/VIP002');
    printResult('初始会员权益', {
      membershipId: membershipBefore.membershipId,
      ownerName: membershipBefore.ownerName,
      remainingTimes: membershipBefore.remainingTimes
    });

    printStep(2, '创建救援工单');
    const order = await request('POST', '/rescue/create', {
      vehiclePlate: '京E77777',
      vehicleModel: '丰田凯美瑞',
      ownerName: '周总',
      ownerPhone: '13500135777',
      location: 'G1 京哈高速 出京方向 30公里处',
      breakdownType: 'lock',
      description: '钥匙锁在车里了',
      membershipId: 'VIP002'
    });
    printResult('创建工单', order);

    printStep(3, '匹配第一个技师（此时首次预扣权益）');
    const matched1 = await request('POST', `/rescue/${order.orderId}/match`);
    printResult('匹配技师 1（首次预扣权益）', {
      technician: matched1.technician,
      preDeductInfo: matched1.preDeductInfo,
      status: matched1.status
    });

    printStep(4, '查看首次匹配后的会员权益');
    const membershipAfterMatch1 = await request('GET', '/membership/VIP002');
    printResult('会员权益对比（首次匹配后）', {
      匹配前剩余次数: membershipBefore.remainingTimes,
      匹配后剩余次数: membershipAfterMatch1.remainingTimes,
      扣减次数: membershipBefore.remainingTimes - membershipAfterMatch1.remainingTimes
    });

    printStep(5, '查看匹配后的技师状态');
    const techs1 = await request('GET', '/technicians');
    printResult('技师状态', 
      techs1.map(t => ({
        name: t.name,
        status: t.status,
        currentOrderId: t.currentOrderId ? t.currentOrderId.substring(0, 8) + '...' : null
      }))
    );

    printStep(6, '重派技师（技师路上堵车无法按时到达）');
    const reassigned = await request('POST', `/rescue/${order.orderId}/reassign`, {
      reason: '技师路上堵车，预计晚到2小时',
      operatorId: 'CS001'
    });
    printResult('重派结果（注意 preDeductInfo 显示不重复预扣）', {
      previousTechnicianId: reassigned.previousTechnicianId,
      newTechnician: reassigned.newTechnician,
      preDeductInfo: reassigned.preDeductInfo,
      reassignCount: reassigned.reassignCount
    });

    printStep(7, '查看重派后的会员权益（不应重复扣减）');
    const membershipAfterReassign = await request('GET', '/membership/VIP002');
    printResult('会员权益对比（重派后）', {
      首次匹配后剩余次数: membershipAfterMatch1.remainingTimes,
      重派后剩余次数: membershipAfterReassign.remainingTimes,
      重派扣减次数: membershipAfterMatch1.remainingTimes - membershipAfterReassign.remainingTimes
    });

    printStep(8, '验证重派未重复扣费');
    const noDoubleCharge = membershipAfterReassign.remainingTimes === membershipAfterMatch1.remainingTimes;
    printResult('重派扣费验证', {
      首次匹配后次数: membershipAfterMatch1.remainingTimes,
      重派后次数: membershipAfterReassign.remainingTimes,
      验证结果: noDoubleCharge ? '✅ 成功 - 重派未重复扣减权益' : '❌ 失败 - 重派重复扣减了权益'
    });

    printStep(9, '查看重派后的技师状态');
    const techs2 = await request('GET', '/technicians');
    printResult('技师状态（原技师已释放，新技师已接单）', 
      techs2.map(t => ({
        name: t.name,
        status: t.status,
        currentOrderId: t.currentOrderId ? t.currentOrderId.substring(0, 8) + '...' : null
      }))
    );

    printStep(10, '查看费用记录（只有一次预扣）');
    const fullOrder = await request('GET', `/rescue/${order.orderId}`);
    printResult('费用记录（验证只有一次预扣）', 
      fullOrder.feeRecords.map(r => {
        let typeName = r.type;
        if (r.type === 'pre_deduct') typeName = '预扣';
        if (r.type === 'deduct') typeName = '正式扣除';
        if (r.type === 'rollback') typeName = '回滚';
        return {
          类型: typeName,
          金额: r.amount,
          次数: r.timesUsed,
          描述: r.description,
          时间: new Date(r.createdAt * 1000).toLocaleString()
        };
      })
    );

    printStep(11, '查看完整工单状态流转');
    printResult('状态流转日志', 
      fullOrder.statusLogs.map((l, i) => ({
        序号: i + 1,
        原状态: l.fromStatus || '无',
        新状态: l.toStatus,
        备注: l.remark || '',
        时间: new Date(l.createdAt * 1000).toLocaleString()
      }))
    );

    printStep(12, '验证单次救援只扣一次权益（总览）');
    printResult('全程权益变化验证', {
      初始剩余次数: membershipBefore.remainingTimes,
      当前剩余次数: membershipAfterReassign.remainingTimes,
      总扣减次数: membershipBefore.remainingTimes - membershipAfterReassign.remainingTimes,
      匹配次数: 2,
      重派次数: 1,
      验证结论: (membershipBefore.remainingTimes - membershipAfterReassign.remainingTimes === 1) 
        ? '✅ 成功 - 虽然匹配了2次、重派1次，但只扣1次权益' 
        : '❌ 失败 - 权益扣减次数不正确'
    });

    console.log('\n' + '✅'.repeat(20));
    console.log('  重派技师场景演示结束！');
    console.log('✅'.repeat(20) + '\n');

  } catch (error) {
    console.error('\n❌ 演示出错:', error.message);
    process.exit(1);
  }
}

setTimeout(runReassignDemo, 1000);