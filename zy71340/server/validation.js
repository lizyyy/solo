function validateLog(logData, db) {
  const warnings = [];
  const { patient_id, session_date, emotions, tracks } = logData;

  const scales = db.prepare('SELECT * FROM emotion_scales').all();
  if (scales.length > 0) {
    const filledScaleIds = (emotions || []).filter(e => e.value != null).map(e => e.scale_id);
    const missingScales = scales.filter(s => !filledScaleIds.includes(s.id));
    
    if (missingScales.length > 0) {
      warnings.push({
        type: 'missing_emotion_scale',
        severity: 'error',
        message: `情绪量表漏填: ${missingScales.map(s => s.name).join(', ')}`
      });
    }
  }

  if (!tracks || tracks.length === 0) {
    warnings.push({
      type: 'no_tracks',
      severity: 'warning',
      message: '本次治疗未关联任何曲目'
    });
  } else {
    const trackIds = tracks.map(t => t.track_id);
    const duplicateIds = trackIds.filter((id, idx) => trackIds.indexOf(id) !== idx);
    if (duplicateIds.length > 0) {
      warnings.push({
        type: 'duplicate_tracks',
        severity: 'warning',
        message: `本次治疗中存在重复曲目`
      });
    }
  }

  if (!patient_id) {
    warnings.push({
      type: 'missing_patient',
      severity: 'error',
      message: '未选择患者'
    });
  }

  if (!session_date) {
    warnings.push({
      type: 'missing_date',
      severity: 'error',
      message: '未填写治疗日期'
    });
  }

  return {
    valid: warnings.filter(w => w.severity === 'error').length === 0,
    warnings
  };
}

function maskPrivacy(data) {
  if (!data) return data;
  
  const masked = { ...data };
  
  if (masked.contact_info) {
    const contact = masked.contact_info;
    if (contact.includes('@')) {
      const [name, domain] = contact.split('@');
      masked.contact_info = `${name.charAt(0)}***@${domain}`;
    } else if (/\d{11}/.test(contact)) {
      masked.contact_info = contact.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
    }
  }
  
  if (masked.diagnosis) {
    masked.diagnosis = '***';
  }
  
  return masked;
}

function detectDuplicate(db, tableName, fields) {
  if (tableName === 'tracks' && fields.name) {
    const conditions = ['name = ?'];
    const params = [fields.name];
    
    if (fields.artist) {
      conditions.push('artist = ?');
      params.push(fields.artist);
    }
    
    const sql = `SELECT * FROM ${tableName} WHERE ${conditions.join(' AND ')} AND is_deleted = 0 LIMIT 1`;
    return db.prepare(sql).get(...params);
  }
  
  return null;
}

module.exports = { validateLog, maskPrivacy, detectDuplicate };
