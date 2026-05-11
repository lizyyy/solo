const db = require('./database');

async function seed() {
  await db.init();

  const database = db.getDb();

  console.log('🌱 开始初始化种子数据...');

  const existingStains = database.prepare('SELECT COUNT(*) as count FROM stain_levels').get();
  if (!existingStains || existingStains.count === 0) {
    console.log('📌 插入污渍等级数据...');
    const stainStmt = database.prepare(`
      INSERT INTO stain_levels (level, name, description, color) VALUES (?, ?, ?, ?)
    `);
    
    const stains = [
      ['L1', '轻微污渍', '可通过常规洗涤清除', '#4CAF50'],
      ['L2', '中等污渍', '需要预处理或特殊洗涤剂', '#FF9800'],
      ['L3', '严重污渍', '可能需要专业处理或返洗', '#F44336'],
      ['L4', '顽固污渍', '多次洗涤仍无法完全清除', '#9C27B0']
    ];
    
    stains.forEach(([level, name, description, color]) => {
      stainStmt.run(level, name, description, color);
    });
  }

  const existingLinen = database.prepare('SELECT COUNT(*) as count FROM linen_items').get();
  if (!existingLinen || existingLinen.count === 0) {
    console.log('📌 插入布草档案数据...');
    const linenStmt = database.prepare(`
      INSERT INTO linen_items (code, name, type, specification, initial_quality, purchase_date) 
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const linenItems = [
      ['LIN-2024-001', '白色标准床单', 'sheet', '200*230cm 纯棉', 'good', '2024-01-15'],
      ['LIN-2024-002', '白色加大床单', 'sheet', '220*240cm 纯棉', 'good', '2024-01-15'],
      ['LIN-2024-003', '白色枕套', 'pillowcase', '48*74cm 纯棉', 'good', '2024-01-20'],
      ['LIN-2024-004', '白色被套', 'duvet_cover', '200*230cm 纯棉', 'good', '2024-01-20'],
      ['LIN-2024-005', '白色毛巾', 'towel', '70*140cm 纯棉', 'good', '2024-02-01'],
      ['LIN-2024-006', '彩色地巾', 'floor_mat', '50*80cm 纯棉', 'good', '2024-02-01'],
      ['LIN-2024-007', '白色浴袍', 'bathrobe', '均码 纯棉', 'good', '2024-02-10'],
      ['LIN-2024-008', '白色方巾', 'face_towel', '33*33cm 纯棉', 'good', '2024-02-10']
    ];
    
    linenItems.forEach(([code, name, type, specification, quality, date]) => {
      linenStmt.run(code, name, type, specification, quality, date);
    });
  }

  const existingBatches = database.prepare('SELECT COUNT(*) as count FROM rewash_batches').get();
  if (!existingBatches || existingBatches.count === 0) {
    console.log('📌 插入返洗批次数据...');
    const batchStmt = database.prepare(`
      INSERT INTO rewash_batches (batch_code, name, reason, status, created_by, created_at) 
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const batches = [
      ['RW-2024-001', '5月上旬严重污渍批次', '餐饮油污污染严重，需要特殊处理', 'in_progress', '张经理', '2024-05-05 09:00:00'],
      ['RW-2024-002', '5月上旬顽固污渍批次', '化妆品残留，常规洗涤无法去除', 'completed', '李主管', '2024-05-03 14:30:00']
    ];
    
    batches.forEach(([code, name, reason, status, createdBy, createdAt]) => {
      batchStmt.run(code, name, reason, status, createdBy, createdAt);
    });
  }

  console.log('✅ 种子数据初始化完成！');
  
  const stainCount = database.prepare('SELECT COUNT(*) as count FROM stain_levels').get();
  const linenCount = database.prepare('SELECT COUNT(*) as count FROM linen_items').get();
  const batchCount = database.prepare('SELECT COUNT(*) as count FROM rewash_batches').get();
  
  console.log('\n📊 数据统计:');
  console.log('├─ 污渍等级:', stainCount?.count || 0);
  console.log('├─ 布草档案:', linenCount?.count || 0);
  console.log('└─ 返洗批次:', batchCount?.count || 0);
}

seed().catch(console.error);
