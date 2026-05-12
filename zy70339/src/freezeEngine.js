const { prepare } = require('./database');
const { v4: uuidv4 } = require('uuid');

function findCrossingWindows(service, startTime, endTime) {
  const windows = prepare(`
    SELECT * FROM freeze_windows 
    WHERE NOT (end_time < ? OR start_time > ?)
    ORDER BY start_time ASC
  `).all(startTime, endTime);

  return windows.filter(w => {
    if (w.scope === 'global') return true;
    if (w.scope === 'service') {
      const services = w.affected_services ? w.affected_services.split(',') : [];
      return services.includes(service);
    }
    return false;
  });
}

function evaluateChange(change) {
  const {
    change_id,
    service,
    change_type,
    risk_level,
    planned_start,
    planned_end
  } = change;

  const result = {
    can_publish: false,
    status: 'blocked',
    reasons: [],
    hit_windows: [],
    requires_exception: false,
    existing_approval: null,
    available_windows: [],
    duplicate_check: null
  };

  const existing = prepare(`
    SELECT * FROM change_requests WHERE change_id = ?
  `).get(change_id);

  if (existing) {
    result.duplicate_check = {
      exists: true,
      existing_id: existing.id,
      existing_status: existing.status
    };
  }

  const windows = findCrossingWindows(service, planned_start, planned_end);
  
  if (windows.length === 0) {
    result.can_publish = true;
    result.status = 'allowed';
    return result;
  }

  result.hit_windows = windows.map(w => ({
    ...w,
    affected_services: w.affected_services ? w.affected_services.split(',') : [],
    allow_readonly: !!w.allow_readonly
  }));

  const hasApprovedException = existing && 
    (existing.status === 'exception_approved' || existing.status === 'approved');
  
  if (hasApprovedException) {
    const latestApproval = prepare(`
      SELECT * FROM approvals 
      WHERE change_request_id = ? AND decision = 'approved'
      ORDER BY created_at DESC LIMIT 1
    `).get(existing.id);

    if (latestApproval) {
      const validFrom = latestApproval.valid_from ? new Date(latestApproval.valid_from) : new Date(0);
      const validUntil = latestApproval.valid_until ? new Date(latestApproval.valid_until) : new Date(9999, 11, 31);
      const requestStart = new Date(planned_start);
      const requestEnd = new Date(planned_end);

      if (requestStart >= validFrom && requestEnd <= validUntil) {
        const applicableServices = latestApproval.applicable_services 
          ? latestApproval.applicable_services.split(',') 
          : null;
        
        if (!applicableServices || applicableServices.includes(service)) {
          result.can_publish = true;
          result.status = 'allowed';
          result.reasons.push('存在有效的例外审批');
          result.existing_approval = {
            approval_id: latestApproval.id,
            valid_from: latestApproval.valid_from,
            valid_until: latestApproval.valid_until,
            applicable_services: applicableServices
          };
          return result;
        }
      }
    }
  }

  if (change_type === 'readonly') {
    const blockedByNonReadonlyWindow = windows.some(w => w.allow_readonly !== 1);
    
    if (!blockedByNonReadonlyWindow) {
      result.can_publish = true;
      result.status = 'allowed';
      result.reasons.push('只读变更在所有命中的冻结窗口中被豁免');
      return result;
    } else {
      result.reasons.push('只读变更命中了不豁免只读的冻结窗口');
    }
  }

  if (change_type === 'emergency') {
    result.can_publish = false;
    result.status = 'requires_exception';
    result.requires_exception = true;
    result.reasons.push('紧急修复需要例外审批');
    return result;
  }

  result.can_publish = false;
  result.status = 'blocked';
  result.reasons.push(`变更时间窗口命中 ${windows.length} 个冻结窗口`);

  windows.forEach(w => {
    result.reasons.push(`- ${w.name} (${w.start_time} ~ ${w.end_time}, 风险等级: ${w.risk_level})`);
  });

  const now = new Date(planned_start);
  const oneWeekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const futureWindows = findCrossingWindows(service, now.toISOString(), oneWeekLater.toISOString());
  
  let current = new Date(planned_start);
  while (current <= oneWeekLater) {
    const dayStart = new Date(current);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(current);
    dayEnd.setHours(23, 59, 59, 999);
    
    const dayWindows = futureWindows.filter(w => 
      !(new Date(w.end_time) < dayStart || new Date(w.start_time) > dayEnd)
    );
    
    if (dayWindows.length === 0) {
      result.available_windows.push({
        date: current.toISOString().split('T')[0],
        available: true
      });
    }
    
    current.setDate(current.getDate() + 1);
  }

  return result;
}

