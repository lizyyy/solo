const db = require('../models/database');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const { parseCsvContent } = require('../controllers/materialController');

const validateDate = (dateStr) => {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
};

const categorizeDetail = (detail) => {
  const missingFields = [];
  const invalidFields = [];
  
  if (!detail.building_name) missingFields.push('楼宇名称');
  if (!detail.address) missingFields.push('地址');
  if (!detail.contact_person) missingFields.push('联系人');
  if (!detail.contact_phone) missingFields.push('联系电话');
  
  if (detail.extinguisher_date && !validateDate(detail.extinguisher_date)) {
    invalidFields.push('灭火器维保日期格式错误');
  }
  if (detail.sprinkler_date && !validateDate(detail.sprinkler_date)) {
    invalidFields.push('喷淋维保日期格式错误');
  }
  if (detail.alarm_date && !validateDate(detail.alarm_date)) {
    invalidFields.push('报警主机维保日期格式错误');
  }
  
  if (missingFields.length >= 3 || invalidFields.length >= 2) {
    return {
      category: 'blocked',
      reason: `关键信息缺失或错误: ${[...missingFields, ...invalidFields].join('、')}`,
      action: 'send_to_interception'
    };
  }
  
  if (missingFields.length > 0 || invalidFields.length > 0) {
    return {
      category: 'pending_supplement',
      reason: `需要补充信息: ${[...missingFields, ...invalidFields].join('、')}`,
      action: 'request_supplement'
    };
  }
  
  return {
    category: 'normal',
    reason: '信息完整有效',
    action: 'process_normally'
  };
};

const addTrace = (detailId, action, fromCategory, toCategory, reason, operator) => {
  const traceId = uuidv4();
  const sql = 'INSERT INTO processing_traces (id, detail_id, action, from_category, to_category, reason, operator) VALUES (?, ?, ?, ?, ?, ?, ?)';
  return new Promise((resolve, reject) => {
    db.run(sql, [traceId, detailId, action, fromCategory, toCategory, reason, operator || 'system'], (err) => {
      if (err) reject(err);
      else resolve(traceId);
    });
  });
};

const processBatch = async (batchId, processor = 'system') => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM raw_materials WHERE batch_id = ? AND status = ?', [batchId, 'pending'], async (err, materials) => {
      if (err) return reject(err);
      if (materials.length === 0) return reject(new Error('没有待处理的材料'));

      let processedCount = 0;
      let normalCount = 0;
      let pendingCount = 0;
      let blockedCount = 0;

      for (const material of materials) {
        let data = [];
        
        if (material.source_type === 'file') {
          const filePath = path.join(__dirname, '../../uploads', material.file_name);
          if (fs.existsSync(filePath)) {
            data = await parseCsvContent(filePath);
          }
        } else if (material.source_type === 'manual') {
          data = JSON.parse(material.content);
          if (!Array.isArray(data)) data = [data];
        }

        for (const item of data) {
          const detailId = uuidv4();
          const categoryResult = categorizeDetail(item);
          
          const sql = `INSERT INTO details (
            id, batch_id, material_id, building_name, address, contact_person, 
            contact_phone, extinguisher_date, sprinkler_date, alarm_date, 
            category, category_reason, processor, processed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
          
          await new Promise((resolve, reject) => {
            db.run(sql, [
              detailId, batchId, material.id,
              item.building_name, item.address, item.contact_person,
              item.contact_phone, item.extinguisher_date, item.sprinkler_date, item.alarm_date,
              categoryResult.category, categoryResult.reason, processor, new Date().toISOString()
            ], async (err) => {
              if (err) return reject(err);
              
              await addTrace(
                detailId, 
                categoryResult.action, 
                'pending', 
                categoryResult.category, 
                categoryResult.reason, 
                processor
              );
              
              processedCount++;
              if (categoryResult.category === 'normal') normalCount++;
              else if (categoryResult.category === 'pending_supplement') pendingCount++;
              else if (categoryResult.category === 'blocked') blockedCount++;
              
              resolve();
            });
          });
        }

        await new Promise((resolve) => {
          db.run('UPDATE raw_materials SET status = ? WHERE id = ?', ['processed', material.id], resolve);
        });
      }

      await new Promise((resolve) => {
        db.run('UPDATE batches SET status = ?, updated_at = ? WHERE id = ?', ['completed', new Date().toISOString(), batchId], resolve);
      });

      resolve({
        processed: processedCount,
        normal: normalCount,
        pending_supplement: pendingCount,
        blocked: blockedCount
      });
    });
  });
};

const getDetailWithTrace = (detailId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM details WHERE id = ?', [detailId], (err, detail) => {
      if (err) return reject(err);
      if (!detail) return reject(new Error('明细不存在'));
      
      db.all('SELECT * FROM processing_traces WHERE detail_id = ? ORDER BY created_at ASC', [detailId], (err, traces) => {
        if (err) return reject(err);
        resolve({ detail, traces });
      });
    });
  });
};

const getMaintenanceTable = async () => {
  const tables = await new Promise((resolve) => {
    db.all('SELECT * FROM maintenance_tables WHERE is_active = 1 ORDER BY last_used_at ASC', [], (err, rows) => {
      if (err) return resolve([]);
      resolve(rows);
    });
  });
  
  if (tables.length === 0) {
    const defaultTables = [
      { id: uuidv4(), table_name: '灭火器维保表A', equipment_type: 'extinguisher', is_active: 1 },
      { id: uuidv4(), table_name: '喷淋维保表A', equipment_type: 'sprinkler', is_active: 1 },
      { id: uuidv4(), table_name: '报警主机维保表A', equipment_type: 'alarm', is_active: 1 },
      { id: uuidv4(), table_name: '灭火器维保表B', equipment_type: 'extinguisher', is_active: 1 },
      { id: uuidv4(), table_name: '喷淋维保表B', equipment_type: 'sprinkler', is_active: 1 },
      { id: uuidv4(), table_name: '报警主机维保表B', equipment_type: 'alarm', is_active: 1 }
    ];
    
    for (const table of defaultTables) {
      await new Promise((resolve) => {
        db.run('INSERT INTO maintenance_tables (id, table_name, equipment_type, is_active) VALUES (?, ?, ?, ?)',
          [table.id, table.table_name, table.equipment_type, table.is_active], resolve);
      });
    }
    return defaultTables;
  }
  
  return tables;
};

const assignMaintenanceTable = async (detailId) => {
  const tables = await getMaintenanceTable();
  const assignedTables = {};
  
  const types = ['extinguisher', 'sprinkler', 'alarm'];
  for (const type of types) {
    const typeTables = tables.filter(t => t.equipment_type === type);
    if (typeTables.length > 0) {
      const selected = typeTables[0];
      assignedTables[type] = selected.table_name;
      
      await new Promise((resolve) => {
        db.run('UPDATE maintenance_tables SET last_used_at = ? WHERE id = ?',
          [new Date().toISOString(), selected.id], resolve);
      });
    }
  }
  
  return assignedTables;
};

module.exports = {
  processBatch,
  getDetailWithTrace,
  categorizeDetail,
  addTrace,
  assignMaintenanceTable
};
