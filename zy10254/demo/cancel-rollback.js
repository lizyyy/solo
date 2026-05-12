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

async function runCancelDemo() {
  console.log('\n' + '↩️'.repeat(20));
  console.log('  取消订单 & 费用回滚场景演示');
  console.log('  (匹配技师时预扣权益，取消时回滚)');
  console.log('↩️'.repeat(20));

  try {
    printStep(1, '查看初始会员权益');
    const membershipBefore = await request('GET', '/membership/VIP001');
    printResult('初始会员权益', {
      membershipId: membershipBefore.membershipId,
      remainingTimes: membershipBefore.remainingTimes,
      expireDate: membershipBefore.expireDate
    });

    printStep(2, '创建救援工单');
    const order = await request('POST', '/rescue/create', {
      vehiclePlate: '京F55555',
      vehicleModel: '本田雅阁',
      ownerName: '吴总',
      ownerPhone: '13400134555',
      location: 'G3 京台高速 出京方向 80公里处',
      breakdownType: 'tow',
      description: '发动机故障，需要拖车',
      membershipId: 'VIP001'
    });
    printResult('创建工单', order);

    printStep(3, '匹配技师（此时预扣会员权益）');
    const matched = await request('POST', `/rescue/${order.orderId}/match`);
    printResult('匹配技师（已预扣权益）', {
      technician: matched.technician,
      preDeductInfo: matched.preDeductInfo,
      status: matched.status
    });

    printStep(4, '匹配后查看会员权益（已预扣）');
    const membershipAfterMatch = await request('GET', '/membership/VIP001');
    printResult('会员权益对比（匹配后）', {
      匹配前剩余次数: membershipBefore.remainingTimes,
      匹配后剩余次数: membershipAfterMatch.remainingTimes,
      预扣次数: 1
    });

    printStep(5, '技师确认出发');
    await request('POST', `/rescue/${order.orderId}/depart`, {
      technicianId: matched.technician.technicianId
    });
    printResult('技师已出发', { status: 'DEPARTED' });

    printStep(6, '技师到达现场（权益仍在预扣状态）');
    await request('POST', `/rescue/${order.orderId}/arrive`, {
      technicianId: matched.technician.technicianId
    });
    printResult('技师已到达', { status: 'ARRIVED' });

    printStep(7, '取消订单（车主自行联系了其他救援，此时权益已预扣）');
    const cancelled = await request('POST', `/rescue/${order.orderId}/cancel`, {
      reason: '车主自行联系了其他救援，取消订单',
      operatorId: 'CS002'
    });
    printResult('取消结果（含回滚信息）', cancelled);

    printStep(8, '查看取消后的会员权益（已回滚）');
    const membershipAfter = await request('GET', '/membership/VIP001');
    printResult('会员权益对比', {
      初始剩余次数: membershipBefore.remainingTimes,
      匹配后剩余次数: membershipAfterMatch.remainingTimes,
      取消后剩余次数: membershipAfter.remainingTimes,
      预扣次数: 1,
      回滚次数: cancelled.rollbackInfo ? cancelled.rollbackInfo.timesRollback : 0,
      回滚来源: cancelled.rollbackInfo ? cancelled.rollbackInfo.rollbackFrom : '无'
    });

    printStep(9, '验证回滚是否生效');
    const rollbackSuccess = membershipAfter.remainingTimes === membershipBefore.remainingTimes;
    printResult('回滚验证', {
      回滚前次数: membershipAfterMatch.remainingTimes,
      回滚后次数: membershipAfter.remainingTimes,
      初始次数: membershipBefore.remainingTimes,
      回滚验证: rollbackSuccess ? '✅ 成功 - 权益已完整回滚' : '❌ 失败 - 权益未正确回滚'
    });

    printStep(10, '查看取消后的技师状态（已释放）');
    const technicians = await request('GET', '/technicians');
    printResult('技师状态', 
      technicians.map(t => ({
        name: t.name,
        status: t.status,
        currentOrderId: t.currentOrderId ? '有工单' : '空闲'
      }))
    );

    printStep(11, '查看费用记录（预扣 + 回滚）');
    const fullOrder = await request('GET', `/rescue/${order.orderId}`);
    printResult('费用记录', 
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

    printStep(12, '查看完整状态流转');
    printResult('状态流转日志', 
      fullOrder.statusLogs.map((l, i) => ({
        序号: i + 1,
        原状态: l.fromStatus || '无',
        新状态: l.toStatus,
        备注: l.remark || '',
        时间: new Date(l.createdAt * 1000).toLocaleString()
      }))
    );

    console.log('\n' + '✅'.repeat(20));
    console.log('  取消回滚场景演示结束！');
    console.log('✅'.repeat(20) + '\n');

  } catch (error) {
    console.error('\n❌ 演示出错:', error.message);
    process.exit(1);
  }
}

setTimeout(runCancelDemo, 1000);