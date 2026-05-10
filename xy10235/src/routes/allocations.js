const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../config/database');
const { 
  VALID_STATUSES, 
  validateStatusTransition, 
  findSuitableCage, 
  validateTransfer 
} = require('../services/allocation-engine');

const router = express.Router();

function addHistory(db, allocationId, fromStatus, toStatus, action, reason, operator) {
  db.prepare(`
    INSERT INTO allocation_history (allocation_id, from_status, to_status, action, reason, operator)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(allocationId, fromStatus, toStatus, action, reason, operator);
}

function updateCageOccupancy(db, cageId, change) {
  if (!cageId) return;
  
  const cage = db.prepare('SELECT * FROM cages WHERE id = ?').get(cageId);
  if (!cage) return;
  
  const newOccupancy = Math.max(0, cage.current_occupancy + change);
  const newStatus = newOccupancy === 0 ? 'available' : (newOccupancy >= cage.max_capacity ? 'occupied' : 'occupied');
  
  db.prepare(`
    UPDATE cages 
    SET current_occupancy = ?, status = ?, updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(newOccupancy, newStatus, cageId);
}

router.get('/', (req, res) => {
  try {
    const { status, animal_id, action } = req.query;
    const db = getDB();
    
    let query = `
      SELECT a.*, 
             an.animal_id as animal_identifier, an.gender,
             s.code as strain_code, s.name as strain_name,
             c.code as cage_code, c.room as cage_room, c.rack as cage_rack,
             ir.code as isolation_code, ir.name as isolation_name
      FROM allocations a
      LEFT JOIN animals an ON a.animal_id = an.id
      LEFT JOIN strains s ON an.strain_id = s.id
      LEFT JOIN cages c ON a.cage_id = c.id
      LEFT JOIN isolation_rules ir ON an.isolation_rule_id = ir.id
      WHERE 1=1
    `;
    const params = [];
    
    if (status) {
      query += ' AND a.status = ?';
      params.push(status);
    }
    if (animal_id) {
      query += ' AND a.animal_id = ?';
      params.push(animal_id);
    }
    if (action) {
      query += ' AND a.action = ?';
      params.push(action);
    }
    
    query += ' ORDER BY a.created_at DESC';
    
    const allocations = db.prepare(query).all(...params);
    
    res.json({
      success: true,
      data: allocations
    });
  } catch (error) {
    console.error('获取分配记录列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取分配记录列表失败',
      error: error.message
    });
  }
});

router.get('/:id', (req, res) => {
  try {
    const db = getDB();
    const allocation = db.prepare(`
      SELECT a.*, 
             an.animal_id as animal_identifier, an.gender, an.birth_date,
             s.code as strain_code, s.name as strain_name,
             c.code as cage_code, c.room as cage_room, c.rack as cage_rack, c.position as cage_position,
             c.max_capacity as cage_max_capacity, c.current_occupancy as cage_current_occupancy,
             ir.code as isolation_code, ir.name as isolation_name, ir.level as isolation_level,
             pc.code as previous_cage_code
      FROM allocations a
      LEFT JOIN animals an ON a.animal_id = an.id
      LEFT JOIN strains s ON an.strain_id = s.id
      LEFT JOIN cages c ON a.cage_id = c.id
      LEFT JOIN cages pc ON a.previous_cage_id = pc.id
      LEFT JOIN isolation_rules ir ON an.isolation_rule_id = ir.id
      WHERE a.id = ?
    `).get(req.params.id);
    
    if (!allocation) {
      return res.status(404).json({
        success: false,
        message: '分配记录不存在'
      });
    }
    
    const history = db.prepare(`
      SELECT * FROM allocation_history 
      WHERE allocation_id = ? 
      ORDER BY created_at ASC
    `).all(req.params.id);
    
    allocation.history = history;
    
    res.json({
      success: true,
      data: allocation
    });
  } catch (error) {
    console.error('获取分配记录详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取分配记录详情失败',
      error: error.message
    });
  }
});

