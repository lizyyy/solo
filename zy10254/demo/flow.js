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

async function runDemo() {
  console.log('\n' + '🚗'.repeat(20));
  console.log('  车辆救援派单系统 - 完整流程演示');
  console.log('🚗'.repeat(20));

  try {
    printStep(1, '创建救援请求（车主在高速口报案）');
    const orderData = {
      vehiclePlate: '京A88888',
      vehicleModel: '奔驰 E300L',
      ownerName: '王总',
      ownerPhone: '13900139888',
      location: 'G6 京藏高速 出京方向 15公里处',
      breakdownType: 'tire',
      description: '左前轮爆胎，需要更换备胎',
      membershipId: 'VIP001'
    };
    printResult('请求参数', orderData);
    
    const order = await request('POST', '/rescue/create', orderData);
    printResult('创建成功', order);

    printStep(2, '查看会员权益（自动检查）');
    const membership = await request('GET', '/membership/VIP001');
    printResult('会员权益信息', {
      remainingTimes: membership.remainingTimes,
      expireDate: membership.expireDate,
      isActive: membership.isActive
    });

    printStep(3, '匹配技师（系统智能派单）');
    const matched = await request('POST', `/rescue/${order.orderId}/match`);
    printResult('匹配结果', matched);

    printStep(4, '查看技师状态');
    const technicians = await request('GET', '/technicians');
    printResult('技师状态（已匹配的技师变为 busy）', 
      technicians.map(t => ({
        id: t.technicianId,
        name: t.name,
        status: t.status,
        skills: t.skills
      }))
    );

    printStep(5, '技师确认出发');
    const departed = await request('POST', `/rescue/${order.orderId}/depart`, {
      technicianId: matched.technician.technicianId
    });
    printResult('出发确认', departed);

    printStep(6, '技师到达现场');
    const arrived = await request('POST', `/rescue/${order.orderId}/arrive`, {
      technicianId: matched.technician.technicianId
    });
    printResult('到达确认', arrived);

    printStep(7, '完成救援并结算');
    const completed = await request('POST', `/rescue/${order.orderId}/complete`, {
      technicianId: matched.technician.technicianId,
      actualCost: 180,
      remark: '已成功更换备胎，车辆可正常行驶'
    });
    printResult('完成结算', completed);

    printStep(8, '查看会员权益变化');
    const membershipAfter = await request('GET', '/membership/VIP001');
    printResult('会员权益变化（已扣除1次）', {
      原剩余次数: membership.remainingTimes,
      现剩余次数: membershipAfter.remainingTimes,
      扣除次数: 1
    });

    printStep(9, '查看完整工单信息');
    const fullOrder = await request('GET', `/rescue/${order.orderId}`);
    printResult('完整工单信息', {
      orderId: fullOrder.orderId,
      vehiclePlate: fullOrder.vehiclePlate,
      status: fullOrder.status,
      technician: fullOrder.technician,
      actualCost: fullOrder.actualCost,
      statusLogs: fullOrder.statusLogs.map(l => ({
        from: l.fromStatus,
        to: l.toStatus,
        time: new Date(l.createdAt * 1000).toLocaleString()
      })),
      feeRecords: fullOrder.feeRecords
    });

    printStep(10, '查看技师状态（已释放）');
    const techniciansAfter = await request('GET', '/technicians');
    printResult('技师状态（完成后变回 available）', 
      techniciansAfter.map(t => ({
        id: t.technicianId,
        name: t.name,
        status: t.status
      }))
    );

    console.log('\n' + '✅'.repeat(20));
    console.log('  完整流程演示成功结束！');
    console.log('✅'.repeat(20) + '\n');

  } catch (error) {
    console.error('\n❌ 演示出错:', error.message);
    process.exit(1);
  }
}

setTimeout(runDemo, 1000);