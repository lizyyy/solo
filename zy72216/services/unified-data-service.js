const CustodianRecord = require('../models/custodian-record');
const ManualChangeLog = require('../models/manual-change-log');
const StatusTransition = require('../models/status-transition');
const ExRightScreenshot = require('../models/ex-right-screenshot');
const ReconciliationNote = require('../models/reconciliation-note');
const { STATUS_LABEL, CHANGE_TYPE_LABEL, FIELD_LABEL } = require('../utils/constants');

function getFullRecordById(recordId, callback) {
  CustodianRecord.getRecordById(recordId, (err, record) => {
    if (err) return callback(err);
    if (!record) return callback(null, null);

    enrichRecord(record);

    Promise.all([
      new Promise((resolve, reject) => {
        ManualChangeLog.getLogsByRecordId(recordId, (err, logs) => {
          if (err) reject(err);
          else resolve(logs);
        });
      }),
      new Promise((resolve, reject) => {
        StatusTransition.getTransitionsByRecordId(recordId, (err, transitions) => {
          if (err) reject(err);
          else resolve(transitions);
        });
      }),
      new Promise((resolve, reject) => {
        ExRightScreenshot.getScreenshotsByRecordId(recordId, (err, screenshots) => {
          if (err) reject(err);
          else resolve(screenshots);
        });
      }),
      new Promise((resolve, reject) => {
        ReconciliationNote.getNotesByRecordId(recordId, (err, notes) => {
          if (err) reject(err);
          else resolve(notes);
        });
      })
    ]).then(([changeLogs, transitions, screenshots, notes]) => {
      record.change_logs = changeLogs.map(enrichChangeLog);
      record.status_transitions = transitions.map(enrichTransition);
      record.ex_right_screenshots = screenshots;
      record.reconciliation_notes = notes;
      callback(null, record);
    }).catch(callback);
  });
}

function getAllRecordsWithDetails(callback) {
  CustodianRecord.getAllRecords((err, records) => {
    if (err) return callback(err);

    const enriched = records.map(enrichRecord);

    Promise.all(enriched.map(record =>
      new Promise((resolve, reject) => {
        Promise.all([
          new Promise((res, rej) => {
            ManualChangeLog.getLogsByRecordId(record.id, (e, logs) => {
              if (e) rej(e); else res(logs);
            });
          }),
          new Promise((res, rej) => {
            ReconciliationNote.getNotesByRecordId(record.id, (e, notes) => {
              if (e) rej(e); else res(notes);
            });
          })
        ]).then(([logs, notes]) => {
          record.change_logs = logs.map(enrichChangeLog);
          record.reconciliation_notes = notes;
          resolve(record);
        }).catch(reject);
      })
    )).then(recordsWithDetails => {
      callback(null, recordsWithDetails);
    }).catch(callback);
  });
}

function getRecordsByBatchWithDetails(batchId, callback) {
  CustodianRecord.getRecordsByBatch(batchId, (err, records) => {
    if (err) return callback(err);

    const enriched = records.map(enrichRecord);

    Promise.all(enriched.map(record =>
      new Promise((resolve, reject) => {
        Promise.all([
          new Promise((res, rej) => {
            ManualChangeLog.getLogsByRecordId(record.id, (e, logs) => {
              if (e) rej(e); else res(logs);
            });
          }),
          new Promise((res, rej) => {
            ReconciliationNote.getNotesByRecordId(record.id, (e, notes) => {
              if (e) rej(e); else res(notes);
            });
          })
        ]).then(([logs, notes]) => {
          record.change_logs = logs.map(enrichChangeLog);
          record.reconciliation_notes = notes;
          resolve(record);
        }).catch(reject);
      })
    )).then(recordsWithDetails => {
      callback(null, recordsWithDetails);
    }).catch(callback);
  });
}

function getExportData(callback) {
  getAllRecordsWithDetails((err, records) => {
    if (err) return callback(err);

    const exportRows = records.map(record => ({
      '批次号': record.batch_id,
      '原始行号': record.original_line_number,
      '基金代码': record.fund_code,
      '基金名称': record.fund_name,
      '证券代码': record.security_code,
      '证券名称': record.security_name,
      '原始到账日': record.original_settlement_date,
      '当前到账日': record.current_settlement_date,
      '原始数量': record.original_quantity,
      '当前数量': record.current_quantity,
      '原始金额': record.original_amount,
      '当前金额': record.current_amount,
      '处理状态': record.status_label,
      '是否人工改动': record.has_manual_change ? '是' : '否',
      '改动类型': record.change_type_label || '-',
      '导入操作员': record.import_operator,
      '导入时间': record.import_time,
      '人工改动记录': record.change_logs.map(l =>
        `${l.operate_time} ${l.operator} ${l.field_label}: ${l.old_value} → ${l.new_value} (${l.change_reason})`
      ).join('; '),
      '对账说明': record.reconciliation_notes ? record.reconciliation_notes.map(n => n.note_content).join('; ') : ''
    }));

    callback(null, exportRows);
  });
}

function enrichRecord(record) {
  record.status_label = STATUS_LABEL[record.status] || record.status;
  record.change_type_label = record.change_type ? (CHANGE_TYPE_LABEL[record.change_type] || record.change_type) : null;
  record.has_manual_change_bool = !!record.has_manual_change;
  return record;
}

function enrichChangeLog(log) {
  log.field_label = FIELD_LABEL[log.field_name] || log.field_name;
  return log;
}

function enrichTransition(transition) {
  transition.from_status_label = STATUS_LABEL[transition.from_status] || transition.from_status;
  transition.to_status_label = STATUS_LABEL[transition.to_status] || transition.to_status;
  return transition;
}

module.exports = {
  getFullRecordById,
  getAllRecordsWithDetails,
  getRecordsByBatchWithDetails,
  getExportData
};
