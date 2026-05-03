const db = require('../config/database');

const sampleCustomers = [
  { name: '张三', phone: '13800138001', email: 'zhangsan@example.com', notes: 'VIP客户，喜欢青瓷' },
  { name: '李四', phone: '13800138002', email: 'lisi@example.com', notes: '新学员，需要指导' },
  { name: '王五', phone: '13800138003', email: 'wangwu@example.com', notes: '工作室成员' }
];

const sampleClays = [
  { name: '紫砂泥', type: '陶土', temp_min: 1100, temp_max: 1200, cone: '06', color: '紫红色', notes: '适合制作茶具' },
  { name: '景德镇高白泥', type: '瓷土', temp_min: 1280, temp_max: 1320, cone: '10', color: '白色', notes: '高温瓷泥，质地细腻' },
  { name: '陶土', type: '陶土', temp_min: 1180, temp_max: 1240, cone: '04', color: '土黄色', notes: '适合初学者' },
  { name: '青瓷泥', type: '瓷土', temp_min: 1250, temp_max: 1280, cone: '06', color: '青灰色', notes: '适合青瓷作品' }
];

const sampleGlazes = [
  { name: '透明釉', type: '透明釉', temp_min: 1250, temp_max: 1280, cone: '06', color: '透明', compatible_clays: JSON.stringify([2, 4]), incompatible_glazes: JSON.stringify([]), notes: '基础透明釉' },
  { name: '青瓷釉', type: '颜色釉', temp_min: 1260, temp_max: 1280, cone: '06', color: '青色', compatible_clays: JSON.stringify([4]), incompatible_glazes: JSON.stringify([]), notes: '传统青瓷釉' },
  { name: '铁锈花釉', type: '颜色釉', temp_min: 1220, temp_max: 1260, cone: '05', color: '铁锈色', compatible_clays: JSON.stringify([1, 3]), incompatible_glazes: JSON.stringify([4]), notes: '需要还原焰' },
  { name: '钧釉', type: '窑变釉', temp_min: 1280, temp_max: 1320, cone: '10', color: '多彩窑变', compatible_clays: JSON.stringify([2]), incompatible_glazes: JSON.stringify([3]), notes: '高温窑变釉' },
  { name: '亚光白釉', type: '哑光釉', temp_min: 1240, temp_max: 1260, cone: '05', color: '亚光白', compatible_clays: JSON.stringify([2, 3]), incompatible_glazes: JSON.stringify([]), notes: '细腻哑光效果' }
];

const sampleKilns = [
  { name: '1号电窑', type: '电窑', max_temperature: 1350, width: 60, height: 80, depth: 60, notes: '常用电窑，温度稳定' },
  { name: '2号气窑', type: '气窑', max_temperature: 1400, width: 80, height: 100, depth: 80, notes: '可做还原焰' }
];

const sampleShelves = [
  { kiln_id: 1, name: '第一层', level: 1, width: 58, height: 20, depth: 58, max_weight: 30, notes: '底层' },
  { kiln_id: 1, name: '第二层', level: 2, width: 58, height: 20, depth: 58, max_weight: 30, notes: '中层' },
  { kiln_id: 1, name: '第三层', level: 3, width: 58, height: 20, depth: 58, max_weight: 30, notes: '顶层' },
  { kiln_id: 2, name: '第一层', level: 1, width: 78, height: 25, depth: 78, max_weight: 50, notes: '底层' },
  { kiln_id: 2, name: '第二层', level: 2, width: 78, height: 25, depth: 78, max_weight: 50, notes: '中层' },
  { kiln_id: 2, name: '第三层', level: 3, width: 78, height: 25, depth: 78, max_weight: 50, notes: '顶层' }
];

const sampleFiringCurves = [
  { name: '素烧 06号锥', type: '素烧', cone: '06', max_temperature: 1000, description: JSON.stringify([
    { step: 1, temp: 200, rate: 150, hold: 0, description: '快速升温' },
    { step: 2, temp: 500, rate: 200, hold: 0, description: '继续升温' },
    { step: 3, temp: 1000, rate: 300, hold: 30, description: '到达目标温度，保温30分钟' }
  ]), notes: '标准素烧曲线' },
  { name: '釉烧 06号锥', type: '釉烧', cone: '06', max_temperature: 1260, description: JSON.stringify([
    { step: 1, temp: 200, rate: 150, hold: 0, description: '缓慢升温' },
    { step: 2, temp: 573, rate: 100, hold: 30, description: '石英相变点，保温' },
    { step: 3, temp: 1000, rate: 200, hold: 0, description: '快速升温' },
    { step: 4, temp: 1260, rate: 150, hold: 20, description: '到达目标温度，保温20分钟' }
  ]), notes: '标准釉烧曲线' },
  { name: '釉烧 10号锥', type: '釉烧', cone: '10', max_temperature: 1300, description: JSON.stringify([
    { step: 1, temp: 200, rate: 150, hold: 0, description: '缓慢升温' },
    { step: 2, temp: 573, rate: 100, hold: 30, description: '石英相变点' },
    { step: 3, temp: 1000, rate: 200, hold: 0, description: '快速升温' },
    { step: 4, temp: 1300, rate: 150, hold: 20, description: '高温保温' }
  ]), notes: '高温釉烧曲线' }
];

