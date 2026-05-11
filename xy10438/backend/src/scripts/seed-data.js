const { v4: uuidv4 } = require('uuid');
const initSqlJs = require('sql.js');
const dayjs = require('dayjs');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'pricetag.db');

let db = null;

const saveDatabase = () => {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
};

const initDatabase = async () => {
  const SQL = await initSqlJs();
  
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    return new SQL.Database(fileBuffer);
  } else {
    return new SQL.Database();
  }
};

const run = (sql, params = []) => {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  stmt.step();
  stmt.free();
};

const seed = async () => {
  console.log('开始生成样例数据...\n');

  try {
    db = await initDatabase();

    console.log('清理旧数据...');
    run('DELETE FROM task_items');
    run('DELETE FROM store_tasks');
    run('DELETE FROM price_adjustment_items');
    run('DELETE FROM price_adjustments');
    run('DELETE FROM exceptions');
    run('DELETE FROM products');
    run('DELETE FROM stores');
    run('DELETE FROM regions');
    run('DELETE FROM users');

    console.log('创建用户...');
    const users = [
      { id: uuidv4(), username: 'admin', password: '123456', name: '系统管理员', role: 'admin' },
      { id: uuidv4(), username: 'supervisor_east', password: '123456', name: '东区督导-李主任', role: 'supervisor' },
      { id: uuidv4(), username: 'supervisor_west', password: '123456', name: '西区督导-王经理', role: 'supervisor' },
      { id: uuidv4(), username: 'store_east_1', password: '123456', name: '东区一店店长', role: 'store_manager' },
      { id: uuidv4(), username: 'store_east_2', password: '123456', name: '东区二店店长', role: 'store_manager' },
      { id: uuidv4(), username: 'store_west_1', password: '123456', name: '西区一店店长', role: 'store_manager' },
    ];
    
    users.forEach(u => {
      run(`
        INSERT INTO users (id, username, password, name, role)
        VALUES (?, ?, ?, ?, ?)
      `, [u.id, u.username, u.password, u.name, u.role]);
    });

    console.log('创建区域...');
    const regions = [
      { id: uuidv4(), name: '华东区', code: 'R-EAST' },
      { id: uuidv4(), name: '华北区', code: 'R-WEST' },
      { id: uuidv4(), name: '华南区', code: 'R-SOUTH' },
    ];
    
    regions.forEach(r => {
      run(`
        INSERT INTO regions (id, name, code)
        VALUES (?, ?, ?)
      `, [r.id, r.name, r.code]);
    });

    users[1].regionId = regions[0].id;
    users[2].regionId = regions[1].id;
    run('UPDATE users SET region_id = ? WHERE id = ?', [regions[0].id, users[1].id]);
    run('UPDATE users SET region_id = ? WHERE id = ?', [regions[1].id, users[2].id]);

    console.log('创建门店...');
    const stores = [
      { id: uuidv4(), name: '上海南京东路店', code: 'S001', regionId: regions[0].id, address: '上海市黄浦区南京东路100号', phone: '021-12345678' },
      { id: uuidv4(), name: '上海徐汇店', code: 'S002', regionId: regions[0].id, address: '上海市徐汇区漕溪北路200号', phone: '021-23456789' },
      { id: uuidv4(), name: '杭州西湖店', code: 'S003', regionId: regions[0].id, address: '杭州市西湖区湖滨路50号', phone: '0571-34567890' },
      { id: uuidv4(), name: '北京王府井店', code: 'S004', regionId: regions[1].id, address: '北京市东城区王府井大街88号', phone: '010-45678901' },
      { id: uuidv4(), name: '北京朝阳店', code: 'S005', regionId: regions[1].id, address: '北京市朝阳区建国路99号', phone: '010-56789012' },
      { id: uuidv4(), name: '深圳罗湖店', code: 'S006', regionId: regions[2].id, address: '深圳市罗湖区深南东路300号', phone: '0755-67890123' },
    ];

    users[3].storeId = stores[0].id;
    users[4].storeId = stores[1].id;
    users[5].storeId = stores[3].id;
    run('UPDATE users SET store_id = ? WHERE id = ?', [stores[0].id, users[3].id]);
    run('UPDATE users SET store_id = ? WHERE id = ?', [stores[1].id, users[4].id]);
    run('UPDATE users SET store_id = ? WHERE id = ?', [stores[3].id, users[5].id]);
    
    stores.forEach(s => {
      run(`
        INSERT INTO stores (id, name, code, region_id, address, phone, status)
        VALUES (?, ?, ?, ?, ?, ?, 'active')
      `, [s.id, s.name, s.code, s.regionId, s.address, s.phone]);
    });

    console.log('创建商品...');
    const products = [
      { id: uuidv4(), sku: 'P001', name: '康师傅红烧牛肉面5包装', category: '食品/方便食品', unit: '包', currentPrice: 12.50 },
      { id: uuidv4(), sku: 'P002', name: '农夫山泉550ml', category: '饮料/饮用水', unit: '瓶', currentPrice: 2.00 },
      { id: uuidv4(), sku: 'P003', name: '乐事薯片原味104g', category: '食品/休闲零食', unit: '袋', currentPrice: 9.90 },
      { id: uuidv4(), sku: 'P004', name: '可口可乐330ml*24罐', category: '饮料/碳酸饮料', unit: '箱', currentPrice: 59.90 },
      { id: uuidv4(), sku: 'P005', name: '奥利奥夹心饼干97g', category: '食品/饼干糕点', unit: '盒', currentPrice: 8.50 },
      { id: uuidv4(), sku: 'P006', name: '海天酱油500ml', category: '食品/调味品', unit: '瓶', currentPrice: 11.80 },
      { id: uuidv4(), sku: 'P007', name: '清风抽纸3层100抽*3包', category: '日用品/纸巾', unit: '提', currentPrice: 15.90 },
      { id: uuidv4(), sku: 'P008', name: '潘婷洗发水400ml', category: '日用品/洗护', unit: '瓶', currentPrice: 39.90 },
      { id: uuidv4(), sku: 'P009', name: '舒肤佳香皂115g', category: '日用品/洗护', unit: '块', currentPrice: 5.90 },
      { id: uuidv4(), sku: 'P010', name: '维达卷纸10卷', category: '日用品/纸巾', unit: '提', currentPrice: 29.90 },
    ];
    
    products.forEach(p => {
      run(`
        INSERT INTO products (id, sku, name, category, unit, current_price, status)
        VALUES (?, ?, ?, ?, ?, ?, 'active')
      `, [p.id, p.sku, p.name, p.category, p.unit, p.currentPrice]);
    });

    console.log('创建调价单...');
    
    const adjustment1Id = uuidv4();
    const adjustment1No = 'ADJ' + dayjs().format('YYYYMMDD') + '0001';
    run(`
      INSERT INTO price_adjustments (id, adjustment_no, type, title, description, effect_time, expire_time, created_by, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'published')
    `, [
      adjustment1Id, 
      adjustment1No, 
      'promotion', 
      '618促销调价（已生效）', 
      '618年中大促，东区门店饮料类商品促销',
      dayjs().subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
      dayjs().add(7, 'day').format('YYYY-MM-DD HH:mm:ss'),
      users[0].id
    ]);

    const adj1Items = [
      { productId: products[1].id, originalPrice: 2.00, newPrice: 1.60 },
      { productId: products[3].id, originalPrice: 59.90, newPrice: 49.90 },
    ];

    const adj1ItemIds = [];
    adj1Items.forEach(item => {
      const itemId = uuidv4();
      run(`
        INSERT INTO price_adjustment_items (id, adjustment_id, product_id, original_price, new_price)
        VALUES (?, ?, ?, ?, ?)
      `, [itemId, adjustment1Id, item.productId, item.originalPrice, item.newPrice]);
      adj1ItemIds.push(itemId);
    });

    const eastStores = stores.filter(s => s.regionId === regions[0].id);
    
    const task1Id = uuidv4();
    run(`
      INSERT INTO store_tasks (id, adjustment_id, store_id, status, confirmed_by, confirmed_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [task1Id, adjustment1Id, eastStores[0].id, 'confirmed', users[3].id, dayjs().subtract(12, 'hour').format('YYYY-MM-DD HH:mm:ss')]);
    
    adj1ItemIds.forEach(itemId => {
      run(`
        INSERT INTO task_items (id, store_task_id, adjustment_item_id, status, confirmed_at)
        VALUES (?, ?, ?, ?, ?)
      `, [uuidv4(), task1Id, itemId, 'confirmed', dayjs().subtract(12, 'hour').format('YYYY-MM-DD HH:mm:ss')]);
    });

    const task2Id = uuidv4();
    run(`
      INSERT INTO store_tasks (id, adjustment_id, store_id, status, confirmed_by, confirmed_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [task2Id, adjustment1Id, eastStores[1].id, 'pending', null, null]);
    
    adj1ItemIds.forEach(itemId => {
      run(`
        INSERT INTO task_items (id, store_task_id, adjustment_item_id, status, confirmed_at)
        VALUES (?, ?, ?, ?, ?)
      `, [uuidv4(), task2Id, itemId, 'pending', null]);
    });

    const task3Id = uuidv4();
    run(`
      INSERT INTO store_tasks (id, adjustment_id, store_id, status, confirmed_by, confirmed_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [task3Id, adjustment1Id, eastStores[2].id, 'has_exception', null, null]);
    
    adj1ItemIds.forEach(itemId => {
      run(`
        INSERT INTO task_items (id, store_task_id, adjustment_item_id, status, confirmed_at)
        VALUES (?, ?, ?, ?, ?)
      `, [uuidv4(), task3Id, itemId, 'pending', null]);
    });

    const exception1Id = uuidv4();
    run(`
      INSERT INTO exceptions (id, store_task_id, adjustment_item_id, type, description, reported_by, status)
      VALUES (?, ?, ?, ?, ?, ?, 'open')
    `, [
      exception1Id,
      task3Id,
      adj1ItemIds[1],
      'tag_missing',
      '可口可乐330ml*24罐的价签缺失，货架上没有找到对应价签，需要打印新价签',
      users[3].id
    ]);

    const adjustment2Id = uuidv4();
    const adjustment2No = 'ADJ' + dayjs().format('YYYYMMDD') + '0002';
    run(`
      INSERT INTO price_adjustments (id, adjustment_no, type, title, description, effect_time, expire_time, created_by, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'published')
    `, [
      adjustment2Id, 
      adjustment2No, 
      'regional', 
      '华北区夏季商品调价（待生效）', 
      '华北区门店夏季商品价格调整，明日生效',
      dayjs().add(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
      dayjs().add(30, 'day').format('YYYY-MM-DD HH:mm:ss'),
      users[1].id
    ]);

    const adj2Items = [
      { productId: products[2].id, originalPrice: 9.90, newPrice: 8.90 },
      { productId: products[4].id, originalPrice: 8.50, newPrice: 7.50 },
      { productId: products[8].id, originalPrice: 5.90, newPrice: 4.90 },
    ];

    const adj2ItemIds = [];
    adj2Items.forEach(item => {
      const itemId = uuidv4();
      run(`
        INSERT INTO price_adjustment_items (id, adjustment_id, product_id, original_price, new_price)
        VALUES (?, ?, ?, ?, ?)
      `, [itemId, adjustment2Id, item.productId, item.originalPrice, item.newPrice]);
      adj2ItemIds.push(itemId);
    });

    const westStores = stores.filter(s => s.regionId === regions[1].id);
    westStores.forEach(store => {
      const taskId = uuidv4();
      run(`
        INSERT INTO store_tasks (id, adjustment_id, store_id, status, confirmed_by, confirmed_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [taskId, adjustment2Id, store.id, 'pending', null, null]);
      
      adj2ItemIds.forEach(itemId => {
        run(`
          INSERT INTO task_items (id, store_task_id, adjustment_item_id, status, confirmed_at)
          VALUES (?, ?, ?, ?, ?)
        `, [uuidv4(), taskId, itemId, 'pending', null]);
      });
    });

    const adjustment3Id = uuidv4();
    const adjustment3No = 'ADJ' + dayjs().format('YYYYMMDD') + '0003';
    run(`
      INSERT INTO price_adjustments (id, adjustment_no, type, title, description, effect_time, created_by, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'draft')
    `, [
      adjustment3Id, 
      adjustment3No, 
      'regular', 
      '日用品价格调整（草稿）', 
      '日用品类商品常规价格调整',
      dayjs().add(3, 'day').format('YYYY-MM-DD HH:mm:ss'),
      users[0].id
    ]);

    const adj3Items = [
      { productId: products[6].id, originalPrice: 15.90, newPrice: 14.90 },
      { productId: products[9].id, originalPrice: 29.90, newPrice: 27.90 },
    ];

    const adj3ItemIds = [];
    adj3Items.forEach(item => {
      const itemId = uuidv4();
      run(`
        INSERT INTO price_adjustment_items (id, adjustment_id, product_id, original_price, new_price)
        VALUES (?, ?, ?, ?, ?)
      `, [itemId, adjustment3Id, item.productId, item.originalPrice, item.newPrice]);
      adj3ItemIds.push(itemId);
    });

    stores.forEach(store => {
      const taskId = uuidv4();
      run(`
        INSERT INTO store_tasks (id, adjustment_id, store_id, status, confirmed_by, confirmed_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [taskId, adjustment3Id, store.id, 'pending', null, null]);
      
      adj3ItemIds.forEach(itemId => {
        run(`
          INSERT INTO task_items (id, store_task_id, adjustment_item_id, status, confirmed_at)
          VALUES (?, ?, ?, ?, ?)
        `, [uuidv4(), taskId, itemId, 'pending', null]);
      });
    });

    saveDatabase();

    console.log('\n样例数据生成完成！');
    console.log('\n=== 数据统计 ===');
    console.log(`用户: ${users.length} 个`);
    console.log(`区域: ${regions.length} 个`);
    console.log(`门店: ${stores.length} 个`);
    console.log(`商品: ${products.length} 个`);
    console.log(`调价单: 3 个`);
    console.log(`  - 已发布(促销调价): 1 个`);
    console.log(`  - 已发布(区域调价): 1 个`);
    console.log(`  - 草稿状态: 1 个`);
    console.log(`门店任务: ${stores.length + 3} 个`);
    console.log(`  - 已确认: 1 个`);
    console.log(`  - 待确认: ${stores.length} 个`);
    console.log(`  - 有异常: 1 个`);
    console.log(`异常记录: 1 个（价签缺失）`);
    console.log('\n=== 样例场景 ===');
    console.log('1. 促销调价场景：618促销，东区3家门店，已生效');
    console.log('   - 上海南京东路店：已完成换签确认');
    console.log('   - 上海徐汇店：待确认');
    console.log('   - 杭州西湖店：有异常（价签缺失）');
    console.log('2. 区域调价场景：华北区夏季调价，明日生效，待门店执行');
    console.log('3. 常规调价场景：草稿状态，全部门店');

    process.exit(0);
  } catch (error) {
    console.error('\n数据初始化失败：', error);
    process.exit(1);
  }
};

seed();
