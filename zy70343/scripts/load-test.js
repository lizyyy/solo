const http = require('http');
const { v4: uuidv4 } = require('uuid');

const BASE_URL = 'http://localhost:3000/api';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({
            statusCode: res.statusCode,
            body: parsed,
            headers: res.headers
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            body: { raw: data },
            headers: res.headers
          });
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

function makeOptions(method, path) {
  const url = new URL(BASE_URL + path);
  return {
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname + url.search,
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };
}

class ConcurrentTester {
  constructor() {
    this.results = [];
    this.productId = 'prod_' + Date.now();
    this.totalStock = 20;
    this.concurrentUsers = 50;
    this.quantityPerUser = 1;
  }

  async initInventory() {
    console.log('========== 初始化库存 ==========');
    console.log(`商品ID: ${this.productId}`);
    console.log(`总库存: ${this.totalStock}`);
    console.log(`并发用户数: ${this.concurrentUsers}`);
    console.log(`每人购买数量: ${this.quantityPerUser}`);
    console.log('');

    const res = await request(
      makeOptions('POST', '/inventory/init'),
      { productId: this.productId, totalStock: this.totalStock }
    );
    console.log('初始化结果:', JSON.stringify(res.body, null, 2));
    console.log('');
  }

  async getInventory() {
    const res = await request(
      makeOptions('GET', `/inventory/${this.productId}`),
      null
    );
    return res.body;
  }

