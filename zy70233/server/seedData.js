const dbModule = require('./database');

function getDb() {
  return dbModule.getDb();
}

async function loadSeedData() {
  const db = getDb();
  
  try {
    const existing = db.prepare('SELECT COUNT(*) as count FROM stain_levels').get();
    if (existing && existing.count > 0) {
      console.log('⏭️  种子数据已存在，跳过');
      return;
    }

    const now = new Date().toISOString();
    console.log('🌱 加载种子数据...');

    const stainLevels = [
      { id: 1, level: 'light', name: '轻度', description: '轻微污渍，可正常清洗去除', color: '#28a745', created_at: now },
      { id: 2, level: 'medium', name: '中度', description: '中等污渍，需要特殊处理', color: '#ffc107', created_at: now },
      { id: 3, level: 'heavy', name: '重度', description: '严重污渍，可能需要返洗', color: '#fd7e14', created_at: now },
      { id: 4, level: 'special', name: '特殊', description: '特殊污渍，需要专门处理流程', color: '#dc3545', created_at: now }
    ];

    for (const level of stainLevels) {
      db.prepare('INSERT INTO stain_levels (id, level, name, description, color, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(level.id, level.level, level.name, level.description, level.color, level.created_at);
    }

    const linenItems = [
      { id: 1, code: 'LN-001', name: '白色床单', type: 'sheet', specification: '200*230cm', initial_quality: 'good', status: 'available', purchase_date: '2024-01-15', total_washes: 15, created_at: now, updated_at: now },
      { id: 2, code: 'LN-002', name: '白色枕套', type: 'pillowcase', specification: '48*74cm', initial_quality: 'good', status: 'available', purchase_date: '2024-01-15', total_washes: 20, created_at: now, updated_at: now },
      { id: 3, code: 'LN-003', name: '白色被套', type: 'quilt', specification: '220*240cm', initial_quality: 'good', status: 'available', purchase_date: '2024-02-20', total_washes: 12, created_at: now, updated_at: now },
      { id: 4, code: 'LN-004', name: '白色毛巾', type: 'towel', specification: '70*140cm', initial_quality: 'good', status: 'available', purchase_date: '2024-02-20', total_washes: 25, created_at: now, updated_at: now },
      { id: 5, code: 'LN-005', name: '米色床单', type: 'sheet', specification: '200*230cm', initial_quality: 'good', status: 'available', purchase_date: '2024-03-10', total_washes: 8, created_at: now, updated_at: now }
    ];

    for (const item of linenItems) {
      db.prepare(`INSERT INTO linen_items (id, code, name, type, specification, initial_quality, status, purchase_date, total_washes, created_at, updated_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        item.id, item.code, item.name, item.type, item.specification, item.initial_quality, item.status, item.purchase_date, item.total_washes, item.created_at, item.updated_at
      );
    }

    const rewashBatch = { 
      id: 1, 
      batch_code: 'RW-2024-001', 
      name: '04月第一批次返洗', 
      reason: '重度污渍需二次清洗', 
      status: 'in_progress', 
      created_by: '张三', 
      created_at: now, 
      completed_at: null 
    };

    db.prepare(`INSERT INTO rewash_batches (id, batch_code, name, reason, status, created_by, created_at, completed_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
      rewashBatch.id, rewashBatch.batch_code, rewashBatch.name, rewashBatch.reason, rewashBatch.status, rewashBatch.created_by, rewashBatch.created_at, rewashBatch.completed_at
    );

    console.log('✅ 种子数据加载完成');
  } catch (error) {
    console.error('❌ 加载种子数据失败:', error.message);
  }
}

module.exports = {
  loadSeedData
};
