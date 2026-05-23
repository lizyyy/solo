const db = require('../database/db');
const crypto = require('crypto');
const moment = require('moment');

class AccessControlService {
  checkBlacklist(idCard, name) {
    const stmt = db.prepare(`
      SELECT * FROM blacklist 
      WHERE status = 'active' 
      AND (id_card = ? OR name = ?)
      AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    `);
    return stmt.get(idCard, name);
  }

  checkTrainingValid(personnelId) {
    const stmt = db.prepare(`
      SELECT * FROM training_status 
      WHERE personnel_id = ? 
      AND status = 'passed'
      AND (expiry_date IS NULL OR expiry_date > CURRENT_TIMESTAMP)
      ORDER BY expiry_date DESC
      LIMIT 1
    `);
    return stmt.get(personnelId);
  }

  checkPersonnelActive(personnelId) {
    const stmt = db.prepare('SELECT * FROM personnel WHERE id = ? AND status = ?');
    return stmt.get(personnelId, 'active');
  }

  checkVisitorValid(visitorApplicationId, eventTime) {
    const stmt = db.prepare(`
      SELECT * FROM visitor_applications 
      WHERE id = ? 
      AND status = 'approved'
      AND scheduled_start <= ?
      AND scheduled_end >= ?
    `);
    return stmt.get(visitorApplicationId, eventTime, eventTime);
  }

  checkDuplicateEvent(idCard, gateNo, direction, eventTime) {
    const timeWindow = moment(eventTime).subtract(5, 'seconds').format('YYYY-MM-DD HH:mm:ss');
    const dedupHash = this.generateDedupHash(idCard, gateNo, direction, eventTime);
    
    const stmt = db.prepare(`
      SELECT * FROM gate_events 
      WHERE dedup_hash = ?
      AND event_time >= ?
      LIMIT 1
    `);
    return stmt.get(dedupHash, timeWindow);
  }

  generateDedupHash(idCard, gateNo, direction, eventTime) {
    const timeBucket = moment(eventTime).format('YYYY-MM-DD HH:mm:00');
    const data = `${idCard}|${gateNo}|${direction}|${timeBucket}`;
    return crypto.createHash('md5').update(data).digest('hex');
  }

  validateAccess(eventData) {
    const result = {
      allowed: false,
      reason: '',
      blacklistHit: null,
      trainingValid: null,
      visitorValid: null,
      personnelValid: null,
      duplicate: null
    };

    const duplicate = this.checkDuplicateEvent(
      eventData.id_card,
      eventData.gate_no,
      eventData.direction,
      eventData.event_time
    );
    if (duplicate) {
      result.duplicate = duplicate;
      result.reason = '重复事件，5秒内已记录';
      return result;
    }

    const blacklistHit = this.checkBlacklist(eventData.id_card, eventData.name);
    if (blacklistHit) {
      result.blacklistHit = blacklistHit;
      result.reason = `黑名单拦截: ${blacklistHit.reason}`;
      return result;
    }

    if (eventData.person_type === 'employee') {
      if (!eventData.personnel_id) {
        result.reason = '未找到人员档案ID';
        return result;
      }

      const personnel = this.checkPersonnelActive(eventData.personnel_id);
      if (!personnel) {
        result.personnelValid = false;
        result.reason = '人员档案不存在或已离职';
        return result;
      }
      result.personnelValid = true;

      const training = this.checkTrainingValid(eventData.personnel_id);
      if (!training) {
        result.trainingValid = false;
        result.reason = '安全培训已过期或未通过';
        return result;
      }
      result.trainingValid = true;

      result.allowed = true;
      result.reason = '通行校验通过';
    } else if (eventData.person_type === 'visitor') {
      if (!eventData.visitor_application_id) {
        result.reason = '未找到访客申请ID';
        return result;
      }

      const visitor = this.checkVisitorValid(
        eventData.visitor_application_id,
        eventData.event_time
      );
      if (!visitor) {
        result.visitorValid = false;
        result.reason = '访客申请未批准或不在预约时段内';
        return result;
      }
      result.visitorValid = true;

      result.allowed = true;
      result.reason = '访客通行校验通过';
    } else {
      result.reason = '未知人员类型';
    }

    return result;
  }
}

module.exports = new AccessControlService();