router.post('/', (req, res) => {
  try {
    const { request_id, animal_id, cage_id, action, reason, operator } = req.body;
    
    if (!request_id || !animal_id || !action) {
      return res.status(400).json({
        success: false,
        message: '请求ID、动物ID和动作为必填项'
      });
    }
    
    const validActions = ['initial_allocation', 'transfer', 'release', 'temporary_move'];
    if (!validActions.includes(action)) {
      return res.status(400).json({
        success: false,
        message: `动作无效，有效值为: ${validActions.join(', ')}`
      });
    }
    
    const db = getDB();
    
    const existing = db.prepare('SELECT * FROM allocations WHERE request_id = ?').get(request_id);
    if (existing) {
      return res.status(200).json({
        success: true,
        message: '重复请求，返回已有记录',
        idempotent: true,
        data: existing
      });
    }
    
    const animal = db.prepare('SELECT * FROM animals WHERE id = ?').get(animal_id);
    if (!animal) {
      return res.status(400).json({
        success: false,
        message: '动物不存在',
        code: 'ANIMAL_NOT_FOUND'
      });
    }
    
    const currentAllocation = db.prepare(`
      SELECT * FROM allocations 
      WHERE animal_id = ? AND status IN ('allocated', 'in_transit', 'completed')
      ORDER BY created_at DESC
      LIMIT 1
    `).get(animal_id);
    
    let targetCageId = cage_id;
    let validationRules = [];
    let previousCageId = null;
    let sourceAllocationId = null;
    
    if (action === 'initial_allocation') {
      if (currentAllocation) {
        return res.status(400).json({
          success: false,
          message: '该动物已有有效的分配记录，无法进行初始分配',
          code: 'ANIMAL_ALREADY_ALLOCATED'
        });
      }
      
      if (!targetCageId) {
        const cageResult = findSuitableCage(animal, db);
        if (!cageResult.success) {
          return res.status(400).json({
            success: false,
            message: cageResult.message,
            code: 'NO_SUITABLE_CAGE',
            rules: cageResult.rules
          });
        }
        targetCageId = cageResult.cage.id;
        validationRules = cageResult.validations;
      } else {
        const cage = db.prepare('SELECT * FROM cages WHERE id = ?').get(targetCageId);
        if (!cage) {
          return res.status(400).json({
            success: false,
            message: '指定的笼位不存在'
          });
        }
        
        if (cage.strain_id && cage.strain_id !== animal.strain_id) {
          return res.status(400).json({
            success: false,
            message: '指定笼位的品系与动物品系不匹配',
            code: 'STRAIN_MISMATCH'
          });
        }
        
        if (cage.gender && cage.gender !== animal.gender && cage.gender !== 'mixed') {
          return res.status(400).json({
            success: false,
            message: '指定笼位的性别与动物性别不匹配',
            code: 'GENDER_MISMATCH'
          });
        }
        
        if (cage.current_occupancy >= cage.max_capacity) {
          return res.status(400).json({
            success: false,
            message: '指定笼位已满',
            code: 'CAGE_FULL'
          });
        }
        
        validationRules = [
          { rule: 'strain_match', passed: true, message: '品系检查通过' },
          { rule: 'gender_match', passed: true, message: '性别检查通过' },
          { rule: 'capacity_available', passed: true, message: '容量检查通过' }
        ];
      }
    } else if (action === 'transfer' || action === 'temporary_move') {
      if (!currentAllocation || !currentAllocation.cage_id) {
        return res.status(400).json({
          success: false,
          message: '动物当前没有有效的笼位分配，无法转笼',
          code: 'NO_CURRENT_ALLOCATION'
        });
      }
      
      if (!targetCageId) {
        return res.status(400).json({
          success: false,
          message: '转笼操作必须指定目标笼位',
          code: 'TARGET_CAGE_REQUIRED'
        });
      }
      
      const transferResult = validateTransfer(animal_id, targetCageId, db);
      if (!transferResult.success) {
        return res.status(400).json({
          success: false,
          message: transferResult.message,
          code: transferResult.code || 'TRANSFER_VALIDATION_FAILED',
          validations: transferResult.validations,
          warning: transferResult.warning
        });
      }
      
      previousCageId = currentAllocation.cage_id;
      sourceAllocationId = currentAllocation.id;
      validationRules = transferResult.validations;
    } else if (action === 'release') {
      if (!currentAllocation || !currentAllocation.cage_id) {
        return res.status(400).json({
          success: false,
          message: '动物当前没有有效的笼位分配，无法释放',
          code: 'NO_CURRENT_ALLOCATION'
        });
      }
      targetCageId = null;
      previousCageId = currentAllocation.cage_id;
      sourceAllocationId = currentAllocation.id;
    }
    
    const status = action === 'initial_allocation' ? 'pending' : 'pending';
    
    const result = db.prepare(`
      INSERT INTO allocations (request_id, animal_id, cage_id, status, action, reason, operator, 
                               previous_cage_id, source_allocation_id, validation_rules)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      request_id, animal_id, targetCageId, status, action, reason || null, operator || null,
      previousCageId, sourceAllocationId, JSON.stringify(validationRules)
    );
    
    const allocation = db.prepare(`
      SELECT a.*, 
             an.animal_id as animal_identifier, an.gender,
             s.code as strain_code, s.name as strain_name,
             c.code as cage_code, c.room as cage_room
      FROM allocations a
      LEFT JOIN animals an ON a.animal_id = an.id
      LEFT JOIN strains s ON an.strain_id = s.id
      LEFT JOIN cages c ON a.cage_id = c.id
      WHERE a.id = ?
    `).get(result.lastInsertRowid);
    
    addHistory(db, allocation.id, null, status, 'create', reason || '创建分配记录', operator);
    
    res.status(201).json({
      success: true,
      message: '分配记录创建成功',
      data: allocation,
      validationRules
    });
  } catch (error) {
    console.error('创建分配记录失败:', error);
    res.status(500).json({
      success: false,
      message: '创建分配记录失败',
      error: error.message
    });
  }
});

router.post('/:id/advance', (req, res) => {
  try {
    const { to_status, reason, operator } = req.body;
    const allocationId = req.params.id;
    
    if (!to_status) {
      return res.status(400).json({
        success: false,
        message: '目标状态为必填项'
      });
    }
    
    if (!VALID_STATUSES.includes(to_status)) {
      return res.status(400).json({
        success: false,
        message: `无效的状态值，有效值为: ${VALID_STATUSES.join(', ')}`
      });
    }
    
    const db = getDB();
    
    const allocation = db.prepare('SELECT * FROM allocations WHERE id = ?').get(allocationId);
    if (!allocation) {
      return res.status(404).json({
        success: false,
        message: '分配记录不存在'
      });
    }
    
    if (allocation.status === to_status) {
      return res.status(200).json({
        success: true,
        message: '状态已是目标状态，无需变更',
        idempotent: true,
        data: allocation
      });
    }
    
    if (!validateStatusTransition(allocation.status, to_status)) {
      return res.status(400).json({
        success: false,
        message: `状态转换无效: ${allocation.status} -> ${to_status}`,
        code: 'INVALID_STATUS_TRANSITION'
      });
    }
    
    const fromStatus = allocation.status;
    
    if (to_status === 'allocated' && allocation.cage_id) {
      updateCageOccupancy(db, allocation.cage_id, 1);
      
      if (allocation.source_allocation_id && allocation.previous_cage_id) {
        db.prepare(`
          UPDATE allocations 
          SET status = 'completed', updated_at = datetime('now', 'localtime')
          WHERE id = ?
        `).run(allocation.source_allocation_id);
        
        updateCageOccupancy(db, allocation.previous_cage_id, -1);
      }
    }
    
    if (to_status === 'completed' && allocation.action === 'release' && allocation.previous_cage_id) {
      updateCageOccupancy(db, allocation.previous_cage_id, -1);
    }
    
    db.prepare(`
      UPDATE allocations 
      SET status = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(to_status, allocationId);
    
    addHistory(db, allocationId, fromStatus, to_status, 'advance', reason || `状态推进至 ${to_status}`, operator);
    
    const updated = db.prepare(`
      SELECT a.*, 
             an.animal_id as animal_identifier, an.gender,
             s.code as strain_code, s.name as strain_name,
             c.code as cage_code, c.room as cage_room
      FROM allocations a
      LEFT JOIN animals an ON a.animal_id = an.id
      LEFT JOIN strains s ON an.strain_id = s.id
      LEFT JOIN cages c ON a.cage_id = c.id
      WHERE a.id = ?
    `).get(allocationId);
    
    res.json({
      success: true,
      message: `状态成功推进至 ${to_status}`,
      data: updated,
      transition: {
        from: fromStatus,
        to: to_status
      }
    });
  } catch (error) {
    console.error('推进分配记录状态失败:', error);
    res.status(500).json({
      success: false,
      message: '推进分配记录状态失败',
      error: error.message
    });
  }
});

router.post('/:id/cancel', (req, res) => {
  try {
    const { reason, operator } = req.body;
    const allocationId = req.params.id;
    
    const db = getDB();
    
    const allocation = db.prepare('SELECT * FROM allocations WHERE id = ?').get(allocationId);
    if (!allocation) {
      return res.status(404).json({
        success: false,
        message: '分配记录不存在'
      });
    }
    
    if (allocation.status === 'cancelled') {
      return res.status(200).json({
        success: true,
        message: '记录已处于取消状态',
        idempotent: true,
        data: allocation
      });
    }
    
    const cancellableStatuses = ['pending', 'validating', 'approved', 'allocated'];
    if (!cancellableStatuses.includes(allocation.status)) {
      return res.status(400).json({
        success: false,
        message: `当前状态 ${allocation.status} 不可取消`,
        code: 'STATUS_NOT_CANCELLABLE'
      });
    }
    
    const fromStatus = allocation.status;
    
    if (allocation.status === 'allocated' && allocation.cage_id) {
      updateCageOccupancy(db, allocation.cage_id, -1);
    }
    
    db.prepare(`
      UPDATE allocations 
      SET status = 'cancelled', updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(allocationId);
    
    addHistory(db, allocationId, fromStatus, 'cancelled', 'cancel', reason || '取消分配记录', operator);
    
    const updated = db.prepare(`
      SELECT a.*, 
             an.animal_id as animal_identifier, an.gender,
             s.code as strain_code, s.name as strain_name,
             c.code as cage_code, c.room as cage_room
      FROM allocations a
      LEFT JOIN animals an ON a.animal_id = an.id
      LEFT JOIN strains s ON an.strain_id = s.id
      LEFT JOIN cages c ON a.cage_id = c.id
      WHERE a.id = ?
    `).get(allocationId);
    
    res.json({
      success: true,
      message: '分配记录已取消',
      data: updated
    });
  } catch (error) {
    console.error('取消分配记录失败:', error);
    res.status(500).json({
      success: false,
      message: '取消分配记录失败',
      error: error.message
    });
  }
});

router.post('/:id/reject', (req, res) => {
  try {
    const { reason, operator } = req.body;
    const allocationId = req.params.id;
    
    const db = getDB();
    
    const allocation = db.prepare('SELECT * FROM allocations WHERE id = ?').get(allocationId);
    if (!allocation) {
      return res.status(404).json({
        success: false,
        message: '分配记录不存在'
      });
    }
    
    if (allocation.status === 'rejected') {
      return res.status(200).json({
        success: true,
        message: '记录已处于拒绝状态',
        idempotent: true,
        data: allocation
      });
    }
    
    if (allocation.status !== 'validating') {
      return res.status(400).json({
        success: false,
        message: `只有 validating 状态的记录才能被拒绝，当前状态: ${allocation.status}`,
        code: 'INVALID_STATUS_FOR_REJECT'
      });
    }
    
    const fromStatus = allocation.status;
    
    db.prepare(`
      UPDATE allocations 
      SET status = 'rejected', updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(allocationId);
    
    addHistory(db, allocationId, fromStatus, 'rejected', 'reject', reason || '拒绝分配申请', operator);
    
    const updated = db.prepare(`
      SELECT a.*, 
             an.animal_id as animal_identifier, an.gender,
             s.code as strain_code, s.name as strain_name,
             c.code as cage_code, c.room as cage_room
      FROM allocations a
      LEFT JOIN animals an ON a.animal_id = an.id
      LEFT JOIN strains s ON an.strain_id = s.id
      LEFT JOIN cages c ON a.cage_id = c.id
      WHERE a.id = ?
    `).get(allocationId);
    
    res.json({
      success: true,
      message: '分配记录已拒绝',
      data: updated
    });
  } catch (error) {
    console.error('拒绝分配记录失败:', error);
    res.status(500).json({
      success: false,
      message: '拒绝分配记录失败',
      error: error.message
    });
  }
});

router.put('/:id/correct', (req, res) => {
  try {
    const { cage_id, reason, operator } = req.body;
    const allocationId = req.params.id;
    
    const db = getDB();
    
    const allocation = db.prepare('SELECT * FROM allocations WHERE id = ?').get(allocationId);
    if (!allocation) {
      return res.status(404).json({
        success: false,
        message: '分配记录不存在'
      });
    }
    
    if (!['pending', 'validating'].includes(allocation.status)) {
      return res.status(400).json({
        success: false,
        message: `只有 pending 或 validating 状态的记录才能修正，当前状态: ${allocation.status}`,
        code: 'STATUS_NOT_CORRECTABLE'
      });
    }
    
    if (cage_id === undefined) {
      return res.status(400).json({
        success: false,
        message: '请提供要修正的字段'
      });
    }
    
    const updates = [];
    const params = [];
    
    if (cage_id !== undefined) {
      if (cage_id !== null) {
        const cage = db.prepare('SELECT * FROM cages WHERE id = ?').get(cage_id);
        if (!cage) {
          return res.status(400).json({
            success: false,
            message: '目标笼位不存在'
          });
        }
      }
      updates.push('cage_id = ?');
      params.push(cage_id);
    }
    
    updates.push("updated_at = datetime('now', 'localtime')");
    params.push(allocationId);
    
    db.prepare(`
      UPDATE allocations 
      SET ${updates.join(', ')}
      WHERE id = ?
    `).run(...params);
    
    addHistory(db, allocationId, allocation.status, allocation.status, 'correct', reason || '修正分配记录', operator);
    
    const updated = db.prepare(`
      SELECT a.*, 
             an.animal_id as animal_identifier, an.gender,
             s.code as strain_code, s.name as strain_name,
             c.code as cage_code, c.room as cage_room
      FROM allocations a
      LEFT JOIN animals an ON a.animal_id = an.id
      LEFT JOIN strains s ON an.strain_id = s.id
      LEFT JOIN cages c ON a.cage_id = c.id
      WHERE a.id = ?
    `).get(allocationId);
    
    res.json({
      success: true,
      message: '分配记录已修正',
      data: updated
    });
  } catch (error) {
    console.error('修正分配记录失败:', error);
    res.status(500).json({
      success: false,
      message: '修正分配记录失败',
      error: error.message
    });
  }
});

module.exports = router;
