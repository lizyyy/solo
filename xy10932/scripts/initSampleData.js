const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'database.db');
const db = new sqlite3.Database(dbPath);

const runQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const getOne = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const generateBatchNo = (index) => {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  return `B${dateStr}${String(index).padStart(4, '0')}`;
};

const generateBoxNo = (index) => {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  return `S${dateStr}${String(index).padStart(4, '0')}`;
};

const initTables = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS storage_locations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        capacity INTEGER DEFAULT 100,
        current_count INTEGER DEFAULT 0,
        temperature_min REAL DEFAULT -18,
        temperature_max REAL DEFAULT -10,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_no TEXT UNIQUE NOT NULL,
        dish_name TEXT NOT NULL,
        production_date DATE NOT NULL,
        production_line TEXT,
        chef TEXT,
        quantity INTEGER NOT NULL,
        shelf_life_days INTEGER DEFAULT 48,
        ingredients TEXT,
        supplier TEXT,
        status TEXT DEFAULT 'produced',
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS sample_boxes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        box_no TEXT UNIQUE NOT NULL,
        batch_id INTEGER NOT NULL,
        location_id INTEGER,
        sample_weight REAL,
        sample_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        expiry_time DATETIME,
        status TEXT DEFAULT 'stored',
        operator TEXT,
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (batch_id) REFERENCES batches(id),
        FOREIGN KEY (location_id) REFERENCES storage_locations(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS inspections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sample_box_id INTEGER NOT NULL,
        inspector TEXT NOT NULL,
        inspection_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        temperature REAL,
        appearance TEXT,
        smell TEXT,
        taste TEXT,
        microorganism_result TEXT,
        result TEXT DEFAULT 'pending',
        conclusion TEXT,
        reviewer TEXT,
        review_time DATETIME,
        review_comment TEXT,
        status TEXT DEFAULT 'pending_review',
        compensation_applied BOOLEAN DEFAULT 0,
        compensation_details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sample_box_id) REFERENCES sample_boxes(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS destructions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sample_box_id INTEGER NOT NULL,
        destruction_time DATETIME,
        operator TEXT NOT NULL,
        first_operator TEXT,
        witness TEXT,
        destruction_method TEXT,
        reason TEXT,
        cancel_reason TEXT,
        cancelled_by TEXT,
        cancelled_at DATETIME,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sample_box_id) REFERENCES sample_boxes(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS trace_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        report_no TEXT UNIQUE NOT NULL,
        batch_id INTEGER,
        sample_box_id INTEGER,
        report_type TEXT NOT NULL,
        generated_by TEXT NOT NULL,
        generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        content TEXT,
        status TEXT DEFAULT 'generated',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (batch_id) REFERENCES batches(id),
        FOREIGN KEY (sample_box_id) REFERENCES sample_boxes(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS exception_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        api_endpoint TEXT,
        request_method TEXT,
        request_body TEXT,
        request_headers TEXT,
        error_message TEXT,
        error_stack TEXT,
        handling_conclusion TEXT,
        handled_by TEXT,
        handled_at DATETIME,
        status TEXT DEFAULT 'unhandled',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS manual_corrections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        target_table TEXT NOT NULL,
        target_id INTEGER NOT NULL,
        field_name TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        reason TEXT NOT NULL,
        operator TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      resolve();
    });
  });
};

