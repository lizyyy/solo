const db = require('./index');
const { v4: uuidv4 } = require('uuid');

const seedData = () => {
  db.serialize(() => {
    db.run('DELETE FROM replacements');
    db.run('DELETE FROM order_items');
    db.run('DELETE FROM orders');
    db.run('DELETE FROM products');
    db.run('DELETE FROM pickup_slots');

    const pickupSlots = [
      { id: uuidv4(), slot_time: '周六 09:00-10:00', description: '周六上午第一批', is_active: 1 },
      { id: uuidv4(), slot_time: '周六 10:00-11:00', description: '周六上午第二批', is_active: 1 },
      { id: uuidv4(), slot_time: '周六 16:00-17:00', description: '周六下午第一批', is_active: 1 },
      { id: uuidv4(), slot_time: '周六 17:00-18:00', description: '周六下午第二批', is_active: 1 },
      { id: uuidv4(), slot_time: '周日 09:00-10:00', description: '周日上午第一批', is_active: 1 },
      { id: uuidv4(), slot_time: '周日 10:00-11:00', description: '周日上午第二批', is_active: 1 },
    ];

    const slotStmt = db.prepare('INSERT INTO pickup_slots (id, slot_time, description, is_active) VALUES (?, ?, ?, ?)');
    pickupSlots.forEach(slot => {
      slotStmt.run(slot.id, slot.slot_time, slot.description, slot.is_active);
    });
    slotStmt.finalize();

    const products = [
      { id: uuidv4(), name: '新鲜草莓', price: 28.0, unit: '盒/500g', category: '水果', stock_quantity: 50, is_available: 1, description: '本地大棚新鲜草莓，香甜多汁' },
      { id: uuidv4(), name: '赣南脐橙', price: 15.0, unit: '斤', category: '水果', stock_quantity: 100, is_available: 1, description: '正宗赣南脐橙，皮薄肉甜' },
      { id: uuidv4(), name: '土鸡蛋', price: 25.0, unit: '盒/30个', category: '禽蛋', stock_quantity: 30, is_available: 1, description: '农家散养土鸡蛋' },
      { id: uuidv4(), name: '有机青菜', price: 8.0, unit: '斤', category: '蔬菜', stock_quantity: 40, is_available: 1, description: '有机种植，无农药残留' },
      { id: uuidv4(), name: '本地猪肉', price: 35.0, unit: '斤', category: '肉类', stock_quantity: 20, is_available: 1, description: '当日现杀本地猪肉' },
      { id: uuidv4(), name: '深海带鱼', price: 45.0, unit: '斤', category: '海鲜', stock_quantity: 15, is_available: 1, description: '新鲜冷冻深海带鱼' },
      { id: uuidv4(), name: '东北大米', price: 3.5, unit: '斤', category: '粮油', stock_quantity: 200, is_available: 1, description: '正宗东北五常大米' },
      { id: uuidv4(), name: '农家蜂蜜', price: 58.0, unit: '瓶/500g', category: '其他', stock_quantity: 25, is_available: 1, description: '纯天然农家百花蜜' },
      { id: uuidv4(), name: '替代水果A', price: 20.0, unit: '斤', category: '水果', stock_quantity: 100, is_available: 1, description: '可作为草莓缺货时的替代商品' },
    ];

    const productStmt = db.prepare('INSERT INTO products (id, name, price, unit, category, stock_quantity, is_available, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    products.forEach(product => {
      productStmt.run(
        product.id, 
        product.name, 
        product.price, 
        product.unit, 
        product.category, 
        product.stock_quantity, 
        product.is_available, 
        product.description
      );
    });
    productStmt.finalize();

    const orders = [
      {
        id: uuidv4(),
        user_name: '张阿姨',
        user_phone: '13800138001',
        pickup_time: '周六 09:00-10:00',
        total_amount: 0,
        status: 'pending',
        notes: '草莓要熟透的'
      },
      {
        id: uuidv4(),
        user_name: '李叔叔',
        user_phone: '13800138002',
        pickup_time: '周六 10:00-11:00',
        total_amount: 0,
        status: 'pending',
        notes: '猪肉要瘦一点的'
      },
      {
        id: uuidv4(),
        user_name: '王大姐',
        user_phone: '13800138003',
        pickup_time: '周六 16:00-17:00',
        total_amount: 0,
        status: 'needs_replacement',
        notes: '鸡蛋要最新鲜的'
      }
    ];

    const orderStmt = db.prepare('INSERT INTO orders (id, user_name, user_phone, pickup_time, total_amount, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const orderItemStmt = db.prepare('INSERT INTO order_items (id, order_id, product_id, product_name, price, quantity, subtotal, replacement_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    const replacementStmt = db.prepare('INSERT INTO replacements (id, order_item_id, original_product_id, original_product_name, suggested_product_id, suggested_product_name, price_difference, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');

    let totalOrderAmount1 = 0;
    let totalOrderAmount2 = 0;
    let totalOrderAmount3 = 0;

    const order1Items = [
      { productId: products[0].id, productName: products[0].name, price: products[0].price, quantity: 2, replacementStatus: 'none' },
      { productId: products[2].id, productName: products[2].name, price: products[2].price, quantity: 1, replacementStatus: 'none' },
      { productId: products[3].id, productName: products[3].name, price: products[3].price, quantity: 3, replacementStatus: 'none' },
    ];

    order1Items.forEach(item => {
      const subtotal = item.price * item.quantity;
      totalOrderAmount1 += subtotal;
      orderItemStmt.run(uuidv4(), orders[0].id, item.productId, item.productName, item.price, item.quantity, subtotal, item.replacementStatus);
    });

    const order2Items = [
      { productId: products[1].id, productName: products[1].name, price: products[1].price, quantity: 5, replacementStatus: 'none' },
      { productId: products[4].id, productName: products[4].name, price: products[4].price, quantity: 2, replacementStatus: 'none' },
      { productId: products[6].id, productName: products[6].name, price: products[6].price, quantity: 10, replacementStatus: 'none' },
    ];

    order2Items.forEach(item => {
      const subtotal = item.price * item.quantity;
      totalOrderAmount2 += subtotal;
      orderItemStmt.run(uuidv4(), orders[1].id, item.productId, item.productName, item.price, item.quantity, subtotal, item.replacementStatus);
    });

    const order3Items = [
      { productId: products[0].id, productName: products[0].name, price: products[0].price, quantity: 1, replacementStatus: 'pending' },
      { productId: products[2].id, productName: products[2].name, price: products[2].price, quantity: 1, replacementStatus: 'none' },
    ];

    let order3Item1Id = null;
    order3Items.forEach(item => {
      const subtotal = item.price * item.quantity;
      totalOrderAmount3 += subtotal;
      const itemId = uuidv4();
      if (item.productId === products[0].id) {
        order3Item1Id = itemId;
      }
      orderItemStmt.run(itemId, orders[2].id, item.productId, item.productName, item.price, item.quantity, subtotal, item.replacementStatus);
    });

    if (order3Item1Id) {
      replacementStmt.run(
        uuidv4(),
        order3Item1Id,
        products[0].id,
        products[0].name,
        products[8].id,
        products[8].name,
        products[8].price - products[0].price,
        '草莓临时缺货，推荐替代水果A，差价8元/斤'
      );
    }

    orderStmt.run(orders[0].id, orders[0].user_name, orders[0].user_phone, orders[0].pickup_time, totalOrderAmount1, orders[0].status, orders[0].notes);
    orderStmt.run(orders[1].id, orders[1].user_name, orders[1].user_phone, orders[1].pickup_time, totalOrderAmount2, orders[1].status, orders[1].notes);
    orderStmt.run(orders[2].id, orders[2].user_name, orders[2].user_phone, orders[2].pickup_time, totalOrderAmount3, orders[2].status, orders[2].notes);

    orderStmt.finalize();
    orderItemStmt.finalize();
    replacementStmt.finalize();

    console.log('示例数据已成功导入！');
    console.log('已创建:');
    console.log(`  - ${pickupSlots.length} 个取货时间段`);
    console.log(`  - ${products.length} 个商品`);
    console.log(`  - ${orders.length} 个订单`);
    console.log(`  - 1 个缺货替换示例`);
  });

  db.close();
};

seedData();
