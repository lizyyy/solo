const { init } = require('../src/db');
const { createTables } = require('../src/db/schema');
const { createProvider, getProviderByName, listProviders } = require('../src/dao/providerDao');
const { createOrUpdateSimulatorConfig } = require('../src/dao/simulatorDao');
const { createEvent } = require('../src/dao/eventDao');
const { EVENT_STATUSES } = require('../src/db/schema');
const { generateTestSignature } = require('../src/services/signatureService');

const PROVIDERS = [
  {
    name: 'payment-gateway',
    secret: 'pay_secret_12345',
    algorithm: 'sha256',
    tolerance_seconds: 300,
    signature_header: 'X-Pay-Signature',
    timestamp_header: 'X-Pay-Timestamp',
    event_id_key: 'eventId',
    description: '支付网关回调 - 默认成功模式',
    simulator: {
      mode: 'success',
      event_type: '*',
    }
  },
  {
    name: 'sms-provider',
    secret: 'sms_secret_67890',
    algorithm: 'sha256',
    tolerance_seconds: 300,
    signature_header: 'X-Sms-Signature',
    timestamp_header: 'X-Sms-Timestamp',
    event_id_key: 'id',
    description: '短信服务商回调 - 默认总是失败',
    simulator: {
      mode: 'fail_always',
      event_type: '*',
      error_message: 'SMS gateway timeout: connection refused',
    }
  },
  {
    name: 'warehouse-system',
    secret: 'wh_secret_abcde',
    algorithm: 'sha512',
    tolerance_seconds: 600,
    signature_header: 'X-Warehouse-Signature',
    timestamp_header: 'X-Warehouse-Timestamp',
    event_id_key: 'event_id',
    description: '仓储系统回调 - 前2次失败后成功',
    simulator: {
      mode: 'fail_n_times',
      event_type: '*',
      fail_count: 2,
      error_message: 'Warehouse API temporary unavailable (503)',
    }
  },
  {
    name: 'ticket-system',
    secret: 'ticket_secret_xyz',
    algorithm: 'sha256',
    tolerance_seconds: 300,
    signature_header: 'X-Signature',
    timestamp_header: 'X-Timestamp',
    event_id_key: 'ticketId',
    description: '工单系统回调 - 默认配置',
    simulator: null
  },
];

async function seed() {
  console.log('[Seed] Initializing database...');
  
  return new Promise((resolve, reject) => {
    init(async (err) => {
      if (err) {
        console.error('[Seed] Failed to initialize database:', err);
        reject(err);
        return;
      }
      
      try {
        await createTables();
        console.log('[Seed] Database tables created');
        
        console.log('[Seed] Creating providers...');
        
        const createdProviders = [];
        
        for (const p of PROVIDERS) {
          const existing = await getProviderByName(p.name);
          if (existing) {
            console.log(`[Seed] Provider '${p.name}' already exists, skipping`);
            createdProviders.push(existing);
            continue;
          }
          
          const provider = await createProvider({
            name: p.name,
            secret: p.secret,
            algorithm: p.algorithm,
            tolerance_seconds: p.tolerance_seconds,
            signature_header: p.signature_header,
            timestamp_header: p.timestamp_header,
            event_id_key: p.event_id_key,
          });
          createdProviders.push(provider);
          console.log(`[Seed] Created provider: ${p.name}`);
          
          if (p.simulator) {
            await createOrUpdateSimulatorConfig({
              provider_id: provider.id,
              event_type: p.simulator.event_type || '*',
              mode: p.simulator.mode,
              fail_count: p.simulator.fail_count,
              error_message: p.simulator.error_message,
              delay_ms: p.simulator.delay_ms || 0,
              enabled: 1,
            });
            console.log(`[Seed] ${p.name}: simulator set to ${p.simulator.mode} mode`);
          }
        }
        
        console.log('[Seed] Generating test signature examples...');
        
        const now = Math.floor(Date.now() / 1000);
        
        const testPayload = JSON.stringify({
          eventId: 'pay_001',
          type: 'payment.success',
          amount: 100.00,
          orderId: 'ORD_2024_001',
          timestamp: now,
        });
        
        const paymentProvider = createdProviders.find(p => p.name === 'payment-gateway');
        if (paymentProvider) {
          const signature = generateTestSignature(testPayload, paymentProvider.secret, paymentProvider.algorithm);
          console.log('');
          console.log('==================================================');
          console.log('测试签名示例 (payment-gateway):');
          console.log('==================================================');
          console.log(`Provider: payment-gateway`);
          console.log(`Secret: ${paymentProvider.secret}`);
          console.log(`Algorithm: ${paymentProvider.algorithm}`);
          console.log('');
          console.log('Payload:');
          console.log(testPayload);
          console.log('');
          console.log(`Timestamp: ${now}`);
          console.log(`Signature: ${signature}`);
          console.log('');
          console.log('curl 示例:');
          console.log(`curl -X POST http://localhost:3000/webhook/payment-gateway \\`);
          console.log(`  -H "Content-Type: application/json" \\`);
          console.log(`  -H "X-Pay-Timestamp: ${now}" \\`);
          console.log(`  -H "X-Pay-Signature: ${signature}" \\`);
          console.log(`  -d '${testPayload}'`);
          console.log('==================================================');
        }
        
        console.log('');
        console.log('[Seed] Done!');
        console.log('');
        console.log('已创建的 Providers:');
        const finalProviders = await listProviders();
        finalProviders.forEach(p => {
          console.log(`  - ${p.name} (id: ${p.id})`);
        });
        console.log('');
        console.log('模拟器配置:');
        console.log('  - payment-gateway: 总是成功');
        console.log('  - sms-provider: 总是失败 (用于测试重试)');
        console.log('  - warehouse-system: 前2次失败，第3次成功 (测试重试补偿)');
        console.log('  - ticket-system: 默认配置');
        
        resolve();
      } catch (seedErr) {
        console.error('[Seed] Error:', seedErr);
        reject(seedErr);
      }
    });
  });
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
