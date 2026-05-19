const { db } = require('../models/database');

const logRule = (hazardId, ruleName, action, reason, details = null) => {
  const stmt = db.prepare(`
    INSERT INTO rule_logs (hazard_id, rule_name, action, reason, details)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(hazardId, ruleName, action, reason, details);
};

const checkPhotoRequired = (hazard, stage) => {
  const photoFields = {
    inspect: 'inspector_photo',
    rectify: 'rectify_photo',
    recheck: 'recheck_photo'
  };
  const photoField = photoFields[stage];
  const hasPhoto = hazard[photoField] && hazard[photoField].trim() !== '';
  
  if (!hasPhoto) {
    logRule(hazard.id, 'photo_required', 'block', 
      `${stage === 'inspect' ? '巡检' : stage === 'rectify' ? '整改' : '复查'}必须上传照片`,
      `缺失字段: ${photoField}`
    );
    return { passed: false, reason: `${stage === 'inspect' ? '巡检' : stage === 'rectify' ? '整改' : '复查'}必须上传照片才能通过` };
  }
  
  logRule(hazard.id, 'photo_required', 'allow', 
    `${stage === 'inspect' ? '巡检' : stage === 'rectify' ? '整改' : '复查'}照片已上传`,
    `字段: ${photoField}, 值: ${hazard[photoField]}`
  );
  return { passed: true };
};

const checkOverdueEscalation = () => {
  const now = new Date();
  const stmt = db.prepare(`
    SELECT * FROM hazards 
    WHERE status IN ('pending', 'rectifying') 
      AND rectify_deadline IS NOT NULL 
      AND rectify_deadline < ?
      AND hazard_level IN ('high', 'critical')
  `);
  
  const overdueHazards = stmt.all(now.toISOString());
  const results = [];
  
  for (const hazard of overdueHazards) {
    if (hazard.status !== 'escalated') {
      const updateStmt = db.prepare(`
        UPDATE hazards SET status = 'escalated', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      updateStmt.run(hazard.id);
      
      const historyStmt = db.prepare(`
        INSERT INTO status_history (hazard_id, from_status, to_status, operator, remark)
        VALUES (?, ?, ?, 'system', ?)
      `);
      historyStmt.run(hazard.id, hazard.status, 'escalated', '高等级隐患整改逾期，自动升级');
      
      logRule(hazard.id, 'overdue_escalation', 'escalate',
        '高等级隐患整改逾期，自动升级处理',
        `原状态: ${hazard.status}, 截止时间: ${hazard.rectify_deadline}, 当前时间: ${now.toISOString()}`
      );
      
      results.push({ hazardId: hazard.id, action: 'escalated', reason: '高等级隐患整改逾期，已自动升级' });
    }
  }
  
  return results;
};

const checkDuplicateLocation = (newHazard) => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  const stmt = db.prepare(`
    SELECT * FROM hazards 
    WHERE location = ? 
      AND id != ?
      AND inspector_time > ?
    ORDER BY inspector_time DESC
    LIMIT 5
  `);
  
  const duplicates = stmt.all(newHazard.location, newHazard.id || 0, thirtyDaysAgo.toISOString());
  
  if (duplicates.length > 0) {
    const duplicateIds = duplicates.map(d => d.id).join(',');
    logRule(newHazard.id, 'duplicate_location', 'merge',
      `发现同位置(${newHazard.location})30天内有${duplicates.length}条重复隐患记录`,
      `关联ID: ${duplicateIds}`
    );
    return { 
      hasDuplicate: true, 
      duplicates,
      reason: `该位置(${newHazard.location})30天内已有${duplicates.length}条隐患记录，建议合并处理`
    };
  }
  
  return { hasDuplicate: false };
};

const checkRectificationDeadline = (hazard) => {
  if (!hazard.rectify_deadline) {
    return { passed: false, reason: '必须设置整改截止时间' };
  }
  
  const deadline = new Date(hazard.rectify_deadline);
  const inspectTime = new Date(hazard.inspector_time);
  
  if (deadline <= inspectTime) {
    logRule(hazard.id, 'deadline_validation', 'block',
      '整改截止时间必须晚于巡检时间',
      `巡检时间: ${hazard.inspector_time}, 截止时间: ${hazard.rectify_deadline}`
    );
    return { passed: false, reason: '整改截止时间必须晚于巡检时间' };
  }
  
  const maxDays = hazard.hazard_level === 'critical' ? 3 : hazard.hazard_level === 'high' ? 7 : 30;
  const diffDays = Math.ceil((deadline - inspectTime) / (1000 * 60 * 60 * 24));
  
  if (diffDays > maxDays) {
    logRule(hazard.id, 'deadline_validation', 'block',
      `${hazard.hazard_level === 'critical' ? '重大' : hazard.hazard_level === 'high' ? '高' : ''}等级隐患整改期限超过规定`,
      `等级: ${hazard.hazard_level}, 允许最大天数: ${maxDays}, 实际: ${diffDays}`
    );
    return { passed: false, reason: `${hazard.hazard_level === 'critical' ? '重大' : hazard.hazard_level === 'high' ? '高' : ''}等级隐患整改期限不能超过${maxDays}天` };
  }
  
  logRule(hazard.id, 'deadline_validation', 'allow',
    '整改期限设置合理',
    `等级: ${hazard.hazard_level}, 天数: ${diffDays}`
  );
  return { passed: true };
};

const getHazardRuleLogs = (hazardId) => {
  const stmt = db.prepare('SELECT * FROM rule_logs WHERE hazard_id = ? ORDER BY created_at DESC');
  return stmt.all(hazardId);
};

const getAllRuleLogs = (filters = {}) => {
  let sql = 'SELECT * FROM rule_logs WHERE 1=1';
  const params = [];
  
  if (filters.hazard_id) {
    sql += ' AND hazard_id = ?';
    params.push(filters.hazard_id);
  }
  if (filters.action) {
    sql += ' AND action = ?';
    params.push(filters.action);
  }
  if (filters.rule_name) {
    sql += ' AND rule_name = ?';
    params.push(filters.rule_name);
  }
  
  sql += ' ORDER BY created_at DESC';
  
  const stmt = db.prepare(sql);
  return stmt.all(...params);
};

module.exports = {
  checkPhotoRequired,
  checkOverdueEscalation,
  checkDuplicateLocation,
  checkRectificationDeadline,
  getHazardRuleLogs,
  getAllRuleLogs,
  logRule
};
