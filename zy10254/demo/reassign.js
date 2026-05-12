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
  console.log('🔄'.repeat(20));

  try {
    printStep(1, '创建救援工单');
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

    printStep(2, '匹配第一个技师');
    const matched1 = await request('POST', `/rescue/${order.orderId}/match`);
    printResult('匹配技师 1', matched1);

    printStep(3, '查看匹配后的技师状态');
    const techs1 = await request('GET', '/technicians');
    printResult('技师状态', 
      techs1.map(t => ({
        name: t.name,
        status: t.status,
        currentOrderId: t.currentOrderId ? t.currentOrderId.substring(0, 8) + '...' : null
      }))
    );

    printStep(4, '重派技师（技师路上堵车无法按时到达）');
    const reassigned = await request('POST', `/rescue/${order.orderId}/reassign`, {
      reason: '技师路上堵车，预计晚到2小时',
      operatorId: 'CS001'
    });
    printResult('重派结果', reassigned);

    printStep(5, '查看重派后的技师状态');
    const techs2 = await request('GET', '/technicians');
    printResult('技师状态（原技师已释放，新技师已接单）', 
      techs2.map(t => ({
        name: t.name,
        status: t.status,
        currentOrderId: t.currentOrderId ? t.currentOrderId.substring(0, 8) + '...' : null
      }))
    );

    printStep(6, '查看完整工单状态流转');
    const fullOrder = await request('GET', `/rescue/${order.orderId}`);
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
    console.log('  重派技师场景演示结束！');
    console.log('✅'.repeat(20) + '\n');

  } catch (error) {
    console.error('\n❌ 演示出错:', error.message);
    process.exit(1);
  }
}

setTimeout(runReassignDemo, 1000);