const sampleArtworks = [
  { name: '青花茶壶', customer_id: 1, clay_id: 2, glaze_id: 1, glaze2_id: null, width: 15, height: 12, depth: 15, weight: 0.8, delivery_date: '2026-05-10', status: 'pending', notes: '客户定制，需要精品' },
  { name: '青瓷花瓶', customer_id: 1, clay_id: 4, glaze_id: 2, glaze2_id: null, width: 20, height: 35, depth: 20, weight: 2.5, delivery_date: '2026-05-08', status: 'pending', notes: '展厅展示用' },
  { name: '铁锈花茶杯', customer_id: 2, clay_id: 1, glaze_id: 3, glaze2_id: null, width: 8, height: 6, depth: 8, weight: 0.2, delivery_date: '2026-05-15', status: 'pending', notes: '学员作品，共6个' },
  { name: '钧釉赏瓶', customer_id: 3, clay_id: 2, glaze_id: 4, glaze2_id: null, width: 18, height: 28, depth: 18, weight: 1.8, delivery_date: '2026-05-20', status: 'pending', notes: '工作室作品，期待窑变效果' },
  { name: '亚光白茶杯组', customer_id: 2, clay_id: 3, glaze_id: 5, glaze2_id: null, width: 7, height: 8, depth: 7, weight: 0.15, delivery_date: '2026-05-05', status: 'pending', notes: '明天要交付，急！' }
];

function initializeSampleData(database) {
  const db = database;
  
  db.get('SELECT COUNT(*) as count FROM customers', (err, row) => {
    if (err) {
      console.error('检查客户数据失败:', err.message);
      return;
    }
    
    if (row.count === 0) {
      console.log('开始初始化示例数据...');
      
      const insertCustomer = db.prepare('INSERT INTO customers (name, phone, email, notes) VALUES (?, ?, ?, ?)');
      sampleCustomers.forEach(customer => {
        insertCustomer.run(customer.name, customer.phone, customer.email, customer.notes);
      });
      insertCustomer.finalize();
      
      const insertClay = db.prepare('INSERT INTO clays (name, type, temp_min, temp_max, cone, color, notes) VALUES (?, ?, ?, ?, ?, ?, ?)');
      sampleClays.forEach(clay => {
        insertClay.run(clay.name, clay.type, clay.temp_min, clay.temp_max, clay.cone, clay.color, clay.notes);
      });
      insertClay.finalize();
      
      const insertGlaze = db.prepare('INSERT INTO glazes (name, type, temp_min, temp_max, cone, color, compatible_clays, incompatible_glazes, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
      sampleGlazes.forEach(glaze => {
        insertGlaze.run(glaze.name, glaze.type, glaze.temp_min, glaze.temp_max, glaze.cone, glaze.color, glaze.compatible_clays, glaze.incompatible_glazes, glaze.notes);
      });
      insertGlaze.finalize();
      
      const insertKiln = db.prepare('INSERT INTO kilns (name, type, max_temperature, width, height, depth, notes) VALUES (?, ?, ?, ?, ?, ?, ?)');
      sampleKilns.forEach(kiln => {
        insertKiln.run(kiln.name, kiln.type, kiln.max_temperature, kiln.width, kiln.height, kiln.depth, kiln.notes);
      });
      insertKiln.finalize();
      
      const insertShelf = db.prepare('INSERT INTO shelves (kiln_id, name, level, width, height, depth, max_weight, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
      sampleShelves.forEach(shelf => {
        insertShelf.run(shelf.kiln_id, shelf.name, shelf.level, shelf.width, shelf.height, shelf.depth, shelf.max_weight, shelf.notes);
      });
      insertShelf.finalize();
      
      const insertFiringCurve = db.prepare('INSERT INTO firing_curves (name, type, cone, max_temperature, description, notes) VALUES (?, ?, ?, ?, ?, ?)');
      sampleFiringCurves.forEach(curve => {
        insertFiringCurve.run(curve.name, curve.type, curve.cone, curve.max_temperature, curve.description, curve.notes);
      });
      insertFiringCurve.finalize();
      
      const insertArtwork = db.prepare('INSERT INTO artworks (name, customer_id, clay_id, glaze_id, glaze2_id, width, height, depth, weight, delivery_date, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      sampleArtworks.forEach(artwork => {
        insertArtwork.run(artwork.name, artwork.customer_id, artwork.clay_id, artwork.glaze_id, artwork.glaze2_id, artwork.width, artwork.height, artwork.depth, artwork.weight, artwork.delivery_date, artwork.status, artwork.notes);
      });
      insertArtwork.finalize();
      
      console.log('示例数据初始化完成！');
    } else {
      console.log('数据库已有数据，跳过示例数据初始化');
    }
  });
}

module.exports = {
  initializeSampleData,
  sampleCustomers,
  sampleClays,
  sampleGlazes,
  sampleKilns,
  sampleShelves,
  sampleFiringCurves,
  sampleArtworks
};
