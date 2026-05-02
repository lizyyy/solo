import { v4 as uuidv4 } from 'uuid';
import { getOne, getAll, runQuery, getDatabase } from '../database/db.js';
import { RulesEngine } from './rulesEngine.js';

export const Scheduler = {
  generateEvacuationPlan(options = {}) {
    const { useShips = true, batchSize = 20, priorityFirst = true } = options;
    
    const db = getDatabase();
    const result = {
      planId: uuidv4(),
      generatedAt: new Date().toISOString(),
      batches: [],
      statistics: {
        totalGuests: 0,
        evacuatedGuests: 0,
        pendingGuests: 0,
        priorityGuests: 0,
        shipsUsed: [],
        warnings: []
      },
      warnings: []
    };

    const allGuests = getAll(`
      SELECT g.*, r.room_number
      FROM guests g
      LEFT JOIN rooms r ON g.room_id = r.id
      WHERE g.is_evacuated = 0
      ORDER BY 
        CASE WHEN g.is_elderly = 1 THEN 1 
             WHEN g.is_child = 1 THEN 2 
             WHEN g.has_disability = 1 THEN 3 
             ELSE 4 END,
        r.room_number
    `);

    result.statistics.totalGuests = getAll('SELECT COUNT(*) as count FROM guests')[0].count;
    result.statistics.evacuatedGuests = getAll('SELECT COUNT(*) as count FROM guests WHERE is_evacuated = 1')[0].count;
    result.statistics.pendingGuests = allGuests.length;
    result.statistics.priorityGuests = allGuests.filter(g => g.is_elderly || g.is_child || g.has_disability).length;

    if (allGuests.length === 0) {
      result.warnings.push('所有住客已完成撤离，无需生成撤离计划');
      return result;
    }

    let availableShips = [];
    if (useShips) {
      availableShips = getAll(`
        SELECT * FROM ships 
        WHERE status = 'available' AND capacity > current_load
        ORDER BY capacity DESC
      `);
      
      if (availableShips.length === 0) {
        result.warnings.push('没有可用船班，将按批次生成计划');
      } else {
        result.statistics.shipsUsed = availableShips.map(s => ({
          id: s.id,
          name: s.name,
          capacity: s.capacity,
          available: s.capacity - s.current_load
        }));
      }
    }

    const supplyStatus = RulesEngine.validateAllSupplies();
    if (!supplyStatus.allSufficient) {
      result.statistics.warnings.push(...supplyStatus.allWarnings);
      result.warnings.push('部分物资低于保底线，请及时补充');
    }

    const batches = this._createBatches(allGuests, availableShips, batchSize);
    result.batches = batches;

    return result;
  },

  _createBatches(guests, availableShips, defaultBatchSize) {
    const batches = [];
    let currentBatchIndex = 1;
    let shipIndex = 0;
    
    const priorityGuests = guests.filter(g => g.is_elderly || g.is_child || g.has_disability);
    const normalGuests = guests.filter(g => !g.is_elderly && !g.is_child && !g.has_disability);
    const sortedGuests = [...priorityGuests, ...normalGuests];

    let remainingGuests = [...sortedGuests];

    while (remainingGuests.length > 0) {
      let currentShip = null;
      let batchCapacity = defaultBatchSize;

      if (availableShips.length > 0 && shipIndex < availableShips.length) {
        currentShip = availableShips[shipIndex];
        batchCapacity = currentShip.capacity - currentShip.current_load;
        
        if (batchCapacity <= 0) {
          shipIndex++;
          continue;
        }
      }

      const batchGuests = remainingGuests.slice(0, batchCapacity);
      remainingGuests = remainingGuests.slice(batchCapacity);

      const batch = {
        id: `batch_${uuidv4().substring(0, 8)}`,
        batchNumber: currentBatchIndex,
        priority: batchGuests.some(g => g.is_elderly || g.is_child || g.has_disability) ? 'high' : 'normal',
        status: 'planned',
        scheduledTime: null,
        ship: currentShip ? {
          id: currentShip.id,
          name: currentShip.name,
          capacity: currentShip.capacity
        } : null,
        guests: batchGuests.map(g => ({
          id: g.id,
          name: g.name,
          roomNumber: g.room_number,
          age: g.age,
          gender: g.gender,
          phone: g.phone,
          isElderly: g.is_elderly === 1,
          isChild: g.is_child === 1,
          hasDisability: g.has_disability === 1,
          priorityTags: RulesEngine.validatePriority(g).tags
        })),
        guestCount: batchGuests.length,
        maxCapacity: batchCapacity
      };

      batches.push(batch);
      currentBatchIndex++;

      if (currentShip) {
        shipIndex++;
      }
    }

    return batches;
  },

  saveEvacuationPlan(plan) {
    const db = getDatabase();
    const transaction = db.transaction(() => {
      runQuery('DELETE FROM evacuation_batches WHERE status = "planned"');

      for (const batch of plan.batches) {
        const batchId = uuidv4();
        
        runQuery(`
          INSERT INTO evacuation_batches (id, batch_number, ship_id, priority, status, guest_count, max_capacity)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          batchId,
          batch.batchNumber,
          batch.ship?.id || null,
          batch.priority,
          batch.status,
          batch.guestCount,
          batch.maxCapacity
        ]);

        for (const guest of batch.guests) {
          runQuery(`
            UPDATE guests 
            SET evacuation_batch_id = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [batchId, guest.id]);
        }
      }

      this._logAudit('generate_plan', 'evacuation_plan', plan.planId, {
        batchCount: plan.batches.length,
        totalGuests: plan.statistics.pendingGuests
      });
    });

    transaction();
    return { success: true, planId: plan.planId };
  },

  assignGuestToBatch(guestId, batchId) {
    const validation = RulesEngine.validateGuestAssignment(guestId, batchId);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const db = getDatabase();
    const transaction = db.transaction(() => {
      runQuery(`
        UPDATE guests 
        SET evacuation_batch_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [batchId, guestId]);

      runQuery(`
        UPDATE evacuation_batches 
        SET guest_count = guest_count + 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [batchId]);

      this._logAudit('assign_guest', 'guest', guestId, { batchId });
    });

    transaction();
    return { success: true };
  },

  removeGuestFromBatch(guestId, batchId) {
    const db = getDatabase();
    const transaction = db.transaction(() => {
      runQuery(`
        UPDATE guests 
        SET evacuation_batch_id = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [guestId]);

      runQuery(`
        UPDATE evacuation_batches 
        SET guest_count = MAX(0, guest_count - 1), updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [batchId]);

      this._logAudit('remove_guest', 'guest', guestId, { batchId });
    });

    transaction();
    return { success: true };
  },

  markGuestEvacuated(guestId) {
    const guest = getOne('SELECT * FROM guests WHERE id = ?', [guestId]);
    if (!guest) {
      return { success: false, error: '住客不存在' };
    }

    const db = getDatabase();
    const transaction = db.transaction(() => {
      runQuery(`
        UPDATE guests 
        SET is_evacuated = 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [guestId]);

      if (guest.room_id) {
        const remainingGuests = getAll(
          'SELECT COUNT(*) as count FROM guests WHERE room_id = ? AND is_evacuated = 0',
          [guest.room_id]
        );

        if (remainingGuests[0].count === 0) {
          runQuery(`
            UPDATE rooms 
            SET is_evacuated = 1, is_occupied = 0, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [guest.room_id]);
        }
      }

      if (guest.evacuation_batch_id) {
        const batchGuests = getAll(
          'SELECT COUNT(*) as count FROM guests WHERE evacuation_batch_id = ? AND is_evacuated = 0',
          [guest.evacuation_batch_id]
        );

        if (batchGuests[0].count === 0) {
          runQuery(`
            UPDATE evacuation_batches 
            SET status = 'completed', updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [guest.evacuation_batch_id]);
        }
      }

      this._logAudit('evacuate_guest', 'guest', guestId, { 
        name: guest.name,
        roomId: guest.room_id
      });
    });

    transaction();
    return { success: true };
  },

  sealRoomWindow(roomId) {
    const validation = RulesEngine.validateRoomClearForSeal(roomId);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    runQuery(`
      UPDATE rooms 
      SET is_window_sealed = 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [roomId]);

    this._logAudit('seal_window', 'room', roomId, validation.room);
    return { success: true };
  },

  _logAudit(action, entityType, entityId, details) {
    runQuery(`
      INSERT INTO audit_logs (id, action, entity_type, entity_id, details)
      VALUES (?, ?, ?, ?, ?)
    `, [
      uuidv4(),
      action,
      entityType,
      entityId,
      JSON.stringify(details)
    ]);
  },

  getEvacuationStatus() {
    const guests = getAll('SELECT * FROM guests');
    const evacuated = guests.filter(g => g.is_evacuated === 1);
    const pending = guests.filter(g => g.is_evacuated === 0);
    
    const rooms = getAll('SELECT * FROM rooms');
    const occupied = rooms.filter(r => r.is_occupied === 1);
    const evacuatedRooms = rooms.filter(r => r.is_evacuated === 1);
    const sealedRooms = rooms.filter(r => r.is_window_sealed === 1);

    const batches = getAll('SELECT * FROM evacuation_batches ORDER BY batch_number');

    return {
      guests: {
        total: guests.length,
        evacuated: evacuated.length,
        pending: pending.length,
        percentage: guests.length > 0 ? Math.round((evacuated.length / guests.length) * 100) : 0
      },
      rooms: {
        total: rooms.length,
        occupied: occupied.length,
        evacuated: evacuatedRooms.length,
        sealed: sealedRooms.length
      },
      batches: {
        total: batches.length,
        completed: batches.filter(b => b.status === 'completed').length,
        inProgress: batches.filter(b => b.status === 'in_progress').length,
        planned: batches.filter(b => b.status === 'planned').length
      },
      supplies: RulesEngine.validateAllSupplies()
    };
  }
};

export default Scheduler;
