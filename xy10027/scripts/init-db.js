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
  database: process.env.DB_NAME || 'inventory',
});

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

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

    console.log('\n=== Seeding test data for Chain Store Expiry Transfer System ===');
    
    const password = 'password123';
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log(`Password hash generated for "${password}"`);

    await client.query('BEGIN');

    const now = new Date();
    const today = formatDate(now);

    // 1. 创建用户
    console.log('\n--- Creating users ---');
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
        username: 'store_manager',
        email: 'manager@store.com',
        full_name: '门店经理王芳',
        role: 'manager',
        password: hashedPassword
      },
      {
        id: '00000000-0000-0000-0000-000000000003',
        username: 'operator',
        email: 'operator@store.com',
        full_name: '库存操作员李强',
        role: 'operator',
        password: hashedPassword
      }
    ];

    for (const user of users) {
      await client.query(`
        INSERT INTO users (id, username, password, email, full_name, role)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (username) DO NOTHING
      `, [user.id, user.username, user.password, user.email, user.full_name, user.role]);
      console.log(`User ${user.username} (${user.full_name}) created/verified.`);
    }

    // 2. 创建门店
    console.log('\n--- Creating stores ---');
    const stores = [
      {
        id: 'STORE-0001',
        code: 'WH-001',
        name: '总部配送中心',
        type: 'warehouse',
        address: '北京市朝阳区建国路88号',
        phone: '010-88888888',
        manager: '张总',
        created_by: '00000000-0000-0000-0000-000000000001'
      },
      {
        id: 'STORE-0002',
        code: 'ST-001',
        name: '朝阳路旗舰店',
        type: 'store',
        address: '北京市朝阳区朝阳路100号',
        phone: '010-66661001',
        manager: '王店长',
        created_by: '00000000-0000-0000-0000-000000000001'
      },
      {
        id: 'STORE-0003',
        code: 'ST-002',
        name: '海淀区中关村店',
        type: 'store',
        address: '北京市海淀区中关村大街58号',
        phone: '010-66661002',
        manager: '李店长',
        created_by: '00000000-0000-0000-0000-000000000001'
      },
      {
        id: 'STORE-0004',
        code: 'ST-003',
        name: '丰台区方庄店',
        type: 'store',
        address: '北京市丰台区方庄路26号',
        phone: '010-66661003',
        manager: '赵店长',
        created_by: '00000000-0000-0000-0000-000000000001'
      },
      {
        id: 'STORE-0005',
        code: 'ST-004',
        name: '上海市浦东新区店',
        type: 'store',
        address: '上海市浦东新区张江高科128号',
        phone: '021-55552001',
        manager: '陈店长',
        created_by: '00000000-0000-0000-0000-000000000001'
      }
    ];

    for (const store of stores) {
      await client.query(`
        INSERT INTO stores (id, code, name, type, address, phone, manager, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (code) DO NOTHING
      `, [store.id, store.code, store.name, store.type, store.address, store.phone, store.manager, store.created_by]);
      console.log(`Store ${store.code} - ${store.name} created/verified.`);
    }

    // 3. 创建商品
    console.log('\n--- Creating products ---');
    const products = [
      {
        id: 'PROD-0001',
        sku: 'FOOD-001',
        barcode: '6901234567891',
        name: '伊利纯牛奶',
        category: '乳制品',
        spec: '250ml*24盒',
        unit: '箱',
        original_price: 68.00,
        cost_price: 45.00,
        shelflife_days: 180
      },
      {
        id: 'PROD-0002',
        sku: 'FOOD-002',
        barcode: '6901234567892',
        name: '康师傅红烧牛肉面',
        category: '方便食品',
        spec: '105g*24包',
        unit: '箱',
        original_price: 48.00,
        cost_price: 32.00,
        shelflife_days: 180
      },
      {
        id: 'PROD-0003',
        sku: 'FOOD-003',
        barcode: '6901234567893',
        name: '乐事薯片原味',
        category: '休闲食品',
        spec: '104g*20袋',
        unit: '箱',
        original_price: 120.00,
        cost_price: 85.00,
        shelflife_days: 270
      },
      {
        id: 'PROD-0004',
        sku: 'FOOD-004',
        barcode: '6901234567894',
        name: '统一鲜橙多',
        category: '饮料',
        spec: '500ml*24瓶',
        unit: '箱',
        original_price: 72.00,
        cost_price: 48.00,
        shelflife_days: 365
      },
      {
        id: 'PROD-0005',
        sku: 'FOOD-005',
        barcode: '6901234567895',
        name: '海天酱油生抽',
        category: '调味品',
        spec: '500ml*12瓶',
        unit: '箱',
        original_price: 84.00,
        cost_price: 55.00,
        shelflife_days: 540
      },
      {
        id: 'PROD-0006',
        sku: 'FOOD-006',
        barcode: '6901234567896',
        name: '金龙鱼调和油',
        category: '粮油',
        spec: '5L*4桶',
        unit: '箱',
        original_price: 280.00,
        cost_price: 195.00,
        shelflife_days: 540
      },
      {
        id: 'PROD-0007',
        sku: 'FOOD-007',
        barcode: '6901234567897',
        name: '奥利奥原味夹心饼干',
        category: '休闲食品',
        spec: '97g*24盒',
        unit: '箱',
        original_price: 144.00,
        cost_price: 98.00,
        shelflife_days: 270
      },
      {
        id: 'PROD-0008',
        sku: 'FOOD-008',
        barcode: '6901234567898',
        name: '蒙牛酸奶',
        category: '乳制品',
        spec: '100g*24杯',
        unit: '箱',
        original_price: 48.00,
        cost_price: 32.00,
        shelflife_days: 14
      },
      {
        id: 'PROD-0009',
        sku: 'FOOD-009',
        barcode: '6901234567899',
        name: '农夫山泉矿泉水',
        category: '饮料',
        spec: '550ml*24瓶',
        unit: '箱',
        original_price: 36.00,
        cost_price: 24.00,
        shelflife_days: 730
      },
      {
        id: 'PROD-0010',
        sku: 'FOOD-010',
        barcode: '6901234567900',
        name: '双汇火腿肠',
        category: '肉制品',
        spec: '40g*50支',
        unit: '箱',
        original_price: 85.00,
        cost_price: 58.00,
        shelflife_days: 180
      }
    ];

    for (const product of products) {
      await client.query(`
        INSERT INTO products (id, sku, barcode, name, category, spec, unit, original_price, cost_price, shelflife_days)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (sku) DO NOTHING
      `, [product.id, product.sku, product.barcode, product.name, product.category, product.spec, product.unit, product.original_price, product.cost_price, product.shelflife_days]);
      console.log(`Product ${product.sku} - ${product.name} created/verified.`);
    }

    // 4. 创建库存批次（包含正常、临期、过期商品）
    console.log('\n--- Creating inventory batches (with expiry) ---');
    const batches = [
      {
        id: 'BATCH-0001',
        store_id: 'STORE-0001',
        product_id: 'PROD-0001',
        batch_no: '20241001-IL-001',
        quantity: 100,
        available_quantity: 85,
        production_date: formatDate(addDays(now, -60)),
        expiry_date: formatDate(addDays(now, 120)),
        supplier: '伊利集团',
        purchase_price: 45.00
      },
      {
        id: 'BATCH-0002',
        store_id: 'STORE-0001',
        product_id: 'PROD-0002',
        batch_no: '20241005-KS-001',
        quantity: 80,
        available_quantity: 65,
        production_date: formatDate(addDays(now, -90)),
        expiry_date: formatDate(addDays(now, 90)),
        supplier: '康师傅集团',
        purchase_price: 32.00
      },
      {
        id: 'BATCH-0003',
        store_id: 'STORE-0001',
        product_id: 'PROD-0008',
        batch_no: '20241101-MN-001',
        quantity: 50,
        available_quantity: 50,
        production_date: formatDate(addDays(now, -10)),
        expiry_date: formatDate(addDays(now, 4)),
        supplier: '蒙牛集团',
        purchase_price: 32.00
      },
      {
        id: 'BATCH-0004',
        store_id: 'STORE-0001',
        product_id: 'PROD-0008',
        batch_no: '20240901-MN-001',
        quantity: 30,
        available_quantity: 30,
        production_date: formatDate(addDays(now, -60)),
        expiry_date: formatDate(addDays(now, -46)),
        supplier: '蒙牛集团',
        purchase_price: 32.00
      },
      {
        id: 'BATCH-0005',
        store_id: 'STORE-0002',
        product_id: 'PROD-0001',
        batch_no: '20241010-IL-002',
        quantity: 40,
        available_quantity: 30,
        production_date: formatDate(addDays(now, -50)),
        expiry_date: formatDate(addDays(now, 130)),
        supplier: '伊利集团',
        purchase_price: 45.00
      },
      {
        id: 'BATCH-0006',
        store_id: 'STORE-0002',
        product_id: 'PROD-0002',
        batch_no: '20240920-KS-002',
        quantity: 30,
        available_quantity: 25,
        production_date: formatDate(addDays(now, -105)),
        expiry_date: formatDate(addDays(now, 75)),
        supplier: '康师傅集团',
        purchase_price: 32.00
      },
      {
        id: 'BATCH-0007',
        store_id: 'STORE-0002',
        product_id: 'PROD-0003',
        batch_no: '20240715-LS-001',
        quantity: 20,
        available_quantity: 18,
        production_date: formatDate(addDays(now, -170)),
        expiry_date: formatDate(addDays(now, 100)),
        supplier: '百事食品',
        purchase_price: 85.00
      },
      {
        id: 'BATCH-0008',
        store_id: 'STORE-0003',
        product_id: 'PROD-0004',
        batch_no: '20240801-TY-001',
        quantity: 60,
        available_quantity: 55,
        production_date: formatDate(addDays(now, -150)),
        expiry_date: formatDate(addDays(now, 215)),
        supplier: '统一集团',
        purchase_price: 48.00
      },
      {
        id: 'BATCH-0009',
        store_id: 'STORE-0003',
        product_id: 'PROD-0005',
        batch_no: '20240601-HT-001',
        quantity: 45,
        available_quantity: 40,
        production_date: formatDate(addDays(now, -200)),
        expiry_date: formatDate(addDays(now, 340)),
        supplier: '海天味业',
        purchase_price: 55.00
      },
      {
        id: 'BATCH-0010',
        store_id: 'STORE-0004',
        product_id: 'PROD-0006',
        batch_no: '20240915-JL-001',
        quantity: 25,
        available_quantity: 20,
        production_date: formatDate(addDays(now, -75)),
        expiry_date: formatDate(addDays(now, 465)),
        supplier: '益海嘉里',
        purchase_price: 195.00
      },
      {
        id: 'BATCH-0011',
        store_id: 'STORE-0004',
        product_id: 'PROD-0007',
        batch_no: '20241020-AL-001',
        quantity: 35,
        available_quantity: 28,
        production_date: formatDate(addDays(now, -40)),
        expiry_date: formatDate(addDays(now, 230)),
        supplier: '亿滋食品',
        purchase_price: 98.00
      },
      {
        id: 'BATCH-0012',
        store_id: 'STORE-0005',
        product_id: 'PROD-0009',
        batch_no: '20240515-NF-001',
        quantity: 100,
        available_quantity: 80,
        production_date: formatDate(addDays(now, -180)),
        expiry_date: formatDate(addDays(now, 550)),
        supplier: '农夫山泉',
        purchase_price: 24.00
      },
      {
        id: 'BATCH-0013',
        store_id: 'STORE-0005',
        product_id: 'PROD-0010',
        batch_no: '20240820-SH-001',
        quantity: 50,
        available_quantity: 35,
        production_date: formatDate(addDays(now, -100)),
        expiry_date: formatDate(addDays(now, 80)),
        supplier: '双汇集团',
        purchase_price: 58.00
      },
      {
        id: 'BATCH-0014',
        store_id: 'STORE-0005',
        product_id: 'PROD-0008',
        batch_no: '20241025-MN-002',
        quantity: 25,
        available_quantity: 20,
        production_date: formatDate(addDays(now, -12)),
        expiry_date: formatDate(addDays(now, 2)),
        supplier: '蒙牛集团',
        purchase_price: 32.00
      },
      {
        id: 'BATCH-0015',
        store_id: 'STORE-0001',
        product_id: 'PROD-0008',
        batch_no: '20240920-MN-002',
        quantity: 20,
        available_quantity: 20,
        production_date: formatDate(addDays(now, -70)),
        expiry_date: formatDate(addDays(now, -56)),
        supplier: '蒙牛集团',
        purchase_price: 32.00
      }
    ];

    for (const batch of batches) {
      await client.query(`
        INSERT INTO inventory_batches (
          id, store_id, product_id, batch_no, quantity, available_quantity,
          production_date, expiry_date, supplier, purchase_price, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT DO NOTHING
      `, [batch.id, batch.store_id, batch.product_id, batch.batch_no, batch.quantity, batch.available_quantity, batch.production_date, batch.expiry_date, batch.supplier, batch.purchase_price, '00000000-0000-0000-0000-000000000001']);
      console.log(`Batch ${batch.batch_no} created/verified (${batch.expiry_date}).`);
    }

    // 5. 创建调拨单（演示完整流程）
    console.log('\n--- Creating transfer orders (demo workflow) ---');
    const transferOrders = [
      {
        id: 'TO-20241101-001',
        order_no: 'TO-20241101-001',
        from_store_id: 'STORE-0001',
        to_store_id: 'STORE-0002',
        transfer_type: 'normal',
        reason: '门店库存不足补货',
        total_quantity: 15,
        status: 'received',
        created_by: '00000000-0000-0000-0000-000000000003',
        submitted_by: '00000000-0000-0000-0000-000000000003',
        approved_by: '00000000-0000-0000-0000-000000000002',
        shipped_by: '00000000-0000-0000-0000-000000000003',
        received_by: '00000000-0000-0000-0000-000000000003'
      },
      {
        id: 'TO-20241102-002',
        order_no: 'TO-20241102-002',
        from_store_id: 'STORE-0001',
        to_store_id: 'STORE-0003',
        transfer_type: 'urgent',
        reason: '紧急调拨补货',
        total_quantity: 20,
        status: 'shipped',
        created_by: '00000000-0000-0000-0000-000000000003',
        submitted_by: '00000000-0000-0000-0000-000000000003',
        approved_by: '00000000-0000-0000-0000-000000000002',
        shipped_by: '00000000-0000-0000-0000-000000000003'
      },
      {
        id: 'TO-20241103-003',
        order_no: 'TO-20241103-003',
        from_store_id: 'STORE-0002',
        to_store_id: 'STORE-0004',
        transfer_type: 'normal',
        reason: '门店间调配',
        total_quantity: 10,
        status: 'submitted',
        created_by: '00000000-0000-0000-0000-000000000003',
        submitted_by: '00000000-0000-0000-0000-000000000003'
      },
      {
        id: 'TO-20241104-004',
        order_no: 'TO-20241104-004',
        from_store_id: 'STORE-0001',
        to_store_id: 'STORE-0005',
        transfer_type: 'normal',
        reason: '新店开业备货',
        total_quantity: 30,
        status: 'draft',
        created_by: '00000000-0000-0000-0000-000000000003'
      }
    ];

    for (const order of transferOrders) {
      await client.query(`
        INSERT INTO transfer_orders (
          id, order_no, from_store_id, to_store_id, transfer_type, reason,
          total_quantity, status, created_by, submitted_by, approved_by,
          shipped_by, received_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT DO NOTHING
      `, [
        order.id, order.order_no, order.from_store_id, order.to_store_id,
        order.transfer_type, order.reason, order.total_quantity, order.status,
        order.created_by, order.submitted_by, order.approved_by,
        order.shipped_by, order.received_by
      ]);
      console.log(`Transfer Order ${order.order_no} created/verified (status: ${order.status}).`);
    }

    // 6. 创建调拨单明细
    console.log('\n--- Creating transfer order items ---');
    const transferItems = [
      {
        order_id: 'TO-20241101-001',
        batch_id: 'BATCH-0001',
        product_id: 'PROD-0001',
        requested_quantity: 10,
        shipped_quantity: 10,
        received_quantity: 10,
        rejected_quantity: 0
      },
      {
        order_id: 'TO-20241101-001',
        batch_id: 'BATCH-0002',
        product_id: 'PROD-0002',
        requested_quantity: 5,
        shipped_quantity: 5,
        received_quantity: 5,
        rejected_quantity: 0
      },
      {
        order_id: 'TO-20241102-002',
        batch_id: 'BATCH-0001',
        product_id: 'PROD-0001',
        requested_quantity: 10,
        shipped_quantity: 10
      },
      {
        order_id: 'TO-20241102-002',
        batch_id: 'BATCH-0004',
        product_id: 'PROD-0008',
        requested_quantity: 10,
        shipped_quantity: 10
      },
      {
        order_id: 'TO-20241103-003',
        batch_id: 'BATCH-0007',
        product_id: 'PROD-0003',
        requested_quantity: 10
      },
      {
        order_id: 'TO-20241104-004',
        batch_id: 'BATCH-0012',
        product_id: 'PROD-0009',
        requested_quantity: 20
      },
      {
        order_id: 'TO-20241104-004',
        batch_id: 'BATCH-0013',
        product_id: 'PROD-0010',
        requested_quantity: 10
      }
    ];

    for (let i = 0; i < transferItems.length; i++) {
      const item = transferItems[i];
      await client.query(`
        INSERT INTO transfer_order_items (
          id, order_id, batch_id, product_id, requested_quantity,
          shipped_quantity, received_quantity, rejected_quantity
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT DO NOTHING
      `, [
        `TOI-${String(i + 1).padStart(6, '0')}`,
        item.order_id, item.batch_id, item.product_id, item.requested_quantity,
        item.shipped_quantity, item.received_quantity, item.rejected_quantity
      ]);
      console.log(`Transfer item for ${item.order_id} created.`);
    }

    // 7. 创建折扣活动
    console.log('\n--- Creating discount sales (expiry promotions) ---');
    const discountSales = [
      {
        id: 'DS-20241101-001',
        sale_no: 'DS-20241101-001',
        store_id: 'STORE-0002',
        name: '酸奶临期促销',
        description: '临期酸奶7折优惠',
        discount_type: 'percentage',
        discount_value: 30,
        start_date: formatDate(addDays(now, -2)),
        end_date: formatDate(addDays(now, 5)),
        status: 'active',
        created_by: '00000000-0000-0000-0000-000000000002'
      },
      {
        id: 'DS-20241101-002',
        sale_no: 'DS-20241101-002',
        store_id: 'STORE-0005',
        name: '紧急临期折扣',
        description: '即将过期商品特惠',
        discount_type: 'percentage',
        discount_value: 50,
        start_date: formatDate(addDays(now, -1)),
        end_date: formatDate(addDays(now, 3)),
        status: 'active',
        created_by: '00000000-0000-0000-0000-000000000002'
      },
      {
        id: 'DS-20241101-003',
        sale_no: 'DS-20241101-003',
        store_id: 'STORE-0003',
        name: '周末促销',
        description: '周末全场8折',
        discount_type: 'percentage',
        discount_value: 20,
        start_date: formatDate(addDays(now, -7)),
        end_date: formatDate(addDays(now, -5)),
        status: 'inactive',
        created_by: '00000000-0000-0000-0000-000000000002'
      }
    ];

    for (const sale of discountSales) {
      await client.query(`
        INSERT INTO discount_sales (
          id, sale_no, store_id, name, description, discount_type,
          discount_value, start_date, end_date, status, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT DO NOTHING
      `, [
        sale.id, sale.sale_no, sale.store_id, sale.name, sale.description,
        sale.discount_type, sale.discount_value, sale.start_date,
        sale.end_date, sale.status, sale.created_by
      ]);
      console.log(`Discount Sale ${sale.sale_no} created/verified.`);
    }

    // 8. 创建折扣活动明细
    const discountItems = [
      {
        sale_id: 'DS-20241101-001',
        product_id: 'PROD-0008',
        batch_id: 'BATCH-0003',
        discount_price: 33.60
      },
      {
        sale_id: 'DS-20241101-002',
        product_id: 'PROD-0008',
        batch_id: 'BATCH-0014',
        discount_price: 24.00
      },
      {
        sale_id: 'DS-20241101-003',
        product_id: 'PROD-0003',
        batch_id: 'BATCH-0007',
        discount_price: 68.00
      }
    ];

    for (let i = 0; i < discountItems.length; i++) {
      const item = discountItems[i];
      await client.query(`
        INSERT INTO discount_sale_items (
          id, sale_id, product_id, batch_id, discount_price
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT DO NOTHING
      `, [`DSI-${String(i + 1).padStart(6, '0')}`, item.sale_id, item.product_id, item.batch_id, item.discount_price]);
      console.log(`Discount item created.`);
    }

    // 9. 创建报损单
    console.log('\n--- Creating damage reports ---');
    const damageReports = [
      {
        id: 'DR-20241101-001',
        report_no: 'DR-20241101-001',
        store_id: 'STORE-0001',
        damage_type: 'expired',
        reason: '商品过期无法销售',
        total_quantity: 20,
        total_amount: 640.00,
        status: 'processed',
        approved_status: 'approved',
        created_by: '00000000-0000-0000-0000-000000000003',
        submitted_by: '00000000-0000-0000-0000-000000000003',
        approved_by: '00000000-0000-0000-0000-000000000002'
      },
      {
        id: 'DR-20241101-002',
        report_no: 'DR-20241101-002',
        store_id: 'STORE-0002',
        damage_type: 'damaged',
        reason: '运输包装破损',
        total_quantity: 2,
        total_amount: 68.00,
        status: 'submitted',
        approved_status: 'pending',
        created_by: '00000000-0000-0000-0000-000000000003',
        submitted_by: '00000000-0000-0000-0000-000000000003'
      },
      {
        id: 'DR-20241101-003',
        report_no: 'DR-20241101-003',
        store_id: 'STORE-0003',
        damage_type: 'quality',
        reason: '商品变质',
        total_quantity: 5,
        total_amount: 240.00,
        status: 'pending',
        approved_status: 'pending',
        created_by: '00000000-0000-0000-0000-000000000003'
      }
    ];

    for (const report of damageReports) {
      await client.query(`
        INSERT INTO damage_reports (
          id, report_no, store_id, damage_type, reason, total_quantity,
          total_amount, status, approved_status, created_by, submitted_by, approved_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT DO NOTHING
      `, [
        report.id, report.report_no, report.store_id, report.damage_type,
        report.reason, report.total_quantity, report.total_amount,
        report.status, report.approved_status, report.created_by,
        report.submitted_by, report.approved_by
      ]);
      console.log(`Damage Report ${report.report_no} created/verified.`);
    }

    // 10. 创建报损明细
    const damageItems = [
      {
        report_id: 'DR-20241101-001',
        product_id: 'PROD-0008',
        batch_id: 'BATCH-0015',
        quantity: 20,
        unit_price: 32.00,
        total_price: 640.00
      },
      {
        report_id: 'DR-20241101-002',
        product_id: 'PROD-0001',
        batch_id: 'BATCH-0005',
        quantity: 1,
        unit_price: 68.00,
        total_price: 68.00
      },
      {
        report_id: 'DR-20241101-003',
        product_id: 'PROD-0004',
        batch_id: 'BATCH-0008',
        quantity: 5,
        unit_price: 48.00,
        total_price: 240.00
      }
    ];

    for (let i = 0; i < damageItems.length; i++) {
      const item = damageItems[i];
      await client.query(`
        INSERT INTO damage_report_items (
          id, report_id, product_id, batch_id, quantity, unit_price, total_price
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT DO NOTHING
      `, [`DRI-${String(i + 1).padStart(6, '0')}`, item.report_id, item.product_id, item.batch_id, item.quantity, item.unit_price, item.total_price]);
      console.log(`Damage item created.`);
    }

    // 11. 手动更新库存汇总
    console.log('\n--- Updating store inventory summary ---');
    await client.query(`
      INSERT INTO store_inventory (store_id, product_id, total_quantity, available_quantity, locked_quantity, expiring_soon_quantity, expired_quantity)
      SELECT 
        ib.store_id,
        ib.product_id,
        SUM(ib.quantity) as total_quantity,
        SUM(ib.available_quantity) as available_quantity,
        0 as locked_quantity,
        SUM(CASE WHEN ib.status = 'expiring_soon' THEN ib.available_quantity ELSE 0 END) as expiring_soon_quantity,
        SUM(CASE WHEN ib.status = 'expired' THEN ib.available_quantity ELSE 0 END) as expired_quantity
      FROM inventory_batches ib
      GROUP BY ib.store_id, ib.product_id
      ON CONFLICT (store_id, product_id) DO UPDATE SET
        total_quantity = EXCLUDED.total_quantity,
        available_quantity = EXCLUDED.available_quantity,
        expiring_soon_quantity = EXCLUDED.expiring_soon_quantity,
        expired_quantity = EXCLUDED.expired_quantity
    `);
    console.log('Store inventory summary updated.');

    await client.query('COMMIT');

    console.log('\n=== Database initialization completed successfully! ===');
    console.log('\nTest credentials:');
    console.log('  Username: admin       Password: password123  (系统管理员)');
    console.log('  Username: store_manager  Password: password123  (门店经理)');
    console.log('  Username: operator    Password: password123  (库存操作员)');
    console.log('\nDemo Data:');
    console.log('  - 5 stores (1 warehouse + 4 retail stores)');
    console.log('  - 10 products (dairy, snacks, beverages, etc.)');
    console.log('  - 15 batches (normal, expiring, expired)');
    console.log('  - 4 transfer orders (different statuses)');
    console.log('  - 3 discount sales (active/inactive)');
    console.log('  - 3 damage reports (processed/pending)');
    console.log('\nKey business scenarios to test:');
    console.log('  1. View expiring products (临期预警)');
    console.log('  2. Create/approve transfer orders (调拨审批)');
    console.log('  3. Confirm receiving (收货确认)');
    console.log('  4. Create damage reports (报损审核)');
    console.log('  5. Create discount sales for expiring items (折扣售卖)');
    console.log('  6. View audit trail and rollback operations (审计追踪和回滚)');

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
