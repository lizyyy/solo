require('dotenv').config();

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'warehouse_inventory',
});

async function initDatabase() {
  let client;
  try {
    console.log('Connecting to database...');
    client = await pool.connect();
    console.log('Connected to database.');

    console.log('\n=== Creating database schema ===');
    const schemaPath = path.join(__dirname, '../server/database/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await client.query(schemaSql);
    console.log('Schema created successfully.');

    console.log('\n=== Seeding test data ===');
    
    const password = 'password123';
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log(`Password hash generated for "${password}"`);

    await client.query('BEGIN');

    const users = [
      {
        id: '00000000-0000-0000-0000-000000000001',
        username: 'admin',
        email: 'admin@example.com',
        full_name: '系统管理员',
        role: 'admin',
        password: hashedPassword
      },
      {
        id: '00000000-0000-0000-0000-000000000002',
        username: 'user1',
        email: 'user1@example.com',
        full_name: '盘点员张三',
        role: 'user',
        password: hashedPassword
      },
      {
        id: '00000000-0000-0000-0000-000000000003',
        username: 'user2',
        email: 'user2@example.com',
        full_name: '盘点员李四',
        role: 'user',
        password: hashedPassword
      }
    ];

    for (const user of users) {
      await client.query(`
        INSERT INTO users (id, username, password, email, full_name, role)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (username) DO NOTHING
      `, [user.id, user.username, user.password, user.email, user.full_name, user.role]);
      console.log(`User ${user.username} created/verified.`);
    }

    const warehouses = [
      {
        id: '10000000-0000-0000-0000-000000000001',
        name: '主仓库A',
        location: '北京市朝阳区建国路88号',
        description: '公司主要存储仓库',
        created_by: '00000000-0000-0000-0000-000000000001'
      },
      {
        id: '10000000-0000-0000-0000-000000000002',
        name: '分仓库B',
        location: '上海市浦东新区张江高科',
        description: '华东地区分发中心',
        created_by: '00000000-0000-0000-0000-000000000001'
      }
    ];

    for (const warehouse of warehouses) {
      await client.query(`
        INSERT INTO warehouses (id, name, location, description, created_by)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT DO NOTHING
      `, [warehouse.id, warehouse.name, warehouse.location, warehouse.description, warehouse.created_by]);
      console.log(`Warehouse ${warehouse.name} created/verified.`);
    }

    const items = [
      { id: '20000000-0000-0000-0000-000000000001', sku: 'SKU001', name: '笔记本电脑', description: '15.6寸商务笔记本', category: '电子产品', unit: '台', min: 10, max: 100, quantity: 45 },
      { id: '20000000-0000-0000-0000-000000000002', sku: 'SKU002', name: '无线鼠标', description: '蓝牙无线办公鼠标', category: '电子产品', unit: '个', min: 50, max: 500, quantity: 234 },
      { id: '20000000-0000-0000-0000-000000000003', sku: 'SKU003', name: '机械键盘', description: '青轴机械键盘', category: '电子产品', unit: '个', min: 20, max: 200, quantity: 89 },
      { id: '20000000-0000-0000-0000-000000000004', sku: 'SKU004', name: '显示器', description: '27寸4K显示器', category: '电子产品', unit: '台', min: 15, max: 150, quantity: 56 },
      { id: '20000000-0000-0000-0000-000000000005', sku: 'SKU005', name: 'USB集线器', description: '4口USB3.0集线器', category: '电子产品', unit: '个', min: 100, max: 1000, quantity: 567 }
    ];

    const locationCodes = ['A-01-01', 'A-01-02', 'A-02-01', 'A-02-02', 'A-03-01'];
    const warehouseId = '10000000-0000-0000-0000-000000000001';

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      await client.query(`
        INSERT INTO inventory_items (id, sku, name, description, category, unit, min_stock_level, max_stock_level)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (sku) DO NOTHING
      `, [item.id, item.sku, item.name, item.description, item.category, item.unit, item.min, item.max]);

      await client.query(`
        INSERT INTO inventory_locations (warehouse_id, item_id, location_code, quantity)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT DO NOTHING
      `, [warehouseId, item.id, locationCodes[i], item.quantity]);
      
      console.log(`Item ${item.sku} created/verified.`);
    }

    const today = new Date().toISOString().split('T')[0];
    const taskId = '30000000-0000-0000-0000-000000000001';

    await client.query(`
      INSERT INTO inventory_tasks (
        id, warehouse_id, name, description, status, priority,
        created_by, assigned_to, scheduled_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT DO NOTHING
    `, [
      taskId,
      warehouseId,
      '2024年11月月度盘点',
      '主仓库A月度例行盘点',
      'pending',
      'high',
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000002',
      today
    ]);
    console.log('Inventory task created/verified.');

    for (const item of items) {
      await client.query(`
        INSERT INTO inventory_task_items (task_id, item_id, expected_quantity, status)
        VALUES ($1, $2, $3, 'pending')
        ON CONFLICT DO NOTHING
      `, [taskId, item.id, item.quantity]);
    }
    console.log('Task items created/verified.');

    await client.query('COMMIT');

    console.log('\n=== Database initialization completed successfully! ===');
    console.log('\nTest credentials:');
    console.log('  Username: admin');
    console.log('  Password: password123');
    console.log('\n  Username: user1');
    console.log('  Password: password123');

  } catch (error) {
    console.error('\nError initializing database:', error);
    if (client) {
      await client.query('ROLLBACK');
    }
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

initDatabase();
