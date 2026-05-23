const { v4: uuidv4 } = require('uuid');
const { runAsync, getAsync, allAsync } = require('../config/database');
const processingRecordService = require('./processingRecordService');

class DepositService {
  async createDeposit(data) {
    const id = uuidv4();
    
    try {
      const validTypes = ['deposit', 'refund'];
      if (!validTypes.includes(data.type)) {
        throw new Error('无效的交易类型');
      }

      const schedule = await getAsync('SELECT id FROM trial_schedules WHERE id = ?', [data.trial_schedule_id]);
      if (!schedule) {
        throw new Error('试工安排不存在');
      }

      await runAsync(
        `INSERT INTO deposit_transactions (id, trial_schedule_id, amount, type, status, payment_method, transaction_no, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, data.trial_schedule_id, data.amount, data.type, data.status || 'pending', data.payment_method, data.transaction_no, data.notes]
      );

      await processingRecordService.createRecord(
        'create_deposit',
        id,
        'deposit',
        data,
        { success: true, depositId: id },
        'success',
        null,
        data.operator || 'system'
      );

      return await this.getDeposit(id);
    } catch (error) {
      await processingRecordService.createRecord(
        'create_deposit',
        null,
        'deposit',
        data,
        null,
        'failed',
        error.message,
        data.operator || 'system'
      );
      throw error;
    }
  }

  async getDeposit(id) {
    return await getAsync('SELECT * FROM deposit_transactions WHERE id = ?', [id]);
  }

  async getDepositsBySchedule(trialScheduleId) {
    return await allAsync(
      'SELECT * FROM deposit_transactions WHERE trial_schedule_id = ? ORDER BY created_at DESC',
      [trialScheduleId]
    );
  }

  async updateDepositStatus(id, status, data = {}) {
    try {
      const validStatuses = ['pending', 'confirmed', 'failed', 'refunded'];
      if (!validStatuses.includes(status)) {
        throw new Error('无效的状态值');
      }

      await runAsync(
        'UPDATE deposit_transactions SET status = ? WHERE id = ?',
        [status, id]
      );

      await processingRecordService.createRecord(
        'update_deposit_status',
        id,
        'deposit',
        { status, ...data },
        { success: true, newStatus: status },
        'success',
        null,
        data.operator || 'system'
      );

      return await this.getDeposit(id);
    } catch (error) {
      await processingRecordService.createRecord(
        'update_deposit_status',
        id,
        'deposit',
        { status, ...data },
        null,
        'failed',
        error.message,
        data.operator || 'system'
      );
      throw error;
    }
  }

  async getDepositSummary(trialScheduleId) {
    const deposits = await this.getDepositsBySchedule(trialScheduleId);
    
    const summary = {
      total_deposit: 0,
      total_refund: 0,
      balance: 0,
      transactions: deposits
    };

    deposits.forEach(d => {
      if (d.type === 'deposit' && d.status === 'confirmed') {
        summary.total_deposit += d.amount;
      } else if (d.type === 'refund' && d.status === 'confirmed') {
        summary.total_refund += d.amount;
      }
    });

    summary.balance = summary.total_deposit - summary.total_refund;
    return summary;
  }
}

module.exports = new DepositService();
