const CustodianRecord = require('../models/custodian-record');
const ManualChangeLog = require('../models/manual-change-log');
const StatusTransition = require('../models/status-transition');
const ExRightScreenshot = require('../models/ex-right-screenshot');
const ReconciliationNote = require('../models/reconciliation-note');
const { STATUS, FIELDS } = require('../utils/constants');
const boundaryRules = require('../utils/boundary-rules');

function generateBatchId() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `BATCH-${dateStr}-${random}`;
}

function formatDateTime(date) {
  return date.toISOString().replace('T', ' ').substring(0, 19);
}

function importCustodianRecords(records, operator, callback) {
  const batchId = generateBatchId();
  const now = formatDateTime(new Date());
  const importTime = now;

  const results = [];
  let currentIndex = 0;

  function importNext() {
    if (currentIndex >= records.length) {
      return callback(null, {
        batch_id: batchId,
        count: records.length,
        records: results
      });
    }

    const record = records[currentIndex];
    const index = currentIndex;
    currentIndex++;

    const newRecord = {
      batch_id: batchId,
      original_line_number: record.original_line_number || (index + 1),
      fund_code: record.fund_code || '',
      fund_name: record.fund_name || '',
      security_code: record.security_code || '',
      security_name: record.security_name || '',
      original_settlement_date: record.settlement_date || '',
      current_settlement_date: record.settlement_date || '',
      original_quantity: record.quantity || 0,
      current_quantity: record.quantity || 0,
      original_amount: record.amount || 0,
      current_amount: record.amount || 0,
      import_operator: operator,
      import_time: importTime
    };

    CustodianRecord.createRecord(newRecord, (err, recordId) => {
      if (err) {
        return callback(err);
      }

      StatusTransition.createTransition({
        record_id: recordId,
        from_status: null,
        to_status: STATUS.IMPORTED,
        transition_reason: '托管确认页导入',
        operator: operator,
        operate_time: importTime
      }, (err) => {
        if (err) {
          return callback(err);
        }

        results.push({ id: recordId, ...newRecord });
        importNext();
      });
    });
  }

  importNext();
}

function recordManualChange(recordId, fieldName, oldValue, newValue, changeReason, operator, evidenceScreenshot, callback) {
  if (!changeReason || !changeReason.trim()) {
    return callback(new Error('改动原因不能为空'));
  }

  const validation = boundaryRules.validateChange(fieldName, oldValue, newValue, operator);
  if (!validation.valid) {
    return callback(new Error(validation.errors.join('; ')));
  }

  CustodianRecord.getRecordById(recordId, (err, record) => {
    if (err) return callback(err);
    if (!record) return callback(new Error('记录不存在'));

    const changeType = boundaryRules.classifyChange(fieldName, oldValue, newValue);
    const now = formatDateTime(new Date());

    const updateField = `current_${fieldName}`;
    const updates = {};
    updates[updateField] = newValue;

    CustodianRecord.updateRecord(recordId, updates, (err) => {
      if (err) return callback(err);

      CustodianRecord.markManualChange(recordId, changeType, (err) => {
        if (err) return callback(err);

        ManualChangeLog.createLog({
          record_id: recordId,
          field_name: fieldName,
          old_value: oldValue,
          new_value: newValue,
          change_reason: changeReason,
          operator: operator,
          operate_time: now,
          evidence_screenshot: evidenceScreenshot
        }, (err, logId) => {
          if (err) return callback(err);

          const nextStatus = boundaryRules.determineNextStatusAfterChange(record.status, changeType);
          if (nextStatus !== record.status) {
            transitionStatus(recordId, record.status, nextStatus,
              boundaryRules.requiresManagerReview(changeType) ? 'T+1→T+2手工改动，待基金经理复核' : '字段值人工调整',
              operator, (err) => {
                if (err) return callback(err);
                callback(null, {
                  log_id: logId,
                  change_type: changeType,
                  new_status: nextStatus,
                  requires_review: boundaryRules.requiresManagerReview(changeType)
                });
              });
          } else {
            callback(null, {
              log_id: logId,
              change_type: changeType,
              new_status: record.status,
              requires_review: boundaryRules.requiresManagerReview(changeType)
            });
          }
        });
      });
    });
  });
}

