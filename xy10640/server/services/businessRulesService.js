const { get, run, all } = require('../database/db');
const TimelineService = require('./timelineService');
const IdempotencyService = require('./idempotencyService');

class BusinessRulesService {
  static async validateCheckinChange(checkinId, newData, operator) {
    const checkin = await get(
      'SELECT * FROM trial_checkins WHERE checkin_id = ?',
      [checkinId]
    );

    if (!checkin) {
      return { valid: false, reason: '试工签到记录不存在' };
    }

    if (checkin.status === 'completed') {
      return { valid: false, reason: '已完成的试工签到不允许修改' };
    }

    const changes = [];
    if (newData.scheduled_date && newData.scheduled_date !== checkin.scheduled_date) {
      changes.push(`日期从 ${checkin.scheduled_date} 改为 ${newData.scheduled_date}`);
    }
    if (newData.scheduled_time && newData.scheduled_time !== checkin.scheduled_time) {
      changes.push(`时间从 ${checkin.scheduled_time} 改为 ${newData.scheduled_time}`);
    }

    if (changes.length === 0) {
      return { valid: true, changes: [] };
    }

    return {
      valid: true,
      changes: changes,
      oldData: checkin
    };
  }

  static async detectAbnormalEvaluation(evalId) {
    const evaluation = await get(
      'SELECT * FROM customer_evaluations WHERE eval_id = ?',
      [evalId]
    );

    if (!evaluation) {
      return { isAbnormal: false, reasons: [] };
    }

    const reasons = [];

    if (evaluation.overall_rating === 1) {
      reasons.push('综合评分为1分，需要人工复核');
    }

    if (evaluation.comments && evaluation.comments.length > 200) {
      reasons.push('评价内容过长，可能存在争议');
    }

    const avgRating = (evaluation.attitude_rating + evaluation.skill_rating + evaluation.punctuality_rating) / 3;
    if (Math.abs(evaluation.overall_rating - avgRating) >= 2) {
      reasons.push('综合评分与分项评分差异过大');
    }

    if (reasons.length > 0) {
      await run(
        'UPDATE customer_evaluations SET is_abnormal = 1, abnormal_reason = ?, status = ? WHERE eval_id = ?',
        [reasons.join('; '), 'pending_review', evalId]
      );

      await TimelineService.record(
        'evaluation_abnormal',
        'evaluation',
        evalId,
        'detected',
        'blocked',
        `检测到异常评价: ${reasons.join('; ')}`,
        'system',
        { evaluation, reasons }
      );

      return { isAbnormal: true, reasons };
    }

    return { isAbnormal: false, reasons: [] };
  }

  static async reviewDeposit(depositId, reviewStatus, reviewedBy, comments = '') {
    const deposit = await get(
      'SELECT * FROM deposits WHERE deposit_id = ?',
      [depositId]
    );

    if (!deposit) {
      return { success: false, reason: '保证金记录不存在' };
    }

    if (deposit.review_status !== 'pending') {
      return { success: false, reason: '保证金已完成复核，不允许重复操作' };
    }

    await run(
      `UPDATE deposits 
       SET review_status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, review_comments = ?, status = ?
       WHERE deposit_id = ?`,
      [
        reviewStatus,
        reviewedBy,
        comments,
        reviewStatus === 'approved' ? 'confirmed' : 'rejected',
        depositId
      ]
    );

    const resultType = reviewStatus === 'approved' ? 'success' : 'manual_correction';
    
    await TimelineService.record(
      'deposit_review',
      'deposit',
      depositId,
      reviewStatus,
      resultType,
      `保证金复核${reviewStatus === 'approved' ? '通过' : '拒绝'}: ${comments}`,
      reviewedBy,
      { depositId, reviewStatus, comments }
    );

    return { success: true };
  }

  static async checkDuplicateOperation(idempotencyKey, operationType) {
    return await IdempotencyService.getResult(idempotencyKey);
  }
}

module.exports = BusinessRulesService;