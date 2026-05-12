const http = require('http');

const BASE_URL = 'http://localhost:3001';

const request = (method, path, body = null) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    
    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
};

const logSection = (title) => {
  console.log('\n' + '='.repeat(60));
  console.log(title);
  console.log('='.repeat(60));
};

const printJson = (obj, indent = 2) => {
  console.log(JSON.stringify(obj, null, indent));
};

(async () => {
  try {
    console.log('\n正在等待服务启动...');
    await new Promise(r => setTimeout(r, 1000));
    
    logSection('1. 查询所有样例订单详情');
    for (const orderNo of ['ORDER-2026-001', 'ORDER-2026-002', 'ORDER-2026-003', 'ORDER-2026-004']) {
      console.log(`\n--- ${orderNo} ---`);
      const result = await request('GET', `/api/orders/${orderNo}`);
      printJson(result.body);
    }
    
    logSection('2. 执行对账扫描 - 扫描差异');
    const scanResult = await request('POST', '/api/reconciliation/scan');
    console.log('扫描结果:');
    printJson(scanResult.body);
    
    const diffs = scanResult.body.data.diffs;
    console.log(`\n发现 ${diffs.length} 个差异`);
    
    const missingFlowDiff = diffs.find(d => d.order_no === 'ORDER-2026-002');
    const amountMismatchDiff = diffs.find(d => d.order_no === 'ORDER-2026-003');
    
    logSection('3. 查询对账差异列表');
    const diffsList = await request('GET', '/api/reconciliation/diffs');
    printJson(diffsList.body);
    
    logSection('4. 查看缺流水订单的差异详情 (ORDER-2026-002)');
    if (missingFlowDiff) {
      const detail = await request('GET', `/api/reconciliation/diffs/${missingFlowDiff.id}`);
      console.log('差异详情（包含订单信息、当前流水、补偿历史）:');
      printJson(detail.body);
    }
    
    logSection('5. 查询补偿任务列表');
    const tasksResult = await request('GET', '/api/compensation/tasks');
    printJson(tasksResult.body);
    
    const missingFlowTask = tasksResult.body.data.find(t => t.order_no === 'ORDER-2026-002');
    
    logSection('6. 执行补偿 - 缺流水订单 ORDER-2026-002');
    if (missingFlowTask) {
      const compResult = await request('POST', `/api/compensation/tasks/${missingFlowTask.id}/execute`);
      console.log('补偿结果:');
      printJson(compResult.body);
    }
    
    logSection('7. 验证补偿后流水');
    const order2Detail = await request('GET', '/api/orders/ORDER-2026-002');
    console.log('ORDER-2026-002 当前信息:');
    printJson(order2Detail.body);
    
    logSection('8. 重复补偿拦截 - 再次执行同一补偿任务');
    if (missingFlowTask) {
      const retryResult = await request('POST', `/api/compensation/tasks/${missingFlowTask.id}/execute`);
      console.log('重复补偿拦截结果:');
      printJson(retryResult.body);
    }
    
    logSection('9. 查看补偿历史 - ORDER-2026-002');
    if (missingFlowDiff) {
      const history = await request('GET', `/api/reconciliation/diffs/${missingFlowDiff.id}/compensation-history`);
      console.log('补偿历史:');
      printJson(history.body);
    }
    
    logSection('10. 人工复核 - 金额不一致订单 ORDER-2026-003');
    if (amountMismatchDiff) {
      console.log('金额不一致差异状态 (需人工复核):');
      const detail = await request('GET', `/api/reconciliation/diffs/${amountMismatchDiff.id}`);
      printJson(detail.body);
      
      console.log('\n模拟人工确认后关闭差异:');
      const closeResult = await request('POST', `/api/reconciliation/diffs/${amountMismatchDiff.id}/close`, {
        reason: '经人工复核，差额 200 元为优惠减免，已确认无误，关闭差异'
      });
      printJson(closeResult.body);
    }
    
    logSection('11. 取消订单补偿拦截测试');
    console.log('ORDER-2026-004 是已取消订单，尝试扫描时不会创建差异，因为只扫描已支付订单');
    const order4 = await request('GET', '/api/orders/ORDER-2026-004');
    printJson(order4.body);
    
    logSection('12. 财务对账汇总');
    const summary = await request('GET', '/api/financial/summary');
    console.log('财务可读的对账汇总:');
    printJson(summary.body);
    
    logSection('演示完成！');
    console.log('\n可以使用以下 curl 命令自行测试:');
    console.log('\n查询订单:');
    console.log('  curl http://localhost:3001/api/orders/ORDER-2026-002');
    console.log('\n对账扫描:');
    console.log('  curl -X POST http://localhost:3001/api/reconciliation/scan');
    console.log('\n查询差异:');
    console.log('  curl http://localhost:3001/api/reconciliation/diffs');
    console.log('\n财务汇总:');
    console.log('  curl http://localhost:3001/api/financial/summary');
    
    process.exit(0);
  } catch (error) {
    console.error('演示失败:', error.message);
    console.log('请确保服务已启动: npm start');
    process.exit(1);
  }
})();
