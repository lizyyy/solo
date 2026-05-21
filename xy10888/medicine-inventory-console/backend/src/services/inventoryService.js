const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const { run, get, all } = require('../utils/db');

class InventoryService {
  async createMedicine(data) {
    const id = uuidv4();
    await run(
      'INSERT INTO medicines (id, code, name, specification, manufacturer, unit) VALUES (?, ?, ?, ?, ?, ?)',
      [id, data.code, data.name, data.specification, data.manufacturer, data.unit]
    );
    return this.getMedicine(id);
  }

  async getMedicine(id) {
    return get('SELECT * FROM medicines WHERE id = ?', [id]);
  }

  async listMedicines(params = {}) {
    let sql = 'SELECT * FROM medicines WHERE 1=1';
    const paramsArr = [];
    
    if (params.keyword) {
      sql += ' AND (name LIKE ? OR code LIKE ?)';
      paramsArr.push(`%${params.keyword}%`, `%${params.keyword}%`);
    }
    
    sql += ' ORDER BY created_at DESC';
    return all(sql, paramsArr);
  }

  async createSource(data) {
    const id = uuidv4();
    await run(
      'INSERT INTO inventory_sources (id, name, type, system_code, sync_url) VALUES (?, ?, ?, ?, ?)',
      [id, data.name, data.type, data.system_code, data.sync_url]
    );
    return this.getSource(id);
  }

  async getSource(id) {
    return get('SELECT * FROM inventory_sources WHERE id = ?', [id]);
  }

  async listSources() {
    return all('SELECT * FROM inventory_sources ORDER BY created_at DESC');
  }

