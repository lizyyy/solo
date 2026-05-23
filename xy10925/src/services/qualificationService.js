const db = require('../database/db');

const REQUIRED_DOCUMENTS = ['身份证', '参赛证明', '健康证明'];

const getAthleteWithDetails = (athleteId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM athletes WHERE id = ?', [athleteId], (err, athlete) => {
      if (err) return reject(err);
      if (!athlete) return resolve(null);

      db.all('SELECT * FROM documents WHERE athlete_id = ?', [athleteId], (err, docs) => {
        if (err) return reject(err);
        athlete.documents = docs;

        db.get('SELECT * FROM groups WHERE id = ?', [athlete.group_id], (err, group) => {
          if (err) return reject(err);
          athlete.group = group;

          db.get('SELECT * FROM substitutes WHERE athlete_id = ? AND is_promoted = 0', [athleteId], (err, substitute) => {
            if (err) return reject(err);
            athlete.substitute = substitute;

            db.all('SELECT * FROM checkin_events WHERE athlete_id = ? ORDER BY checkin_time DESC', [athleteId], (err, events) => {
              if (err) return reject(err);
              athlete.checkinEvents = events;
              resolve(athlete);
            });
          });
        });
      });
    });
  });
};

const validateDocuments = (athlete) => {
  const issues = [];
  const athleteDocs = athlete.documents || [];
  
  for (const required of REQUIRED_DOCUMENTS) {
    const doc = athleteDocs.find(d => d.doc_type === required);
    if (!doc) {
      issues.push(`缺少 ${required}`);
    } else if (!doc.is_valid) {
      issues.push(`${required} 未验证`);
    }
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
};

const checkGroupCapacity = (groupId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT max_participants FROM groups WHERE id = ?', [groupId], (err, group) => {
      if (err) return reject(err);
      if (!group) return resolve({ valid: false, message: '组别不存在' });

      db.get('SELECT COUNT(*) as count FROM athletes WHERE group_id = ?', [groupId], (err, result) => {
        if (err) return reject(err);
        const current = result.count;
        const max = group.max_participants;
        resolve({
          valid: current < max,
          current,
          max,
          remaining: max - current
        });
      });
    });
  });
};

const checkDuplicateCheckin = (athleteId) => {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM checkin_events WHERE athlete_id = ? AND status = "已检录" ORDER BY checkin_time DESC LIMIT 1',
      [athleteId],
      (err, event) => {
        if (err) return reject(err);
        resolve({
          isDuplicate: !!event,
          lastCheckin: event
        });
      }
    );
  });
};

const promoteSubstitute = (groupId) => {
  return new Promise((resolve, reject) => {
    checkGroupCapacity(groupId).then(capacity => {
      if (!capacity.valid) {
        return resolve(null);
      }

      db.get(
        'SELECT * FROM substitutes WHERE group_id = ? AND is_promoted = 0 ORDER BY priority, created_at ASC LIMIT 1',
        [groupId],
        (err, substitute) => {
          if (err) return reject(err);
          if (!substitute) return resolve(null);

          db.run(
            'UPDATE substitutes SET is_promoted = 1, promoted_at = CURRENT_TIMESTAMP WHERE id = ?',
            [substitute.id],
            (err) => {
              if (err) return reject(err);

              db.run(
                'UPDATE athletes SET group_id = ? WHERE id = ?',
                [groupId, substitute.athlete_id],
                (err) => {
                  if (err) return reject(err);
                  resolve(substitute.athlete_id);
                }
              );
            }
          );
        }
      );
    }).catch(reject);
  });
};

const recordCheckinEvent = (athleteId, status, rawInput, processingResult, operator, notes = '') => {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO checkin_events (athlete_id, status, raw_input, processing_result, operator, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [athleteId, status, JSON.stringify(rawInput), JSON.stringify(processingResult), operator, notes],
      function(err) {
        if (err) return reject(err);
        resolve(this.lastID);
      }
    );
  });
};

