const http = require('http');

const API_BASE = 'http://localhost:3000/api';

const makeRequest = (options, data = null) => {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseData));
        } catch (e) {
          resolve(responseData);
        }
      });
    });
    
    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
};

const post = (path, data, operator = 'admin') => {
  return makeRequest({
    method: 'POST',
    hostname: 'localhost',
    port: 3000,
    path: `/api${path}`,
    headers: {
      'Content-Type': 'application/json',
      'x-operator': operator
    }
  }, data);
};

const seed = async () => {
  console.log('========================================');
  console.log('开始初始化基础数据...');
  console.log('========================================\n');
  
  try {
    // 创建门店
    console.log('1. 创建门店...');
    
    const stores = [
      {
        store_name: '北京朝阳店',
        store_code: 'STORE_BJ001',
        city: '北京',
        address: '北京市朝阳区建国路88号'
      },
      {
        store_name: '上海浦东店',
        store_code: 'STORE_SH001',
        city: '上海',
        address: '上海市浦东新区陆家嘴环路1000号'
      },
      {
        store_name: '广州天河店',
        store_code: 'STORE_GZ001',
        city: '广州',
        address: '广州市天河区珠江新城华夏路30号'
      }
    ];
    
    const createdStores = [];
    for (const store of stores) {
      const result = await post('/stores', store, 'admin');
      if (result.success) {
        createdStores.push(result.data);
        console.log(`   ✓ 创建门店: ${result.data.store_name} (${result.data.store_code})`);
      } else {
        console.log(`   ✗ 创建门店失败: ${result.error}`);
      }
    }
    
    console.log('\n2. 创建预制菜批次...');
    
    const batches = [
      {
        product_name: '宫保鸡丁预制菜',
        product_code: 'PROD_GBC001',
        production_date: '2026-05-10',
        expiry_date: '2026-08-10',
        quantity: 100,
        unit: '箱'
      },
      {
        product_name: '麻婆豆腐预制菜',
        product_code: 'PROD_MPD001',
        production_date: '2026-05-11',
        expiry_date: '2026-08-11',
        quantity: 80,
        unit: '箱'
      },
      {
        product_name: '红烧肉预制菜',
        product_code: 'PROD_HSR001',
        production_date: '2026-05-12',
        expiry_date: '2026-08-12',
        quantity: 60,
        unit: '箱'
      }
    ];
    
    const createdBatches = [];
    for (const batch of batches) {
      const result = await post('/batches', batch, 'kitchen_manager');
      if (result.success) {
        createdBatches.push(result.data);
        console.log(`   ✓ 创建批次: ${result.data.product_name} (${result.data.product_code})`);
        console.log(`     数量: ${result.data.quantity}${result.data.unit}, 有效期: ${result.data.expiry_date}`);
      } else {
        console.log(`   ✗ 创建批次失败: ${result.error}`);
      }
    }
    
    console.log('\n========================================');
    console.log('基础数据初始化完成！');
    console.log('========================================');
    console.log(`\n已创建 ${createdStores.length} 个门店:`);
    createdStores.forEach(s => console.log(`  - ${s.store_name} (ID: ${s.id})`));
    
    console.log(`\n已创建 ${createdBatches.length} 个批次:`);
    createdBatches.forEach(b => console.log(`  - ${b.product_name} (ID: ${b.id})`));
    
    console.log('\n提示: 请保存这些 ID，后续演示需要使用');
    
  } catch (error) {
    console.error('初始化失败:', error.message);
    console.log('\n请确保 API 服务已启动: npm start');
  }
};

seed();