  async createBatch(data) {
    const id = uuidv4();
    await run(
      `INSERT INTO inventory_batches (id, medicine_id, batch_no, production_date, expiry_date, quantity, occupied_quantity, source_id, warehouse_location) 
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [id, data.medicine_id, data.batch_no, data.production_date, data.expiry_date, 
       data.quantity, data.source_id, data.warehouse_location]
    );
    return this.getBatch(id);
  }

  async getBatch(id) {
    return get(`
      SELECT b.*, m.name as medicine_name, m.code as medicine_code, s.name as source_name
      FROM inventory_batches b
      JOIN medicines m ON b.medicine_id = m.id
      JOIN inventory_sources s ON b.source_id = s.id
      WHERE b.id = ?
    `, [id]);
  }

  async listBatches(params = {}) {
    let sql = `
      SELECT b.*, m.name as medicine_name, m.code as medicine_code, s.name as source_name,
             CASE 
               WHEN julianday(b.expiry_date) - julianday('now') <= (
                 SELECT COALESCE(MIN(critical_days), 30) FROM expiry_rules WHERE is_default = 1
               ) THEN 'critical'
               WHEN julianday(b.expiry_date) - julianday('now') <= (
                 SELECT COALESCE(MIN(warning_days), 90) FROM expiry_rules WHERE is_default = 1
               ) THEN 'warning'
               ELSE 'normal'
             END as expiry_status
      FROM inventory_batches b
      JOIN medicines m ON b.medicine_id = m.id
      JOIN inventory_sources s ON b.source_id = s.id
      WHERE 1=1
    `;
    const paramsArr = [];
    
    if (params.status) {
      sql += ' AND b.status = ?';
      paramsArr.push(params.status);
    }
    if (params.expiry_status) {
      if (params.expiry_status === 'critical') {
        sql += ` AND julianday(b.expiry_date) - julianday('now') <= (SELECT COALESCE(MIN(critical_days), 30) FROM expiry_rules WHERE is_default = 1)`;
      } else if (params.expiry_status === 'warning') {
        sql += ` AND julianday(b.expiry_date) - julianday('now') <= (SELECT COALESCE(MIN(warning_days), 90) FROM expiry_rules WHERE is_default = 1)
                 AND julianday(b.expiry_date) - julianday('now') > (SELECT COALESCE(MIN(critical_days), 30) FROM expiry_rules WHERE is_default = 1)`;
      }
    }
    
    sql += ' ORDER BY b.created_at DESC';
    return all(sql, paramsArr);
  }

  async occupyBatch(data) {
    const batch = await this.getBatch(data.batch_id);
    if (!batch) {
      const err = new Error('批次不存在');
      err.statusCode = 404;
      throw err;
    }
    
    const available = batch.quantity - batch.occupied_quantity;
    if (data.quantity > available) {
      const err = new Error(`库存不足，可用数量: ${available}`);
      err.statusCode = 400;
      throw err;
    }
    
    const daysToExpiry = moment(batch.expiry_date).diff(moment(), 'days');
    const rule = await get('SELECT * FROM expiry_rules WHERE is_default = 1 LIMIT 1');
    if (rule && daysToExpiry <= rule.critical_days) {
      const err = new Error(`该药品已临期，剩余有效期: ${daysToExpiry}天，禁止占用`);
      err.statusCode = 400;
      throw err;
    }
    
    const occupyId = uuidv4();
    
    await run('BEGIN TRANSACTION');
    try {
      await run(
        'INSERT INTO occupancy_records (id, batch_id, quantity, order_no, department, operator, reason) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [occupyId, data.batch_id, data.quantity, data.order_no, data.department, data.operator, data.reason]
      );
      
      await run(
        'UPDATE inventory_batches SET occupied_quantity = occupied_quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [data.quantity, data.batch_id]
      );
      
      await run('COMMIT');
    } catch (err) {
      await run('ROLLBACK');
      throw err;
    }
    
    return this.getOccupancy(occupyId);
  }

  async getOccupancy(id) {
    return get(`
      SELECT o.*, b.batch_no, m.name as medicine_name
      FROM occupancy_records o
      JOIN inventory_batches b ON o.batch_id = b.id
      JOIN medicines m ON b.medicine_id = m.id
      WHERE o.id = ?
    `, [id]);
  }

  async listOccupancies(params = {}) {
    let sql = `
      SELECT o.*, b.batch_no, m.name as medicine_name
      FROM occupancy_records o
      JOIN inventory_batches b ON o.batch_id = b.id
      JOIN medicines m ON b.medicine_id = m.id
      WHERE 1=1
    `;
    const paramsArr = [];
    
    if (params.status) {
      sql += ' AND o.status = ?';
      paramsArr.push(params.status);
    }
    
    sql += ' ORDER BY o.created_at DESC';
    return all(sql, paramsArr);
  }

  async createDelivery(data) {
    const id = uuidv4();
    const deliveryNo = `DL${moment().format('YYYYMMDDHHmmss')}`;
    
    await run(
      'INSERT INTO delivery_receipts (id, delivery_no, source_id, total_quantity, status) VALUES (?, ?, ?, ?, ?)',
      [id, deliveryNo, data.source_id, data.total_quantity, 'pending']
    );
    
    return this.getDelivery(id);
  }

  async getDelivery(id) {
    return get(`
      SELECT d.*, s.name as source_name
      FROM delivery_receipts d
      JOIN inventory_sources s ON d.source_id = s.id
      WHERE d.id = ?
    `, [id]);
  }

  async listDeliveries(params = {}) {
    let sql = `
      SELECT d.*, s.name as source_name
      FROM delivery_receipts d
      JOIN inventory_sources s ON d.source_id = s.id
      WHERE 1=1
    `;
    const paramsArr = [];
    
    if (params.status) {
      sql += ' AND d.status = ?';
      paramsArr.push(params.status);
    }
    
    sql += ' ORDER BY d.created_at DESC';
    return all(sql, paramsArr);
  }

  async confirmDelivery(deliveryId, items, operator) {
    const delivery = await this.getDelivery(deliveryId);
    if (!delivery) {
      const err = new Error('配送单不存在');
      err.statusCode = 404;
      throw err;
    }
    if (delivery.status !== 'pending') {
      const err = new Error('配送单状态不正确');
      err.statusCode = 400;
      throw err;
    }
    
    await run('BEGIN TRANSACTION');
    try {
      let receivedQty = 0;
      
      for (const item of items) {
        const itemId = uuidv4();
        await run(
          `INSERT INTO delivery_items (id, receipt_id, medicine_id, batch_no, planned_quantity, actual_quantity, expiry_date, status) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [itemId, deliveryId, item.medicine_id, item.batch_no, item.planned_quantity, 
           item.actual_quantity, item.expiry_date, 'confirmed']
        );
        
        const diff = item.actual_quantity - item.planned_quantity;
        if (diff !== 0) {
          const discId = uuidv4();
          const discNo = `DC${moment().format('YYYYMMDDHHmmss')}${Math.random().toString(36).substr(2, 4)}`;
          await run(
            `INSERT INTO discrepancy_orders (id, order_no, type, source_id, medicine_id, batch_no, expected_quantity, actual_quantity, difference, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [discId, discNo, 'delivery', delivery.source_id, item.medicine_id, item.batch_no,
             item.planned_quantity, item.actual_quantity, diff, 'pending']
          );
        }
        
        if (item.actual_quantity > 0) {
          const existing = await get(
            'SELECT id, quantity FROM inventory_batches WHERE medicine_id = ? AND batch_no = ? AND source_id = ?',
            [item.medicine_id, item.batch_no, delivery.source_id]
          );
          
          if (existing) {
            await run(
              'UPDATE inventory_batches SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
              [item.actual_quantity, existing.id]
            );
          } else {
            const batchId = uuidv4();
            await run(
              `INSERT INTO inventory_batches (id, medicine_id, batch_no, expiry_date, quantity, occupied_quantity, source_id, status)
               VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
              [batchId, item.medicine_id, item.batch_no, item.expiry_date, item.actual_quantity, delivery.source_id, 'normal']
            );
          }
        }
        
