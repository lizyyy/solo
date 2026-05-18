const db = require('../database');

class ValidationService {
  static async checkSiblingContactAlert(childId, checkDate) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT DISTINCT
          s.child_id1 as sibling_id,
          c.name as sibling_name,
          c.class_name,
          ch.contact_date,
          ch.is_close_contact
        FROM sibling_relations s
        JOIN children c ON s.child_id1 = c.child_id OR s.child_id2 = c.child_id
        LEFT JOIN contact_history ch ON 
          (ch.child_id = s.child_id1 OR ch.child_id = s.child_id2)
          AND ch.contact_date = ?
        WHERE (s.child_id1 = ? OR s.child_id2 = ?)
          AND c.child_id != ?
          AND s.is_living_together = 1
      `;

      db.all(query, [checkDate, childId, childId, childId], (err, rows) => {
        if (err) reject(err);
        resolve({
          hasAlert: rows.length > 0,
          siblings: rows,
          requiredActions: rows.length > 0 ? [
            '立即排查兄妹当日接触史',
            '补充兄妹晨检记录',
            '评估是否需要同步隔离观察',
            '记录同住接触情况说明'
          ] : []
        });
      });
    });
  }

  static async checkReportConsistency(checkId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          hcr.*,
          c.name as child_name,
          c.class_name,
          ir.isolation_id,
          ir.isolation_reason,
          ir.is_ended
        FROM health_check_records hcr
        JOIN children c ON hcr.child_id = c.child_id
        LEFT JOIN isolation_records ir ON hcr.check_id = ir.check_id
        WHERE hcr.check_id = ?
      `;

      db.get(query, [checkId], (err, record) => {
        if (err) reject(err);
        
        const missingMaterials = [];
        const inconsistencies = [];

        if (!record.checker_name) {
          missingMaterials.push('晨检人员签名');
        }

        if (record.body_temperature === null) {
          missingMaterials.push('体温测量记录');
        }

        if (record.check_result === '隔离' && !record.isolation_id) {
          inconsistencies.push('晨检结果为隔离但未创建隔离记录');
          missingMaterials.push('隔离审批表');
          missingMaterials.push('家长签字确认单');
        }

        if (record.has_fever === 1 && record.body_temperature < 37.3) {
          inconsistencies.push('标记为发热但体温正常');
        }

        if (!record.spirit_status) {
          missingMaterials.push('精神状态评估');
        }

        if (!record.appetite_status) {
          missingMaterials.push('食欲状态评估');
        }

        if (!record.sleep_status) {
          missingMaterials.push('睡眠状态评估');
        }

        if (record.check_result === '送医' && !record.remarks) {
          missingMaterials.push('送医原因说明');
        }

        if (record.guardian_notified === 1 && !record.notification_time) {
          inconsistencies.push('标记为已通知家长但无通知时间');
        }

        resolve({
          isConsistent: inconsistencies.length === 0 && missingMaterials.length === 0,
          inconsistencies,
          missingMaterials,
          nextSteps: [
            ...inconsistencies.map(i => `修正不一致项: ${i}`),
            ...missingMaterials.map(m => `补充材料: ${m}`)
          ]
        });
      });
    });
  }

  static async validateHealthCheckRecord(record) {
    const errors = [];
    const warnings = [];

    if (!record.child_id) errors.push('儿童编号不能为空');
    if (!record.check_date) errors.push('晨检日期不能为空');
    if (!record.check_time) errors.push('晨检时间不能为空');
    if (!record.checker_name) errors.push('晨检人员不能为空');
    if (record.body_temperature === undefined || record.body_temperature === null) {
      errors.push('体温不能为空');
    } else if (record.body_temperature < 35 || record.body_temperature > 42) {
      errors.push('体温值不在合理范围内');
    }
    if (record.is_allowed_entry === undefined) errors.push('是否允许入园不能为空');
    if (!record.check_result) errors.push('晨检结果不能为空');

    if (record.body_temperature >= 37.3 && record.has_fever === 0) {
      warnings.push('体温≥37.3℃但未标记发热');
    }

    if (record.check_result === '隔离' && record.is_allowed_entry === 1) {
      warnings.push('晨检结果为隔离但标记允许入园');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  static async validateIsolationRecord(record) {
    const errors = [];
    const warnings = [];

    if (!record.child_id) errors.push('儿童编号不能为空');
    if (!record.start_date) errors.push('隔离开始日期不能为空');
    if (!record.start_time) errors.push('隔离开始时间不能为空');
    if (!record.isolation_reason) errors.push('隔离原因不能为空');
    if (!record.isolation_type) errors.push('隔离类型不能为空');
    if (!record.checker_name) errors.push('记录人员不能为空');

    return { isValid: errors.length === 0, errors, warnings };
  }
}

module.exports = ValidationService;
