const { db } = require('./database');
const { v4: uuidv4 } = require('uuid');

const APPLICATION_STATUSES = {
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  WITHDRAWN: 'WITHDRAWN',
  MODIFIED: 'MODIFIED'
};

const STATUS_TRANSITIONS = {
  [APPLICATION_STATUSES.DRAFT]: [APPLICATION_STATUSES.PENDING_APPROVAL, APPLICATION_STATUSES.WITHDRAWN],
  [APPLICATION_STATUSES.PENDING_APPROVAL]: [APPLICATION_STATUSES.APPROVED, APPLICATION_STATUSES.REJECTED, APPLICATION_STATUSES.WITHDRAWN, APPLICATION_STATUSES.MODIFIED],
  [APPLICATION_STATUSES.APPROVED]: [APPLICATION_STATUSES.WITHDRAWN],
  [APPLICATION_STATUSES.REJECTED]: [APPLICATION_STATUSES.MODIFIED],
  [APPLICATION_STATUSES.WITHDRAWN]: [],
  [APPLICATION_STATUSES.MODIFIED]: [APPLICATION_STATUSES.PENDING_APPROVAL]
};

class ValidationError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

async function checkIdempotent(requestId) {
  const existing = await db.prepare('SELECT * FROM operation_logs WHERE request_id = ?').get(requestId);
  if (existing) {
    return JSON.parse(existing.response_data || '{}');
  }
  return null;
}

