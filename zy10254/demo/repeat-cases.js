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
  console.log(`场景 ${step}: ${message}`);
  console.log(`${'='.repeat(60)}`);
}

function printResult(title, data) {
  console.log(`\n▶ ${title}:`);
  console.log(JSON.stringify(data, null, 2));
}

async function runRepeatDemo() {
  console.log('\n' + '🔄'.repeat(20));
  console.log('  重复报案场景演示');
  console.log('🔄'.repeat(20));

  try {
    printStep('1-1', '同一车辆30分钟内第一次报案');
    const orderData1 = {
      vehiclePlate: '京B66666',
      vehicleModel: '宝马 530Li',
      ownerName: '李总',
      ownerPhone: '13800138666',
      location: 'G4 京港澳高速 进京方向 50公里处',
      breakdownType: 'battery',
      description: '电瓶没电，无法启动',
      membershipId: 'VIP002'
    };
    
    const order1 = await request('POST', '/rescue/create', orderData1);
    printResult('第一次创建工单', order1);

    printStep('1-2', '同一车辆5分钟内再次报案（重复报案）');
    const orderData2 = {
      vehiclePlate: '京B66666',
      vehicleModel: '宝马 530Li',
      ownerName: '李总',
      ownerPhone: '13800138666',
      location: 'G4 京港澳高速 进京方向 50公里处',
      breakdownType: 'battery',
      description: '还是打不着火，再叫一次救援',
      membershipId: 'VIP002'
    };
    
    const order2 = await request('POST', '/rescue/create', orderData2);
    printResult('第二次创建工单（系统自动识别为重复）', order2);

    printStep('1-3', '查看该车辆所有工单');
    const allOrders = await request('GET', '/rescue/vehicle/京B66666');
    printResult('该车辆所有工单（可见重复标记和关联关系）', 
      allOrders.map(o => ({
        orderId: o.orderId.substring(0, 8) + '...',
        status: o.status,
        isRepeat: o.isRepeat,
        originalOrderId: o.originalOrderId ? o.originalOrderId.substring(0, 8) + '...' : null,
        createdAt: new Date(o.createdAt * 1000).toLocaleTimeString()
      }))
    );

    printStep('2', '权益过期场景演示');
    try {
      const expiredOrder = await request('POST', '/rescue/create', {
        vehiclePlate: '京C99999',
        vehicleModel: '奥迪 A6L',
        ownerName: '赵总',
        ownerPhone: '13700137999',
        location: 'G2 京沪高速',
        breakdownType: 'fuel',
        description: '没油了',
        membershipId: 'VIP003'
      });
      printResult('创建结果', expiredOrder);
    } catch (error) {
      printResult('预期错误（权益过期）', error.message);
    }

    printStep('3', '技师已接单不会被重复派单');
    await request('POST', `/rescue/${order1.orderId}/match`);
    
    const busyOrder = await request('POST', '/rescue/create', {
      vehiclePlate: '京D11111',
      vehicleModel: '大众迈腾',
      ownerName: '孙总',
      ownerPhone: '13600136111',
      location: 'G5 京昆高速',
      breakdownType: 'tire',
      description: '爆胎'
    });
    
    const matched = await request('POST', `/rescue/${busyOrder.orderId}/match`);
    printResult('新工单匹配结果', {
      newOrderId: busyOrder.orderId.substring(0, 8) + '...',
      matchedTechnician: matched.technician.name,
      note: '系统不会把已接单的技师派给新工单'
    });

    console.log('\n' + '✅'.repeat(20));
    console.log('  重复报案场景演示结束！');
    console.log('✅'.repeat(20) + '\n');

  } catch (error) {
    console.error('\n❌ 演示出错:', error.message);
    process.exit(1);
  }
}

setTimeout(runRepeatDemo, 1000);