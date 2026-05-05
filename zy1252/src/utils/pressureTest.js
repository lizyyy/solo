const http = require('http');
const https = require('https');
const { v4: uuidv4 } = require('uuid');
const { ReportGenerator } = require('./reportGenerator');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

class PressureTest {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || BASE_URL;
    this.concurrency = options.concurrency || 10;
    this.requestsPerScenario = options.requestsPerScenario || 5;
    this.results = [];
    this.startTime = null;
  }

  async makeRequest(method, path, headers = {}, body = null) {
    const url = new URL(this.baseUrl + path);
    const client = url.protocol === 'https:' ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    return new Promise((resolve, reject) => {
      const req = client.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const response = {
              statusCode: res.statusCode,
              headers: res.headers,
              body: data ? JSON.parse(data) : null
            };
            resolve(response);
          } catch (error) {
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              rawBody: data,
              parseError: error.message
            });
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      if (body) {
        req.write(JSON.stringify(body));
      }

      req.end();
    });
  }

  async runScenario(name, scenarioFn) {
    console.log(`\n=== 开始场景: ${name} ===`);
    console.log(`并发数: ${this.concurrency}, 每场景请求数: ${this.requestsPerScenario}`);

    const scenarioStartTime = Date.now();
    const scenarioResults = [];

    const promises = [];
    
    for (let i = 0; i < this.concurrency; i++) {
      const workerId = i;
      promises.push((async () => {
        for (let j = 0; j < this.requestsPerScenario; j++) {
          const requestStartTime = Date.now();
          try {
            const result = await scenarioFn(workerId, j);
            scenarioResults.push({
              workerId,
              requestIndex: j,
              success: true,
              ...result,
              duration: Date.now() - requestStartTime
            });
          } catch (error) {
            scenarioResults.push({
              workerId,
              requestIndex: j,
              success: false,
              error: error.message,
              duration: Date.now() - requestStartTime
            });
          }
        }
      })());
    }

    await Promise.all(promises);

    const duration = Date.now() - scenarioStartTime;
    const successCount = scenarioResults.filter(r => r.success).length;
    const failureCount = scenarioResults.filter(r => !r.success).length;
    const avgDuration = scenarioResults.reduce((sum, r) => sum + r.duration, 0) / scenarioResults.length;

    const scenarioSummary = {
      name,
      duration,
      totalRequests: scenarioResults.length,
      successCount,
      failureCount,
      avgDuration: avgDuration.toFixed(2),
      results: scenarioResults
    };

    this.results.push(scenarioSummary);

    console.log(`场景完成: ${name}`);
    console.log(`总耗时: ${duration}ms`);
    console.log(`成功率: ${((successCount / scenarioResults.length) * 100).toFixed(2)}%`);
    console.log(`平均响应时间: ${avgDuration.toFixed(2)}ms`);

    return scenarioSummary;
  }

  async runScenarioCreateOrder() {
    const idempotencyKey = `order-${uuidv4().substring(0, 8)}`;
    const userId = `user-${Math.floor(Math.random() * 1000)}`;
    
    const requestBody = {
      user_id: userId,
      product_name: '测试商品 - 并发测试',
      amount: 99.99
    };

    return this.runScenario('创建订单 - 同一幂等键重复请求', async (workerId, requestIndex) => {
      const response = await this.makeRequest('POST', '/api/orders', {
        'X-Idempotency-Key': idempotencyKey
      }, requestBody);

      return {
        idempotencyKey,
        statusCode: response.statusCode,
        body: response.body,
        isCacheHit: response.body?.idempotency_hit === true
      };
    });
  }

  async runScenarioCreateOrderWithDifferentParams() {
    const idempotencyKey = `conflict-${uuidv4().substring(0, 8)}`;
    const userId = `user-${Math.floor(Math.random() * 1000)}`;

    const requestBodies = [
      { user_id: userId, product_name: '商品A', amount: 99.99 },
      { user_id: userId, product_name: '商品B', amount: 199.99 }
    ];

    return this.runScenario('创建订单 - 同一幂等键不同参数冲突测试', async (workerId, requestIndex) => {
      const body = requestBodies[requestIndex % 2];
      
      const response = await this.makeRequest('POST', '/api/orders', {
        'X-Idempotency-Key': idempotencyKey
      }, body);

      return {
        idempotencyKey,
        bodyUsed: body.product_name,
        statusCode: response.statusCode,
        body: response.body,
        isConflict: response.statusCode === 409
      };
    });
  }

  async runScenarioPaymentCallback() {
    const orderResponse = await this.makeRequest('POST', '/api/orders', {
      'X-Idempotency-Key': `setup-${uuidv4().substring(0, 8)}`
    }, {
      user_id: 'user-test-callback',
      product_name: '回调测试商品',
      amount: 299.99
    });

    const orderId = orderResponse.body?.data?.order?.id;
    
    if (!orderId) {
      throw new Error('无法创建订单用于测试');
    }

    const paymentIdempotencyKey = `payment-${uuidv4().substring(0, 8)}`;
    
    await this.makeRequest('POST', '/api/payments', {
      'X-Idempotency-Key': paymentIdempotencyKey
    }, {
      order_id: orderId,
      payment_method: 'alipay',
      amount: 299.99
    });

    const callbackKey = `callback-${uuidv4().substring(0, 8)}`;
    const gatewayTransactionId = `GATEWAY_TEST_${uuidv4().substring(0, 8).toUpperCase()}`;

    return this.runScenario('支付回调 - 重复回调幂等性测试', async (workerId, requestIndex) => {
      const response = await this.makeRequest('POST', '/api/payments/callback', {
        'X-Idempotency-Key': callbackKey
      }, {
        gateway_transaction_id: gatewayTransactionId,
        order_id: orderId,
        status: 'success',
        amount: 299.99
      });

      return {
        callbackKey,
        gatewayTransactionId,
        statusCode: response.statusCode,
        body: response.body,
        isDuplicate: response.body?.code === 'CALLBACK_DUPLICATE' || response.body?.idempotency_hit === true
      };
    });
  }

  async runScenarioNoIdempotencyKey() {
    return this.runScenario('无幂等键请求 - 风险提示测试', async (workerId, requestIndex) => {
      const response = await this.makeRequest('POST', '/api/orders', {}, {
        user_id: `user-${workerId}`,
        product_name: '无幂等键测试商品',
        amount: 59.99
      });

      return {
        statusCode: response.statusCode,
        body: response.body,
        isRejected: response.statusCode === 400 && response.body?.code === 'IDEMPOTENCY_KEY_REQUIRED'
      };
    });
  }

  async runAllScenarios() {
    console.log('\n========================================');
    console.log('       接口幂等性并发重放压测工具');
    console.log('========================================');
    console.log(`\n配置:`);
    console.log(`  - 基础URL: ${this.baseUrl}`);
    console.log(`  - 并发数: ${this.concurrency}`);
    console.log(`  - 每场景请求数: ${this.requestsPerScenario}`);
    console.log(`  - 总请求数: ${this.concurrency * this.requestsPerScenario * 4}`);

    this.startTime = Date.now();

    await this.runScenarioCreateOrder();
    await this.runScenarioCreateOrderWithDifferentParams();
    await this.runScenarioPaymentCallback();
    await this.runScenarioNoIdempotencyKey();

    const totalDuration = Date.now() - this.startTime;
    
    console.log('\n========================================');
    console.log('              压测总结');
    console.log('========================================');
    console.log(`\n总耗时: ${totalDuration}ms`);

    let totalRequests = 0;
    let totalSuccess = 0;
    let totalFailures = 0;
    let totalCacheHits = 0;
    let totalConflicts = 0;
    let totalDuplicates = 0;

    this.results.forEach(summary => {
      totalRequests += summary.totalRequests;
      totalSuccess += summary.successCount;
      totalFailures += summary.failureCount;

      summary.results.forEach(r => {
        if (r.isCacheHit) totalCacheHits++;
        if (r.isConflict) totalConflicts++;
        if (r.isDuplicate) totalDuplicates++;
      });
    });

    console.log(`\n总请求数: ${totalRequests}`);
    console.log(`成功请求: ${totalSuccess}`);
    console.log(`失败请求: ${totalFailures}`);
    console.log(`\n幂等性效果:`);
    console.log(`  - 缓存命中 (idempotency_hit): ${totalCacheHits}`);
    console.log(`  - 冲突检测 (conflict): ${totalConflicts}`);
    console.log(`  - 重复回调检测 (duplicate): ${totalDuplicates}`);
    console.log(`\n成功率: ${((totalSuccess / totalRequests) * 100).toFixed(2)}%`);

    return {
      totalDuration,
      totalRequests,
      totalSuccess,
      totalFailures,
      totalCacheHits,
      totalConflicts,
      totalDuplicates,
      scenarios: this.results
    };
  }

  async generateReport(format = 'json') {
    const summary = {
      generated_at: new Date().toISOString(),
      base_url: this.baseUrl,
      config: {
        concurrency: this.concurrency,
        requestsPerScenario: this.requestsPerScenario
      },
      results: this.results
    };

    if (format === 'markdown') {
      return this.generateMarkdownReport(summary);
    }

    return JSON.stringify(summary, null, 2);
  }

  generateMarkdownReport(summary) {
    let md = `# 接口幂等性压测报告

> 生成时间: ${summary.generated_at}
> 基础URL: ${summary.base_url}

## 测试配置

| 配置项 | 值 |
|--------|-----|
| 并发数 | ${summary.config.concurrency} |
| 每场景请求数 | ${summary.config.requestsPerScenario} |

## 场景详情

`;

    summary.results.forEach((scenario, index) => {
      md += `### 场景 ${index + 1}: ${scenario.name}

| 指标 | 值 |
|------|-----|
| 总耗时 | ${scenario.duration}ms |
| 总请求数 | ${scenario.totalRequests} |
| 成功 | ${scenario.successCount} |
| 失败 | ${scenario.failureCount} |
| 平均响应时间 | ${scenario.avgDuration}ms |
| 成功率 | ${((scenario.successCount / scenario.totalRequests) * 100).toFixed(2)}% |

`;
    });

    return md;
  }
}

async function main() {
  const concurrency = parseInt(process.env.CONCURRENCY) || 10;
  const requestsPerScenario = parseInt(process.env.REQUESTS_PER_SCENARIO) || 5;

  const pressureTest = new PressureTest({
    concurrency,
    requestsPerScenario
  });

  try {
    await pressureTest.runAllScenarios();
    
    console.log('\n\n生成报告...');
    const jsonReport = await pressureTest.generateReport('json');
    const mdReport = await pressureTest.generateReport('markdown');
    
    console.log('\nJSON报告示例:');
    console.log(JSON.parse(jsonReport));
    
    console.log('\n\nMarkdown报告已生成，可以保存为 report.md');
    console.log('\n压测完成！');
  } catch (error) {
    console.error('压测执行失败:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { PressureTest };
