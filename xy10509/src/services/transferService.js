const { v4: uuidv4 } = require('uuid');
const { db, transaction } = require('../database/db');
const { 
  URGENCY_SCORES, 
  REQUEST_STATUS, 
  APPOINTMENT_STATUS,
  EXCEPTION_TYPES,
  BED_STATUS
} = require('../utils/constants');
const historyService = require('./historyService');
const exceptionService = require('./exceptionService');
const bedService = require('./bedService');
const config = require('../config/config');

function createTransferRequest(data) {
  const tx = transaction((d) => {
    if (d.idempotencyKey) {
      const existing = db.prepare(
        'SELECT * FROM transfer_requests WHERE idempotency_key = ?'
      ).get(d.idempotencyKey);
      
      if (existing) {
        return {
          request: existing,
          isDuplicate: true,
          message: '重复请求，返回已有记录'
        };
      }
    }
    
    const department = db.prepare(
      'SELECT * FROM departments WHERE id = ?'
    ).get(d.toDepartmentId);
    
    if (!department) {
      throw new Error('目标科室不存在');
    }
    
    if (!department.is_active) {
      exceptionService.recordException(
        'transfer_request',
        d.idempotencyKey || 'pending',
        EXCEPTION_TYPES.DEPARTMENT_INACTIVE,
        `科室 ${department.name} 已暂停接收`
      );
      throw new Error('目标科室已暂停接收');
    }
    
    if (!URGENCY_SCORES[d.severityLevel]) {
      throw new Error('无效的病情等级');
    }
    
    const activeRequests = db.prepare(`
      SELECT * FROM transfer_requests 
      WHERE patient_id = ? 
        AND current_status IN (?, ?, ?, ?)
    `).all(d.patientId, REQUEST_STATUS.PENDING, REQUEST_STATUS.WAITING, REQUEST_STATUS.SCHEDULED, REQUEST_STATUS.CONFIRMED);
    
    if (activeRequests.length > 0) {
      exceptionService.recordException(
        'transfer_request',
        d.idempotencyKey || 'pending',
        EXCEPTION_TYPES.DUPLICATE_REQUEST,
        `患者 ${d.patientId} 存在未完成的转诊申请`
      );
      return {
        existingRequest: activeRequests[0],
        isDuplicate: true,
        message: '该患者存在未完成的转诊申请'
      };
    }
    
    const id = uuidv4();
    const urgencyScore = URGENCY_SCORES[d.severityLevel];
    
    db.prepare(`
      INSERT INTO transfer_requests (
        id, idempotency_key, patient_id, from_hospital_id,
        to_hospital_id, to_department_id, severity_level, 
        urgency_score, diagnosis, current_status, notes,
        created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      id,
      d.idempotencyKey || null,
      d.patientId,
      d.fromHospitalId || null,
      d.toHospitalId,
      d.toDepartmentId,
      d.severityLevel,
      urgencyScore,
      d.diagnosis || null,
      REQUEST_STATUS.PENDING,
      d.notes || null,
      d.createdBy || 'system'
    );
    
    historyService.recordHistory(
      'transfer_request',
      id,
      null,
      REQUEST_STATUS.PENDING,
      d.createdBy || 'system',
      '创建转诊申请'
    );
    
    const request = db.prepare('SELECT * FROM transfer_requests WHERE id = ?').get(id);
    
    return {
      request,
      isDuplicate: false
    };
  });
  
  return tx(data);
}

function scheduleRequest(requestId, scheduledDate) {
  const request = db.prepare('SELECT * FROM transfer_requests WHERE id = ?').get(requestId);
  if (!request) throw new Error('转诊申请不存在');
  
  if (request.current_status !== REQUEST_STATUS.PENDING) {
    throw new Error(`当前状态 ${request.current_status} 无法预约`);
  }
  
  const dateStr = scheduledDate || new Date().toISOString().split('T')[0];
  
  const department = db.prepare(
    'SELECT * FROM departments WHERE id = ?'
  ).get(request.to_department_id);
  
  if (!department.is_active) {
    updateRequestStatus(requestId, REQUEST_STATUS.EXCEPTION, '科室已暂停');
    exceptionService.recordException(
      'transfer_request',
      requestId,
      EXCEPTION_TYPES.DEPARTMENT_INACTIVE,
      `科室 ${department.name} 已暂停接收`
    );
    throw new Error('科室已暂停接收');
  }
  
  const availableBeds = bedService.getAvailableBeds(request.to_department_id, dateStr);
  
  if (availableBeds.length > 0) {
    const bed = availableBeds[0];
    const appointmentId = uuidv4();
    
    db.prepare(`
      INSERT INTO appointments (id, request_id, bed_id, scheduled_date, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(appointmentId, requestId, bed.id, dateStr, APPOINTMENT_STATUS.PENDING);
    
    bedService.updateBedStatus(bed.id, BED_STATUS.RESERVED, '预约预留');
    
    updateRequestStatus(requestId, REQUEST_STATUS.SCHEDULED, `预约床位 ${bed.bed_number}`);
    
    return {
      scheduled: true,
      bedId: bed.id,
      bedNumber: bed.bed_number,
      appointmentId,
      message: `成功预约床位 ${bed.bed_number}`
    };
  } else {
    addToWaitingQueue(requestId, request.to_department_id, dateStr, request.urgency_score);
    updateRequestStatus(requestId, REQUEST_STATUS.WAITING, '无可用床位，加入候补队列');
    
    return {
      scheduled: false,
      inQueue: true,
      queuePosition: getQueuePosition(requestId),
      message: '无可用床位，已加入候补队列'
    };
  }
}

function confirmRequest(requestId, confirmedBy) {
  const request = db.prepare('SELECT * FROM transfer_requests WHERE id = ?').get(requestId);
  if (!request) throw new Error('转诊申请不存在');
  
  if (request.current_status !== REQUEST_STATUS.SCHEDULED) {
    throw new Error(`当前状态 ${request.current_status} 无法确认`);
  }
  
  const appointment = db.prepare(
    'SELECT * FROM appointments WHERE request_id = ? ORDER BY created_at DESC LIMIT 1'
  ).get(requestId);
  
  if (appointment) {
    db.prepare(`
      UPDATE appointments 
      SET status = ?, confirmed_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `).run(APPOINTMENT_STATUS.CONFIRMED, appointment.id);
    
    if (appointment.bed_id) {
      bedService.updateBedStatus(appointment.bed_id, BED_STATUS.RESERVED, '已确认预约');
    }
  }
  
  db.prepare(`
    UPDATE transfer_requests 
    SET current_status = ?, confirmed_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ?
  `).run(REQUEST_STATUS.CONFIRMED, requestId);
  
  historyService.recordHistory(
    'transfer_request',
    requestId,
    REQUEST_STATUS.SCHEDULED,
    REQUEST_STATUS.CONFIRMED,
    confirmedBy || 'system',
    '确认预约'
  );
  
  return db.prepare('SELECT * FROM transfer_requests WHERE id = ?').get(requestId);
}

function cancelRequest(requestId, reason, cancelledBy) {
  const request = db.prepare('SELECT * FROM transfer_requests WHERE id = ?').get(requestId);
  if (!request) throw new Error('转诊申请不存在');
  
  const terminalStatuses = [REQUEST_STATUS.CANCELLED, REQUEST_STATUS.COMPLETED, REQUEST_STATUS.TIMED_OUT, REQUEST_STATUS.REJECTED];
  if (terminalStatuses.includes(request.current_status)) {
    return {
      request,
      alreadyCancelled: true,
      message: '申请已处于终止状态'
    };
  }
  
  const tx = transaction(() => {
    const oldStatus = request.current_status;
    
    db.prepare(`
      UPDATE transfer_requests 
      SET current_status = ?, cancelled_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `).run(REQUEST_STATUS.CANCELLED, requestId);
    
    const appointments = db.prepare(
      'SELECT * FROM appointments WHERE request_id = ?'
    ).all(requestId);
    
    appointments.forEach(apt => {
      db.prepare(`
        UPDATE appointments 
        SET status = ?, cancelled_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).run(APPOINTMENT_STATUS.CANCELLED, apt.id);
      
      if (apt.bed_id) {
        bedService.updateBedStatus(apt.bed_id, BED_STATUS.AVAILABLE, '取消预约释放');
      }
    });
    
    db.prepare(`
      UPDATE waiting_queue 
      SET status = 'cancelled', updated_at = datetime('now')
      WHERE request_id = ? AND status = 'waiting'
    `).run(requestId);
    
    historyService.recordHistory(
      'transfer_request',
      requestId,
      oldStatus,
      REQUEST_STATUS.CANCELLED,
      cancelledBy || 'system',
      reason || '用户取消'
    );
    
    if (appointments.some(a => a.bed_id)) {
      processWaitingQueue(request.to_department_id);
    }
    
    return db.prepare('SELECT * FROM transfer_requests WHERE id = ?').get(requestId);
  });
  
  return {
    request: tx(),
    alreadyCancelled: false,
    message: '取消成功'
  };
}

function addToWaitingQueue(requestId, departmentId, scheduledDate, priorityScore) {
  const existing = db.prepare(
    'SELECT * FROM waiting_queue WHERE request_id = ? AND status = ?'
  ).get(requestId, 'waiting');
  
  if (existing) return existing;
  
  const id = uuidv4();
  db.prepare(`
    INSERT INTO waiting_queue (id, request_id, department_id, scheduled_date, priority_score, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(id, requestId, departmentId, scheduledDate, priorityScore, 'waiting');
  
  recalculateQueuePositions(departmentId, scheduledDate);
  
  return db.prepare('SELECT * FROM waiting_queue WHERE id = ?').get(id);
}

function recalculateQueuePositions(departmentId, scheduledDate) {
  const queueItems = db.prepare(`
    SELECT * FROM waiting_queue 
    WHERE department_id = ? AND scheduled_date = ? AND status = ?
    ORDER BY priority_score DESC, created_at ASC
  `).all(departmentId, scheduledDate, 'waiting');
  
  queueItems.forEach((item, index) => {
    db.prepare(
      'UPDATE waiting_queue SET queue_position = ?, updated_at = datetime("now") WHERE id = ?'
    ).run(index + 1, item.id);
  });
}

function getQueuePosition(requestId) {
  const item = db.prepare(
    "SELECT queue_position FROM waiting_queue WHERE request_id = ? AND status = 'waiting'"
  ).get(requestId);
  
  return item ? item.queue_position : null;
}

function processWaitingQueue(departmentId) {
  const today = new Date().toISOString().split('T')[0];
  
  const queueItems = db.prepare(`
    SELECT wq.*, tr.current_status as request_status
    FROM waiting_queue wq
    JOIN transfer_requests tr ON wq.request_id = tr.id
    WHERE wq.department_id = ? 
      AND wq.scheduled_date = ? 
      AND wq.status = ?
      AND tr.current_status = ?
    ORDER BY wq.priority_score DESC, wq.created_at ASC
  `).all(departmentId, today, 'waiting', REQUEST_STATUS.WAITING);
  
  for (const item of queueItems) {
    const availableBeds = bedService.getAvailableBeds(departmentId, today);
    
    if (availableBeds.length > 0) {
      const bed = availableBeds[0];
      const appointmentId = uuidv4();
      
      db.prepare(`
        INSERT INTO appointments (id, request_id, bed_id, scheduled_date, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(appointmentId, item.request_id, bed.id, item.scheduled_date, APPOINTMENT_STATUS.PENDING);
      
      bedService.updateBedStatus(bed.id, BED_STATUS.RESERVED, '候补递补预约');
      
      db.prepare(`
        UPDATE waiting_queue 
        SET status = 'processed', updated_at = datetime('now')
        WHERE id = ?
      `).run(item.id);
      
      updateRequestStatus(item.request_id, REQUEST_STATUS.SCHEDULED, `候补递补成功，预约床位 ${bed.bed_number}`);
      
      recalculateQueuePositions(departmentId, today);
    } else {
      break;
    }
  }
}

function checkTimeouts() {
  const timeoutMinutes = config.business.confirmTimeoutMinutes;
  
  const timeoutRequests = db.prepare(`
    SELECT * FROM transfer_requests 
    WHERE current_status = ? 
      AND datetime('now') > datetime(requested_at, '+' || ? || ' minutes')
  `).all(REQUEST_STATUS.SCHEDULED, timeoutMinutes);
  
  const results = [];
  
  for (const request of timeoutRequests) {
    const oldStatus = request.current_status;
    
    db.prepare(`
      UPDATE transfer_requests 
      SET current_status = ?, cancelled_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `).run(REQUEST_STATUS.TIMED_OUT, request.id);
    
    const appointments = db.prepare(
      'SELECT * FROM appointments WHERE request_id = ?'
    ).all(request.id);
    
    appointments.forEach(apt => {
      db.prepare(`
        UPDATE appointments 
        SET status = ?, cancelled_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).run(APPOINTMENT_STATUS.TIMED_OUT, apt.id);
      
      if (apt.bed_id) {
        bedService.updateBedStatus(apt.bed_id, BED_STATUS.AVAILABLE, '超时释放');
      }
    });
    
    historyService.recordHistory(
      'transfer_request',
      request.id,
      oldStatus,
      REQUEST_STATUS.TIMED_OUT,
      'system',
      `超过 ${timeoutMinutes} 分钟未确认`
    );
    
    exceptionService.recordException(
      'transfer_request',
      request.id,
      EXCEPTION_TYPES.CONFIRM_TIMEOUT,
      `转诊申请超过 ${timeoutMinutes} 分钟未确认，已自动取消`
    );
    
    processWaitingQueue(request.to_department_id);
    
    results.push({
      requestId: request.id,
      status: REQUEST_STATUS.TIMED_OUT
    });
  }
  
  return results;
}

function updateRequestStatus(requestId, newStatus, reason, changedBy) {
  const request = db.prepare('SELECT * FROM transfer_requests WHERE id = ?').get(requestId);
  if (!request) return null;
  
  const oldStatus = request.current_status;
  
  db.prepare(`
    UPDATE transfer_requests 
    SET current_status = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(newStatus, requestId);
  
  historyService.recordHistory(
    'transfer_request',
    requestId,
    oldStatus,
    newStatus,
    changedBy || 'system',
    reason
  );
  
  return db.prepare('SELECT * FROM transfer_requests WHERE id = ?').get(requestId);
}

function getRequestById(requestId) {
  const request = db.prepare(`
    SELECT tr.*, 
           p.name as patient_name,
           p.id_card as patient_id_card,
           h1.name as from_hospital_name,
           h2.name as to_hospital_name,
           d.name as to_department_name
    FROM transfer_requests tr
    JOIN patients p ON tr.patient_id = p.id
    LEFT JOIN hospitals h1 ON tr.from_hospital_id = h1.id
    JOIN hospitals h2 ON tr.to_hospital_id = h2.id
    JOIN departments d ON tr.to_department_id = d.id
    WHERE tr.id = ?
  `).get(requestId);
  
  if (!request) return null;
  
  const history = historyService.getHistory('transfer_request', requestId);
  const appointments = db.prepare('SELECT * FROM appointments WHERE request_id = ?').all(requestId);
  const exceptions = exceptionService.getExceptions({ entityType: 'transfer_request', entityId: requestId });
  
  return {
    ...request,
    history,
    appointments,
    exceptions
  };
}

function getAllRequests(options = {}) {
  let query = `
    SELECT tr.*, 
           p.name as patient_name,
           h2.name as to_hospital_name,
           d.name as to_department_name
    FROM transfer_requests tr
    JOIN patients p ON tr.patient_id = p.id
    JOIN hospitals h2 ON tr.to_hospital_id = h2.id
    JOIN departments d ON tr.to_department_id = d.id
    WHERE 1=1
  `;
  const params = [];
  
  if (options.status) {
    query += ' AND tr.current_status = ?';
    params.push(options.status);
  }
  
  if (options.patientId) {
    query += ' AND tr.patient_id = ?';
    params.push(options.patientId);
  }
  
  if (options.departmentId) {
    query += ' AND tr.to_department_id = ?';
    params.push(options.departmentId);
  }
  
  query += ' ORDER BY tr.created_at DESC';
  
  return db.prepare(query).all(...params);
}

function getWaitingQueue(departmentId, date) {
  const dateStr = date || new Date().toISOString().split('T')[0];
  
  return db.prepare(`
    SELECT wq.*,
           tr.patient_id,
           tr.severity_level,
           tr.urgency_score,
           p.name as patient_name
    FROM waiting_queue wq
    JOIN transfer_requests tr ON wq.request_id = tr.id
    JOIN patients p ON tr.patient_id = p.id
    WHERE wq.department_id = ? 
      AND wq.scheduled_date = ? 
      AND wq.status = ?
    ORDER BY wq.queue_position ASC
  `).all(departmentId, dateStr, 'waiting');
}

function manualUpdateRequest(requestId, updates, operator) {
  const request = db.prepare('SELECT * FROM transfer_requests WHERE id = ?').get(requestId);
  if (!request) throw new Error('转诊申请不存在');
  
  const oldStatus = request.current_status;
  const diff = {};
  
  if (updates.current_status && updates.current_status !== oldStatus) {
    diff.current_status = { old: oldStatus, new: updates.current_status };
  }
  
  if (updates.notes !== undefined && updates.notes !== request.notes) {
    diff.notes = { old: request.notes, new: updates.notes };
  }
  
  if (updates.severity_level && updates.severity_level !== request.severity_level) {
    diff.severity_level = { old: request.severity_level, new: updates.severity_level };
  }
  
  if (Object.keys(diff).length === 0) {
    return { request, diff: null };
  }
  
  const tx = transaction(() => {
    const setClauses = [];
    const values = [];
    
    if (updates.current_status) {
      setClauses.push('current_status = ?');
      values.push(updates.current_status);
    }
    
    if (updates.notes !== undefined) {
      setClauses.push('notes = ?');
      values.push(updates.notes);
    }
    
    if (updates.severity_level) {
      setClauses.push('severity_level = ?');
      values.push(updates.severity_level);
      setClauses.push('urgency_score = ?');
      values.push(URGENCY_SCORES[updates.severity_level] || request.urgency_score);
    }
    
    setClauses.push('updated_at = datetime("now")');
    values.push(requestId);
    
    db.prepare(`UPDATE transfer_requests SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
    
    historyService.recordHistory(
      'transfer_request',
      requestId,
      oldStatus,
      updates.current_status || oldStatus,
      operator || 'admin',
      '人工修正',
      diff
    );
    
    return db.prepare('SELECT * FROM transfer_requests WHERE id = ?').get(requestId);
  });
  
  return {
    request: tx(),
    diff,
    operator: operator || 'admin'
  };
}

module.exports = {
  createTransferRequest,
  scheduleRequest,
  confirmRequest,
  cancelRequest,
  getRequestById,
  getAllRequests,
  getWaitingQueue,
  checkTimeouts,
  manualUpdateRequest,
  processWaitingQueue,
  updateRequestStatus
};
