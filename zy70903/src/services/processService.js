const Database = require('../db/database');

class ProcessService {
  static async submitTrialRun(batchId, data) {
    const { runDuration, passengerCount, abnormalConditions, result, operator } = data;

    const batch = await Database.get('SELECT * FROM batches WHERE id = ?', [batchId]);
    if (!batch) {
      throw new Error('批次不存在');
    }

    await Database.run(
      `INSERT INTO trial_run_records (batch_id, run_duration, passenger_count, abnormal_conditions, result, operator)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [batchId, runDuration, passengerCount, abnormalConditions || '', result, operator]
    );

    const newStatus = result === 'pass' ? 'approving' : 'rejected';
    await Database.run(
      'UPDATE batches SET status = ? WHERE id = ?',
      [newStatus, batchId]
    );

    return await Database.get('SELECT * FROM batches WHERE id = ?', [batchId]);
  }

  static async submitApproval(batchId, data) {
    const { stage, approver, approvalResult, comment } = data;

    const batch = await Database.get('SELECT * FROM batches WHERE id = ?', [batchId]);
    if (!batch) {
      throw new Error('批次不存在');
    }

    await Database.run(
      `INSERT INTO approval_records (batch_id, stage, approver, approval_result, comment)
       VALUES (?, ?, ?, ?, ?)`,
      [batchId, stage, approver, approvalResult, comment || '']
    );

    let newStatus = batch.status;
    let finalHandler = null;
    let finalApprovalTime = null;

    if (approvalResult === 'pass') {
      if (stage === 'final') {
        newStatus = 'passed';
        finalHandler = approver;
        finalApprovalTime = new Date().toISOString();
      } else {
        newStatus = 'approving';
      }
    } else {
      newStatus = 'rejected';
      finalHandler = approver;
      finalApprovalTime = new Date().toISOString();
    }

    await Database.run(
      'UPDATE batches SET status = ?, final_handler = ?, final_approval_time = ? WHERE id = ?',
      [newStatus, finalHandler, finalApprovalTime, batchId]
    );

    return await Database.get('SELECT * FROM batches WHERE id = ?', [batchId]);
  }
}

module.exports = ProcessService;
