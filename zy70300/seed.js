#!/usr/bin/env node

const http = require('http');

const BASE_URL = 'http://localhost:3000';

function request(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: body ? JSON.parse(body) : null
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: body
          });
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

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('🌱 开始加载种子数据...\n');

  try {
    // 1. 检查服务是否启动
    console.log('1️⃣  检查服务状态...');
    const health = await request('GET', '/api/health');
    console.log('   ✅ 服务正常:', health.data.status);
    await sleep(200);

    // 2. 发布配置版本 - 计费开关
    console.log('\n2️⃣  发布计费开关配置 v1 (原始关闭状态)...');
    const config1 = await request('POST', '/api/configs', {
      configKey: 'billing:enable_new_pricing',
      configValue: { enabled: false, version: 'legacy' },
      operator: 'release_manager'
    });
    console.log('   ✅ 配置发布成功, 版本:', config1.data.config.version);
    const configId1 = config1.data.config.id;
    await sleep(200);

    console.log('\n   发布计费开关配置 v2 (新计费方案)...');
    const config2 = await request('POST', '/api/configs', {
      configKey: 'billing:enable_new_pricing',
      configValue: { enabled: true, version: 'v2', discount: 0.1 },
      operator: 'release_manager'
    });
    console.log('   ✅ 配置发布成功, 版本:', config2.data.config.version);
    await sleep(200);

    // 3. 创建两个灰度批次
    console.log('\n3️⃣  创建灰度批次 A (健康批次 - 继续推进)...');
    const batchA = await request('POST', '/api/batches', {
      configKey: 'billing:enable_new_pricing',
      tenantIds: ['tenant-001', 'tenant-002', 'tenant-003'],
      batchName: 'Billing_V2_Batch_A_Healthy',
      operator: 'release_manager'
    });
    const batchIdA = batchA.data.batch.id;
    console.log('   ✅ 批次 A 创建成功:', batchIdA);
    console.log('   租户: tenant-001, tenant-002, tenant-003');
    await sleep(200);

    console.log('\n4️⃣  创建灰度批次 B (异常批次 - 需要暂停和回滚)...');
    const batchB = await request('POST', '/api/batches', {
      configKey: 'billing:enable_new_pricing',
      tenantIds: ['tenant-004', 'tenant-005', 'tenant-006', 'tenant-007'],
      batchName: 'Billing_V2_Batch_B_Abnormal',
      operator: 'release_manager'
    });
    const batchIdB = batchB.data.batch.id;
    console.log('   ✅ 批次 B 创建成功:', batchIdB);
    console.log('   租户: tenant-004, tenant-005, tenant-006, tenant-007');
    await sleep(200);

    // 4. 写入指标快照
    console.log('\n5️⃣  写入指标快照 - 批次 A (健康指标)...');
    
    // 批次 A - 租户 001: 成功率 99.5%
    await request('POST', '/api/metrics', {
      batchId: batchIdA,
      tenantId: 'tenant-001',
      metrics: {
        order_success_rate: 0.995,
        order_count: 1500,
        avg_response_time_ms: 120,
        error_count: 7
      },
      operator: 'metrics_collector'
    });
    console.log('   ✅ tenant-001: 成功率 99.5%');

    // 批次 A - 租户 002: 成功率 99.2%
    await request('POST', '/api/metrics', {
      batchId: batchIdA,
      tenantId: 'tenant-002',
      metrics: {
        order_success_rate: 0.992,
        order_count: 2300,
        avg_response_time_ms: 135,
        error_count: 18
      },
      operator: 'metrics_collector'
    });
    console.log('   ✅ tenant-002: 成功率 99.2%');

    // 批次 A - 租户 003: 成功率 99.8%
    await request('POST', '/api/metrics', {
      batchId: batchIdA,
      tenantId: 'tenant-003',
      metrics: {
        order_success_rate: 0.998,
        order_count: 800,
        avg_response_time_ms: 95,
        error_count: 2
      },
      operator: 'metrics_collector'
    });
    console.log('   ✅ tenant-003: 成功率 99.8%');
    await sleep(200);

    console.log('\n6️⃣  写入指标快照 - 批次 B (异常指标)...');
    
    // 批次 B - 租户 004: 成功率 45% (异常)
    await request('POST', '/api/metrics', {
      batchId: batchIdB,
      tenantId: 'tenant-004',
      metrics: {
        order_success_rate: 0.45,
        order_count: 500,
        avg_response_time_ms: 520,
        error_count: 275
      },
      operator: 'metrics_collector'
    });
    console.log('   ❌ tenant-004: 成功率 45% (异常)');

    // 批次 B - 租户 005: 成功率 38% (异常)
    await request('POST', '/api/metrics', {
      batchId: batchIdB,
      tenantId: 'tenant-005',
      metrics: {
        order_success_rate: 0.38,
        order_count: 1200,
        avg_response_time_ms: 680,
        error_count: 744
      },
      operator: 'metrics_collector'
    });
    console.log('   ❌ tenant-005: 成功率 38% (异常)');

    // 批次 B - 租户 006: 成功率 52% (异常)
    await request('POST', '/api/metrics', {
      batchId: batchIdB,
      tenantId: 'tenant-006',
      metrics: {
        order_success_rate: 0.52,
        order_count: 900,
        avg_response_time_ms: 490,
        error_count: 432
      },
      operator: 'metrics_collector'
    });
    console.log('   ❌ tenant-006: 成功率 52% (异常)');

    // 批次 B - 租户 007: 成功率 98% (正常)
    await request('POST', '/api/metrics', {
      batchId: batchIdB,
      tenantId: 'tenant-007',
      metrics: {
        order_success_rate: 0.98,
        order_count: 300,
        avg_response_time_ms: 140,
        error_count: 6
      },
      operator: 'metrics_collector'
    });
    console.log('   ✅ tenant-007: 成功率 98% (正常)');
    await sleep(200);

    console.log('\n');
    console.log('════════════════════════════════════════════════════════');
    console.log('✅ 种子数据加载完成！');
    console.log('════════════════════════════════════════════════════════');
    console.log('\n📋 已创建的数据:');
    console.log('  - 配置: billing:enable_new_pricing (v1, v2)');
    console.log('  - 批次 A (健康):', batchIdA);
    console.log('       tenant-001 (99.5%), tenant-002 (99.2%), tenant-003 (99.8%)');
    console.log('  - 批次 B (异常):', batchIdB);
    console.log('       tenant-004 (45%), tenant-005 (38%), tenant-006 (52%), tenant-007 (98%)');
    console.log('\n💡 下一步: 运行 demo.sh 执行完整演示流程');
    console.log('   或手动执行 curl 命令进行测试\n');

    // 保存批次 ID 供 demo 脚本使用
    const fs = require('fs');
    fs.writeFileSync('/tmp/gray_rollback_demo_state.json', JSON.stringify({
      batchIdA,
      batchIdB,
      configId1,
      configId2: config2.data.config.id
    }, null, 2));

  } catch (error) {
    console.error('\n❌ 错误:', error.message);
    console.error('💡 请确保服务器已启动: node server.js');
    process.exit(1);
  }
}

main();