const initSampleData = async () => {
  try {
    console.log('开始初始化数据库表结构...');
    await initTables();
    console.log('数据库表结构初始化完成');
    
    console.log('开始初始化样例数据...');
    
    const locations = [
      { code: 'A01', name: '冷藏区A-01', description: '第一层左侧', capacity: 50, temperature_min: -20, temperature_max: -15 },
      { code: 'A02', name: '冷藏区A-02', description: '第一层右侧', capacity: 50, temperature_min: -20, temperature_max: -15 },
      { code: 'B01', name: '冷藏区B-01', description: '第二层左侧', capacity: 50, temperature_min: -18, temperature_max: -12 },
      { code: 'B02', name: '冷藏区B-02', description: '第二层右侧', capacity: 50, temperature_min: -18, temperature_max: -12 },
      { code: 'C01', name: '冷藏区C-01', description: '第三层左侧', capacity: 50, temperature_min: -15, temperature_max: -10 }
    ];
    
    for (const loc of locations) {
      const exists = await getOne('SELECT id FROM storage_locations WHERE code = ?', [loc.code]);
      if (!exists) {
        await runQuery(
          'INSERT INTO storage_locations (code, name, description, capacity, current_count, temperature_min, temperature_max, status) VALUES (?, ?, ?, ?, 0, ?, ?, ?)',
          [loc.code, loc.name, loc.description, loc.capacity, loc.temperature_min, loc.temperature_max, 'active']
        );
        console.log(`已创建冷藏位置: ${loc.code}`);
      }
    }
    
    const dishes = [
      { name: '宫保鸡丁', chef: '张师傅', ingredients: '鸡肉、花生、干辣椒、黄瓜', supplier: '北京生鲜配送中心' },
      { name: '红烧排骨', chef: '李师傅', ingredients: '排骨、生姜、大葱、八角', supplier: '上海肉类加工厂' },
      { name: '清炒虾仁', chef: '王师傅', ingredients: '虾仁、青豆、胡萝卜、蒜', supplier: '广州海鲜市场' },
      { name: '鱼香肉丝', chef: '赵师傅', ingredients: '猪肉、木耳、青椒、笋丝', supplier: '成都农产品市场' },
      { name: '麻婆豆腐', chef: '陈师傅', ingredients: '豆腐、猪肉末、豆瓣酱、花椒', supplier: '重庆豆制品厂' },
      { name: '糖醋里脊', chef: '刘师傅', ingredients: '猪肉、淀粉、番茄酱、白糖', supplier: '武汉肉联厂' }
    ];
    
    const today = new Date().toISOString().slice(0, 10);
    const batchIds = [];
    
    for (let i = 0; i < dishes.length; i++) {
      const dish = dishes[i];
      const batchNo = generateBatchNo(i + 1);
      const exists = await getOne('SELECT id FROM batches WHERE batch_no = ?', [batchNo]);
      
      if (!exists) {
        const result = await runQuery(
          'INSERT INTO batches (batch_no, dish_name, production_date, production_line, chef, quantity, shelf_life_days, ingredients, supplier, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [batchNo, dish.name, today, `Line-${(i % 3) + 1}`, dish.chef, 100 + i * 20, 48, dish.ingredients, dish.supplier, 'produced']
        );
        batchIds.push(result.lastID);
        console.log(`已创建批次: ${batchNo} - ${dish.name}`);
      } else {
        batchIds.push(exists.id);
      }
    }
    
    const locationIds = [];
    for (const loc of locations) {
      const locRecord = await getOne('SELECT id FROM storage_locations WHERE code = ?', [loc.code]);
      if (locRecord) {
        locationIds.push(locRecord.id);
      }
    }
    
    const sampleBoxIds = [];
    let sampleIndex = 1;
    
    for (const batchId of batchIds) {
      for (let j = 0; j < 2; j++) {
        const boxNo = generateBoxNo(sampleIndex);
        const locationId = locationIds[sampleIndex % locationIds.length];
        const sampleTime = new Date().toISOString();
        const expiryTime = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
        
        const exists = await getOne('SELECT id FROM sample_boxes WHERE box_no = ?', [boxNo]);
        if (!exists) {
          const result = await runQuery(
            'INSERT INTO sample_boxes (box_no, batch_id, location_id, sample_weight, sample_time, expiry_time, operator, status, remarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [boxNo, batchId, locationId, 200 + sampleIndex * 10, sampleTime, expiryTime, '留样员' + ((sampleIndex % 3) + 1), 'stored', '常规留样']
          );
          sampleBoxIds.push(result.lastID);
          
          await runQuery(
            'UPDATE storage_locations SET current_count = current_count + 1 WHERE id = ?',
            [locationId]
          );
          
          await runQuery(
            'UPDATE batches SET status = ? WHERE id = ?',
            ['sampled', batchId]
          );
          
          console.log(`已创建留样盒: ${boxNo}`);
        } else {
          sampleBoxIds.push(exists.id);
        }
        sampleIndex++;
      }
    }
    
    const inspectors = ['质检员A', '质检员B', '质检员C'];
    for (let i = 0; i < Math.min(sampleBoxIds.length, 4); i++) {
      const sampleBoxId = sampleBoxIds[i];
      const inspector = inspectors[i % inspectors.length];
      
      const existing = await getOne('SELECT id FROM inspections WHERE sample_box_id = ?', [sampleBoxId]);
      if (!existing) {
        const statuses = ['pending_review', 'review_passed', 'review_rejected', 'compensated'];
        const status = statuses[i % statuses.length];
        
        let reviewData = {};
        if (status !== 'pending_review') {
          reviewData.reviewer = '主管' + ((i % 2) + 1);
          reviewData.review_time = new Date().toISOString();
          reviewData.review_comment = status === 'review_passed' ? '抽检合格，同意通过' : '抽检数据异常，需重新采样';
        }
        
        await runQuery(
          `INSERT INTO inspections (sample_box_id, inspector, temperature, appearance, smell, taste, microorganism_result, result, conclusion, status, reviewer, review_time, review_comment)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [sampleBoxId, inspector, -16 + i, '正常', '正常', '正常', '阴性', status === 'review_rejected' ? 'unqualified' : 'qualified', '符合留样标准',
           status, reviewData.reviewer || null, reviewData.review_time || null, reviewData.review_comment || null]
        );
        console.log(`已创建抽检记录，状态: ${status}`);
      }
    }
    
    if (sampleBoxIds.length > 1) {
      const confirmedBoxId = sampleBoxIds[0];
      const pendingBoxId = sampleBoxIds[1];
      
      const existing1 = await getOne('SELECT id FROM destructions WHERE sample_box_id = ?', [confirmedBoxId]);
      if (!existing1) {
        const sampleBox = await getOne('SELECT location_id, batch_id FROM sample_boxes WHERE id = ?', [confirmedBoxId]);
        
        await runQuery(
          'INSERT INTO destructions (sample_box_id, operator, witness, destruction_method, reason, status, first_operator, destruction_time) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
          [confirmedBoxId, '销毁员1', '监督员1', '高温销毁', '留样到期正常销毁', 'confirmed', '销毁员1']
        );
        
        await runQuery(
          'UPDATE sample_boxes SET status = ?, location_id = NULL WHERE id = ?',
          ['destroyed', confirmedBoxId]
        );
        
        if (sampleBox && sampleBox.location_id) {
          await runQuery(
            'UPDATE storage_locations SET current_count = current_count - 1 WHERE id = ?',
            [sampleBox.location_id]
          );
        }
        
        console.log('已创建已确认销毁记录');
      }
      
      const existing2 = await getOne('SELECT id FROM destructions WHERE sample_box_id = ? AND status = ?', [pendingBoxId, 'pending']);
      if (!existing2) {
        await runQuery(
          'INSERT INTO destructions (sample_box_id, operator, destruction_method, reason, status, first_operator) VALUES (?, ?, ?, ?, ?, ?)',
          [pendingBoxId, '销毁员2', '高温销毁', '留样到期待确认', 'pending', '销毁员2']
        );
        
        await runQuery(
          'UPDATE sample_boxes SET status = ? WHERE id = ?',
          ['pending_destruction', pendingBoxId]
        );
        
        console.log('已创建待确认销毁记录（演示双人复核流程）');
      }
    }
    
    console.log('\n========================================');
    console.log('样例数据初始化完成!');
    console.log('冷藏位置: 5个');
    console.log('批次: 6个');
    console.log('留样盒: 12个');
    console.log('抽检记录: 4个（包含不同状态）');
    console.log('销毁记录: 1个');
    console.log('========================================\n');
    
    db.close();
  } catch (error) {
    console.error('初始化样例数据失败:', error);
    db.close();
    process.exit(1);
  }
};

initSampleData();
