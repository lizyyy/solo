const { sequelize, Product, GroupBatch, Order, OrderItem, InventoryBatch, Freezer, PickupSlot, Exception, InventoryAllocation } = require('../models');
const dayjs = require('dayjs');

const today = dayjs();
const tomorrow = today.add(1, 'day');
const yesterday = today.subtract(1, 'day');
const nextWeek = today.add(7, 'day');
const dayAfterTomorrow = today.add(2, 'day');

const generateOrderNo = () => `ORD${today.format('YYYYMMDD')}${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
const generateBatchNo = () => `BATCH${today.format('YYYYMMDD')}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
const generatePickupCode = () => String(Math.floor(100000 + Math.random() * 900000));

const seedDatabase = async () => {
  console.log('开始插入种子数据...');

  await Freezer.bulkCreate([
    { name: '冷藏柜A', code: 'FREEZER-001', type: 'refrigerated', capacity: 50, used_capacity: 45, location: '客厅左侧', status: 'active', note: '主要存放酸奶和水果' },
    { name: '冷冻柜B', code: 'FREEZER-002', type: 'frozen', capacity: 40, used_capacity: 38, location: '阳台', status: 'active', note: '存放冷冻肉类，容量紧张' },
    { name: '冷藏备用柜', code: 'FREEZER-003', type: 'refrigerated', capacity: 30, used_capacity: 5, location: '厨房', status: 'active', note: '备用柜，容量充足' }
  ]);

  const products = await Product.bulkCreate([
    { name: '蒙牛纯甄酸奶', sku: 'SKU001', category: 'yogurt', unit: '盒', price: 8.5, storage_temp: 'refrigerated', shelf_life_days: 21, description: '200ml/盒，原味' },
    { name: '安慕希希腊酸奶', sku: 'SKU002', category: 'yogurt', unit: '盒', price: 12.0, storage_temp: 'refrigerated', shelf_life_days: 180, description: '205g/盒，高端希腊风味' },
    { name: '鲜切西瓜盒', sku: 'SKU003', category: 'fresh_fruit', unit: '盒', price: 15.0, storage_temp: 'refrigerated', shelf_life_days: 1, description: '500g/盒，现切现卖' },
    { name: '鲜切哈密瓜', sku: 'SKU004', category: 'fresh_fruit', unit: '盒', price: 18.0, storage_temp: 'refrigerated', shelf_life_days: 1, description: '500g/盒，甜蜜多汁' },
    { name: '巴西进口牛腩', sku: 'SKU005', category: 'frozen_meat', unit: '斤', price: 45.0, storage_temp: 'frozen', shelf_life_days: 180, description: '500g/份，进口原切' },
    { name: '澳洲羊排', sku: 'SKU006', category: 'frozen_meat', unit: '斤', price: 68.0, storage_temp: 'frozen', shelf_life_days: 180, description: '500g/份，新鲜冷冻' }
  ], { returning: true });

  const productMap = products.reduce((map, p) => { map[p.sku] = p; return map; }, {});

  const groupBatch = await GroupBatch.create({
    batch_no: generateBatchNo(),
    name: '周末特惠团购',
    start_time: yesterday.toDate(),
    end_time: tomorrow.toDate(),
    delivery_date: dayAfterTomorrow.format('YYYY-MM-DD'),
    status: 'active',
    description: '本周末酸奶、水果、肉类特惠团购'
  });

  const pickupSlots = await PickupSlot.bulkCreate([
    { group_batch_id: groupBatch.id, date: dayAfterTomorrow.format('YYYY-MM-DD'), start_time: '09:00', end_time: '10:00', max_orders: 5, current_orders: 5, status: 'full' },
    { group_batch_id: groupBatch.id, date: dayAfterTomorrow.format('YYYY-MM-DD'), start_time: '10:00', end_time: '11:00', max_orders: 8, current_orders: 3, status: 'available' },
    { group_batch_id: groupBatch.id, date: dayAfterTomorrow.format('YYYY-MM-DD'), start_time: '11:00', end_time: '12:00', max_orders: 8, current_orders: 2, status: 'available' },
    { group_batch_id: groupBatch.id, date: dayAfterTomorrow.format('YYYY-MM-DD'), start_time: '14:00', end_time: '15:00', max_orders: 8, current_orders: 4, status: 'available' },
    { group_batch_id: groupBatch.id, date: dayAfterTomorrow.format('YYYY-MM-DD'), start_time: '15:00', end_time: '16:00', max_orders: 8, current_orders: 1, status: 'available' }
  ], { returning: true });

  const freezers = await Freezer.findAll();
  const freezerMap = freezers.reduce((map, f) => { map[f.code] = f; return map; }, {});

  const inventoryBatches = await InventoryBatch.bulkCreate([
    {
      batch_no: `INV${today.format('YYYYMMDD')}001`,
      product_id: productMap['SKU001'].id,
      group_batch_id: groupBatch.id,
      supplier_name: '蒙牛乳业',
      supplier_batch_no: 'MN20260425',
      production_date: today.subtract(18, 'day').format('YYYY-MM-DD'),
      expiry_date: today.add(3, 'day').format('YYYY-MM-DD'),
      quantity: 15,
      allocated_quantity: 12,
      picked_quantity: 0,
      freezer_id: freezerMap['FREEZER-001'].id,
      freezer_unit: '盒',
      status: 'partial_allocated',
      note: '⚠️ 临期批次，仅剩3天保质期，需优先分配'
    },
    {
      batch_no: `INV${today.format('YYYYMMDD')}002`,
      product_id: productMap['SKU001'].id,
      group_batch_id: groupBatch.id,
      supplier_name: '蒙牛乳业',
      supplier_batch_no: 'MN20260428',
      production_date: today.subtract(6, 'day').format('YYYY-MM-DD'),
      expiry_date: today.add(15, 'day').format('YYYY-MM-DD'),
      quantity: 20,
      allocated_quantity: 5,
      picked_quantity: 0,
      freezer_id: freezerMap['FREEZER-001'].id,
      freezer_unit: '盒',
      status: 'partial_allocated',
      note: '新鲜批次，保质期充足'
    },
    {
      batch_no: `INV${today.format('YYYYMMDD')}003`,
      product_id: productMap['SKU002'].id,
      group_batch_id: groupBatch.id,
      supplier_name: '伊利集团',
      supplier_batch_no: 'YL20260420',
      production_date: today.subtract(14, 'day').format('YYYY-MM-DD'),
      expiry_date: today.add(166, 'day').format('YYYY-MM-DD'),
      quantity: 10,
      allocated_quantity: 8,
      picked_quantity: 0,
      freezer_id: freezerMap['FREEZER-001'].id,
      freezer_unit: '盒',
      status: 'partial_allocated'
    },
    {
      batch_no: `INV${today.format('YYYYMMDD')}004`,
      product_id: productMap['SKU003'].id,
      group_batch_id: groupBatch.id,
      supplier_name: '本地水果供应商',
      supplier_batch_no: 'FRUIT20260503',
      production_date: today.format('YYYY-MM-DD'),
      expiry_date: tomorrow.format('YYYY-MM-DD'),
      quantity: 8,
      allocated_quantity: 6,
      picked_quantity: 0,
      freezer_id: freezerMap['FREEZER-001'].id,
      freezer_unit: '盒',
      status: 'partial_allocated',
      note: '鲜切水果，当天必须送出'
    },
    {
      batch_no: `INV${today.format('YYYYMMDD')}005`,
      product_id: productMap['SKU005'].id,
      group_batch_id: groupBatch.id,
      supplier_name: '进口肉类批发',
      supplier_batch_no: 'MEAT20260415',
      production_date: today.subtract(19, 'day').format('YYYY-MM-DD'),
      expiry_date: today.add(161, 'day').format('YYYY-MM-DD'),
      quantity: 5,
      allocated_quantity: 5,
      picked_quantity: 0,
      freezer_id: freezerMap['FREEZER-002'].id,
      freezer_unit: '斤',
      status: 'allocated',
      note: '冷冻柜已满，新到货无法存放'
    },
    {
      batch_no: `INV${today.format('YYYYMMDD')}006`,
      product_id: productMap['SKU006'].id,
      group_batch_id: groupBatch.id,
      supplier_name: '进口肉类批发',
      supplier_batch_no: 'MEAT20260420',
      production_date: today.subtract(14, 'day').format('YYYY-MM-DD'),
      expiry_date: today.add(166, 'day').format('YYYY-MM-DD'),
      quantity: 3,
      allocated_quantity: 0,
      picked_quantity: 0,
      freezer_id: null,
      freezer_unit: '斤',
      status: 'in_stock',
      note: '⚠️ 冰柜容量不足，暂未入库'
    }
  ], { returning: true });

  const inventoryMap = inventoryBatches.reduce((map, inv) => {
    if (!map[inv.product_id]) map[inv.product_id] = [];
    map[inv.product_id].push(inv);
    return map;
  }, {});

  const ordersData = [
    {
      customer_name: '张阿姨',
      customer_phone: '13800138001',
      customer_address: '1栋101室',
      items: [
        { sku: 'SKU001', quantity: 3, note: '要新鲜日期的' },
        { sku: 'SKU003', quantity: 2 }
      ],
      slotIndex: 0,
      status: 'paid',
      note: '老顾客，每次都很准时'
    },
    {
      customer_name: '李叔叔',
      customer_phone: '13800138002',
      customer_address: '2栋202室',
      items: [
        { sku: 'SKU001', quantity: 5, note: '家人多，要得多' },
        { sku: 'SKU002', quantity: 2 },
        { sku: 'SKU005', quantity: 2 }
      ],
      slotIndex: 0,
      status: 'paid',
      note: '订单较大，注意核对'
    },
    {
      customer_name: '王女士',
      customer_phone: '13800138003',
      customer_address: '1栋303室',
      items: [
        { sku: 'SKU001', quantity: 4 },
        { sku: 'SKU005', quantity: 3, note: '周末炖汤用' }
      ],
      slotIndex: 0,
      status: 'paid',
      note: '牛肉订了3斤，但库存只有5斤，李叔叔订了2斤，刚好够'
    },
    {
      customer_name: '刘先生',
      customer_phone: '13800138004',
      customer_address: '3栋404室',
      items: [
        { sku: 'SKU002', quantity: 6, note: '公司福利，帮同事带的' },
        { sku: 'SKU004', quantity: 3 }
      ],
      slotIndex: 0,
      status: 'paid',
      note: '⚠️ 安慕希库存只有10盒，已分配8盒，刘先生订6盒，只能部分满足！'
    },
    {
      customer_name: '陈阿姨',
      customer_phone: '13800138005',
      customer_address: '2栋105室',
      items: [
        { sku: 'SKU001', quantity: 2 },
        { sku: 'SKU003', quantity: 3 }
      ],
      slotIndex: 0,
      status: 'paid',
      note: '这个时段第5个订单，时段已满'
    },
    {
      customer_name: '赵女士',
      customer_phone: '13800138006',
      customer_address: '1栋206室',
      items: [
        { sku: 'SKU001', quantity: 3 },
        { sku: 'SKU005', quantity: 1 }
      ],
      slotIndex: 1,
      status: 'paid',
      note: '第二时段订单'
    },
    {
      customer_name: '孙叔叔',
      customer_phone: '13800138007',
      customer_address: '3栋107室',
      items: [
        { sku: 'SKU006', quantity: 2, note: '羊排，但冰柜已满，无法入库' }
      ],
      slotIndex: 2,
      status: 'paid',
      note: '⚠️ 羊排订了2斤，但库存只有3斤且未入库（冰柜已满），需要处理冰柜容量问题'
    }
  ];

  for (const orderData of ordersData) {
    let totalAmount = 0;
    const orderItems = [];

    for (const item of orderData.items) {
      const product = productMap[item.sku];
      if (product) {
        const itemAmount = product.price * item.quantity;
        totalAmount += itemAmount;
        orderItems.push({
          product_id: product.id,
          quantity: item.quantity,
          unit_price: product.price,
          status: 'pending',
          note: item.note || ''
        });
      }
    }

    const order = await Order.create({
      order_no: generateOrderNo(),
      group_batch_id: groupBatch.id,
      customer_name: orderData.customer_name,
      customer_phone: orderData.customer_phone,
      customer_address: orderData.customer_address,
      pickup_slot_id: pickupSlots[orderData.slotIndex].id,
      pickup_code: generatePickupCode(),
      total_amount: totalAmount,
      status: orderData.status,
      note: orderData.note
    });

    for (const item of orderItems) {
      item.order_id = order.id;
    }

    const createdOrderItems = await OrderItem.bulkCreate(orderItems, { returning: true });

    for (const orderItem of createdOrderItems) {
      const productInventory = inventoryMap[orderItem.product_id] || [];
      let remainingQuantity = orderItem.quantity;

      const sortedInventory = [...productInventory].sort((a, b) => {
        if (a.expiry_date && b.expiry_date) {
          return new Date(a.expiry_date) - new Date(b.expiry_date);
        }
        return 0;
      });

      for (const inventory of sortedInventory) {
        if (remainingQuantity <= 0) break;
        
        const availableQuantity = inventory.quantity - inventory.allocated_quantity;
        if (availableQuantity <= 0) continue;

        const allocateQuantity = Math.min(remainingQuantity, availableQuantity);
        
        const isExpiryPriority = inventory.expiry_date && 
          dayjs(inventory.expiry_date).diff(today, 'day') <= 7;

        await InventoryAllocation.create({
          order_item_id: orderItem.id,
          inventory_batch_id: inventory.id,
          quantity: allocateQuantity,
          picked_quantity: 0,
          is_expiry_priority: isExpiryPriority,
          allocated_at: new Date()
        });

        inventory.allocated_quantity += allocateQuantity;
        inventory.status = inventory.allocated_quantity >= inventory.quantity ? 'allocated' : 'partial_allocated';
        await inventory.save();

        orderItem.allocated_quantity += allocateQuantity;
        remainingQuantity -= allocateQuantity;
      }

      if (orderItem.allocated_quantity === orderItem.quantity) {
        orderItem.status = 'allocated';
      } else if (orderItem.allocated_quantity > 0) {
        orderItem.status = 'partial_allocated';
        
        await Exception.create({
          order_id: order.id,
          type: 'shortage',
          product_id: orderItem.product_id,
          affected_quantity: orderItem.quantity - orderItem.allocated_quantity,
          description: `订单商品缺货，订购${orderItem.quantity}，实际分配${orderItem.allocated_quantity}，缺货${orderItem.quantity - orderItem.allocated_quantity}`,
          action: 'pending',
          status: 'open'
        });
      }

      await orderItem.save();
    }

    const allItemsAllocated = createdOrderItems.every(item => 
      item.status === 'allocated'
    );
    const hasPartialAllocated = createdOrderItems.some(item => 
      item.status === 'partial_allocated'
    );

    if (allItemsAllocated) {
      order.status = 'allocated';
    } else if (hasPartialAllocated) {
      order.status = 'paid';
    }
    await order.save();
  }

  console.log('种子数据插入完成！');
  console.log('\n📋 测试场景说明：');
  console.log('========================================');
  console.log('1. 🍶 临期酸奶优先分配：');
  console.log('   - 蒙牛纯甄酸奶有两个批次：');
  console.log('   - 批次1：保质期仅剩3天（临期），库存15盒');
  console.log('   - 批次2：保质期15天，库存20盒');
  console.log('   - 系统已按临期优先规则分配');
  console.log('');
  console.log('2. ❄️ 冰柜容量不足：');
  console.log('   - 冷冻柜B（FREEZER-002）：容量40，已用38');
  console.log('   - 澳洲羊排3斤库存因冰柜已满暂未入库');
  console.log('   - 孙叔叔订单订了2斤羊排，需要先解决冰柜容量问题');
  console.log('');
  console.log('3. ⏰ 自提时段爆满：');
  console.log('   - 5月6日 09:00-10:00 时段：最大5单，已约5单（已满）');
  console.log('   - 张阿姨、李叔叔、王女士、刘先生、陈阿姨都在这个时段');
  console.log('');
  console.log('4. 📦 部分缺货订单：');
  console.log('   - 刘先生：订了6盒安慕希酸奶');
  console.log('   - 实际库存：10盒，已分配8盒');
  console.log('   - 刘先生订单只能部分满足，已生成缺货异常');
  console.log('');
  console.log('5. 🧊 鲜切水果当天必须送出：');
  console.log('   - 鲜切西瓜、哈密瓜保质期仅1天');
  console.log('   - 需要在当天自提时段完成配送');
  console.log('========================================');
};

module.exports = seedDatabase;
