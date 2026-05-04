const { v4: uuidv4 } = require('uuid');
const { runAsync, getAsync, allAsync } = require('../config/database');
const Cage = require('./Cage');
const Animal = require('./Animal');

class TransferRecord {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.transfer_id = data.transfer_id;
    this.animal_id = data.animal_id;
    this.from_cage_id = data.from_cage_id;
    this.to_cage_id = data.to_cage_id;
    this.transfer_date = data.transfer_date;
    this.transfer_reason = data.transfer_reason;
    this.performed_by = data.performed_by;
    this.verified_by = data.verified_by;
    this.notes = data.notes;
    this.status = data.status || 'pending';
    this.created_at = data.created_at;
  }

  static async create(data) {
    const transfer = new TransferRecord(data);
    
    if (!transfer.transfer_id) {
      transfer.transfer_id = `TRF-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    }

    const existing = await getAsync(
      'SELECT * FROM transfer_records WHERE transfer_id = ?',
      [transfer.transfer_id]
    );
    
    if (existing) {
      await TransferRecord.update(transfer.transfer_id, data);
      return await TransferRecord.findByTransferId(transfer.transfer_id);
    }

    await runAsync(
      `INSERT INTO transfer_records 
       (id, transfer_id, animal_id, from_cage_id, to_cage_id, transfer_date, 
        transfer_reason, performed_by, verified_by, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [transfer.id, transfer.transfer_id, transfer.animal_id, 
       transfer.from_cage_id, transfer.to_cage_id, transfer.transfer_date,
       transfer.transfer_reason, transfer.performed_by, 
       transfer.verified_by, transfer.notes, transfer.status]
    );

    return transfer;
  }

  static async update(transferId, data) {
    const updates = [];
    const values = [];
    
    const allowedFields = [
      'animal_id', 'from_cage_id', 'to_cage_id', 'transfer_date',
      'transfer_reason', 'performed_by', 'verified_by', 'notes', 'status'
    ];
    
    allowedFields.forEach(field => {
      if (data[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(data[field]);
      }
    });

    values.push(transferId);

    await runAsync(
      `UPDATE transfer_records SET ${updates.join(', ')} WHERE transfer_id = ?`,
      values
    );
  }

  static async findByTransferId(transferId) {
    const row = await getAsync(
      'SELECT * FROM transfer_records WHERE transfer_id = ?',
      [transferId]
    );
    return row ? new TransferRecord(row) : null;
  }

  static async findAll(options = {}) {
    const { status, animal_id, limit = 100, offset = 0 } = options;
    let sql = 'SELECT * FROM transfer_records WHERE 1=1';
    const params = [];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    
    if (animal_id) {
      sql += ' AND animal_id = ?';
      params.push(animal_id);
    }

    sql += ' ORDER BY transfer_date DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = await allAsync(sql, params);
    return rows.map(row => new TransferRecord(row));
  }

  static async executeTransfer(transferId, verifiedBy) {
    const transfer = await TransferRecord.findByTransferId(transferId);
    
    if (!transfer) {
      throw new Error(`转笼记录不存在: ${transferId}`);
    }

    if (transfer.from_cage_id) {
      await Cage.endOccupancy(
        transfer.from_cage_id, 
        transfer.animal_id, 
        transfer.transfer_date
      );
    }

    await Cage.addOccupancy(
      transfer.to_cage_id,
      transfer.animal_id,
      transfer.transfer_date,
      transfer.transfer_reason,
      transfer.performed_by
    );

    await Animal.addTimelineEvent(transfer.animal_id, {
      event_type: 'transfer',
      event_id: transfer.transfer_id,
      event_time: transfer.transfer_date,
      description: `从 ${transfer.from_cage_id || '新入'} 转至 ${transfer.to_cage_id}`,
      metadata: {
        from_cage: transfer.from_cage_id,
        to_cage: transfer.to_cage_id,
        reason: transfer.transfer_reason,
        performed_by: transfer.performed_by
      }
    });

    await TransferRecord.update(transferId, {
      status: 'completed',
      verified_by: verifiedBy
    });

    return await TransferRecord.findByTransferId(transferId);
  }

  static async getAnimalTransferHistory(animalId) {
    const rows = await allAsync(
      `SELECT tr.*, 
        fc.rack_id as from_rack, fc.position as from_position,
        tc.rack_id as to_rack, tc.position as to_position
       FROM transfer_records tr
       LEFT JOIN cages fc ON tr.from_cage_id = fc.cage_id
       LEFT JOIN cages tc ON tr.to_cage_id = tc.cage_id
       WHERE tr.animal_id = ?
       ORDER BY tr.transfer_date ASC`,
      [animalId]
    );
    return rows.map(row => new TransferRecord(row));
  }

  static async checkDuplicateTransfer(animalId, fromCageId, toCageId, transferDate) {
    const rows = await allAsync(
      `SELECT * FROM transfer_records 
       WHERE animal_id = ? 
       AND from_cage_id = ? 
       AND to_cage_id = ? 
       AND DATE(transfer_date) = DATE(?)
       AND status IN ('pending', 'completed')`,
      [animalId, fromCageId, toCageId, transferDate]
    );
    return rows.length > 0;
  }

  static async getPendingTransfers() {
    const rows = await allAsync(
      `SELECT tr.*, a.species, a.strain,
        fc.rack_id as from_rack, tc.rack_id as to_rack
       FROM transfer_records tr
       JOIN animals a ON tr.animal_id = a.animal_id
       LEFT JOIN cages fc ON tr.from_cage_id = fc.cage_id
       LEFT JOIN cages tc ON tr.to_cage_id = tc.cage_id
       WHERE tr.status = 'pending'
       ORDER BY tr.transfer_date ASC`
    );
    return rows.map(row => new TransferRecord(row));
  }
}

module.exports = TransferRecord;