function uploadExRightScreenshot(recordId, screenshotPath, operator, remark, callback) {
  CustodianRecord.getRecordById(recordId, (err, record) => {
    if (err) return callback(err);
    if (!record) return callback(new Error('记录不存在'));

    const now = formatDateTime(new Date());

    ExRightScreenshot.createScreenshot({
      record_id: recordId,
      screenshot_path: screenshotPath,
      upload_operator: operator,
      upload_time: now,
      remark: remark
    }, (err, screenshotId) => {
      if (err) return callback(err);

      if (record.status === STATUS.IMPORTED) {
        const nextStatus = boundaryRules.determineNextStatusAfterScreenshotReview(record);
        transitionStatus(recordId, STATUS.IMPORTED, nextStatus,
          record.has_manual_change ? '已补看除权日截图，存在T+1→T+2手工改动待复核' : '已补看除权日截图',
          operator, (err) => {
            if (err) return callback(err);
            callback(null, {
              screenshot_id: screenshotId,
              new_status: nextStatus
            });
          });
      } else {
        callback(null, {
          screenshot_id: screenshotId,
          new_status: record.status
        });
      }
    });
  });
}

function updateReconciliationNote(recordId, noteContent, operator, callback) {
  CustodianRecord.getRecordById(recordId, (err, record) => {
    if (err) return callback(err);
    if (!record) return callback(new Error('记录不存在'));

    const now = formatDateTime(new Date());

    ReconciliationNote.createNote({
      record_id: recordId,
      note_content: noteContent,
      operator: operator,
      update_time: now
    }, (err, noteId) => {
      if (err) return callback(err);
      callback(null, { note_id: noteId });
    });
  });
}

function transitionStatus(recordId, fromStatus, toStatus, reason, operator, callback) {
  if (!boundaryRules.validateTransition(fromStatus, toStatus)) {
    return callback(new Error(`不允许的状态流转: ${fromStatus} → ${toStatus}`));
  }

  const now = formatDateTime(new Date());

  CustodianRecord.updateRecordStatus(recordId, toStatus, (err) => {
    if (err) return callback(err);

    StatusTransition.createTransition({
      record_id: recordId,
      from_status: fromStatus,
      to_status: toStatus,
      transition_reason: reason,
      operator: operator,
      operate_time: now
    }, (err, transitionId) => {
      if (err) return callback(err);
      callback(null, { transition_id: transitionId, new_status: toStatus });
    });
  });
}

function managerReview(recordId, approved, reviewComment, operator, callback) {
  CustodianRecord.getRecordById(recordId, (err, record) => {
    if (err) return callback(err);
    if (!record) return callback(new Error('记录不存在'));
    if (record.status !== STATUS.PENDING_MANAGER_REVIEW) {
      return callback(new Error('当前状态不允许基金经理复核'));
    }

    const toStatus = approved ? STATUS.MANAGER_APPROVED : STATUS.MANAGER_REJECTED;
    const reason = approved ?
      `基金经理复核通过: ${reviewComment || '无异议'}` :
      `基金经理复核驳回: ${reviewComment || '需重新核对'}`;

    transitionStatus(recordId, STATUS.PENDING_MANAGER_REVIEW, toStatus, reason, operator, callback);
  });
}

function finalizeRecord(recordId, operator, callback) {
  CustodianRecord.getRecordById(recordId, (err, record) => {
    if (err) return callback(err);
    if (!record) return callback(new Error('记录不存在'));

    if (!boundaryRules.canFinalize(record.status, record)) {
      return callback(new Error('当前状态不允许标记为正常'));
    }

    transitionStatus(recordId, record.status, STATUS.NORMAL,
      '核对完成，标记为正常', operator, callback);
  });
}

function revertRecord(recordId, operator, reason, callback) {
  CustodianRecord.getRecordById(recordId, (err, record) => {
    if (err) return callback(err);
    if (!record) return callback(new Error('记录不存在'));

    if (!boundaryRules.canRevert(record.status)) {
      return callback(new Error('当前状态不允许回滚'));
    }

    const targetStatus = boundaryRules.getRevertTargetStatus(record.status);
    const revertReason = reason || `回滚操作: 从 ${record.status} 回退到 ${targetStatus}`;

    transitionStatus(recordId, record.status, targetStatus, revertReason, operator, (err, result) => {
      if (err) return callback(err);

      CustodianRecord.clearManualChange(recordId, (err) => {
        if (err) return callback(err);

        if (record.original_settlement_date) {
          CustodianRecord.updateRecord(recordId, {
            current_settlement_date: record.original_settlement_date,
            current_quantity: record.original_quantity,
            current_amount: record.original_amount
          }, (err) => {
            if (err) return callback(err);
            callback(null, { ...result, values_reverted: true });
          });
        } else {
          callback(null, { ...result, values_reverted: false });
        }
      });
    });
  });
}

module.exports = {
  generateBatchId,
  importCustodianRecords,
  recordManualChange,
  uploadExRightScreenshot,
  updateReconciliationNote,
  transitionStatus,
  managerReview,
  finalizeRecord,
  revertRecord
};
