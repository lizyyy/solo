const http = require('http');

const API_BASE = 'http://localhost:3000/api';

function request(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    
    const req = http.request(`${API_BASE}${path}`, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function log(title, data) {
  console.log(`\n=== ${title} ===`);
  console.log(JSON.stringify(data, null, 2));
}

async function runScenario() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║        零售收银离线补单 API - 断网恢复场景模拟              ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('场景：便利店断网30分钟，期间产生5笔交易，恢复网络后批量同步\n');
  await sleep(1000);

  console.log('[1/6] 查询初始库存...');
  const initialInventory = await request('GET', '/inventory');
  log('初始库存', initialInventory.data);
  await sleep(500);

  console.log('\n[2/6] 模拟断网恢复，第一次同步批次...');
  const batch1 = {
    batchId: 'BATCH-' + Date.now(),
    terminalNo: 'POS-001',
    startTime: new Date(Date.now() - 1800000).toISOString(),
    endTime: new Date().toISOString(),
    orders: [
      {
        orderNo: 'SO-20240512-001',
        cashierNo: 'CASH-001',
        terminalNo: 'POS-001',
        saleTime: new Date(Date.now() - 1500000).toISOString(),
        items: [
          { sku: 'SKU001', name: '农夫山泉550ml', quantity: 2, unitPrice: 2, subtotal: 4 }
        ],
        totalAmount: 4,
        discountAmount: 0,
        payAmount: 4,
        payments: [{ paymentId: 'PAY-001', type: 'cash', amount: 4, status: 'success' }]
      },
      {
        orderNo: 'SO-20240512-002',
        cashierNo: 'CASH-001',
        terminalNo: 'POS-001',
        saleTime: new Date(Date.now() - 1200000).toISOString(),
        items: [
          { sku: 'SKU002', name: '康师傅红烧牛肉面', quantity: 1, unitPrice: 5, subtotal: 5 },
          { sku: 'SKU003', name: '可口可乐330ml', quantity: 1, unitPrice: 3, subtotal: 3 }
        ],
        totalAmount: 8,
        discountAmount: 0,
        payAmount: 8,
        payments: [{ paymentId: 'PAY-002', type: 'wechat', amount: 8, status: 'success', transactionNo: 'WX123456' }],
        member: { memberId: 'MEMBER-001', pointsEarned: 8, pointsUsed: 0 }
      },
      {
        orderNo: 'SO-20240512-003',
        cashierNo: 'CASH-001',
        terminalNo: 'POS-001',
        saleTime: new Date(Date.now() - 900000).toISOString(),
        items: [
          { sku: 'SKU004', name: '乐事薯片原味', quantity: 2, unitPrice: 8, subtotal: 16 }
        ],
        totalAmount: 16,
        discountAmount: 0,
        payAmount: 16,
        payments: [{ paymentId: 'PAY-003', type: 'alipay', amount: 16, status: 'success', transactionNo: 'ALI789012' }]
      },
      {
        orderNo: 'SO-20240512-004',
        cashierNo: 'CASH-001',
        terminalNo: 'POS-001',
        saleTime: new Date(Date.now() - 600000).toISOString(),
        items: [
          { sku: 'SKU005', name: '士力架花生夹心', quantity: 100, unitPrice: 6, subtotal: 600 }
        ],
        totalAmount: 600,
        discountAmount: 0,
        payAmount: 600,
        payments: [{ paymentId: 'PAY-004', type: 'cash', amount: 600, status: 'success' }]
      },
      {
        orderNo: 'SO-20240512-005',
        cashierNo: 'CASH-001',
        terminalNo: 'POS-001',
        saleTime: new Date(Date.now() - 300000).toISOString(),
        items: [
          { sku: 'SKU001', name: '农夫山泉550ml', quantity: 1, unitPrice: 2, subtotal: 2 }
        ],
        totalAmount: 2,
        discountAmount: 0,
        payAmount: 2,
        payments: [{ paymentId: 'PAY-005', type: 'cash', amount: 2, status: 'success' }],
        refund: {
          refundId: 'REF-001',
          saleOrderNo: 'SO-20240512-005',
          amount: 2,
          reason: '商品过期',
          operator: 'OP-001',
          refundTime: new Date(Date.now() - 600000).toISOString()
        }
      }
    ]
  };

  const result1 = await request('POST', '/offline/sync', batch1);
  log('第一次同步结果', result1.data);
  await sleep(500);

  console.log('\n[3/6] 模拟重复提交（同一批次再次上传）...');
  const result2 = await request('POST', '/offline/sync', batch1);
  log('重复提交结果', result2.data);
  await sleep(500);

  console.log('\n[4/6] 模拟流水号重复但内容不同...');
  const badBatch = {
    batchId: 'BATCH-' + (Date.now() + 1),
    terminalNo: 'POS-001',
    startTime: new Date(Date.now() - 1800000).toISOString(),
    endTime: new Date().toISOString(),
    orders: [
      {
        orderNo: 'SO-20240512-001',
        cashierNo: 'CASH-001',
        terminalNo: 'POS-001',
        saleTime: new Date(Date.now() - 1500000).toISOString(),
        items: [
          { sku: 'SKU001', name: '农夫山泉550ml', quantity: 10, unitPrice: 2, subtotal: 20 }
        ],
        totalAmount: 20,
        discountAmount: 0,
        payAmount: 20,
        payments: [{ paymentId: 'PAY-001', type: 'cash', amount: 20, status: 'success' }]
      }
    ]
  };

  const result3 = await request('POST', '/offline/sync', badBatch);
  log('内容不一致结果', result3.data);
  await sleep(500);

  console.log('\n[5/6] 查询同步批次列表...');
  const batches = await request('GET', '/batch');
  log('批次列表', batches.data);
  await sleep(500);

  console.log('\n[6/6] 查询异常单...');
  const exceptions = await request('GET', '/exception');
  log('异常单列表', exceptions.data);
  await sleep(500);

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('验证关键点：');
  console.log('  ✓ 第4笔订单：库存不足(100 > 45)，应该失败');
  console.log('  ✓ 第5笔订单：退款时间早于销售时间，应该失败');
  console.log('  ✓ 重复提交：第1-3笔应该幂等成功');
  console.log('  ✓ 内容不一致：同一流水号内容不同，应该记录异常');
  console.log('  ✓ 库存扣减：成功的订单库存应该减少');
  console.log('══════════════════════════════════════════════════════════════\n');

  console.log('\n[补充] 查询最终库存...');
  const finalInventory = await request('GET', '/inventory');
  log('最终库存', finalInventory.data);

  console.log('\n[补充] 查询第2笔订单详情(带会员积分)...');
  const order2 = await request('GET', '/order/SO-20240512-002');
  log('订单详情', order2.data);
}

runScenario().catch(console.error);