async function saveOperationLog(requestId, operationType, applicationId, requestData, responseData, status, errorMessage) {
  await db.prepare(`
    INSERT INTO operation_logs (request_id, operation_type, application_id, request_data, response_data, status, error_message)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    requestId,
    operationType,
    applicationId,
    JSON.stringify(requestData),
    JSON.stringify(responseData),
    status,
    errorMessage
  );
}

function validateCreateApplication(data) {
  const errors = [];
  
  if (!data.applicant_name || data.applicant_name.trim() === '') {
    errors.push({ field: 'applicant_name', message: '申请人姓名不能为空' });
  }
  
  if (!data.activity_name || data.activity_name.trim() === '') {
    errors.push({ field: 'activity_name', message: '活动名称不能为空' });
  }
  
  if (!data.booth_code || data.booth_code.trim() === '') {
    errors.push({ field: 'booth_code', message: '摊位编号不能为空' });
  }
  
  if (!data.start_time) {
    errors.push({ field: 'start_time', message: '活动开始时间不能为空' });
  }
  
  if (!data.end_time) {
    errors.push({ field: 'end_time', message: '活动结束时间不能为空' });
  }
  
  if (!data.devices || !Array.isArray(data.devices) || data.devices.length === 0) {
    errors.push({ field: 'devices', message: '至少需要填写一个用电设备' });
  }
  
  if (data.start_time && data.end_time) {
    const start = new Date(data.start_time);
    const end = new Date(data.end_time);
    if (start >= end) {
      errors.push({ field: 'time', message: '活动结束时间必须晚于开始时间' });
    }
  }
  
  if (errors.length > 0) {
    throw new ValidationError('申请数据校验失败', 'VALIDATION_ERROR', { validation_errors: errors });
  }
}

function validateDevices(devices) {
  const errors = [];
  
  for (let i = 0; i < devices.length; i++) {
    const device = devices[i];
    
    if (!device.device_name || device.device_name.trim() === '') {
      errors.push({ field: `devices[${i}].device_name`, message: '设备名称不能为空' });
    }
    
    if (device.power_kw === undefined || device.power_kw === null || isNaN(device.power_kw) || device.power_kw <= 0) {
      errors.push({ field: `devices[${i}].power_kw`, message: '设备功率必须大于0' });
    }
    
    if (device.quantity !== undefined && (isNaN(device.quantity) || device.quantity < 1)) {
      errors.push({ field: `devices[${i}].quantity`, message: '设备数量必须大于0或正整数' });
    }
  }
  
  if (errors.length > 0) {
    throw new ValidationError('设备数据校验失败', 'DEVICE_VALIDATION_ERROR', { validation_errors: errors });
  }
}

async function checkFloorCapacity(floorId, startTime, endTime, excludeApplicationId = null) {
  const floor = await db.prepare('SELECT * FROM floors WHERE id = ?').get(floorId);
  
  if (!floor) {
    throw new ValidationError('楼层不存在', 'FLOOR_NOT_FOUND');
  }
  
  const overlappingApps = await db.prepare(`
    SELECT a.*, b.booth_code, f.floor_name, f.available_capacity_kw
    FROM applications a
    JOIN booths b ON a.booth_id = b.id
    JOIN floors f ON b.floor_id = f.id
    WHERE f.id = ?
    AND a.status IN ('APPROVED', 'PENDING_APPROVAL')
    AND a.id != ?
    AND (
      (a.start_time <= ? AND a.end_time >= ?)
      OR (a.start_time >= ? AND a.start_time < ?)
      OR (a.end_time > ? AND a.end_time <= ?)
    )
  `).all(floorId, excludeApplicationId || 0, startTime, endTime, startTime, endTime, endTime, startTime, endTime);
  
  const overlappingPower = overlappingApps.reduce((sum, app) => sum + app.total_power_kw, 0);
  
  return {
    floor,
    overlapping_applications: overlappingApps,
    reserved_power: overlappingPower,
    available_capacity: floor.available_capacity_kw
  };
}

async function checkTimeConflict(boothId, startTime, endTime, excludeApplicationId = null) {
  const overlappingApps = await db.prepare(`
    SELECT a.*, b.booth_code
    FROM applications a
    JOIN booths b ON a.booth_id = b.id
    WHERE a.booth_id = ?
    AND a.status IN ('APPROVED', 'PENDING_APPROVAL')
    AND a.id != ?
    AND (
      (a.start_time <= ? AND a.end_time >= ?)
      OR (a.start_time >= ? AND a.start_time < ?)
    )
  `).all(boothId, excludeApplicationId || 0, startTime, endTime, startTime, endTime, endTime);
  
  return overlappingApps;
}

function calculateTotalPower(devices) {
  return devices.reduce((sum, device) => {
    const quantity = device.quantity || 1;
    return sum + (device.power_kw * quantity);
  }, 0);
}

async function createApplication(data, requestId) {
  const cached = await checkIdempotent(requestId);
  if (cached) {
    return cached;
  }
  
  try {
    validateCreateApplication(data);
    
    const booth = await db.prepare('SELECT * FROM booths WHERE booth_code = ?').get(data.booth_code);
    
    if (!booth) {
      throw new ValidationError('摊位不存在', 'BOOTH_NOT_FOUND');
    }
    
    const devices = data.devices;
    validateDevices(devices);
    
    const totalPower = calculateTotalPower(devices);
    
    const startTime = new Date(data.start_time);
    const endTime = new Date(data.end_time);
    
    const timeConflict = await checkTimeConflict(booth.id, startTime.toISOString(), endTime.toISOString());
    
    if (timeConflict.length > 0) {
      throw new ValidationError(
        '同一摊位在该时段已有审批中或已通过的申请',
        'TIME_CONFLICT',
        { conflicting_applications: timeConflict }
      );
    }
    
    const capacityCheck = await checkFloorCapacity(
      booth.floor_id,
      startTime.toISOString(),
      endTime.toISOString()
    );
    
    if (capacityCheck.reserved_power + totalPower > capacityCheck.available_capacity) {
      throw new ValidationError(
        '楼层配电容量不足',
        'CAPACITY_EXCEEDED',
        {
          floor_info: {
            floor_name: capacityCheck.floor.floor_name,
            available_capacity_kw: capacityCheck.available_capacity,
            reserved_by_others_kw: capacityCheck.reserved_power,
            requested_kw: totalPower,
            deficit_kw: capacityCheck.reserved_power + totalPower - capacityCheck.available_capacity
          }
        }
      );
    }
    
    const applicationNo = `APP${Date.now()}${Math.floor(Math.random() * 1000)}`;
    
    const appResult = await db.prepare(`
      INSERT INTO applications (
        application_no, booth_id, applicant_name, applicant_contact,
        activity_name, start_time, end_time, total_power_kw,
        status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      applicationNo,
      booth.id,
      data.applicant_name,
      data.applicant_contact || null,
      data.activity_name,
      startTime.toISOString(),
      endTime.toISOString(),
      totalPower,
      APPLICATION_STATUSES.DRAFT,
      data.created_by || 'SYSTEM'
    );
    
    const appId = appResult.lastInsertRowid;
    
    const deviceStmt = db.prepare(`
      INSERT INTO application_devices (
        application_id, device_name, device_type,
        power_kw, quantity, total_power_kw
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    for (const device of devices) {
      const quantity = device.quantity || 1;
      const total = device.power_kw * quantity;
      await deviceStmt.run(
        appId,
        device.device_name,
        device.device_type || null,
        device.power_kw,
        quantity,
        total
      );
    }
    
    const result = await getApplicationDetail(appId);
    
    await saveOperationLog(
      requestId,
      'CREATE_APPLICATION',
      appId,
      data,
      result,
      'SUCCESS',
      null
    );
    
    return result;
  } catch (error) {
    await saveOperationLog(
      requestId,
      'CREATE_APPLICATION',
      null,
      data,
      null,
      'ERROR',
      error.message
    );
    throw error;
  }
}

async function advanceApplication(applicationNo, action, remark = '', requestId) {
  const cached = await checkIdempotent(requestId);
  if (cached) {
    return cached;
  }
  
  try {
    const app = await db.prepare('SELECT * FROM applications WHERE application_no = ?').get(applicationNo);
    
    if (!app) {
      throw new ValidationError('申请不存在', 'APPLICATION_NOT_FOUND');
    }
    
    let newStatus;
    
    switch (action) {
      case 'SUBMIT':
        if (app.status !== APPLICATION_STATUSES.DRAFT && app.status !== APPLICATION_STATUSES.MODIFIED) {
          throw new ValidationError(
            '当前状态不支持提交操作',
            'INVALID_STATUS_TRANSITION',
            { current_status: app.status }
          );
        }
        newStatus = APPLICATION_STATUSES.PENDING_APPROVAL;
        break;
        
      case 'APPROVE':
        if (app.status !== APPLICATION_STATUSES.PENDING_APPROVAL) {
          throw new ValidationError(
            '当前状态不支持审批通过操作',
            'INVALID_STATUS_TRANSITION',
            { current_status: app.status }
          );
        }
        newStatus = APPLICATION_STATUSES.APPROVED;
        break;
        
      case 'REJECT':
        if (app.status !== APPLICATION_STATUSES.PENDING_APPROVAL) {
          throw new ValidationError(
            '当前状态不支持审批拒绝操作',
            'INVALID_STATUS_TRANSITION',
            { current_status: app.status }
          );
        }
        newStatus = APPLICATION_STATUSES.REJECTED;
        break;
        
      default:
        throw new ValidationError('未知的推进操作类型', 'UNKNOWN_ACTION');
    }
    
    await db.prepare(`
      UPDATE applications
      SET status = ?, approval_remark = ?, updated_at = CURRENT_TIMESTAMP
      WHERE application_no = ?
    `).run(newStatus, remark || null, applicationNo);
    
    const result = await getApplicationDetail(app.id);
    
    await saveOperationLog(
      requestId,
      'ADVANCE_' + action,
      app.id,
      { application_no: applicationNo, action, remark },
      result,
      'SUCCESS',
      null
    );
    
    return result;
  } catch (error) {
    await saveOperationLog(
      requestId,
      'ADVANCE_' + action,
      null,
      { application_no: applicationNo, action, remark },
      null,
      'ERROR',
      error.message
    );
    throw error;
  }
}

async function withdrawApplication(applicationNo, reason, requestId) {
  const cached = await checkIdempotent(requestId);
  if (cached) {
    return cached;
  }
  
  try {
    const app = await db.prepare('SELECT * FROM applications WHERE application_no = ?').get(applicationNo);
    
    if (!app) {
      throw new ValidationError('申请不存在', 'APPLICATION_NOT_FOUND');
    }
    
    const allowedStatuses = [
      APPLICATION_STATUSES.DRAFT,
      APPLICATION_STATUSES.PENDING_APPROVAL,
      APPLICATION_STATUSES.APPROVED
    ];
    
    if (!allowedStatuses.includes(app.status)) {
      throw new ValidationError(
        '当前状态不支持撤回操作',
        'INVALID_STATUS_TRANSITION',
        { current_status: app.status }
      );
    }
    
    await db.prepare(`
      UPDATE applications
      SET status = ?, approval_remark = ?, updated_at = CURRENT_TIMESTAMP
      WHERE application_no = ?
    `).run(APPLICATION_STATUSES.WITHDRAWN, reason || null, applicationNo);
    
    const result = await getApplicationDetail(app.id);
    
    await saveOperationLog(
      requestId,
      'WITHDRAW',
      app.id,
      { application_no: applicationNo, reason },
      result,
      'SUCCESS',
      null
    );
    
    return result;
  } catch (error) {
    await saveOperationLog(
      requestId,
      'WITHDRAW',
      null,
      { application_no: applicationNo, reason },
      null,
      'ERROR',
      error.message
    );
    throw error;
  }
}

async function modifyApplication(applicationNo, data, requestId) {
  const cached = await checkIdempotent(requestId);
  if (cached) {
    return cached;
  }
  
  try {
    const app = await db.prepare('SELECT * FROM applications WHERE application_no = ?').get(applicationNo);
    
    if (!app) {
      throw new ValidationError('申请不存在', 'APPLICATION_NOT_FOUND');
    }
    
    const allowedStatuses = [
      APPLICATION_STATUSES.DRAFT,
      APPLICATION_STATUSES.PENDING_APPROVAL,
      APPLICATION_STATUSES.REJECTED
    ];
    
    if (!allowedStatuses.includes(app.status)) {
      throw new ValidationError(
        '当前状态不支持修改操作',
        'INVALID_STATUS_TRANSITION',
        { current_status: app.status }
      );
    }
    
    let booth = null;
    
    if (data.booth_code) {
      booth = await db.prepare('SELECT * FROM booths WHERE booth_code = ?').get(data.booth_code);
      
      if (!booth) {
        throw new ValidationError('摊位不存在', 'BOOTH_NOT_FOUND');
      }
    } else {
      booth = await db.prepare('SELECT * FROM booths WHERE id = ?').get(app.booth_id);
    }
    
    let devices = data.devices ? data.devices : null;
    let totalPower = app.total_power_kw;
    
    if (devices) {
      validateDevices(devices);
      totalPower = calculateTotalPower(devices);
    }
    
    const startTime = data.start_time ? new Date(data.start_time) : new Date(app.start_time);
    const endTime = data.end_time ? new Date(data.end_time) : new Date(app.end_time);
    
    if (data.start_time || data.end_time || data.booth_code || devices) {
      const timeConflict = await checkTimeConflict(
        booth.id,
        startTime.toISOString(),
        endTime.toISOString(),
        app.id
      );
      
      if (timeConflict.length > 0) {
        throw new ValidationError(
          '同一摊位在该时段已有审批中或已通过的申请',
          'TIME_CONFLICT',
          { conflicting_applications: timeConflict }
        );
      }
      
      const capacityCheck = await checkFloorCapacity(
        booth.floor_id,
        startTime.toISOString(),
        endTime.toISOString(),
        app.id
      );
      
      if (capacityCheck.reserved_power + totalPower > capacityCheck.available_capacity) {
        throw new ValidationError(
          '楼层配电容量不足',
          'CAPACITY_EXCEEDED',
          {
            floor_info: {
              floor_name: capacityCheck.floor.floor_name,
              available_capacity_kw: capacityCheck.available_capacity,
              reserved_by_others_kw: capacityCheck.reserved_power,
              requested_kw: totalPower,
              deficit_kw: capacityCheck.reserved_power + totalPower - capacityCheck.available_capacity
            }
          }
        );
      }
    }
    
    const updateFields = [];
    const updateParams = [];
    
    if (data.applicant_name !== undefined) {
      updateFields.push('applicant_name = ?');
      updateParams.push(data.applicant_name);
    }
    
    if (data.applicant_contact !== undefined) {
      updateFields.push('applicant_contact = ?');
      updateParams.push(data.applicant_contact);
    }
    
    if (data.activity_name !== undefined) {
      updateFields.push('activity_name = ?');
      updateParams.push(data.activity_name);
    }
    
    if (data.start_time !== undefined) {
      updateFields.push('start_time = ?');
      updateParams.push(startTime.toISOString());
    }
    
    if (data.end_time !== undefined) {
      updateFields.push('end_time = ?');
      updateParams.push(endTime.toISOString());
    }
    
    if (data.booth_code !== undefined) {
      updateFields.push('booth_id = ?');
      updateParams.push(booth.id);
    }
    
    if (devices) {
      updateFields.push('total_power_kw = ?');
      updateParams.push(totalPower);
    }
    
    if (app.status !== APPLICATION_STATUSES.DRAFT) {
      updateFields.push('status = ?');
      updateParams.push(APPLICATION_STATUSES.MODIFIED);
    }
    
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateParams.push(applicationNo);
    
    if (updateFields.length > 0) {
      const sql = 'UPDATE applications SET ' + updateFields.join(', ') + ' WHERE application_no = ?';
      await db.prepare(sql).run(...updateParams);
    }
    
    if (devices) {
      await db.prepare('DELETE FROM application_devices WHERE application_id = ?').run(app.id);
      
      const deviceStmt = db.prepare(`
        INSERT INTO application_devices (
          application_id, device_name, device_type,
          power_kw, quantity, total_power_kw
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      for (const device of devices) {
        const quantity = device.quantity || 1;
        const total = device.power_kw * quantity;
        await deviceStmt.run(
          app.id,
          device.device_name,
          device.device_type || null,
          device.power_kw,
          quantity,
          total
        );
      }
    }
    
    const result = await getApplicationDetail(app.id);
    
    await saveOperationLog(
      requestId,
      'MODIFY',
      app.id,
      data,
      result,
      'SUCCESS',
      null
    );
    
    return result;
  } catch (error) {
    await saveOperationLog(
      requestId,
      'MODIFY',
      null,
      data,
      null,
      'ERROR',
      error.message
    );
    throw error;
  }
}

async function getApplicationDetail(applicationId) {
  const app = await db.prepare(`
    SELECT a.*, b.booth_code, f.floor_name,
           f.total_capacity_kw as floor_total_capacity_kw,
           f.available_capacity_kw as floor_available_capacity_kw
    FROM applications a
    JOIN booths b ON a.booth_id = b.id
    JOIN floors f ON b.floor_id = f.id
    WHERE a.id = ?
  `).get(applicationId);
  
  if (!app) {
    return null;
  }
  
  const devices = await db.prepare('SELECT * FROM application_devices WHERE application_id = ?').all(applicationId);
  
  return {
    ...app,
    devices
  };
}

async function getApplicationByNo(applicationNo) {
  const app = await db.prepare(`
    SELECT a.*, b.booth_code, f.floor_name,
           f.total_capacity_kw as floor_total_capacity_kw,
           f.available_capacity_kw as floor_available_capacity_kw
    FROM applications a
    JOIN booths b ON a.booth_id = b.id
    JOIN floors f ON b.floor_id = f.id
    WHERE a.application_no = ?
  `).get(applicationNo);
  
  if (!app) {
    return null;
  }
  
  const devices = await db.prepare('SELECT * FROM application_devices WHERE application_id = ?').all(app.id);
  
  return {
    ...app,
    devices
  };
}

async function queryApplications(params = {}) {
  const conditions = [];
  const queryParams = [];
  
  if (params.status) {
    conditions.push('a.status = ?');
    queryParams.push(params.status);
  }
  
  if (params.booth_code) {
    conditions.push('b.booth_code = ?');
    queryParams.push(params.booth_code);
  }
  
  if (params.floor_name) {
    conditions.push('f.floor_name = ?');
    queryParams.push(params.floor_name);
  }
  
  if (params.applicant_name) {
    conditions.push('a.applicant_name LIKE ?');
    queryParams.push('%' + params.applicant_name + '%');
  }
  
  if (params.start_date) {
    conditions.push('a.start_time >= ?');
    queryParams.push(params.start_date);
  }
  
  if (params.end_date) {
    conditions.push('a.end_time <= ?');
    queryParams.push(params.end_date);
  }
  
  const whereClause = conditions.length > 0
    ? 'WHERE ' + conditions.join(' AND ')
    : '';
  
  const sql = `
    SELECT a.*, b.booth_code, f.floor_name
    FROM applications a
    JOIN booths b ON a.booth_id = b.id
    JOIN floors f ON b.floor_id = f.id
    ${whereClause}
    ORDER BY a.created_at DESC
  `;
  
  const applications = await db.prepare(sql).all(...queryParams);
  
  const summary = {
    total: applications.length,
    by_status: {},
    total_power_requested: 0
  };
  
  for (const app of applications) {
    summary.total_power_requested += app.total_power_kw;
    if (!summary.by_status[app.status]) {
      summary.by_status[app.status] = 0;
    }
    summary.by_status[app.status]++;
  }
  
  return {
    applications,
    summary
  };
}

async function getFloorCapacity(floorName) {
  const floor = await db.prepare('SELECT * FROM floors WHERE floor_name = ?').get(floorName);
  
  if (!floor) {
    throw new ValidationError('楼层不存在', 'FLOOR_NOT_FOUND');
  }
  
  const activeApps = await db.prepare(`
    SELECT a.*, b.booth_code
    FROM applications a
    JOIN booths b ON a.booth_id = b.id
    JOIN floors f ON b.floor_id = f.id
    WHERE f.floor_name = ?
    AND a.status IN ('APPROVED', 'PENDING_APPROVAL')
    ORDER BY a.start_time
  `).all(floorName);
  
  const reservedPower = activeApps.reduce((sum, app) => sum + app.total_power_kw, 0);
  
  return {
    floor: {
      floor_name: floor.floor_name,
      total_capacity_kw: floor.total_capacity_kw,
      available_capacity_kw: floor.available_capacity_kw,
      reserved_by_applications_kw: reservedPower,
      remaining_capacity_kw: floor.available_capacity_kw - reservedPower
    },
    active_applications: activeApps
  };
}

module.exports = {
  APPLICATION_STATUSES,
  ValidationError,
  createApplication,
  advanceApplication,
  withdrawApplication,
  modifyApplication,
  getApplicationByNo,
  queryApplications,
  getFloorCapacity
};
