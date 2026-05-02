import { getOne, getAll, runQuery } from '../database/db.js';

export const RulesEngine = {
  validatePriority(guest) {
    const priorityScore = {
      elderly: 100,
      child: 90,
      disability: 80,
      normal: 10
    };
    
    let score = 0;
    if (guest.is_elderly) score += priorityScore.elderly;
    if (guest.is_child) score += priorityScore.child;
    if (guest.has_disability) score += priorityScore.disability;
    if (score === 0) score = priorityScore.normal;
    
    return {
      score,
      priority: score >= 80 ? 'high' : 'normal',
      tags: [
        guest.is_elderly && '老人',
        guest.is_child && '儿童',
        guest.has_disability && '行动不便'
      ].filter(Boolean)
    };
  },

  validateShipCapacity(shipId, additionalGuests = 1) {
    const ship = getOne(
      'SELECT * FROM ships WHERE id = ?',
      [shipId]
    );
    
    if (!ship) {
      return { valid: false, error: '船班不存在' };
    }
    
    const newLoad = ship.current_load + additionalGuests;
    const isOverCapacity = newLoad > ship.capacity;
    
    return {
      valid: !isOverCapacity,
      error: isOverCapacity ? `船班容量不足：当前${ship.current_load}人，容量${ship.capacity}人` : null,
      currentLoad: ship.current_load,
      capacity: ship.capacity,
      available: ship.capacity - ship.current_load
    };
  },

  validateSupplyThreshold(supplyType) {
    const supplies = getAll(
      'SELECT * FROM supplies WHERE type = ?',
      [supplyType]
    );
    
    const results = [];
    for (const supply of supplies) {
      const isLow = supply.quantity <= supply.min_threshold;
      const percentage = supply.min_threshold > 0 ? (supply.quantity / supply.min_threshold * 100) : 100;
      
      results.push({
        id: supply.id,
        name: supply.name,
        quantity: supply.quantity,
        unit: supply.unit,
        minThreshold: supply.min_threshold,
        percentage: Math.round(percentage),
        status: isLow ? 'critical' : 'sufficient',
        warning: isLow ? `${supply.name}不足：${supply.quantity}${supply.unit}，底线${supply.min_threshold}${supply.unit}` : null
      });
    }
    
    return {
      allSufficient: results.every(r => r.status === 'sufficient'),
      supplies: results,
      warnings: results.filter(r => r.status === 'critical').map(r => r.warning)
    };
  },

  validateRoomClearForSeal(roomId) {
    const room = getOne(
      'SELECT * FROM rooms WHERE id = ?',
      [roomId]
    );
    
    if (!room) {
      return { valid: false, error: '房间不存在' };
    }
    
    if (room.is_evacuated === 0 && room.is_occupied === 1) {
      const guests = getAll(
        'SELECT * FROM guests WHERE room_id = ? AND is_evacuated = 0',
        [roomId]
      );
      
      if (guests.length > 0) {
        return {
          valid: false,
          error: `房间${room.room_number}还有${guests.length}名住客未撤离，无法封窗`,
          remainingGuests: guests.map(g => g.name)
        };
      }
    }
    
    return {
      valid: true,
      room: {
        id: room.id,
        roomNumber: room.room_number,
        isEvacuated: room.is_evacuated === 1,
        isOccupied: room.is_occupied === 1
      }
    };
  },

  validateEvacuationBatchCapacity(batchId, additionalGuests = 1) {
    const batch = getOne(
      `SELECT eb.*, s.capacity as ship_capacity 
       FROM evacuation_batches eb 
       LEFT JOIN ships s ON eb.ship_id = s.id 
       WHERE eb.id = ?`,
      [batchId]
    );
    
    if (!batch) {
      return { valid: false, error: '撤离批次不存在' };
    }
    
    const maxCapacity = batch.max_capacity || batch.ship_capacity || 10;
    const newCount = batch.guest_count + additionalGuests;
    
    return {
      valid: newCount <= maxCapacity,
      error: newCount > maxCapacity ? `批次容量不足：当前${batch.guest_count}人，最大${maxCapacity}人` : null,
      currentCount: batch.guest_count,
      maxCapacity,
      available: maxCapacity - batch.guest_count
    };
  },

  validateGuestAssignment(guestId, batchId) {
    const guest = getOne(
      'SELECT * FROM guests WHERE id = ?',
      [guestId]
    );
    
    if (!guest) {
      return { valid: false, error: '住客不存在' };
    }
    
    if (guest.is_evacuated === 1) {
      return { valid: false, error: '该住客已完成撤离' };
    }
    
    const batchValidation = this.validateEvacuationBatchCapacity(batchId, 1);
    if (!batchValidation.valid) {
      return batchValidation;
    }
    
    const batch = getOne(
      'SELECT * FROM evacuation_batches WHERE id = ?',
      [batchId]
    );
    
    if (batch && batch.ship_id) {
      const shipValidation = this.validateShipCapacity(batch.ship_id, 1);
      if (!shipValidation.valid) {
        return shipValidation;
      }
    }
    
    return {
      valid: true,
      guest: {
        id: guest.id,
        name: guest.name,
        priority: this.validatePriority(guest)
      },
      batch: batch
    };
  },

  validateAllSupplies() {
    const types = ['fuel', 'water', 'food', 'medicine'];
    const results = {};
    
    for (const type of types) {
      results[type] = this.validateSupplyThreshold(type);
    }
    
    const allWarnings = Object.values(results)
      .flatMap(r => r.warnings);
    
    return {
      allSufficient: Object.values(results).every(r => r.allSufficient),
      byType: results,
      allWarnings
    };
  },

  getPriorityGuests() {
    return getAll(`
      SELECT g.*, r.room_number
      FROM guests g
      LEFT JOIN rooms r ON g.room_id = r.id
      WHERE (g.is_elderly = 1 OR g.is_child = 1 OR g.has_disability = 1)
        AND g.is_evacuated = 0
      ORDER BY 
        CASE WHEN g.is_elderly = 1 THEN 1 
             WHEN g.is_child = 1 THEN 2 
             WHEN g.has_disability = 1 THEN 3 
             ELSE 4 END
    `);
  }
};

export default RulesEngine;
