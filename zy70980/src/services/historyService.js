const db = require('../database/db');
const { formatDateTime } = require('../utils/generator');

class HistoryService {
  async addHistory(data) {
    const {
      record_id, action_type, action_reason, action_by,
      previous_status, new_status, remark
    } = data;
    
    await db.run(
      `INSERT INTO processing_history 
       (record_id, action_type, action_reason, action_by, action_time, previous_status, new_status, remark)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record_id, action_type, action_reason, action_by, formatDateTime(),
        previous_status, new_status, remark || null
      ]
    );
  }

  async getHistoryByRecordId(record_id) {
    return await db.all(
      `SELECT * FROM processing_history 
       WHERE record_id = ? 
       ORDER BY action_time DESC`,
      [record_id]
    );
  }

  async getRecordTrace(record_id) {
    const record = await db.get('SELECT * FROM records WHERE id = ?', [record_id]);
    if (!record) return null;

    const history = await this.getHistoryByRecordId(record_id);
    
    const relatedRecords = await db.all(
      `SELECT r.*, ml.relation_type 
       FROM multi_light_relations ml
       JOIN records r ON ml.related_record_id = r.id
       WHERE ml.main_record_id = ?`,
      [record_id]
    );

    const falseAlarmFilter = await db.get(
      'SELECT * FROM false_alarm_filters WHERE record_id = ?',
      [record_id]
    );

    return {
      record,
      processing_history: history,
      related_records: relatedRecords,
      false_alarm_filter: falseAlarmFilter
    };
  }
}

module.exports = new HistoryService();
