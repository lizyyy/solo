const db = require('../database/init');
const { v4: uuidv4 } = require('uuid');

function calculateAge(birthDate) {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function getResidentWithFamily(residentId) {
  const resident = db.prepare('SELECT * FROM residents WHERE id = ?').get(residentId);
  if (!resident) return null;
  
  const familyMembers = db.prepare('SELECT * FROM family_members WHERE resident_id = ?').all(residentId);
  return {
    ...resident,
    familyMembers
  };
}

function getFamilyMembersByIds(memberIds) {
  if (!memberIds || memberIds.length === 0) return [];
  const placeholders = memberIds.map(() => '?').join(',');
  return db.prepare(`SELECT * FROM family_members WHERE id IN (${placeholders})`).all(...memberIds);
}

function getActivityParticipants(activityId) {
  return db.prepare(`
    SELECT r.*, 
           reg.id as registration_id,
           reg.status as registration_status,
           reg.participant_count,
           reg.family_member_ids,
           reg.check_in_time
    FROM registrations reg
    JOIN residents r ON reg.resident_id = r.id
    WHERE reg.activity_id = ? AND reg.status IN ('confirmed', 'checked_in')
  `).all(activityId);
}

function getActivityWaitlist(activityId) {
  return db.prepare(`
    SELECT w.*, r.name as resident_name
    FROM waitlist w
    JOIN residents r ON w.resident_id = r.id
    WHERE w.activity_id = ? AND w.status = 'waiting'
    ORDER BY w.position ASC
  `).all(activityId);
}

function getConfirmedCount(activityId) {
  const result = db.prepare(`
    SELECT COALESCE(SUM(participant_count), 0) as total
    FROM registrations 
    WHERE activity_id = ? AND status IN ('confirmed', 'checked_in')
  `).get(activityId);
  return result.total;
}

function getNextWaitlistPosition(activityId) {
  const result = db.prepare(`
    SELECT COALESCE(MAX(position), 0) + 1 as next_position
    FROM waitlist
    WHERE activity_id = ? AND status = 'waiting'
  `).get(activityId);
  return result.next_position;
}

function logAudit(entityType, entityId, action, beforeData, afterData, operator, reason, requestId) {
  const stmt = db.prepare(`
    INSERT INTO audit_logs (id, entity_type, entity_id, action, before_data, after_data, operator, reason, request_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    uuidv4(),
    entityType,
    entityId,
    action,
    beforeData ? JSON.stringify(beforeData) : null,
    afterData ? JSON.stringify(afterData) : null,
    operator || 'system',
    reason || null,
    requestId || null
  );
}

function checkIdempotency(requestId, action) {
  const existing = db.prepare('SELECT * FROM idempotency_keys WHERE request_id = ? AND action = ?').get(requestId, action);
  return existing;
}

function saveIdempotency(requestId, action, responseData, statusCode) {
  const stmt = db.prepare(`
    INSERT INTO idempotency_keys (id, request_id, action, response_data, status_code)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(
    uuidv4(),
    requestId,
    action,
    JSON.stringify(responseData),
    statusCode
  );
}

function validateRegistration(activityId, residentId, familyMemberIds = []) {
  const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(activityId);
  if (!activity) {
    return { valid: false, reason: '活动不存在', code: 'ACTIVITY_NOT_FOUND' };
  }
  
  if (activity.status !== 'active') {
    return { valid: false, reason: '活动未开放报名', code: 'ACTIVITY_NOT_ACTIVE' };
  }
  
  const resident = getResidentWithFamily(residentId);
  if (!resident) {
    return { valid: false, reason: '居民不存在', code: 'RESIDENT_NOT_FOUND' };
  }
  
  const familyMemberIdArray = Array.isArray(familyMemberIds) ? familyMemberIds : (familyMemberIds ? familyMemberIds.split(',') : []);
  const allParticipants = [resident, ...getFamilyMembersByIds(familyMemberIdArray)];
  const participantCount = allParticipants.length;
  
  const existingRegistration = db.prepare(
    'SELECT * FROM registrations WHERE activity_id = ? AND resident_id = ? AND status IN (\'pending\', \'confirmed\', \'checked_in\')'
  ).get(activityId, residentId);
  
  if (existingRegistration) {
    return { valid: false, reason: '该居民已报名此活动', code: 'ALREADY_REGISTERED' };
  }
  
  const existingWaitlist = db.prepare(
    'SELECT * FROM waitlist WHERE activity_id = ? AND resident_id = ? AND status = \'waiting\''
  ).get(activityId, residentId);
  
  if (existingWaitlist) {
    return { valid: false, reason: '该居民已在候补队列中', code: 'ALREADY_IN_WAITLIST' };
  }
  
  if (activity.max_per_family && participantCount > activity.max_per_family) {
    return { 
      valid: false, 
      reason: `家庭报名人数超限，活动限制每户最多${activity.max_per_family}人，当前报名${participantCount}人`, 
      code: 'FAMILY_LIMIT_EXCEEDED',
      detail: { max: activity.max_per_family, current: participantCount }
    };
  }
  
  const ageViolations = [];
  for (const participant of allParticipants) {
    const age = calculateAge(participant.birth_date);
    if (activity.min_age !== null && activity.min_age !== undefined && age < activity.min_age) {
      ageViolations.push({
        name: participant.name,
        age,
        reason: `年龄${age}岁低于活动最低年龄限制${activity.min_age}岁`
      });
    }
    if (activity.max_age !== null && activity.max_age !== undefined && age > activity.max_age) {
      ageViolations.push({
        name: participant.name,
        age,
        reason: `年龄${age}岁高于活动最高年龄限制${activity.max_age}岁`
      });
    }
  }
  
  if (ageViolations.length > 0) {
    return {
      valid: false,
      reason: '存在参与者年龄不符合活动限制',
      code: 'AGE_RESTRICTION_VIOLATION',
      detail: { violations: ageViolations }
    };
  }
  
  const currentCount = getConfirmedCount(activityId);
  const isFull = currentCount + participantCount > activity.max_participants;
  
  return {
    valid: true,
    isFull,
    participantCount,
    activity,
    resident,
    allParticipants,
    currentCount
  };
}

function registerForActivity(data) {
  const { activityId, residentId, familyMemberIds = [], operator, requestId } = data;
  
  if (requestId) {
    const existing = checkIdempotency(requestId, 'register');
    if (existing) {
      return {
        success: true,
        idempotent: true,
        data: JSON.parse(existing.response_data)
      };
    }
  }
  
  const validation = validateRegistration(activityId, residentId, familyMemberIds);
  
  if (!validation.valid) {
    const response = {
      success: false,
      error: validation.reason,
      code: validation.code,
      detail: validation.detail
    };
    if (requestId) saveIdempotency(requestId, 'register', response, 400);
    return response;
  }
  
  const { activity, participantCount, isFull, allParticipants } = validation;
  
  if (isFull) {
    const position = getNextWaitlistPosition(activityId);
    const waitlistId = uuidv4();
    
    const stmt = db.prepare(`
      INSERT INTO waitlist (id, activity_id, resident_id, family_member_ids, participant_count, position)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      waitlistId,
      activityId,
      residentId,
      familyMemberIds.join(','),
      participantCount,
      position
    );
    
    const response = {
      success: true,
      result: 'waitlist',
      waitlistId,
      position,
      message: `活动名额已满，已加入候补队列，当前位置：${position}`,
      activity: { id: activity.id, name: activity.name },
      participants: allParticipants.map(p => ({ name: p.name, age: calculateAge(p.birth_date) }))
    };
    
    logAudit('waitlist', waitlistId, 'created', null, {
      activityId, residentId, position, participantCount
    }, operator, '活动名额已满，加入候补队列', requestId);
    
    if (requestId) saveIdempotency(requestId, 'register', response, 200);
    return response;
  }
  
  const registrationId = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO registrations (id, activity_id, resident_id, family_member_ids, participant_count, status)
    VALUES (?, ?, ?, ?, ?, 'confirmed')
  `);
  stmt.run(
    registrationId,
    activityId,
    residentId,
    familyMemberIds.join(','),
    participantCount
  );
  
  const response = {
    success: true,
    result: 'confirmed',
    registrationId,
    message: '报名成功',
    activity: { id: activity.id, name: activity.name },
    participants: allParticipants.map(p => ({ name: p.name, age: calculateAge(p.birth_date) }))
  };
  
  logAudit('registration', registrationId, 'created', null, {
    activityId, residentId, participantCount, status: 'confirmed'
  }, operator, '报名成功', requestId);
  
  if (requestId) saveIdempotency(requestId, 'register', response, 200);
  return response;
}

function cancelRegistration(data) {
  const { registrationId, operator, reason, requestId } = data;
  
  if (requestId) {
    const existing = checkIdempotency(requestId, 'cancel');
    if (existing) {
      return {
        success: true,
        idempotent: true,
        data: JSON.parse(existing.response_data)
      };
    }
  }
  
  const registration = db.prepare('SELECT * FROM registrations WHERE id = ?').get(registrationId);
  
  if (!registration) {
    const response = { success: false, error: '报名记录不存在', code: 'REGISTRATION_NOT_FOUND' };
    if (requestId) saveIdempotency(requestId, 'cancel', response, 404);
    return response;
  }
  
  if (registration.status === 'checked_in') {
    const response = { success: false, error: '已签到的报名不能取消', code: 'CANNOT_CANCEL_CHECKED_IN' };
    if (requestId) saveIdempotency(requestId, 'cancel', response, 400);
    return response;
  }
  
  if (registration.status === 'cancelled') {
    const response = { success: true, result: 'already_cancelled', message: '该报名已取消' };
    if (requestId) saveIdempotency(requestId, 'cancel', response, 200);
    return response;
  }
  
  const beforeData = { ...registration };
  
  db.prepare('UPDATE registrations SET status = \'cancelled\', updated_at = datetime(\'now\') WHERE id = ?')
    .run(registrationId);
  
  logAudit('registration', registrationId, 'cancelled', beforeData, { status: 'cancelled' }, operator, reason, requestId);
  
  const waitlistPromoted = processWaitlistPromotion(registration.activity_id, operator, requestId);
  
  const response = {
    success: true,
    result: 'cancelled',
    message: '取消成功',
    promoted: waitlistPromoted
  };
  
  if (requestId) saveIdempotency(requestId, 'cancel', response, 200);
  return response;
}

function cancelWaitlist(data) {
  const { waitlistId, operator, reason, requestId } = data;
  
  if (requestId) {
    const existing = checkIdempotency(requestId, 'cancel_waitlist');
    if (existing) {
      return {
        success: true,
        idempotent: true,
        data: JSON.parse(existing.response_data)
      };
    }
  }
  
  const waitlistItem = db.prepare('SELECT * FROM waitlist WHERE id = ?').get(waitlistId);
  
  if (!waitlistItem) {
    const response = { success: false, error: '候补记录不存在', code: 'WAITLIST_NOT_FOUND' };
    if (requestId) saveIdempotency(requestId, 'cancel_waitlist', response, 404);
    return response;
  }
  
  if (waitlistItem.status !== 'waiting') {
    const response = { success: true, message: '该候补已不在队列中', status: waitlistItem.status };
    if (requestId) saveIdempotency(requestId, 'cancel_waitlist', response, 200);
    return response;
  }
  
  const beforeData = { ...waitlistItem };
  const activityId = waitlistItem.activity_id;
  const position = waitlistItem.position;
  
  db.prepare('UPDATE waitlist SET status = \'cancelled\', updated_at = datetime(\'now\') WHERE id = ?')
    .run(waitlistId);
  
  db.prepare('UPDATE waitlist SET position = position - 1, updated_at = datetime(\'now\') WHERE activity_id = ? AND position > ? AND status = \'waiting\'')
    .run(activityId, position);
  
  logAudit('waitlist', waitlistId, 'cancelled', beforeData, { status: 'cancelled' }, operator, reason, requestId);
  
  const response = { success: true, result: 'cancelled', message: '候补已取消' };
  if (requestId) saveIdempotency(requestId, 'cancel_waitlist', response, 200);
  return response;
}

function processWaitlistPromotion(activityId, operator, requestId) {
  const currentCount = getConfirmedCount(activityId);
  const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(activityId);
  const availableSpots = activity.max_participants - currentCount;
  
  if (availableSpots <= 0) return [];
  
  const waitlist = db.prepare(`
    SELECT * FROM waitlist 
    WHERE activity_id = ? AND status = 'waiting' 
    ORDER BY position ASC
  `).all(activityId);
  
  const promoted = [];
  let remainingSpots = availableSpots;
  
  for (const item of waitlist) {
    if (remainingSpots <= 0) break;
    if (item.participant_count > remainingSpots) continue;
    
    const registrationId = uuidv4();
    
    db.prepare(`
      INSERT INTO registrations (id, activity_id, resident_id, family_member_ids, participant_count, status)
      VALUES (?, ?, ?, ?, ?, 'confirmed')
    `).run(
      registrationId,
      activityId,
      item.resident_id,
      item.family_member_ids,
      item.participant_count
    );
    
    const beforeData = { ...item };
    db.prepare('UPDATE waitlist SET status = \'promoted\', updated_at = datetime(\'now\') WHERE id = ?')
      .run(item.id);
    
    logAudit('waitlist', item.id, 'promoted', beforeData, { status: 'promoted', registrationId }, operator, '名额释放，候补递补成功', requestId);
    logAudit('registration', registrationId, 'created', null, {
      activityId, residentId: item.resident_id, participantCount: item.participant_count, status: 'confirmed', source: 'waitlist'
    }, operator, '候补递补成功', requestId);
    
    db.prepare('UPDATE waitlist SET position = position - 1, updated_at = datetime(\'now\') WHERE activity_id = ? AND position > ? AND status = \'waiting\'')
      .run(activityId, item.position);
    
    promoted.push({
      waitlistId: item.id,
      registrationId,
      residentId: item.resident_id,
      participantCount: item.participant_count
    });
    
    remainingSpots -= item.participant_count;
  }
  
  return promoted;
}

function checkIn(data) {
  const { registrationId, operator, requestId } = data;
  
  if (requestId) {
    const existing = checkIdempotency(requestId, 'checkin');
    if (existing) {
      return {
        success: true,
        idempotent: true,
        data: JSON.parse(existing.response_data)
      };
    }
  }
  
  const registration = db.prepare('SELECT * FROM registrations WHERE id = ?').get(registrationId);
  
  if (!registration) {
    const response = { success: false, error: '报名记录不存在', code: 'REGISTRATION_NOT_FOUND' };
    if (requestId) saveIdempotency(requestId, 'checkin', response, 404);
    return response;
  }
  
  if (registration.status === 'checked_in') {
    const response = { success: true, result: 'already_checked_in', message: '已签到' };
    if (requestId) saveIdempotency(requestId, 'checkin', response, 200);
    return response;
  }
  
  if (registration.status !== 'confirmed') {
    const response = { success: false, error: `当前状态${registration.status}不允许签到`, code: 'INVALID_STATUS' };
    if (requestId) saveIdempotency(requestId, 'checkin', response, 400);
    return response;
  }
  
  const beforeData = { ...registration };
  
  db.prepare(`
    UPDATE registrations 
    SET status = 'checked_in', check_in_time = datetime('now'), check_in_by = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(operator || 'staff', registrationId);
  
  logAudit('registration', registrationId, 'checked_in', beforeData, { status: 'checked_in' }, operator, '签到成功', requestId);
  
  const response = { success: true, result: 'checked_in', message: '签到成功' };
  if (requestId) saveIdempotency(requestId, 'checkin', response, 200);
  return response;
}

function manualCorrection(data) {
  const { entityType, entityId, updates, operator, reason, requestId } = data;
  
  if (!operator || !reason) {
    return { success: false, error: '人工修正必须提供操作者和原因', code: 'OPERATOR_REASON_REQUIRED' };
  }
  
  let table;
  switch (entityType) {
    case 'registration': table = 'registrations'; break;
    case 'waitlist': table = 'waitlist'; break;
    case 'activity': table = 'activities'; break;
    default: return { success: false, error: '不支持的实体类型', code: 'INVALID_ENTITY_TYPE' };
  }
  
  const existing = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(entityId);
  if (!existing) {
    return { success: false, error: '实体不存在', code: 'ENTITY_NOT_FOUND' };
  }
  
  const beforeData = { ...existing };
  const afterData = { ...existing, ...updates };
  
  const validFields = Object.keys(updates).filter(key => existing.hasOwnProperty(key));
  if (validFields.length === 0) {
    return { success: false, error: '没有有效的更新字段', code: 'NO_VALID_FIELDS' };
  }
  
  const setClause = validFields.map(key => `${key} = ?`).join(', ');
  const values = [...validFields.map(key => updates[key]), entityId];
  
  db.prepare(`UPDATE ${table} SET ${setClause}, updated_at = datetime('now') WHERE id = ?`).run(...values);
  
  const diff = {
    before: {},
    after: {}
  };
  for (const key of validFields) {
    if (JSON.stringify(existing[key]) !== JSON.stringify(updates[key])) {
      diff.before[key] = existing[key];
      diff.after[key] = updates[key];
    }
  }
  
  logAudit(entityType, entityId, 'manual_correction', diff.before, diff.after, operator, reason, requestId);
  
  return {
    success: true,
    message: '人工修正成功',
    diff,
    operator,
    reason
  };
}

function getActivityReport(activityId) {
  const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(activityId);
  if (!activity) return { success: false, error: '活动不存在', code: 'ACTIVITY_NOT_FOUND' };
  
  const registrations = db.prepare(`
    SELECT r.*, res.name as resident_name, res.phone as resident_phone
    FROM registrations r
    JOIN residents res ON r.resident_id = res.id
    WHERE r.activity_id = ?
    ORDER BY r.created_at ASC
  `).all(activityId);
  
  const waitlist = getActivityWaitlist(activityId);
  
  const confirmed = registrations.filter(r => r.status === 'confirmed' || r.status === 'checked_in');
  const checkedIn = registrations.filter(r => r.status === 'checked_in');
  const cancelled = registrations.filter(r => r.status === 'cancelled');
  
  const totalParticipants = confirmed.reduce((sum, r) => sum + r.participant_count, 0);
  const checkedInParticipants = checkedIn.reduce((sum, r) => sum + r.participant_count, 0);
  
  const waitlistParticipants = waitlist.filter(w => w.status === 'waiting').reduce((sum, w) => sum + w.participant_count, 0);
  
  const auditLogs = db.prepare(`
    SELECT * FROM audit_logs 
    WHERE entity_type IN ('activity', 'registration', 'waitlist') 
    AND (entity_id = ? OR entity_type = 'activity' AND entity_id = ?)
    ORDER BY created_at ASC
  `).all(activityId, activityId);
  
  return {
    success: true,
    activity,
    summary: {
      maxParticipants: activity.max_participants,
      registeredCount: confirmed.length,
      registeredParticipants: totalParticipants,
      availableSpots: activity.max_participants - totalParticipants,
      checkedInCount: checkedIn.length,
      checkedInParticipants,
      checkInRate: totalParticipants > 0 ? ((checkedInParticipants / totalParticipants) * 100).toFixed(1) : '0',
      cancelledCount: cancelled.length,
      waitlistCount: waitlist.filter(w => w.status === 'waiting').length,
      waitlistParticipants
    },
    registrations,
    waitlist,
    auditLogs
  };
}

function getFamilyReport(residentId) {
  const resident = getResidentWithFamily(residentId);
  if (!resident) return { success: false, error: '居民不存在', code: 'RESIDENT_NOT_FOUND' };
  
  const allMemberIds = [residentId, ...resident.familyMembers.map(m => m.id)];
  
  const registrations = db.prepare(`
    SELECT r.*, a.name as activity_name, a.start_time as activity_time, a.status as activity_status
    FROM registrations r
    JOIN activities a ON r.activity_id = a.id
    WHERE r.resident_id = ?
    ORDER BY a.start_time DESC
  `).all(residentId);
  
  const waitlistItems = db.prepare(`
    SELECT w.*, a.name as activity_name, a.start_time as activity_time
    FROM waitlist w
    JOIN activities a ON w.activity_id = a.id
    WHERE w.resident_id = ? AND w.status = 'waiting'
    ORDER BY w.position ASC
  `).all(residentId);
  
  return {
    success: true,
    resident: {
      id: resident.id,
      name: resident.name,
      age: calculateAge(resident.birth_date),
      phone: resident.phone,
      address: resident.address
    },
    familyMembers: resident.familyMembers.map(m => ({
      id: m.id,
      name: m.name,
      relation: m.relation,
      age: calculateAge(m.birth_date)
    })),
    registrations,
    waitlist: waitlistItems
  };
}

module.exports = {
  calculateAge,
  getResidentWithFamily,
  getActivityParticipants,
  getActivityWaitlist,
  validateRegistration,
  registerForActivity,
  cancelRegistration,
  cancelWaitlist,
  checkIn,
  manualCorrection,
  getActivityReport,
  getFamilyReport,
  logAudit
};
