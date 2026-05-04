const { initDB, getDB, closeDB } = require('./db');
const orderService = require('./services/orderService');

function seedData() {
  console.log('开始初始化种子数据...\n');
  
  const isNew = initDB();
  const db = getDB();
  
  if (!isNew) {
    console.log('数据库已存在，跳过种子数据初始化');
    console.log('如果需要重新初始化，请先删除 printshop.db 文件');
    return;
  }
  
  console.log('📋 插入客户数据...');
  const customers = [
    { name: '张三', phone: '13800138001', wechat: 'zhangsan_wx', address: '北京市朝阳区XX路XX号', notes: '老客户，月结' },
    { name: '李四', phone: '13800138002', wechat: 'lisi_wx', address: '北京市海淀区XX路XX号', notes: '需要发票' },
    { name: '王五', phone: '13800138003', wechat: 'wangwu_wx', address: '北京市西城区XX路XX号', notes: '' },
    { name: '赵六', phone: '13800138004', wechat: 'zhaoliu_wx', address: '北京市东城区XX路XX号', notes: '广告公司，长期合作' },
    { name: '孙七', phone: '13800138005', wechat: 'sunqi_wx', address: '北京市丰台区XX路XX号', notes: '' }
  ];
  
  const insertCustomer = db.prepare(`
    INSERT INTO customers (name, phone, wechat, address, notes)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  customers.forEach(c => insertCustomer.run(c.name, c.phone, c.wechat, c.address, c.notes));
  console.log(`  已插入 ${customers.length} 个客户\n`);
  
  console.log('📦 插入纸张耗材数据...');
  const papers = [
    { name: '铜版纸 157g', type: '铜版纸', size: 'A4', weight: 157, color: '白色', unit_price: 0.8, stock_qty: 500, min_stock: 100, supplier: 'XX纸业' },
    { name: '铜版纸 200g', type: '铜版纸', size: 'A4', weight: 200, color: '白色', unit_price: 1.0, stock_qty: 300, min_stock: 100, supplier: 'XX纸业' },
    { name: '铜版纸 250g', type: '铜版纸', size: 'A4', weight: 250, color: '白色', unit_price: 1.2, stock_qty: 200, min_stock: 80, supplier: 'XX纸业' },
    { name: '哑粉纸 157g', type: '哑粉纸', size: 'A4', weight: 157, color: '白色', unit_price: 0.9, stock_qty: 250, min_stock: 100, supplier: 'YY纸业' },
    { name: '哑粉纸 200g', type: '哑粉纸', size: 'A4', weight: 200, color: '白色', unit_price: 1.1, stock_qty: 150, min_stock: 80, supplier: 'YY纸业' },
    { name: '双胶纸 80g', type: '双胶纸', size: 'A4', weight: 80, color: '白色', unit_price: 0.3, stock_qty: 1000, min_stock: 200, supplier: 'ZZ纸业' },
    { name: '双胶纸 100g', type: '双胶纸', size: 'A4', weight: 100, color: '白色', unit_price: 0.4, stock_qty: 800, min_stock: 200, supplier: 'ZZ纸业' },
    { name: '特种纸 名片纸', type: '特种纸', size: 'A4', weight: 300, color: '米白', unit_price: 2.0, stock_qty: 50, min_stock: 30, supplier: '特种纸供应商' },
    { name: '不干胶 铜版', type: '不干胶', size: 'A4', weight: 120, color: '白色', unit_price: 1.5, stock_qty: 30, min_stock: 20, supplier: '不干胶厂商' },
    { name: '牛皮纸 120g', type: '牛皮纸', size: 'A4', weight: 120, color: '黄色', unit_price: 0.5, stock_qty: 15, min_stock: 50, supplier: '牛皮纸厂商' }
  ];
  
  const insertPaper = db.prepare(`
    INSERT INTO paper_stock (name, type, size, weight, color, unit_price, stock_qty, min_stock, supplier)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  papers.forEach(p => insertPaper.run(p.name, p.type, p.size, p.weight, p.color, p.unit_price, p.stock_qty, p.min_stock, p.supplier));
  console.log(`  已插入 ${papers.length} 种纸张\n`);
  
  console.log('📐 插入规格模板数据...');
  const templates = [
    { name: '标准名片', product_type: '名片', width: 90, height: 54, unit: 'mm', bleed: 3, resolution: 300, color_mode: 'CMYK', default_quantity: 200, sheet_size: 'A4', sheets_per_sheet: 10, waste_rate: 0.05, notes: '横版标准名片' },
    { name: '竖版名片', product_type: '名片', width: 54, height: 90, unit: 'mm', bleed: 3, resolution: 300, color_mode: 'CMYK', default_quantity: 200, sheet_size: 'A4', sheets_per_sheet: 10, waste_rate: 0.05, notes: '竖版名片' },
    { name: 'A4宣传单', product_type: '宣传单', width: 210, height: 297, unit: 'mm', bleed: 3, resolution: 300, color_mode: 'CMYK', default_quantity: 500, sheet_size: 'A4', sheets_per_sheet: 1, waste_rate: 0.05, notes: '' },
    { name: 'A3海报', product_type: '海报', width: 420, height: 297, unit: 'mm', bleed: 5, resolution: 300, color_mode: 'CMYK', default_quantity: 10, sheet_size: 'A3', sheets_per_sheet: 1, waste_rate: 0.1, notes: '' },
    { name: 'A5宣传单', product_type: '宣传单', width: 148, height: 210, unit: 'mm', bleed: 3, resolution: 300, color_mode: 'CMYK', default_quantity: 1000, sheet_size: 'A4', sheets_per_sheet: 4, waste_rate: 0.05, notes: 'A4纸拼4个' }
  ];
  
  const insertTemplate = db.prepare(`
    INSERT INTO spec_templates (name, product_type, width, height, unit, bleed, resolution, color_mode, default_quantity, sheet_size, sheets_per_sheet, waste_rate, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  templates.forEach(t => insertTemplate.run(t.name, t.product_type, t.width, t.height, t.unit, t.bleed, t.resolution, t.color_mode, t.default_quantity, t.sheet_size, t.sheets_per_sheet, t.waste_rate, t.notes));
  console.log(`  已插入 ${templates.length} 个规格模板\n`);
  
  console.log('⚙️ 插入工序数据...');
  const processes = [
    { name: '彩色打印', type: 'print', cost_per_unit: 0.5, setup_time: 5, time_per_unit: 0.1, capacity_per_hour: 500, requires_machine: 1, notes: '彩色数码打印' },
    { name: '黑白打印', type: 'print', cost_per_unit: 0.1, setup_time: 2, time_per_unit: 0.05, capacity_per_hour: 1000, requires_machine: 1, notes: '黑白数码打印' },
    { name: '覆膜（亮膜）', type: 'laminate', cost_per_unit: 0.3, setup_time: 10, time_per_unit: 0.2, capacity_per_hour: 200, requires_machine: 1, notes: '亮膜覆膜' },
    { name: '覆膜（哑膜）', type: 'laminate', cost_per_unit: 0.3, setup_time: 10, time_per_unit: 0.2, capacity_per_hour: 200, requires_machine: 1, notes: '哑膜覆膜' },
    { name: '裁切', type: 'cut', cost_per_unit: 0.1, setup_time: 5, time_per_unit: 0.1, capacity_per_hour: 300, requires_machine: 1, notes: '裁切工序' },
    { name: '骑马订', type: 'bind', cost_per_unit: 1.0, setup_time: 15, time_per_unit: 0.5, capacity_per_hour: 100, requires_machine: 1, notes: '骑马钉装订' },
    { name: '胶装', type: 'bind', cost_per_unit: 2.0, setup_time: 20, time_per_unit: 1.0, capacity_per_hour: 50, requires_machine: 1, notes: '无线胶装' }
  ];
  
  const insertProcess = db.prepare(`
    INSERT INTO processes (name, type, cost_per_unit, setup_time, time_per_unit, capacity_per_hour, requires_machine, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  processes.forEach(p => insertProcess.run(p.name, p.type, p.cost_per_unit, p.setup_time, p.time_per_unit, p.capacity_per_hour, p.requires_machine, p.notes));
  console.log(`  已插入 ${processes.length} 个工序\n`);
  
  console.log('🖨️ 插入机器设备数据...');
  const machines = [
    { name: '彩色打印机A', type: 'print', status: 'available', capacity_per_hour: 500, working_hours_start: '09:00', working_hours_end: '18:00', notes: '主力彩色打印机' },
    { name: '彩色打印机B', type: 'print', status: 'available', capacity_per_hour: 300, working_hours_start: '09:00', working_hours_end: '18:00', notes: '备用彩色打印机' },
    { name: '黑白打印机', type: 'print', status: 'available', capacity_per_hour: 1000, working_hours_start: '09:00', working_hours_end: '18:00', notes: '高速黑白机' },
    { name: '覆膜机', type: 'laminate', status: 'available', capacity_per_hour: 200, working_hours_start: '09:00', working_hours_end: '18:00', notes: '全自动覆膜机' },
    { name: '裁切机A', type: 'cut', status: 'available', capacity_per_hour: 300, working_hours_start: '09:00', working_hours_end: '18:00', notes: '数控裁切机' },
    { name: '裁切机B', type: 'cut', status: 'available', capacity_per_hour: 200, working_hours_start: '09:00', working_hours_end: '18:00', notes: '手动裁切机' },
    { name: '胶装机', type: 'bind', status: 'available', capacity_per_hour: 50, working_hours_start: '09:00', working_hours_end: '18:00', notes: '无线胶装机' }
  ];
  
  const insertMachine = db.prepare(`
    INSERT INTO machines (name, type, status, capacity_per_hour, working_hours_start, working_hours_end, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  machines.forEach(m => insertMachine.run(m.name, m.type, m.status, m.capacity_per_hour, m.working_hours_start, m.working_hours_end, m.notes));
  console.log(`  已插入 ${machines.length} 台机器\n`);
  
  console.log('📋 创建示例订单...\n');
  
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(17, 0, 0, 0);
  
  const dayAfter = new Date(today);
  dayAfter.setDate(dayAfter.getDate() + 2);
  dayAfter.setHours(17, 0, 0, 0);
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const ordersData = [
    {
      customer_id: 1,
      product_type: '名片',
      width: 90,
      height: 54,
      quantity: 200,
      paper_id: 8,
      process_ids: [1, 5],
      pickup_time: tomorrow.toISOString(),
      status: 'quoted',
      notes: '横版名片，双面'
    },
    {
      customer_id: 2,
      product_type: '宣传单',
      width: 210,
      height: 297,
      quantity: 500,
      paper_id: 1,
      process_ids: [1, 5],
      pickup_time: dayAfter.toISOString(),
      status: 'paid',
      paid_amount: 800,
      paid_at: yesterday.toISOString(),
      notes: 'A4宣传单，单面彩色'
    },
    {
      customer_id: 4,
      product_type: '名片',
      width: 90,
      height: 54,
      quantity: 500,
      paper_id: 8,
      process_ids: [1, 3, 5],
      pickup_time: tomorrow.toISOString(),
      status: 'scheduled',
      paid_amount: 450,
      paid_at: yesterday.toISOString(),
      notes: '需要亮膜'
    },
    {
      customer_id: null,
      product_type: '海报',
      width: 420,
      height: 297,
      quantity: 20,
      paper_id: 2,
      process_ids: [1],
      pickup_time: today.toISOString(),
      status: 'ready',
      paid_amount: 120,
      paid_at: yesterday.toISOString(),
      notes: '散客，A3海报'
    },
    {
      customer_id: 5,
      product_type: '宣传单',
      width: 148,
      height: 210,
      quantity: 1000,
      paper_id: 4,
      process_ids: [1, 4, 5],
      pickup_time: dayAfter.toISOString(),
      status: 'locked',
      paid_amount: 1500,
      paid_at: yesterday.toISOString(),
      notes: 'A5宣传单，哑膜'
    },
    {
      customer_id: 3,
      product_type: '宣传单',
      width: 210,
      height: 297,
      quantity: 200,
      paper_id: 6,
      process_ids: [2, 5],
      pickup_time: tomorrow.toISOString(),
      status: 'completed',
      paid_amount: 200,
      paid_at: yesterday.toISOString(),
      notes: '已完成交付'
    }
  ];
  
  ordersData.forEach((orderData, idx) => {
    const order = orderService.createOrder({
      customer_id: orderData.customer_id,
      product_type: orderData.product_type,
      width: orderData.width,
      height: orderData.height,
      quantity: orderData.quantity,
      paper_id: orderData.paper_id,
      process_ids: orderData.process_ids,
      pickup_time: orderData.pickup_time,
      notes: orderData.notes
    });
    
    if (orderData.status !== 'pending') {
      if (orderData.paid_amount) {
        db.prepare('UPDATE orders SET paid_amount = ?, paid_at = ? WHERE id = ?')
          .run(orderData.paid_amount, orderData.paid_at, order.id);
      }
      
      orderService.updateOrderStatus(order.id, orderData.status, '示例数据', 'system');
    }
    
    console.log(`  订单 ${order.order_no} - ${orderData.status_name || orderService.STATUS_NAMES[orderData.status]}`);
  });
  
  console.log('\n✅ 种子数据初始化完成！');
  console.log('\n📝 已创建数据统计：');
  console.log(`  - 客户: ${customers.length} 个`);
  console.log(`  - 纸张: ${papers.length} 种`);
  console.log(`  - 规格模板: ${templates.length} 个`);
  console.log(`  - 工序: ${processes.length} 个`);
  console.log(`  - 机器: ${machines.length} 台`);
  console.log(`  - 订单: ${ordersData.length} 个`);
  
  closeDB();
}

seedData();