        receivedQty += item.actual_quantity;
      }
      
      await run(
        'UPDATE delivery_receipts SET status = ?, received_quantity = ?, receive_time = CURRENT_TIMESTAMP, operator = ? WHERE id = ?',
        ['completed', receivedQty, operator, deliveryId]
      );
      
      await run('COMMIT');
    } catch (err) {
      await run('ROLLBACK');
      throw err;
    }
    
    return this.getDelivery(deliveryId);
  }

  async listDiscrepancies(params = {}) {
    let sql = `
      SELECT d.*, m.name as medicine_name, s.name as source_name
      FROM discrepancy_orders d
      LEFT JOIN medicines m ON d.medicine_id = m.id
      LEFT JOIN inventory_sources s ON d.source_id = s.id
      WHERE 1=1
    `;
    const paramsArr = [];
    
    if (params.status) {
      sql += ' AND d.status = ?';
      paramsArr.push(params.status);
    }
    
    sql += ' ORDER BY d.created_at DESC';
    return all(sql, paramsArr);
  }

  async getDiscrepancy(id) {
    return get(`
      SELECT d.*, m.name as medicine_name, s.name as source_name
      FROM discrepancy_orders d
      LEFT JOIN medicines m ON d.medicine_id = m.id
      LEFT JOIN inventory_sources s ON d.source_id = s.id
      WHERE d.id = ?
    `, [id]);
  }

  async resolveDiscrepancy(id, resolution, resolver, remarks) {
    const disc = await this.getDiscrepancy(id);
    if (!disc) {
      const err = new Error('差异单不存在');
      err.statusCode = 404;
      throw err;
    }
    if (disc.status !== 'pending') {
      const err = new Error('差异单已处理');
      err.statusCode = 400;
      throw err;
    }
    
    await run(
      'UPDATE discrepancy_orders SET status = ?, resolved_at = CURRENT_TIMESTAMP, resolver = ?, resolution = ?, remarks = ? WHERE id = ?',
      ['resolved', resolver, resolution, remarks, id]
    );
    
    return this.getDiscrepancy(id);
  }

  async getStatistics() {
    const totalBatches = await get('SELECT COUNT(*) as count FROM inventory_batches');
    const totalQty = await get('SELECT SUM(quantity) as total, SUM(occupied_quantity) as occupied FROM inventory_batches');
    const pendingDeliveries = await get('SELECT COUNT(*) as count FROM delivery_receipts WHERE status = ?', ['pending']);
    const pendingDiscrepancies = await get('SELECT COUNT(*) as count FROM discrepancy_orders WHERE status = ?', ['pending']);
    const expiringBatches = await all(`
      SELECT COUNT(*) as count, 
             CASE WHEN julianday(expiry_date) - julianday('now') <= 30 THEN 'critical'
                  WHEN julianday(expiry_date) - julianday('now') <= 90 THEN 'warning'
                  ELSE 'normal' END as status
      FROM inventory_batches 
      WHERE julianday(expiry_date) - julianday('now') <= 90
      GROUP BY status
    `);
    
    return {
      totalBatches: totalBatches.count,
      totalQuantity: totalQty.total || 0,
      occupiedQuantity: totalQty.occupied || 0,
      pendingDeliveries: pendingDeliveries.count,
      pendingDiscrepancies: pendingDiscrepancies.count,
      expiringBatches: expiringBatches
    };
  }

  async exportBatches() {
    return all(`
      SELECT 
        m.code as 药品编码,
        m.name as 药品名称,
        b.batch_no as 批号,
        b.production_date as 生产日期,
        b.expiry_date as 有效期至,
        b.quantity as 库存数量,
        b.occupied_quantity as 已占用,
        (b.quantity - b.occupied_quantity) as 可用数量,
        s.name as 来源系统,
        b.warehouse_location as 库位,
        b.status as 状态
      FROM inventory_batches b
      JOIN medicines m ON b.medicine_id = m.id
      JOIN inventory_sources s ON b.source_id = s.id
      ORDER BY m.name, b.expiry_date
    `);
  }

  async createExpiryRule(data) {
    const id = uuidv4();
    if (data.is_default) {
      await run('UPDATE expiry_rules SET is_default = 0');
    }
    await run(
      'INSERT INTO expiry_rules (id, name, warning_days, critical_days, is_default) VALUES (?, ?, ?, ?, ?)',
      [id, data.name, data.warning_days, data.critical_days, data.is_default ? 1 : 0]
    );
    return get('SELECT * FROM expiry_rules WHERE id = ?', [id]);
  }

  async listExpiryRules() {
    return all('SELECT * FROM expiry_rules ORDER BY is_default DESC, created_at DESC');
  }

  async releaseOccupancy(occupancyId, operator, reason) {
    const occupancy = await this.getOccupancy(occupancyId);
    if (!occupancy) {
      const err = new Error('占用记录不存在');
      err.statusCode = 404;
      throw err;
    }
    if (occupancy.status !== 'active') {
      const err = new Error('占用记录状态不正确，当前状态: ' + occupancy.status);
      err.statusCode = 400;
      throw err;
    }

    await run('BEGIN TRANSACTION');
    try {
      await run(
        'UPDATE occupancy_records SET status = ?, released_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['released', occupancyId]
      );

      await run(
        'UPDATE inventory_batches SET occupied_quantity = occupied_quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [occupancy.quantity, occupancy.batch_id]
      );

      await run('COMMIT');
    } catch (err) {
      await run('ROLLBACK');
      throw err;
    }

    return this.getOccupancy(occupancyId);
  }

  async syncFromSource(sourceId, syncType, operator) {
    const source = await this.getSource(sourceId);
    if (!source) {
      const err = new Error('来源系统不存在');
      err.statusCode = 404;
      throw err;
    }
    if (!source.is_active) {
      const err = new Error('来源系统已停用');
      err.statusCode = 400;
      throw err;
    }

    const syncLogId = uuidv4();
    const requestId = uuidv4();

    await run(
      'INSERT INTO sync_logs (id, source_id, sync_type, status, request_id, started_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
      [syncLogId, sourceId, syncType, 'processing', requestId]
    );

    await new Promise(resolve => setTimeout(resolve, 1500));

    const existingMedicines = await all('SELECT id, code, name FROM medicines ORDER BY id');
    if (existingMedicines.length === 0) {
      const err = new Error('系统中无药品数据，请先导入药品基础数据');
      err.statusCode = 400;
      await run(
        'UPDATE sync_logs SET status = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['failed', err.message, syncLogId]
      );
      throw err;
    }

    const syncData = this.generateSyncData(source, syncType, existingMedicines);

    await run('BEGIN TRANSACTION');
    try {
      let recordCount = 0;

      for (const item of syncData) {
        const existing = await get(
          'SELECT id, quantity FROM inventory_batches WHERE medicine_id = ? AND batch_no = ? AND source_id = ?',
          [item.medicine_id, item.batch_no, sourceId]
        );

        if (existing) {
          await run(
            'UPDATE inventory_batches SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [item.quantity, existing.id]
          );
        } else {
          await run(
            `INSERT INTO inventory_batches (id, medicine_id, batch_no, expiry_date, quantity, occupied_quantity, source_id, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 0, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [uuidv4(), item.medicine_id, item.batch_no, item.expiry_date, item.quantity, sourceId, 'normal']
          );
        }
        recordCount++;
      }

      await run(
        'UPDATE sync_logs SET status = ?, record_count = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['success', recordCount, syncLogId]
      );

      await run('COMMIT');
    } catch (err) {
      await run(
        'UPDATE sync_logs SET status = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['failed', err.message, syncLogId]
      );
      await run('ROLLBACK');
      throw err;
    }

    return get('SELECT * FROM sync_logs WHERE id = ?', [syncLogId]);
  }

  generateSyncData(source, syncType, existingMedicines) {
    const today = new Date();
    const syncPrefix = `SYNC${source.type.substring(0, 2).toUpperCase()}${today.getFullYear()}`;
    
    const medicinesToSync = syncType === 'full' 
      ? existingMedicines 
      : [existingMedicines[Math.floor(Math.random() * existingMedicines.length)]];

    return medicinesToSync.map((med, idx) => ({
      medicine_id: med.id,
      name: med.name,
      batch_no: `${syncPrefix}${String(idx + 1).padStart(3, '0')}`,
      expiry_date: new Date(today.getFullYear() + 1, today.getMonth(), today.getDate()).toISOString().split('T')[0],
      quantity: Math.floor(Math.random() * 150) + 50
    }));
  }

  async listSyncLogs(params = {}) {
    let sql = `
      SELECT l.*, s.name as source_name
      FROM sync_logs l
      JOIN inventory_sources s ON l.source_id = s.id
      WHERE 1=1
    `;
    const paramsArr = [];

    if (params.source_id) {
      sql += ' AND l.source_id = ?';
      paramsArr.push(params.source_id);
    }

    sql += ' ORDER BY l.started_at DESC LIMIT 50';
    return all(sql, paramsArr);
  }

  async getSyncLog(id) {
    return get(`
      SELECT l.*, s.name as source_name
      FROM sync_logs l
      JOIN inventory_sources s ON l.source_id = s.id
      WHERE l.id = ?
    `, [id]);
  }
}

module.exports = new InventoryService();
