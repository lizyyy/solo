const { Parser } = require('json2csv');
const { get, all } = require('../database');

async function generateBatchReport(batchId) {
  const records = await all(
    `SELECT 
      id,
      batch_id,
      dormitory,
      room_number,
      student_id,
      student_name,
      repair_type,
      repair_date,
      initial_score,
      initial_comment,
      appeal_score,
      appeal_reason,
      review_score,
      review_reason,
      CASE WHEN is_malicious_low_score = 1 THEN '是' ELSE '否' END as is_malicious_low_score,
      malicious_reason,
      final_score,
      created_at
    FROM maintenance_records 
    WHERE batch_id = ?`,
    [batchId]
  );

  const batch = await get('SELECT * FROM batches WHERE id = ?', [batchId]);

  return {
    batchInfo: batch,
    recordCount: records.length,
    records: records
  };
}

async function generateCSVReport(batchId) {
  const data = await generateBatchReport(batchId);
  
  const fields = [
    { label: '记录ID', value: 'id' },
    { label: '宿舍楼', value: 'dormitory' },
    { label: '房间号', value: 'room_number' },
    { label: '学号', value: 'student_id' },
    { label: '学生姓名', value: 'student_name' },
    { label: '维修类型', value: 'repair_type' },
    { label: '维修日期', value: 'repair_date' },
    { label: '首次评分', value: 'initial_score' },
    { label: '首次评价', value: 'initial_comment' },
    { label: '申诉改分', value: 'appeal_score' },
    { label: '申诉原因', value: 'appeal_reason' },
    { label: '复核评分', value: 'review_score' },
    { label: '复核原因', value: 'review_reason' },
    { label: '恶意低分', value: 'is_malicious_low_score' },
    { label: '恶意理由', value: 'malicious_reason' },
    { label: '最终分数', value: 'final_score' },
    { label: '创建时间', value: 'created_at' }
  ];

  const json2csvParser = new Parser({ fields });
  return json2csvParser.parse(data.records);
}

async function generateAuditReport(batchId) {
  const logs = await all(
    `SELECT 
      al.id,
      al.record_id,
      mr.dormitory,
      mr.room_number,
      mr.student_name,
      al.modified_by,
      al.modified_at,
      al.field_name,
      al.old_value,
      al.new_value,
      al.change_reason
    FROM audit_logs al
    JOIN maintenance_records mr ON al.record_id = mr.id
    WHERE al.batch_id = ?
    ORDER BY al.modified_at DESC`,
    [batchId]
  );

  const fieldMapping = {
    'appeal_score': '申诉改分',
    'appeal_reason': '申诉原因',
    'review_score': '复核评分',
    'review_reason': '复核原因',
    'is_malicious_low_score': '恶意低分标记',
    'malicious_reason': '恶意低分理由',
    'final_score': '最终分数'
  };

  return logs.map(log => ({
    ...log,
    field_name: fieldMapping[log.field_name] || log.field_name
  }));
}

module.exports = {
  generateBatchReport,
  generateCSVReport,
  generateAuditReport
};
