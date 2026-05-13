const { runQuery, getQuery, allQuery } = require('../database/db');

async function validateCheckin(checkinId) {
  const checkin = await getQuery(`
    SELECT ac.*, a.name as activity_name, a.standard_hours, v.name as volunteer_name
    FROM activity_checkins ac
    JOIN activities a ON ac.activity_id = a.id
    JOIN volunteers v ON ac.volunteer_id = v.id
    WHERE ac.id = ?
  `, [checkinId]);

  if (!checkin) {
    return { valid: false, message: '签到记录不存在' };
  }

  const issues = [];

  if (!checkin.checkout_time) {
    issues.push('缺少签退时间');
  }

  if (checkin.hours <= 0) {
    issues.push('时长为0');
  }

  if (checkin.hours > checkin.standard_hours * 1.5) {
    issues.push('时长超过标准时长1.5倍');
  }

  return {
    valid: issues.length === 0,
    checkin,
    issues
  };
}

async function processMissingCheckout(checkinId, approvedHours, notes, handledBy) {
  const checkin = await getQuery('SELECT * FROM activity_checkins WHERE id = ?', [checkinId]);
  if (!checkin) {
    throw new Error('签到记录不存在');
  }

  const oldHours = checkin.hours;

  await runQuery(
    'UPDATE activity_checkins SET hours = ?, status = "pending_audit", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [approvedHours, checkinId]
  );

  await runQuery(
    'INSERT INTO checkin_history (checkin_id, field_name, old_value, new_value, changed_by) VALUES (?, ?, ?, ?, ?)',
    [checkinId, 'hours', oldHours.toString(), approvedHours.toString(), handledBy]
  );

  await runQuery(
    'UPDATE missing_checkouts SET status = "handled", handled_by = ?, handled_at = CURRENT_TIMESTAMP, notes = ? WHERE checkin_id = ?',
    [handledBy, notes, checkinId]
  );

  return { success: true, message: '缺签退处理完成' };
}

async function saveSupplementalAudit(auditId, status, approvedHours, handledBy) {
  const audit = await getQuery('SELECT * FROM supplemental_audits WHERE id = ?', [auditId]);
  if (!audit) {
    throw new Error('审核记录不存在');
  }

  if (status === 'approved' && approvedHours !== undefined) {
    const checkin = await getQuery('SELECT * FROM activity_checkins WHERE id = ?', [audit.checkin_id]);
    if (!checkin) {
      throw new Error('签到记录不存在');
    }

    const oldHours = checkin.hours;

    await runQuery(
      'UPDATE activity_checkins SET hours = ?, status = "confirmed", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [approvedHours, audit.checkin_id]
    );

    await runQuery(
      'INSERT INTO checkin_history (checkin_id, field_name, old_value, new_value, changed_by) VALUES (?, ?, ?, ?, ?)',
      [audit.checkin_id, 'hours', oldHours.toString(), approvedHours.toString(), handledBy]
    );

    await updateVolunteerTotalHours(checkin.volunteer_id);

    await updateCaptainConfirmation(checkin.id, approvedHours, handledBy);
  }

  await runQuery(
    'UPDATE supplemental_audits SET status = ?, approved_hours = ?, handled_by = ?, handled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [status, approvedHours || audit.approved_hours, handledBy, auditId]
  );

  return { success: true, message: '审核完成' };
}

async function updateVolunteerTotalHours(volunteerId) {
  const result = await getQuery(
    'SELECT SUM(hours) as total FROM activity_checkins WHERE volunteer_id = ? AND status = "confirmed"',
    [volunteerId]
  );

  const volunteer = await getQuery('SELECT total_hours FROM volunteers WHERE id = ?', [volunteerId]);
  const oldTotal = volunteer ? volunteer.total_hours : 0;
  const newTotal = result.total || 0;

  if (Math.abs(oldTotal - newTotal) > 0.01) {
    await runQuery(
      'UPDATE volunteers SET total_hours = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newTotal, volunteerId]
    );

    await runQuery(
      'INSERT INTO volunteer_history (volunteer_id, field_name, old_value, new_value, changed_by) VALUES (?, ?, ?, ?, ?)',
      [volunteerId, 'total_hours', oldTotal.toString(), newTotal.toString(), '系统自动更新']
    );
  }
}

async function updateCaptainConfirmation(checkinId, confirmedHours, handledBy) {
  const confirmation = await getQuery('SELECT * FROM captain_confirmations WHERE checkin_id = ?', [checkinId]);
  if (confirmation) {
    const oldHours = confirmation.confirmed_hours;

    await runQuery(
      'UPDATE captain_confirmations SET confirmed_hours = ?, status = "confirmed", confirmed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE checkin_id = ?',
      [confirmedHours, checkinId]
    );

    if (Math.abs(oldHours - confirmedHours) > 0.01) {
      await runQuery(
        'INSERT INTO confirmation_history (confirmation_id, field_name, old_value, new_value, changed_by) VALUES (?, ?, ?, ?, ?)',
        [confirmation.id, 'confirmed_hours', oldHours.toString(), confirmedHours.toString(), handledBy]
      );
    }
  }
}

