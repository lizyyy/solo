const hazardModel = require('../models/hazard');
const { HAZARD_STATUS, HAZARD_STATUS_LABELS } = require('../utils/constants');

const STATE_TRANSITIONS = {
  [HAZARD_STATUS.NEW]: [HAZARD_STATUS.ASSIGNED, HAZARD_STATUS.CLOSED],
  [HAZARD_STATUS.ASSIGNED]: [HAZARD_STATUS.RECTIFYING, HAZARD_STATUS.REJECTED],
  [HAZARD_STATUS.RECTIFYING]: [HAZARD_STATUS.REVIEWING],
  [HAZARD_STATUS.REVIEWING]: [HAZARD_STATUS.CLOSED, HAZARD_STATUS.REJECTED],
  [HAZARD_STATUS.REJECTED]: [HAZARD_STATUS.RECTIFYING, HAZARD_STATUS.CLOSED],
  [HAZARD_STATUS.CLOSED]: [HAZARD_STATUS.REJECTED]
};

class StatusService {
  canTransition(fromStatus, toStatus) {
    const allowed = STATE_TRANSITIONS[fromStatus] || [];
    return allowed.includes(toStatus);
  }

  getAvailableTransitions(currentStatus) {
    return STATE_TRANSITIONS[currentStatus] || [];
  }

  validateTransition(hazardCode, toStatus) {
    const hazard = hazardModel.findByCode(hazardCode);
    if (!hazard) {
      throw new Error(`隐患不存在: ${hazardCode}`);
    }

    if (!this.canTransition(hazard.status, toStatus)) {
      throw new Error(
        `状态变更不允许: ${HAZARD_STATUS_LABELS[hazard.status]} -> ${HAZARD_STATUS_LABELS[toStatus]}`
      );
    }

    return hazard;
  }

  async assign(hazardCode, responsiblePerson, deadline, operator) {
    const hazard = await hazardModel.findByCode(hazardCode);
    if (!hazard) {
      throw new Error(`隐患不存在: ${hazardCode}`);
    }

    if (!this.canTransition(hazard.status, HAZARD_STATUS.ASSIGNED)) {
      throw new Error(
        `当前状态 ${HAZARD_STATUS_LABELS[hazard.status]} 不能分配责任人`
      );
    }

    if (!responsiblePerson) {
      throw new Error('整改责任人不能为空');
    }

    await hazardModel.assignResponsible(hazardCode, responsiblePerson, deadline, operator);
    return { success: true, hazardCode, status: HAZARD_STATUS.ASSIGNED };
  }

  async startRectification(hazardCode, description, operator) {
    const hazard = await hazardModel.findByCode(hazardCode);
    if (!hazard) {
      throw new Error(`隐患不存在: ${hazardCode}`);
    }

    if (!this.canTransition(hazard.status, HAZARD_STATUS.RECTIFYING)) {
      throw new Error(
        `当前状态 ${HAZARD_STATUS_LABELS[hazard.status]} 不能开始整改`
      );
    }

    if (!description) {
      throw new Error('整改描述不能为空');
    }

    await hazardModel.startRectification(hazardCode, description, operator);
    return { success: true, hazardCode, status: HAZARD_STATUS.RECTIFYING };
  }

  async completeRectification(hazardCode, operator) {
    const hazard = await hazardModel.findByCode(hazardCode);
    if (!hazard) {
      throw new Error(`隐患不存在: ${hazardCode}`);
    }

    if (!this.canTransition(hazard.status, HAZARD_STATUS.REVIEWING)) {
      throw new Error(
        `当前状态 ${HAZARD_STATUS_LABELS[hazard.status]} 不能申请复查`
      );
    }

    await hazardModel.completeRectification(hazardCode, operator);
    return { success: true, hazardCode, status: HAZARD_STATUS.REVIEWING };
  }

  async review(hazardCode, result, reviewer, comments = '') {
    const hazard = await hazardModel.findByCode(hazardCode);
    if (!hazard) {
      throw new Error(`隐患不存在: ${hazardCode}`);
    }

    const targetStatus = result === 'pass' ? HAZARD_STATUS.CLOSED : HAZARD_STATUS.REJECTED;
    
    if (!this.canTransition(hazard.status, targetStatus)) {
      throw new Error(
        `当前状态 ${HAZARD_STATUS_LABELS[hazard.status]} 不能进行复查`
      );
    }

    if (!reviewer) {
      throw new Error('复查人不能为空');
    }

    return await hazardModel.review(hazardCode, result, reviewer, comments);
  }

  async batchAssign(hazardCodes, responsiblePerson, deadline, operator) {
    const results = { success: [], failed: [] };

    for (const hazardCode of hazardCodes) {
      try {
        await this.assign(hazardCode, responsiblePerson, deadline, operator);
        results.success.push(hazardCode);
      } catch (err) {
        results.failed.push({ hazardCode, error: err.message });
      }
    }

    return {
      total: hazardCodes.length,
      successCount: results.success.length,
      failedCount: results.failed.length,
      ...results
    };
  }

  async batchReview(hazardCodes, result, reviewer, comments = '') {
    const results = { success: [], failed: [] };

    for (const hazardCode of hazardCodes) {
      try {
        await this.review(hazardCode, result, reviewer, comments);
        results.success.push(hazardCode);
      } catch (err) {
        results.failed.push({ hazardCode, error: err.message });
      }
    }

    return {
      total: hazardCodes.length,
      successCount: results.success.length,
      failedCount: results.failed.length,
      ...results
    };
  }

  getClosureStatus(hazard) {
    const isClosed = hazard.status === HAZARD_STATUS.CLOSED;
    const isOverdue = !isClosed && hazard.deadline && new Date(hazard.deadline) < new Date();
    
    return {
      isClosed,
      isOverdue,
      daysRemaining: this.calculateDaysRemaining(hazard.deadline),
      statusLabel: HAZARD_STATUS_LABELS[hazard.status]
    };
  }

  calculateDaysRemaining(deadline) {
    if (!deadline) return null;
    const deadlineDate = new Date(deadline);
    const today = new Date();
    const diffTime = deadlineDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }
}

module.exports = new StatusService();
