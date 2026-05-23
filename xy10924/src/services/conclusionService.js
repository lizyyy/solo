const { v4: uuidv4 } = require('uuid');
const { runAsync, getAsync, allAsync } = require('../config/database');
const processingRecordService = require('./processingRecordService');

class ConclusionService {
  async createConclusion(data) {
    const id = uuidv4();
    
    try {
      const validResults = ['hire', 'not_hire', 'pending'];
      if (!validResults.includes(data.result)) {
        throw new Error('无效的转正结果');
      }

      const schedule = await getAsync('SELECT id FROM trial_schedules WHERE id = ?', [data.trial_schedule_id]);
      if (!schedule) {
        throw new Error('试工安排不存在');
      }

      await runAsync(
        `INSERT INTO conversion_conclusions (id, trial_schedule_id, evaluation_id, result, salary_proposal, start_date, contract_terms, notes, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          data.trial_schedule_id,
          data.evaluation_id,
          data.result,
          data.salary_proposal,
          data.start_date,
          data.contract_terms,
          data.notes,
          'draft'
        ]
      );

      await processingRecordService.createRecord(
        'create_conclusion',
        id,
        'conclusion',
        data,
        { success: true, conclusionId: id },
        'success',
        null,
        data.operator || 'system'
      );

      return await this.getConclusion(id);
    } catch (error) {
      await processingRecordService.createRecord(
        'create_conclusion',
        null,
        'conclusion',
        data,
        null,
        'failed',
        error.message,
        data.operator || 'system'
      );
      throw error;
    }
  }

  async getConclusion(id) {
    return await getAsync('SELECT * FROM conversion_conclusions WHERE id = ?', [id]);
  }

  async getConclusionsBySchedule(trialScheduleId) {
    return await allAsync(
      'SELECT * FROM conversion_conclusions WHERE trial_schedule_id = ? ORDER BY created_at DESC',
      [trialScheduleId]
    );
  }

  async updateConclusionStatus(id, status, data = {}) {
    try {
      const validStatuses = ['draft', 'reviewing', 'approved', 'rejected', 'completed'];
      if (!validStatuses.includes(status)) {
        throw new Error('无效的状态值');
      }

      await runAsync(
        `UPDATE conversion_conclusions 
         SET status = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [status, id]
      );

      await processingRecordService.createRecord(
        'update_conclusion_status',
        id,
        'conclusion',
        { status, ...data },
        { success: true, newStatus: status },
        'success',
        null,
        data.operator || 'system'
      );

      return await this.getConclusion(id);
    } catch (error) {
      await processingRecordService.createRecord(
        'update_conclusion_status',
        id,
        'conclusion',
        { status, ...data },
        null,
        'failed',
        error.message,
        data.operator || 'system'
      );
      throw error;
    }
  }

  async markAsExported(id, operator = 'system') {
    try {
      await runAsync(
        'UPDATE conversion_conclusions SET exported_at = CURRENT_TIMESTAMP WHERE id = ?',
        [id]
      );

      await processingRecordService.createRecord(
        'export_conclusion',
        id,
        'conclusion',
        {},
        { success: true, exportedAt: new Date().toISOString() },
        'success',
        null,
        operator
      );

      return await this.getConclusion(id);
    } catch (error) {
      await processingRecordService.createRecord(
        'export_conclusion',
        id,
        'conclusion',
        {},
        null,
        'failed',
        error.message,
        operator
      );
      throw error;
    }
  }

  async exportConclusionData(id) {
    const conclusion = await this.getConclusion(id);
    if (!conclusion) return null;

    const schedule = await getAsync(
      'SELECT * FROM trial_schedules WHERE id = ?',
      [conclusion.trial_schedule_id]
    );
    const customer = await getAsync(
      'SELECT name, phone, address FROM customers WHERE id = ?',
      [schedule.customer_id]
    );
    const worker = await getAsync(
      'SELECT name, phone, id_card, age, experience_years FROM workers WHERE id = ?',
      [schedule.worker_id]
    );
    const evaluations = await allAsync(
      'SELECT * FROM evaluations WHERE trial_schedule_id = ? ORDER BY created_at DESC LIMIT 1',
      [conclusion.trial_schedule_id]
    );
    const deposits = await allAsync(
      'SELECT * FROM deposit_transactions WHERE trial_schedule_id = ?',
      [conclusion.trial_schedule_id]
    );

    const totalDeposit = deposits
      .filter(d => d.type === 'deposit' && d.status === 'confirmed')
      .reduce((sum, d) => sum + d.amount, 0);

    const exportData = {
      conclusion: {
        id: conclusion.id,
        result: conclusion.result === 'hire' ? '录用' : conclusion.result === 'not_hire' ? '不录用' : '待决定',
        salary_proposal: conclusion.salary_proposal,
        start_date: conclusion.start_date,
        contract_terms: conclusion.contract_terms,
        notes: conclusion.notes,
        status: conclusion.status,
        created_at: conclusion.created_at
      },
      schedule: {
        scheduled_date: schedule.scheduled_date,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        status: schedule.status
      },
      customer: {
        name: customer.name,
        phone: customer.phone,
        address: customer.address
      },
      worker: {
        name: worker.name,
        phone: worker.phone,
        id_card: worker.id_card,
        age: worker.age,
        experience_years: worker.experience_years
      },
      evaluation: evaluations.length > 0 ? {
        overall_rating: evaluations[0].overall_rating,
        punctuality_rating: evaluations[0].punctuality_rating,
        attitude_rating: evaluations[0].attitude_rating,
        skill_rating: evaluations[0].skill_rating,
        comments: evaluations[0].comments,
        reviewer_name: evaluations[0].reviewer_name
      } : null,
      deposit_summary: {
        total_deposit: totalDeposit,
        transaction_count: deposits.length
      },
      exported_at: new Date().toISOString()
    };

    return exportData;
  }

  async getAllConclusions(filters = {}) {
    let sql = 'SELECT * FROM conversion_conclusions WHERE 1=1';
    const params = [];

    if (filters.result) {
      sql += ' AND result = ?';
      params.push(filters.result);
    }
    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }

    sql += ' ORDER BY created_at DESC';

    return await allAsync(sql, params);
  }

  async manualCorrect(id, data, operator = 'system') {
    try {
      const fields = [];
      const values = [];

      if (data.result !== undefined) { fields.push('result = ?'); values.push(data.result); }
      if (data.salary_proposal !== undefined) { fields.push('salary_proposal = ?'); values.push(data.salary_proposal); }
      if (data.start_date !== undefined) { fields.push('start_date = ?'); values.push(data.start_date); }
      if (data.contract_terms !== undefined) { fields.push('contract_terms = ?'); values.push(data.contract_terms); }
      if (data.notes !== undefined) { fields.push('notes = ?'); values.push(data.notes); }
      if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
      
      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);

      await runAsync(
        `UPDATE conversion_conclusions SET ${fields.join(', ')} WHERE id = ?`,
        values
      );

      await processingRecordService.createRecord(
        'manual_correct_conclusion',
        id,
        'conclusion',
        data,
        { success: true },
        'success',
        null,
        operator
      );

      return await this.getConclusion(id);
    } catch (error) {
      await processingRecordService.createRecord(
        'manual_correct_conclusion',
        id,
        'conclusion',
        data,
        null,
        'failed',
        error.message,
        operator
      );
      throw error;
    }
  }
}

module.exports = new ConclusionService();