function createFreezeWindow(data) {
  const id = uuidv4();
  const now = new Date().toISOString();
  
  prepare(`
    INSERT INTO freeze_windows 
    (id, name, description, start_time, end_time, scope, affected_services, risk_level, allow_readonly, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.name,
    data.description || null,
    data.start_time,
    data.end_time,
    data.scope,
    data.affected_services ? data.affected_services.join(',') : null,
    data.risk_level,
    data.allow_readonly ? 1 : 0,
    now,
    now
  );
  
  return getFreezeWindow(id);
}

function getFreezeWindow(id) {
  const window = prepare('SELECT * FROM freeze_windows WHERE id = ?').get(id);
  if (window) {
    window.affected_services = window.affected_services ? window.affected_services.split(',') : [];
    window.allow_readonly = !!window.allow_readonly;
  }
  return window;
}

function getAllFreezeWindows() {
  const windows = prepare('SELECT * FROM freeze_windows ORDER BY start_time DESC').all();
  return windows.map(w => ({
    ...w,
    affected_services: w.affected_services ? w.affected_services.split(',') : [],
    allow_readonly: !!w.allow_readonly
  }));
}

function updateFreezeWindow(id, data) {
  const existing = getFreezeWindow(id);
  if (!existing) return null;
  
  const updates = [];
  const values = [];
  
  const fields = ['name', 'description', 'start_time', 'end_time', 'scope', 'risk_level'];
  fields.forEach(field => {
    if (data[field] !== undefined) {
      updates.push(`${field} = ?`);
      values.push(data[field]);
    }
  });
  
  if (data.affected_services !== undefined) {
    updates.push('affected_services = ?');
    values.push(data.affected_services.join(','));
  }
  
  if (data.allow_readonly !== undefined) {
    updates.push('allow_readonly = ?');
    values.push(data.allow_readonly ? 1 : 0);
  }
  
  updates.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);
  
  prepare(`UPDATE freeze_windows SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  return getFreezeWindow(id);
}

function deleteFreezeWindow(id) {
  prepare('DELETE FROM freeze_windows WHERE id = ?').run(id);
}

function createChangeRequest(data) {
  const id = uuidv4();
  const evaluation = evaluateChange(data);
  
  let status = 'pending';
  if (evaluation.status === 'allowed') {
    status = 'approved';
  } else if (evaluation.status === 'requires_exception') {
    status = 'exception_requested';
  } else if (evaluation.status === 'blocked') {
    status = 'rejected';
  }
  
  const now = new Date().toISOString();
  
  try {
    prepare(`
      INSERT INTO change_requests 
      (id, change_id, service, change_type, risk_level, planned_start, planned_end, description, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.change_id,
      data.service,
      data.change_type,
      data.risk_level,
      data.planned_start,
      data.planned_end,
      data.description || null,
      status,
      now,
      now
    );
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE') || e.message && e.message.includes('constraint')) {
      const existing = prepare('SELECT * FROM change_requests WHERE change_id = ?').get(data.change_id);
      return {
        error: 'DUPLICATE_CHANGE_ID',
        message: '该变更ID已存在',
        existing_request: existing,
        evaluation: evaluation
      };
    }
    throw e;
  }
  
  return {
    ...getChangeRequest(id),
    evaluation
  };
}

function getChangeRequest(id) {
  const request = prepare('SELECT * FROM change_requests WHERE id = ?').get(id);
  if (request) {
    const approvals = prepare(`
      SELECT * FROM approvals WHERE change_request_id = ? ORDER BY created_at DESC
    `).all(id);
    request.approvals = approvals.map(a => ({
      ...a,
      applicable_services: a.applicable_services ? a.applicable_services.split(',') : null
    }));
  }
  return request;
}

function getAllChangeRequests() {
  const requests = prepare('SELECT * FROM change_requests ORDER BY created_at DESC').all();
  return requests.map(r => getChangeRequest(r.id));
}

function approveException(changeRequestId, approver, reason, validFrom, validUntil, applicableServices) {
  const approvalId = uuidv4();
  const now = new Date().toISOString();
  
  prepare(`
    INSERT INTO approvals 
    (id, change_request_id, approver, decision, reason, valid_from, valid_until, applicable_services, created_at)
    VALUES (?, ?, ?, 'approved', ?, ?, ?, ?, ?)
  `).run(
    approvalId,
    changeRequestId,
    approver,
    reason || null,
    validFrom || null,
    validUntil || null,
    applicableServices ? applicableServices.join(',') : null,
    now
  );
  
  prepare(`
    UPDATE change_requests 
    SET status = 'exception_approved', updated_at = ?
    WHERE id = ?
  `).run(now, changeRequestId);
  
  return getChangeRequest(changeRequestId);
}

function rejectException(changeRequestId, approver, reason) {
  const approvalId = uuidv4();
  const now = new Date().toISOString();
  
  prepare(`
    INSERT INTO approvals 
    (id, change_request_id, approver, decision, reason, created_at)
    VALUES (?, ?, ?, 'rejected', ?, ?)
  `).run(approvalId, changeRequestId, approver, reason || null, now);
  
  prepare(`
    UPDATE change_requests 
    SET status = 'exception_rejected', updated_at = ?
    WHERE id = ?
  `).run(now, changeRequestId);
  
  return getChangeRequest(changeRequestId);
}

function exportToICal() {
  const windows = getAllFreezeWindows();
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  
  let ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Change Freeze Calendar//EN',
    `DTSTAMP:${now}`
  ];
  
  windows.forEach(w => {
    const start = new Date(w.start_time).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const end = new Date(w.end_time).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const uid = `${w.id}@freeze.calendar`;
    
    ics = ics.concat([
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:【冻结】${w.name} (${w.risk_level})`,
      `DESCRIPTION:${w.description || ''}\\n范围: ${w.scope}\\n风险: ${w.risk_level}\\n豁免只读: ${w.allow_readonly ? '是' : '否'}`,
      'STATUS:CONFIRMED',
      'END:VEVENT'
    ]);
  });
  
  ics.push('END:VCALENDAR');
  
  return ics.join('\r\n');
}

module.exports = {
  evaluateChange,
  createFreezeWindow,
  getFreezeWindow,
  getAllFreezeWindows,
  updateFreezeWindow,
  deleteFreezeWindow,
  createChangeRequest,
  getChangeRequest,
  getAllChangeRequests,
  approveException,
  rejectException,
  exportToICal,
  findCrossingWindows
};