  async runConcurrentLockTest() {
    console.log('========== 阶段1: 并发下单锁定库存 ==========');

    const promises = [];

    for (let i = 0; i < this.concurrentUsers; i++) {
      const userId = `user_${i}`;
      const orderId = `order_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

      const promise = (async () => {
        const startTime = Date.now();
        try {
          const res = await request(
            makeOptions('POST', '/orders/lock'),
            {
              orderId,
              productId: this.productId,
              userId,
              quantity: this.quantityPerUser
            }
          );
          const duration = Date.now() - startTime;

          const result = {
            userId,
            orderId,
            success: res.body.success,
            statusCode: res.statusCode,
            errorType: res.body.errorType,
            errorMessage: res.body.errorMessage,
            status: res.body.status,
            duration
          };

          if (res.body.success) {
            console.log(`✓ 用户 ${userId} 锁定成功 (${duration}ms) - 订单: ${orderId}`);
          } else {
            const reason = this.getReadableReason(res.body.errorType);
            console.log(`✗ 用户 ${userId} 锁定失败 (${duration}ms) - 原因: ${reason}`);
            console.log(`   详情: ${res.body.errorMessage}`);
          }

          return result;
        } catch (err) {
          return {
            userId,
            orderId,
            success: false,
            errorType: 'network_error',
            errorMessage: err.message
          };
        }
      })();

      promises.push(promise);
    }

    this.results = await Promise.all(promises);
    console.log('');
  }

  async runPaymentTest() {
    console.log('========== 阶段2: 并发支付确认 ==========');

    const successfulLocks = this.results.filter(r => r.success);
    console.log(`准备支付 ${successfulLocks.length} 个锁定成功的订单`);
    console.log('');

    const paymentPromises = successfulLocks.map((result, idx) => {
      return (async () => {
        await sleep(Math.random() * 500);

        const startTime = Date.now();
        try {
          const res = await request(
            makeOptions('POST', '/orders/pay'),
            { orderId: result.orderId }
          );
          const duration = Date.now() - startTime;

          const paymentResult = {
            ...result,
            paymentSuccess: res.body.success,
            paymentStatusCode: res.statusCode,
            paymentErrorType: res.body.errorType,
            paymentErrorMessage: res.body.errorMessage,
            paymentStatus: res.body.status,
            isDuplicatePayment: res.body.isDuplicate,
            paymentDuration: duration
          };

          if (res.body.success) {
            if (res.body.isDuplicate) {
              console.log(`△ 订单 ${result.orderId.substr(-8)} 重复支付 (幂等返回) (${duration}ms)`);
            } else {
              console.log(`✓ 订单 ${result.orderId.substr(-8)} 支付成功 (${duration}ms)`);
            }
          } else {
            console.log(`✗ 订单 ${result.orderId.substr(-8)} 支付失败 (${duration}ms)`);
            console.log(`   原因: ${this.getReadableReason(res.body.errorType)}`);
            console.log(`   详情: ${res.body.errorMessage}`);
          }

          return paymentResult;
        } catch (err) {
          return {
            ...result,
            paymentSuccess: false,
            paymentErrorMessage: err.message
          };
        }
      })();
    });

    const paymentResults = await Promise.all(paymentPromises);

    const resultsMap = new Map();
    for (const r of this.results) {
      resultsMap.set(r.orderId, r);
    }
    for (const pr of paymentResults) {
      resultsMap.set(pr.orderId, pr);
    }
    this.results = Array.from(resultsMap.values());

    console.log('');
  }

  async runDuplicateRequestTest() {
    console.log('========== 阶段3: 测试重复请求 ==========');
    console.log('');

    const successfulLocks = this.results.filter(r => r.success);
    if (successfulLocks.length > 0) {
      const testOrder = successfulLocks[0];
      console.log(`测试订单: ${testOrder.orderId}`);
      console.log('');

      console.log('--- 测试重复锁定 (同订单号) ---');
      const duplicateLock = await request(
        makeOptions('POST', '/orders/lock'),
        {
          orderId: testOrder.orderId,
          productId: this.productId,
          userId: testOrder.userId,
          quantity: 1
        }
      );
      console.log('重复锁定结果:', JSON.stringify(duplicateLock.body, null, 2));
      console.log('');

      console.log('--- 测试同一用户重复下单 ---');
      const newOrderId = `order_${testOrder.userId}_duplicate_${Date.now()}`;
      const userDuplicateLock = await request(
        makeOptions('POST', '/orders/lock'),
        {
          orderId: newOrderId,
          productId: this.productId,
          userId: testOrder.userId,
          quantity: 1
        }
      );
      console.log('用户重复下单结果:', JSON.stringify(userDuplicateLock.body, null, 2));
      console.log('');

      console.log('--- 测试重复支付回调 ---');
      const duplicatePayment1 = await request(
        makeOptions('POST', '/orders/pay'),
        { orderId: testOrder.orderId }
      );
      const duplicatePayment2 = await request(
        makeOptions('POST', '/orders/pay'),
        { orderId: testOrder.orderId }
      );
      console.log('重复支付1结果:', JSON.stringify(duplicatePayment1.body, null, 2));
      console.log('重复支付2结果:', JSON.stringify(duplicatePayment2.body, null, 2));
      console.log('');

      console.log('--- 测试补偿任务重复执行 ---');
      const compensationId = `comp_${Date.now()}`;
      const comp1 = await request(
        makeOptions('POST', '/compensation/log'),
        {
          compensationId,
          orderId: testOrder.orderId,
          action: 'verify_stock',
          status: 'completed',
          details: { checked: true }
        }
      );
      const comp2 = await request(
        makeOptions('POST', '/compensation/log'),
        {
          compensationId,
          orderId: testOrder.orderId,
          action: 'verify_stock',
          status: 'completed',
          details: { checked: true }
        }
      );
      console.log('补偿记录1结果:', JSON.stringify(comp1.body, null, 2));
      console.log('补偿记录2结果:', JSON.stringify(comp2.body, null, 2));
    }
    console.log('');
  }

  async runCancelTest() {
    console.log('========== 阶段4: 测试取消和状态冲突 ==========');
    console.log('');

    const newUserId = 'user_cancel_test_' + Date.now();
    const cancelOrderId = 'order_cancel_' + Date.now();

    console.log(`创建新订单用于取消测试: ${cancelOrderId}`);
    const lockRes = await request(
      makeOptions('POST', '/orders/lock'),
      {
        orderId: cancelOrderId,
        productId: this.productId,
        userId: newUserId,
        quantity: 1
      }
    );

    if (lockRes.body.success) {
      console.log('订单锁定成功');
      console.log('');

      console.log('--- 同时发起取消和支付 (模拟并发冲突) ---');
      const [cancelRes, payRes] = await Promise.all([
        request(
          makeOptions('POST', '/orders/cancel'),
          { orderId: cancelOrderId }
        ),
        request(
          makeOptions('POST', '/orders/pay'),
          { orderId: cancelOrderId }
        )
      ]);

      console.log('取消请求结果:', JSON.stringify(cancelRes.body, null, 2));
      console.log('支付请求结果:', JSON.stringify(payRes.body, null, 2));
      console.log('');

      if (cancelRes.body.success) {
        console.log('--- 测试已取消订单重复取消 ---');
        const duplicateCancel = await request(
          makeOptions('POST', '/orders/cancel'),
          { orderId: cancelOrderId }
        );
        console.log('重复取消结果:', JSON.stringify(duplicateCancel.body, null, 2));
      }

      if (payRes.body.success) {
        console.log('--- 测试已支付订单取消 ---');
        const cancelAfterPay = await request(
          makeOptions('POST', '/orders/cancel'),
          { orderId: cancelOrderId }
        );
        console.log('已支付订单取消结果:', JSON.stringify(cancelAfterPay.body, null, 2));
      }
    } else {
      console.log('订单锁定失败，跳过取消测试:', lockRes.body.errorMessage);
    }
    console.log('');
  }

  async getCompensationReport() {
    console.log('========== 阶段5: 获取补偿报告 ==========');
    const res = await request(
      makeOptions('GET', '/compensation/report'),
      null
    );
    return res.body;
  }

  getReadableReason(errorType) {
    const map = {
      'insufficient_stock': '库存不足',
      'duplicate_request': '重复请求',
      'status_conflict': '状态冲突',
      'timeout': '超时关闭',
      'not_found': '资源不存在',
      'network_error': '网络错误'
    };
    return map[errorType] || errorType || '未知错误';
  }

  generateReport() {
    console.log('');
    console.log('════════════════════════════════════════════════════════════');
    console.log('                  并发测试最终报告');
    console.log('════════════════════════════════════════════════════════════');
    console.log('');

    console.log('【测试配置】');
    console.log(`  商品ID: ${this.productId}`);
    console.log(`  总库存: ${this.totalStock}`);
    console.log(`  并发用户数: ${this.concurrentUsers}`);
    console.log(`  每人购买数量: ${this.quantityPerUser}`);
    console.log(`  理论最大成功数: ${this.totalStock}`);
    console.log('');

    const lockResults = this.results;
    const successfulLocks = lockResults.filter(r => r.success);
    const failedLocks = lockResults.filter(r => !r.success);

    console.log('【锁定阶段统计】');
    console.log(`  总请求数: ${lockResults.length}`);
    console.log(`  成功锁定: ${successfulLocks.length}`);
    console.log(`  失败锁定: ${failedLocks.length}`);
    console.log('');

    if (failedLocks.length > 0) {
      console.log('  失败原因分布:');
      const reasonCounts = {};
      for (const r of failedLocks) {
        const reason = r.errorType || 'unknown';
        reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
      }
      for (const [reason, count] of Object.entries(reasonCounts)) {
        console.log(`    - ${this.getReadableReason(reason)}: ${count} 个`);
      }
      console.log('');

      console.log('  失败请求详情 (最多10个):');
      failedLocks.slice(0, 10).forEach((r, idx) => {
        console.log(`    [${idx + 1}] 用户 ${r.userId}`);
        console.log(`         原因: ${this.getReadableReason(r.errorType)}`);
        console.log(`         详情: ${r.errorMessage}`);
      });
      console.log('');
    }

    const paymentResults = lockResults.filter(r => r.paymentSuccess !== undefined);
    if (paymentResults.length > 0) {
      console.log('【支付阶段统计】');
      const successfulPayments = paymentResults.filter(r => r.paymentSuccess);
      const failedPayments = paymentResults.filter(r => !r.paymentSuccess);
      const duplicatePayments = paymentResults.filter(r => r.isDuplicatePayment);

      console.log(`  支付请求数: ${paymentResults.length}`);
      console.log(`  支付成功: ${successfulPayments.length}`);
      console.log(`  重复支付(幂等): ${duplicatePayments.length}`);
      console.log(`  支付失败: ${failedPayments.length}`);
      console.log('');
    }

    const totalSuccess = lockResults.filter(r => r.success).length;
    console.log('【库存守恒验证】');
    console.log(`  总库存: ${this.totalStock}`);
    console.log(`  成功锁定数: ${totalSuccess}`);
    console.log(`  是否超卖: ${totalSuccess > this.totalStock ? '是 ❌' : '否 ✓'}`);

    if (totalSuccess > this.totalStock) {
      console.log(`  ⚠️  超卖数量: ${totalSuccess - this.totalStock}`);
    } else {
      console.log(`  ✓  系统正确处理了并发请求`);
    }
    console.log('');

    const failedByType = {};
    for (const r of failedLocks) {
      const type = r.errorType || 'unknown';
      if (!failedByType[type]) failedByType[type] = [];
      failedByType[type].push(r);
    }

    if (Object.keys(failedByType).length > 0) {
      console.log('【失败分类详情】');
      for (const [type, requests] of Object.entries(failedByType)) {
        console.log('');
        console.log(`  类型: ${this.getReadableReason(type)} (${type})`);
        console.log(`  数量: ${requests.length}`);
        console.log('  示例:');
        requests.slice(0, 3).forEach((r, idx) => {
          console.log(`    ${idx + 1}. 用户 ${r.userId} - ${r.errorMessage}`);
        });
      }
      console.log('');
    }

    const allPassed = totalSuccess <= this.totalStock;
    console.log('════════════════════════════════════════════════════════════');
    console.log(`  测试结果: ${allPassed ? '通过 ✓' : '失败 ❌'}`);
    console.log('════════════════════════════════════════════════════════════');
    console.log('');

    return allPassed;
  }

  async runFullTest() {
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║           并发库存扣减 API - 完整测试套件                  ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');

    try {
      await this.initInventory();

      const initialInventory = await this.getInventory();
      console.log('初始库存状态:', JSON.stringify(initialInventory, null, 2));
      console.log('');

      await this.runConcurrentLockTest();

      await this.runPaymentTest();

      await this.runDuplicateRequestTest();

      await this.runCancelTest();

      const finalInventory = await this.getInventory();
      console.log('========== 最终库存状态 ==========');
      console.log(JSON.stringify(finalInventory, null, 2));
      console.log('');

      const report = await this.getCompensationReport();
      console.log('========== 补偿报告摘要 ==========');
      console.log(`库存守恒: ${report.data.inventory.every(i => i.stockConserved) ? '✓' : '✗'}`);
      console.log(`订单统计:`, JSON.stringify(report.data.orders, null, 2));
      if (report.data.abnormalOrders.length > 0) {
        console.log(`异常订单: ${report.data.abnormalOrders.length}`);
        console.log(JSON.stringify(report.data.abnormalOrders, null, 2));
      }
      console.log('');

      const allPassed = this.generateReport();

      process.exit(allPassed ? 0 : 1);
    } catch (err) {
      console.error('测试执行失败:', err);
      process.exit(1);
    }
  }
}

if (require.main === module) {
  const tester = new ConcurrentTester();
  tester.runFullTest();
}

module.exports = ConcurrentTester;
