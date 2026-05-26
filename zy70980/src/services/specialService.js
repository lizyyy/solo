const db = require('../database/db');
const recordService = require('./recordService');
const historyService = require('./historyService');
const { formatDateTime } = require('../utils/generator');

class SpecialService {
  async handleMultiLight(mainRecordId, relatedRecordIds, action_by, reason = '同杆多灯合并处理') {
    const stmt = db.prepare(
      'INSERT INTO multi_light_relations (main_record_id, related_record_id, relation_type) VALUES (?, ?, ?)'
    );
    
    for (const relatedId of relatedRecordIds) {
      stmt.run(mainRecordId, relatedId, 'same_pole');
    }
    stmt.finalize();
    
    await historyService.addHistory({
      record_id: mainRecordId,
      action_type: 'multi_light_merge',
      action_reason: reason,
      action_by,
      previous_status: null,
      new_status: null,
      remark: `关联记录: ${relatedRecordIds.join(', ')}`
    });
    
    return { success: true, merged_count: relatedRecordIds.length };
  }

  async filterFalseAlarm(record_id, filter_reason, filter_by, confidence_score = null) {
    const record = await recordService.getRecordById(record_id);
    if (!record) {
      throw new Error('记录不存在');
    }
    
    await db.run(
      `INSERT INTO false_alarm_filters (record_id, filter_reason, filter_by, filter_time, confidence_score)
       VALUES (?, ?, ?, ?, ?)`,
      [record_id, filter_reason, filter_by, formatDateTime(), confidence_score]
    );
    
    const previousStatus = record.status;
    await recordService.updateRecordStatus(record_id, 'false_alarm');
    
    await historyService.addHistory({
      record_id,
      action_type: 'false_alarm_filter',
      action_reason: filter_reason,
      action_by: filter_by,
      previous_status: previousStatus,
      new_status: 'false_alarm',
      remark: confidence_score ? `置信度: ${confidence_score}` : null
    });
    
    return { success: true };
  }

  async recheckRecord(record_id, recheck_result, recheck_by, recheck_reason) {
    const record = await recordService.getRecordById(record_id);
    if (!record) {
      throw new Error('记录不存在');
    }
    
    const previousStatus = record.status;
    await recordService.updateRecordRecheck(record_id, recheck_result, recheck_by);
    
    await historyService.addHistory({
      record_id,
      action_type: 'recheck',
      action_reason: recheck_reason,
      action_by: recheck_by,
      previous_status: previousStatus,
      new_status: 'rechecked',
      remark: `复测结果: ${recheck_result}`
    });
    
    return { success: true, recheck_result };
  }
}

module.exports = new SpecialService();
