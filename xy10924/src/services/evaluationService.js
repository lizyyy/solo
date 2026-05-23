const { v4: uuidv4 } = require('uuid');
const { runAsync, getAsync, allAsync } = require('../config/database');
const processingRecordService = require('./processingRecordService');

class EvaluationService {
  async createEvaluation(data) {
    const id = uuidv4();
    
    try {
      if (data.overall_rating < 1 || data.overall_rating > 5) {
        throw new Error('总体评分必须在1-5之间');
      }

      const schedule = await getAsync('SELECT id FROM trial_schedules WHERE id = ?', [data.trial_schedule_id]);
      if (!schedule) {
        throw new Error('试工安排不存在');
      }

      await runAsync(
        `INSERT INTO evaluations (id, trial_schedule_id, overall_rating, punctuality_rating, attitude_rating, skill_rating, comments, reviewer_name, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          data.trial_schedule_id,
          data.overall_rating,
          data.punctuality_rating,
          data.attitude_rating,
          data.skill_rating,
          data.comments,
          data.reviewer_name,
          'pending'
        ]
      );

      await processingRecordService.createRecord(
        'create_evaluation',
        id,
        'evaluation',
        data,
        { success: true, evaluationId: id },
        'success',
        null,
        data.operator || 'system'
      );

      return await this.getEvaluation(id);
    } catch (error) {
      await processingRecordService.createRecord(
        'create_evaluation',
        null,
        'evaluation',
        data,
        null,
        'failed',
        error.message,
        data.operator || 'system'
      );
      throw error;
    }
  }

  async getEvaluation(id) {
    return await getAsync('SELECT * FROM evaluations WHERE id = ?', [id]);
  }

  async getEvaluationsBySchedule(trialScheduleId) {
    return await allAsync(
      'SELECT * FROM evaluations WHERE trial_schedule_id = ? ORDER BY created_at DESC',
      [trialScheduleId]
    );
  }

  async reviewEvaluation(id, status, reviewNotes, reviewer) {
    try {
      const validStatuses = ['pending', 'approved', 'rejected'];
      if (!validStatuses.includes(status)) {
        throw new Error('无效的复核状态');
      }

      await runAsync(
        `UPDATE evaluations 
         SET status = ?, review_notes = ?, reviewed_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [status, reviewNotes, id]
      );

      await processingRecordService.createRecord(
        'review_evaluation',
        id,
        'evaluation',
        { status, reviewNotes },
        { success: true, newStatus: status },
        'success',
        null,
        reviewer || 'system'
      );

      return await this.getEvaluation(id);
    } catch (error) {
      await processingRecordService.createRecord(
        'review_evaluation',
        id,
        'evaluation',
        { status, reviewNotes },
        null,
        'failed',
        error.message,
        reviewer || 'system'
      );
      throw error;
    }
  }

  async manualCorrect(id, data, operator = 'system') {
    try {
      const fields = [];
      const values = [];

      if (data.overall_rating !== undefined) {
        if (data.overall_rating < 1 || data.overall_rating > 5) {
          throw new Error('总体评分必须在1-5之间');
        }
        fields.push('overall_rating = ?');
        values.push(data.overall_rating);
      }
      if (data.punctuality_rating !== undefined) { fields.push('punctuality_rating = ?'); values.push(data.punctuality_rating); }
      if (data.attitude_rating !== undefined) { fields.push('attitude_rating = ?'); values.push(data.attitude_rating); }
      if (data.skill_rating !== undefined) { fields.push('skill_rating = ?'); values.push(data.skill_rating); }
      if (data.comments !== undefined) { fields.push('comments = ?'); values.push(data.comments); }
      if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
      if (data.review_notes !== undefined) { fields.push('review_notes = ?'); values.push(data.review_notes); }

      values.push(id);

      await runAsync(
        `UPDATE evaluations SET ${fields.join(', ')} WHERE id = ?`,
        values
      );

      await processingRecordService.createRecord(
        'manual_correct_evaluation',
        id,
        'evaluation',
        data,
        { success: true },
        'success',
        null,
        operator
      );

      return await this.getEvaluation(id);
    } catch (error) {
      await processingRecordService.createRecord(
        'manual_correct_evaluation',
        id,
        'evaluation',
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

module.exports = new EvaluationService();
