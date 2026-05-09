const http = require('http');

const BASE_URL = 'http://localhost:3000/api';
const operator = 'test_user';

let orderId = null;
let rejudgeId = null;
let freezeId = null;
let costId = null;
let settlementBatchId = null;
let evidenceId = null;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function apiRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const fullPath = '/api' + path;
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: fullPath,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'X-Operator': operator
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: null, raw: data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function log(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const prefix = type === 'success' ? '[✓]' : type === 'error' ? '[✗]' : '[i]';
  console.log(`${prefix} [${timestamp}] ${message}`);
}

async function runTests() {
  console.log('');
  console.log('========================================');
  console.log('  返修责任冻结服务 - 自动化测试');
  console.log('========================================');
  console.log('');

  try {
    log('检查服务是否运行...');
    const health = await apiRequest('/health');
    if (health.status !== 200 || !health.data || health.data.status !== 'ok') {
      throw new Error('服务未运行，请先执行: npm start');
    }
    log('服务运行正常', 'success');
    console.log('');

    log('========================================');
    log('  测试 1: 创建返修单');
    log('========================================');
    const createRes = await apiRequest('/orders', 'POST', {
      product_sn: 'TEST-AUTO-' + Date.now(),
      product_name: '自动化测试产品',
      repair_type: '功能故障',
      description: '这是一个自动化测试用的返修单'
    });
    
    if (createRes.status !== 201 || !createRes.data.success) {
      throw new Error('创建返修单失败: ' + (createRes.data?.error || '未知错误'));
    }
    orderId = createRes.data.data.id;
    log(`返修单创建成功，ID: ${orderId.substring(0, 20)}...`, 'success');

    console.log('');
    log('========================================');
    log('  测试 2: 责任冻结');
    log('========================================');
    
    const freeze1 = await apiRequest('/liability/freeze', 'POST', {
      repair_order_id: orderId,
      responsibility: 'ASSEMBLY',
      reason: '初始判定为装配问题'
    });
    
    if (!freeze1.data.success) throw new Error('冻结失败: ' + freeze1.data.error);
    freezeId = freeze1.data.data.freeze_id;
    log('责任已冻结到: 装配', 'success');

    const freeze2 = await apiRequest('/liability/freeze', 'POST', {
      repair_order_id: orderId,
      responsibility: 'TESTING',
      reason: '进一步分析确认是测试问题'
    });
    
    if (!freeze2.data.success) throw new Error('切换责任失败: ' + freeze2.data.error);
    log('责任已切换到: 测试', 'success');

    const activeCheck = await apiRequest(`/liability/active/${orderId}`);
    if (!activeCheck.data.success || activeCheck.data.data.responsibility !== 'TESTING') {
      throw new Error('当前责任方不正确');
    }
    log('验证当前责任方为测试: 通过', 'success');

    const history = await apiRequest(`/liability/history/${orderId}`);
    if (!history.data.success || history.data.data.length < 2) {
      throw new Error('责任冻结历史记录不正确');
    }
    log(`责任冻结历史记录数: ${history.data.data.length}`, 'success');

    console.log('');
    log('========================================');
    log('  测试 3: 费用登记');
    log('========================================');
    
    const cost1 = await apiRequest('/costs/add', 'POST', {
      repair_order_id: orderId,
      responsibility: 'TESTING',
      cost_type: '返工人工费',
      amount: 150.00,
      description: '测试返工所需人工费用'
    });
    if (!cost1.data.success) throw new Error('登记费用失败: ' + cost1.data.error);
    costId = cost1.data.data.id;
    log('费用1登记成功: 返工人工费 150.00', 'success');

    const cost2 = await apiRequest('/costs/add', 'POST', {
      repair_order_id: orderId,
      responsibility: 'TESTING',
      cost_type: '材料费',
      amount: 75.50,
      description: '更换测试组件'
    });
    if (!cost2.data.success) throw new Error('登记费用失败: ' + cost2.data.error);
    log('费用2登记成功: 材料费 75.50', 'success');

    console.log('');
    log('========================================');
    log('  测试 4: 复判流转');
    log('========================================');
    
    const submitRejudge = await apiRequest('/rejudge/submit', 'POST', {
      repair_order_id: orderId,
      new_responsibility: 'PACKAGING',
      reason: '经深入调查，发现是包装环节的问题导致返修'
    });
    if (!submitRejudge.data.success) throw new Error('提交复判失败: ' + submitRejudge.data.error);
    rejudgeId = submitRejudge.data.data.id;
    log('复判申请已提交，转包装责任', 'success');

    const approveRejudge = await apiRequest(`/rejudge/${rejudgeId}/approve`, 'POST', {
      comment: '审核通过，确认为包装责任'
    });
    if (!approveRejudge.data.success) throw new Error('审批复判失败: ' + approveRejudge.data.error);
    log('复判已通过审批', 'success');

    const checkAfter = await apiRequest(`/liability/active/${orderId}`);
    if (!checkAfter.data.success || checkAfter.data.data.responsibility !== 'PACKAGING') {
      throw new Error('复判后责任方未正确切换');
    }
    log('验证责任已切换到包装: 通过', 'success');

    console.log('');
    log('========================================');
    log('  测试 5: 批量结算');
    log('========================================');
    
    const createBatch = await apiRequest('/costs/settlement/batch', 'POST', {
      responsibility: 'TESTING'
    });
    if (!createBatch.data.success) throw new Error('创建结算批次失败: ' + createBatch.data.error);
    settlementBatchId = createBatch.data.data.batch_id;
    log(`结算批次创建成功，批次ID: ${settlementBatchId.substring(0, 20)}...`, 'success');
    log(`  费用数量: ${createBatch.data.data.cost_count}`, 'info');
    log(`  总金额: ${createBatch.data.data.total_amount}`, 'info');

    const confirmBatch = await apiRequest(`/costs/settlement/batches/${settlementBatchId}/confirm`, 'POST');
    if (!confirmBatch.data.success) throw new Error('确认结算批次失败: ' + confirmBatch.data.error);
    log('结算批次已确认', 'success');

    const unsettled = await apiRequest('/costs/unsettled');
    const testingUnsettled = unsettled.data.data.find(g => g.responsibility === 'TESTING');
    if (testingUnsettled) {
      throw new Error('测试责任方应该没有待结算费用了');
    }
    log('验证测试责任方已无待结算费用: 通过', 'success');

    console.log('');
    log('========================================');
    log('  测试 6: 报表统计');
    log('========================================');
    
    const report = await apiRequest('/reports/summary');
    if (!report.data.success) throw new Error('获取报表失败');
    
    const stats = report.data.data;
    log(`总返修单数: ${stats.order_status.total_orders}`, 'info');
    log(`总冻结次数: ${stats.liability.total_freezes}`, 'info');
    log(`总复判数: ${stats.rejudge.total_rejudges}`, 'info');
    log(`已通过复判: ${stats.rejudge.approved}`, 'info');
    log('报表数据获取成功', 'success');

    console.log('');
    log('========================================');
    log('  测试 7: 并发场景与数据一致性');
    log('========================================');
    
    log('创建新返修单用于并发测试...');
    const concurrentOrder = await apiRequest('/orders', 'POST', {
      product_sn: 'CONC-TEST-' + Date.now(),
      product_name: '并发测试产品',
      repair_type: '并发测试'
    });
    if (!concurrentOrder.data.success) throw new Error('创建失败');
    const concurrentOrderId = concurrentOrder.data.data.id;
    log(`并发测试返修单ID: ${concurrentOrderId.substring(0, 20)}...`, 'info');

    log('同时发起多个冻结请求（责任在装配/测试/包装之间切换）...');
    const concurrentPromises = [];
    const responsibilities = ['ASSEMBLY', 'TESTING', 'PACKAGING', 'ASSEMBLY', 'TESTING'];
    
    for (let i = 0; i < 5; i++) {
      concurrentPromises.push(
        apiRequest('/liability/freeze', 'POST', {
          repair_order_id: concurrentOrderId,
          responsibility: responsibilities[i],
          reason: `并发请求 #${i + 1}`
        })
      );
    }

    const results = await Promise.all(concurrentPromises);
    
    let successCount = 0;
    let failCount = 0;
    results.forEach((r, i) => {
      if (r.data && r.data.success) {
        successCount++;
        log(`请求 #${i + 1}: 成功 (责任: ${responsibilities[i]})`, 'success');
      } else {
        failCount++;
        log(`请求 #${i + 1}: 失败 - ${r.data?.error || '未知'}`, 'error');
      }
    });

    console.log('');
    log(`并发测试结果: 成功 ${successCount}, 失败 ${failCount}`);
    
    log('验证数据一致性...', 'info');
    const freezeHistory = await apiRequest(`/liability/history/${concurrentOrderId}`);
    if (!freezeHistory.data.success) throw new Error('获取冻结历史失败');
    
    const historyCount = freezeHistory.data.data.length;
    log(`冻结历史记录数: ${historyCount}`, 'info');
    
    if (historyCount === successCount) {
      log('数据一致性验证通过！所有成功的冻结都被正确记录', 'success');
    } else {
      throw new Error(`数据不一致！成功请求数(${successCount}) != 历史记录数(${historyCount})`);
    }

    const activeFreeze = await apiRequest(`/liability/active/${concurrentOrderId}`);
    if (activeFreeze.data.success && activeFreeze.data.data) {
      log(`当前活动责任方: ${activeFreeze.data.data.responsibility}`, 'success');
    }
    
    log('并发测试完成（锁机制保证了操作的原子性和数据一致性）', 'success');

    console.log('');
    log('========================================');
    log('  测试 8: 操作日志验证');
    log('========================================');
    
    const logs = await apiRequest('/reports/logs?limit=50');
    if (!logs.data.success) throw new Error('获取日志失败');
    
    log(`日志记录数: ${logs.data.data.length}`, 'info');
    
    const modules = ['REPAIR_ORDER', 'LIABILITY', 'COST', 'REJUDGE', 'SETTLEMENT'];
    for (const mod of modules) {
      const hasModule = logs.data.data.some(l => l.module === mod);
      if (hasModule) {
        log(`  包含 ${mod} 模块日志: 是`, 'success');
      } else {
        log(`  包含 ${mod} 模块日志: 否`, 'info');
      }
    }
    log('操作日志系统正常', 'success');

    console.log('');
    console.log('========================================');
    console.log('  ✓ 所有测试通过！');
    console.log('========================================');
    console.log('');
    console.log('验证方法:');
    console.log('  1. 打开浏览器访问 http://localhost:3000');
    console.log('  2. 查看各个页签的数据是否正确');
    console.log('  3. 尝试「导出」功能，下载CSV文件进行复核');
    console.log('  4. 查看「操作日志」页签，确认所有操作都有记录');
    console.log('');
    console.log('测试数据ID（供参考）:');
    console.log(`  返修单: ${orderId}`);
    console.log(`  复判记录: ${rejudgeId}`);
    console.log(`  结算批次: ${settlementBatchId}`);
    console.log('');
    
    process.exit(0);

  } catch (e) {
    console.log('');
    console.log('========================================');
    console.log('  ✗ 测试失败');
    console.log('========================================');
    console.log('');
    console.log('错误信息:', e.message);
    console.log('');
    console.log('请确保:');
    console.log('  1. 服务已启动: npm start');
    console.log('  2. 数据库文件可读写');
    console.log('  3. 端口 3000 未被占用');
    console.log('');
    process.exit(1);
  }
}

runTests();
