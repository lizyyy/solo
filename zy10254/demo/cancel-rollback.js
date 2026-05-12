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

    printStep(3, '匹配技师');
    const matched = await request('POST', `/rescue/${order.orderId}/match`);
    printResult('匹配技师', matched);

    printStep(4, '技师确认出发');
    await request('POST', `/rescue/${order.orderId}/depart`, {
      technicianId: matched.technician.technicianId
    });
    printResult('技师已出发', { status: 'DEPARTED' });

    printStep(5, '取消订单（车主自行联系了其他救援）');
    const cancelled = await request('POST', `/rescue/${order.orderId}/cancel`, {
      reason: '车主自行联系了其他救援，取消订单',
      operatorId: 'CS002'
    });
    printResult('取消结果', cancelled);

    printStep(6, '查看取消后的会员权益（回滚）');
    const membershipAfter = await request('GET', '/membership/VIP001');
    printResult('会员权益对比', {
      取消前剩余次数: membershipBefore.remainingTimes,
      取消后剩余次数: membershipAfter.remainingTimes,
      回滚次数: cancelled.rollbackInfo ? cancelled.rollbackInfo.timesRollback : 0
    });

    printStep(7, '查看取消后的技师状态（已释放）');
    const technicians = await request('GET', '/technicians');
    printResult('技师状态', 
      technicians.map(t => ({
        name: t.name,
        status: t.status,
        currentOrderId: t.currentOrderId ? '有工单' : '空闲'
      }))
    );

    printStep(8, '查看费用记录（含回滚记录）');
    const fullOrder = await request('GET', `/rescue/${order.orderId}`);
    printResult('费用记录', 
      fullOrder.feeRecords.map(r => ({
        类型: r.type === 'deduct' ? '扣除' : '回滚',
        金额: r.amount,
        次数: r.timesUsed,
        时间: new Date(r.createdAt * 1000).toLocaleString()
      }))
    );

    printStep(9, '查看完整状态流转');
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