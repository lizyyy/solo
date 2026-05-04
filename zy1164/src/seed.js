const db = require('./database');

const seedData = {
  appKeys: [
    {
      appKey: 'ak_test_001',
      name: '测试应用 A',
      description: '用于压测测试的主要应用，高配额',
      isActive: true
    },
    {
      appKey: 'ak_test_002',
      name: '测试应用 B',
      description: '用于边界测试的应用，低配额',
      isActive: true
    },
    {
      appKey: 'ak_test_003',
      name: '测试应用 C',
      description: '已禁用的测试应用',
      isActive: false
    },
    {
      appKey: 'ak_prod_001',
      name: '生产应用',
      description: '模拟生产环境的应用配置',
      isActive: true
    }
  ],
  routes: [
    {
      path: '/api/users',
      method: 'GET',
      description: '获取用户列表接口',
      isActive: true
    },
    {
      path: '/api/users',
      method: 'POST',
      description: '创建用户接口',
      isActive: true
    },
    {
      path: '/api/orders',
      method: 'GET',
      description: '获取订单列表接口',
      isActive: true
    },
    {
      path: '/api/orders',
      method: 'POST',
      description: '创建订单接口',
      isActive: true
    },
    {
      path: '/api/payments',
      method: 'POST',
      description: '支付接口（高频操作）',
      isActive: true
    },
    {
      path: '/api/health',
      method: 'GET',
      description: '健康检查接口',
      isActive: true
    }
  ],
  rateLimitConfigs: [
    {
      appKeyIndex: 0,
      routeIndex: 0,
      algorithm: 'fixed-window',
      limit: 100,
      windowSeconds: 60,
      isActive: true
    },
    {
      appKeyIndex: 0,
      routeIndex: 1,
      algorithm: 'fixed-window',
      limit: 50,
      windowSeconds: 60,
      isActive: true
    },
    {
      appKeyIndex: 0,
      routeIndex: 2,
      algorithm: 'sliding-window',
      limit: 200,
      windowSeconds: 60,
      isActive: true
    },
    {
      appKeyIndex: 0,
      routeIndex: 3,
      algorithm: 'sliding-window',
      limit: 100,
      windowSeconds: 60,
      isActive: true
    },
    {
      appKeyIndex: 0,
      routeIndex: 4,
      algorithm: 'sliding-window',
      limit: 30,
      windowSeconds: 10,
      isActive: true
    },
    {
      appKeyIndex: 1,
      routeIndex: 0,
      algorithm: 'fixed-window',
      limit: 10,
      windowSeconds: 60,
      isActive: true
    },
    {
      appKeyIndex: 1,
      routeIndex: 1,
      algorithm: 'sliding-window',
      limit: 10,
      windowSeconds: 60,
      isActive: true
    },
    {
      appKeyIndex: 3,
      routeIndex: 0,
      algorithm: 'fixed-window',
      limit: 1000,
      windowSeconds: 60,
      isActive: true
    },
    {
      appKeyIndex: 3,
      routeIndex: 2,
      algorithm: 'sliding-window',
      limit: 2000,
      windowSeconds: 60,
      isActive: true
    },
    {
      appKeyIndex: 3,
      routeIndex: 4,
      algorithm: 'sliding-window',
      limit: 100,
      windowSeconds: 1,
      isActive: true
    }
  ]
};

async function runSeed() {
  try {
    await db.init();
    
    console.log('Seeding database...');
    console.log('='.repeat(50));
    
    console.log('\n1. Creating App Keys...');
    const appKeyIds = [];
    for (const ak of seedData.appKeys) {
      const existing = db.get('SELECT id FROM app_keys WHERE app_key = ?', [ak.appKey]);
      if (existing) {
        console.log(`   ✅ App Key ${ak.appKey} already exists`);
        appKeyIds.push(existing.id);
        continue;
      }
      
      const result = db.run(
        `INSERT INTO app_keys (app_key, name, description, is_active)
         VALUES (?, ?, ?, ?)`,
        [ak.appKey, ak.name, ak.description, ak.isActive ? 1 : 0]
      );
      appKeyIds.push(result?.lastInsertRowid);
      console.log(`   ✅ Created App Key: ${ak.appKey} (${ak.name})`);
    }
    
    console.log('\n2. Creating Routes...');
    const routeIds = [];
    for (const r of seedData.routes) {
      const existing = db.get(
        'SELECT id FROM routes WHERE path = ? AND method = ?',
        [r.path, r.method]
      );
      if (existing) {
        console.log(`   ✅ Route ${r.method} ${r.path} already exists`);
        routeIds.push(existing.id);
        continue;
      }
      
      const result = db.run(
        `INSERT INTO routes (path, method, description, is_active)
         VALUES (?, ?, ?, ?)`,
        [r.path, r.method, r.description, r.isActive ? 1 : 0]
      );
      routeIds.push(result?.lastInsertRowid);
      console.log(`   ✅ Created Route: ${r.method} ${r.path}`);
    }
    
    console.log('\n3. Creating Rate Limit Configurations...');
    for (const config of seedData.rateLimitConfigs) {
      const appKeyId = appKeyIds[config.appKeyIndex];
      const routeId = routeIds[config.routeIndex];
      
      const existing = db.get(
        'SELECT id FROM rate_limit_configs WHERE app_key_id = ? AND route_id = ?',
        [appKeyId, routeId]
      );
      if (existing) {
        console.log(`   ✅ Config for AppKey[${config.appKeyIndex}] Route[${config.routeIndex}] already exists`);
        continue;
      }
      
      db.run(
        `INSERT INTO rate_limit_configs 
         (app_key_id, route_id, algorithm, request_limit, window_seconds, is_active)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          appKeyId,
          routeId,
          config.algorithm,
          config.limit,
          config.windowSeconds,
          config.isActive ? 1 : 0
        ]
      );
      
      const algorithmName = config.algorithm === 'fixed-window' ? '固定窗口' : '滑动窗口';
      console.log(`   ✅ Created Config: ${algorithmName} - limit:${config.limit}/${config.windowSeconds}s`);
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ Seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - App Keys: ${seedData.appKeys.length}`);
    console.log(`   - Routes: ${seedData.routes.length}`);
    console.log(`   - Rate Limit Configs: ${seedData.rateLimitConfigs.length}`);
    
    console.log('\n🔑 Test App Keys:');
    console.log(`   - ak_test_001 (测试应用 A) - 高配额`);
    console.log(`   - ak_test_002 (测试应用 B) - 低配额（边界测试）`);
    console.log(`   - ak_prod_001 (生产应用) - 模拟生产配置`);
    
    db.close();
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

runSeed();