const recordStatusChange = (athleteId, oldStatus, newStatus, changedBy, reason = '') => {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO status_history (athlete_id, old_status, new_status, changed_by, reason) VALUES (?, ?, ?, ?, ?)',
      [athleteId, oldStatus, newStatus, changedBy, reason],
      function(err) {
        if (err) return reject(err);
        resolve(this.lastID);
      }
    );
  });
};

const processCheckin = async (athleteId, operator = '系统') => {
  const athlete = await getAthleteWithDetails(athleteId);
  if (!athlete) {
    throw new Error('选手不存在');
  }

  const rawInput = { athleteId, operator, timestamp: new Date().toISOString() };
  const issues = [];

  const docValidation = validateDocuments(athlete);
  if (!docValidation.valid) {
    issues.push(...docValidation.issues);
  }

  const duplicateCheck = await checkDuplicateCheckin(athleteId);
  if (duplicateCheck.isDuplicate) {
    issues.push('选手已检录，重复提交');
  }

  if (!athlete.group_id && !athlete.substitute) {
    issues.push('选手未分配组别且不在替补名单中');
  }

  if (athlete.substitute && !athlete.substitute.is_promoted) {
    const capacity = await checkGroupCapacity(athlete.substitute.group_id);
    if (capacity.valid) {
      await promoteSubstitute(athlete.substitute.group_id);
      issues.push('替补选手已递补至正式名单');
    } else {
      issues.push('替补选手等待递补中，组别已满');
    }
  }

  const status = issues.length === 0 || (issues.length === 1 && issues[0].includes('递补至正式')) ? '已检录' : '检录异常';
  const processingResult = {
    success: status === '已检录',
    issues,
    documents: docValidation,
    duplicateCheck
  };

  const eventId = await recordCheckinEvent(athleteId, status, rawInput, processingResult, operator);
  await recordStatusChange(athleteId, '待检录', status, operator, issues.join('; '));

  return {
    eventId,
    status,
    athlete: { id: athlete.id, name: athlete.name },
    ...processingResult
  };
};

const manualCorrect = async (athleteId, newStatus, changedBy, reason = '') => {
  const athlete = await getAthleteWithDetails(athleteId);
  if (!athlete) {
    throw new Error('选手不存在');
  }

  const lastEvent = athlete.checkinEvents[0];
  const oldStatus = lastEvent ? lastEvent.status : '待检录';

  const rawInput = { athleteId, newStatus, changedBy, reason, timestamp: new Date().toISOString() };
  const processingResult = { success: true, manual: true, oldStatus, newStatus, reason };

  const eventId = await recordCheckinEvent(athleteId, newStatus, rawInput, processingResult, changedBy, `人工修正: ${reason}`);
  await recordStatusChange(athleteId, oldStatus, newStatus, changedBy, reason);

  return {
    eventId,
    oldStatus,
    newStatus,
    success: true
  };
};

const generateReport = (athleteId, generatedBy = '系统') => {
  return new Promise((resolve, reject) => {
    getAthleteWithDetails(athleteId).then(athlete => {
      if (!athlete) return reject(new Error('选手不存在'));

      const docValidation = validateDocuments(athlete);
      const reportData = {
        athlete: {
          id: athlete.id,
          name: athlete.name,
          idCard: athlete.id_card,
          phone: athlete.phone
        },
        group: athlete.group,
        substitute: athlete.substitute,
        documents: athlete.documents,
        documentValidation: docValidation,
        checkinEvents: athlete.checkinEvents,
        qualification: {
          eligible: docValidation.valid && athlete.checkinEvents.some(e => e.status === '已检录'),
          reasons: docValidation.issues
        }
      };

      db.run(
        'INSERT INTO qualification_reports (athlete_id, report_data, generated_by) VALUES (?, ?, ?)',
        [athleteId, JSON.stringify(reportData), generatedBy],
        function(err) {
          if (err) return reject(err);
          resolve({
            reportId: this.lastID,
            ...reportData
          });
        }
      );
    }).catch(reject);
  });
};

module.exports = {
  getAthleteWithDetails,
  validateDocuments,
  checkGroupCapacity,
  checkDuplicateCheckin,
  promoteSubstitute,
  processCheckin,
  manualCorrect,
  generateReport
};
