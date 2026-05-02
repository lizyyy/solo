const db = require('../database');
const Batch = require('../../models/Batch');

class BatchRepository {
  async create(batch) {
    const sql = `
      INSERT INTO batches (
        id, chemical_id, batch_number, production_date, expiry_date,
        initial_quantity, current_quantity, unit, supplier, manufacturer,
        storage_location, status, created_at, updated_at, created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      batch.id, batch.chemical_id, batch.batch_number, batch.production_date,
      batch.expiry_date, batch.initial_quantity, batch.current_quantity,
      batch.unit, batch.supplier, batch.manufacturer, batch.storage_location,
      batch.status, batch.created_at, batch.updated_at, batch.created_by, batch.updated_by
    ];
    
    await db.run(sql, params);
    return batch;
  }

  async update(batch) {
    const sql = `
      UPDATE batches SET
        chemical_id = ?, batch_number = ?, production_date = ?, expiry_date = ?,
        initial_quantity = ?, current_quantity = ?, unit = ?, supplier = ?,
        manufacturer = ?, storage_location = ?, status = ?, updated_at = ?, updated_by = ?
      WHERE id = ?
    `;
    
    const params = [
      batch.chemical_id, batch.batch_number, batch.production_date, batch.expiry_date,
      batch.initial_quantity, batch.current_quantity, batch.unit, batch.supplier,
      batch.manufacturer, batch.storage_location, batch.status, batch.updated_at,
      batch.updated_by, batch.id
    ];
    
    await db.run(sql, params);
    return batch;
  }

  async delete(id) {
    const sql = 'DELETE FROM batches WHERE id = ?';
    const result = await db.run(sql, [id]);
    return result.changes > 0;
  }

  async findById(id) {
    const sql = 'SELECT * FROM batches WHERE id = ?';
    const row = await db.get(sql, [id]);
    if (row) {
      return new Batch(row);
    }
    return null;
  }

  async findAll(options = {}) {
    let sql = 'SELECT * FROM batches WHERE 1=1';
    const params = [];
    
    if (options.chemical_id) {
      sql += ' AND chemical_id = ?';
      params.push(options.chemical_id);
    }
    
    if (options.batch_number) {
      sql += ' AND batch_number LIKE ?';
      params.push(`%${options.batch_number}%`);
    }
    
    if (options.status) {
      sql += ' AND status = ?';
      params.push(options.status);
    }
    
    if (options.is_expired) {
      const now = new Date().toISOString();
      sql += ' AND expiry_date < ?';
      params.push(now);
    }
    
    if (options.sortBy) {
      const sortOrder = options.sortOrder === 'desc' ? 'DESC' : 'ASC';
      sql += ` ORDER BY ${options.sortBy} ${sortOrder}`;
    } else {
      sql += ' ORDER BY created_at DESC';
    }
    
    if (options.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }
    
    if (options.offset) {
      sql += ' OFFSET ?';
      params.push(options.offset);
    }
    
    const rows = await db.all(sql, params);
    return rows.map(row => new Batch(row));
  }

  async count(options = {}) {
    let sql = 'SELECT COUNT(*) as total FROM batches WHERE 1=1';
    const params = [];
    
    if (options.chemical_id) {
      sql += ' AND chemical_id = ?';
      params.push(options.chemical_id);
    }
    
    if (options.batch_number) {
      sql += ' AND batch_number LIKE ?';
      params.push(`%${options.batch_number}%`);
    }
    
    if (options.status) {
      sql += ' AND status = ?';
      params.push(options.status);
    }
    
    const result = await db.get(sql, params);
    return result.total;
  }

  async findByBatchNumber(batchNumber) {
    const sql = 'SELECT * FROM batches WHERE batch_number = ?';
    const row = await db.get(sql, [batchNumber]);
    if (row) {
      return new Batch(row);
    }
    return null;
  }

  async findByChemicalId(chemicalId) {
    const sql = 'SELECT * FROM batches WHERE chemical_id = ? ORDER BY created_at DESC';
    const rows = await db.all(sql, [chemicalId]);
    return rows.map(row => new Batch(row));
  }

  async updateCurrentQuantity(id, quantity) {
    const sql = 'UPDATE batches SET current_quantity = ? WHERE id = ?';
    await db.run(sql, [quantity, id]);
  }

  async deductStock(id, quantity) {
    const sql = 'UPDATE batches SET current_quantity = current_quantity - ? WHERE id = ?';
    const result = await db.run(sql, [quantity, id]);
    return result.changes > 0;
  }

  async addStock(id, quantity) {
    const sql = 'UPDATE batches SET current_quantity = current_quantity + ? WHERE id = ?';
    const result = await db.run(sql, [quantity, id]);
    return result.changes > 0;
  }

  async getExpiringBatches(daysThreshold) {
    const now = new Date();
    const thresholdDate = new Date(now.getTime() + daysThreshold * 24 * 60 * 60 * 1000);
    
    const sql = `
      SELECT * FROM batches 
      WHERE expiry_date <= ? AND expiry_date >= ? AND status = 'active'
      ORDER BY expiry_date ASC
    `;
    
    const rows = await db.all(sql, [thresholdDate.toISOString(), now.toISOString()]);
    return rows.map(row => new Batch(row));
  }

  async getLowStockBatches(threshold) {
    const sql = `
      SELECT * FROM batches 
      WHERE current_quantity <= ? AND status = 'active'
      ORDER BY current_quantity ASC
    `;
    
    const rows = await db.all(sql, [threshold]);
    return rows.map(row => new Batch(row));
  }

  async createMany(batches) {
    return db.transaction(async (tx) => {
      for (const batch of batches) {
        const sql = `
          INSERT INTO batches (
            id, chemical_id, batch_number, production_date, expiry_date,
            initial_quantity, current_quantity, unit, supplier, manufacturer,
            storage_location, status, created_at, updated_at, created_by, updated_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const params = [
          batch.id, batch.chemical_id, batch.batch_number, batch.production_date,
          batch.expiry_date, batch.initial_quantity, batch.current_quantity,
          batch.unit, batch.supplier, batch.manufacturer, batch.storage_location,
          batch.status, batch.created_at, batch.updated_at, batch.created_by, batch.updated_by
        ];
        
        await tx.run(sql, params);
      }
      return batches;
    });
  }
}

module.exports = BatchRepository;