async function getAuditList(filters = {}) {
  let sql = `
    SELECT 
      sa.id,
      sa.checkin_id,
      sa.original_hours,
      sa.approved_hours,
      sa.status,
      sa.reason,
      sa.handled_by,
      sa.handled_at,
      sa.created_at,
      ac.checkin_time,
      ac.checkout_time,
      a.name as activity_name,
      a.date as activity_date,
      v.name as volunteer_name,
      v.phone as volunteer_phone,
      c.status as confirmation_status,
      c.confirmed_hours
    FROM supplemental_audits sa
    JOIN activity_checkins ac ON sa.checkin_id = ac.id
    JOIN activities a ON ac.activity_id = a.id
    JOIN volunteers v ON ac.volunteer_id = v.id
    LEFT JOIN captain_confirmations c ON sa.checkin_id = c.checkin_id
    WHERE 1=1
  `;

  const params = [];

  if (filters.volunteerName) {
    sql += ' AND v.name LIKE ?';
    params.push(`%${filters.volunteerName}%`);
  }

  if (filters.activityName) {
    sql += ' AND a.name LIKE ?';
    params.push(`%${filters.activityName}%`);
  }

  if (filters.status) {
    sql += ' AND sa.status = ?';
    params.push(filters.status);
  }

  if (filters.startDate) {
    sql += ' AND a.date >= ?';
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    sql += ' AND a.date <= ?';
    params.push(filters.endDate);
  }

  sql += ' ORDER BY sa.created_at DESC';

  return await allQuery(sql, params);
}

async function getStatistics() {
  const pendingAudits = await getQuery('SELECT COUNT(*) as count FROM supplemental_audits WHERE status = "pending"');
  const approvedAudits = await getQuery('SELECT COUNT(*) as count FROM supplemental_audits WHERE status = "approved"');
  const rejectedAudits = await getQuery('SELECT COUNT(*) as count FROM supplemental_audits WHERE status = "rejected"');
  const missingCheckouts = await getQuery('SELECT COUNT(*) as count FROM missing_checkouts WHERE status = "pending"');

  const totalHoursResult = await getQuery('SELECT SUM(approved_hours) as total FROM supplemental_audits WHERE status = "approved"');

  return {
    pendingAudits: pendingAudits.count,
    approvedAudits: approvedAudits.count,
    rejectedAudits: rejectedAudits.count,
    missingCheckouts: missingCheckouts.count,
    totalApprovedHours: totalHoursResult.total || 0
  };
}

async function getMissingCheckoutList() {
  return await allQuery(`
    SELECT 
      mc.id,
      mc.checkin_id,
      mc.status,
      mc.notes,
      mc.created_at,
      ac.checkin_time,
      a.name as activity_name,
      a.date as activity_date,
      v.name as volunteer_name
    FROM missing_checkouts mc
    JOIN activity_checkins ac ON mc.checkin_id = ac.id
    JOIN activities a ON ac.activity_id = a.id
    JOIN volunteers v ON ac.volunteer_id = v.id
    WHERE mc.status = 'pending'
    ORDER BY mc.created_at DESC
  `);
}

async function exportReport(filters = {}) {
  let sql = `
    SELECT 
      sa.id,
      v.name as volunteer_name,
      v.phone,
      a.name as activity_name,
      a.date as activity_date,
      ac.checkin_time,
      ac.checkout_time,
      sa.original_hours,
      sa.approved_hours,
      sa.status as audit_status,
      sa.reason,
      sa.handled_by,
      sa.handled_at,
      c.confirmed_hours,
      c.status as confirmation_status
    FROM supplemental_audits sa
    JOIN activity_checkins ac ON sa.checkin_id = ac.id
    JOIN activities a ON ac.activity_id = a.id
    JOIN volunteers v ON ac.volunteer_id = v.id
    LEFT JOIN captain_confirmations c ON sa.checkin_id = c.checkin_id
    WHERE 1=1
  `;

  const params = [];

  if (filters.handledBy) {
    sql += ' AND sa.handled_by LIKE ?';
    params.push(`%${filters.handledBy}%`);
  }

  if (filters.startTime) {
    sql += ' AND sa.handled_at >= ?';
    params.push(filters.startTime);
  }

  if (filters.endTime) {
    sql += ' AND sa.handled_at <= ?';
    params.push(filters.endTime);
  }

  sql += ' ORDER BY sa.handled_at DESC';

  return await allQuery(sql, params);
}

async function getVolunteerHistory(volunteerId) {
  return await allQuery(`
    SELECT * FROM volunteer_history
    WHERE volunteer_id = ?
    ORDER BY changed_at DESC
  `, [volunteerId]);
}

async function getCheckinHistory(checkinId) {
  return await allQuery(`
    SELECT * FROM checkin_history
    WHERE checkin_id = ?
    ORDER BY changed_at DESC
  `, [checkinId]);
}

async function getConfirmationHistory(confirmationId) {
  return await allQuery(`
    SELECT * FROM confirmation_history
    WHERE confirmation_id = ?
    ORDER BY changed_at DESC
  `, [confirmationId]);
}

module.exports = {
  validateCheckin,
  processMissingCheckout,
  saveSupplementalAudit,
  getAuditList,
  getStatistics,
  getMissingCheckoutList,
  exportReport,
  getVolunteerHistory,
  getCheckinHistory,
  getConfirmationHistory
};
