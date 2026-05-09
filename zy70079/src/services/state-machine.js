const { TASK_STATUS, CANDIDATE_STATUS } = require('../config/constants');

const STATE_TRANSITIONS = {
  [TASK_STATUS.DRAFT]: {
    allowedTransitions: [TASK_STATUS.PENDING_MATERIALS, TASK_STATUS.CANCELLED],
    description: '草稿状态，可以提交材料需求或取消',
  },
  [TASK_STATUS.PENDING_MATERIALS]: {
    allowedTransitions: [TASK_STATUS.MATERIALS_SUBMITTED, TASK_STATUS.CANCELLED],
    description: '等待候选人提交材料',
  },
  [TASK_STATUS.MATERIALS_SUBMITTED]: {
    allowedTransitions: [TASK_STATUS.SENT_TO_THIRD_PARTY, TASK_STATUS.CONFLICT, TASK_STATUS.CANCELLED],
    description: '材料已提交，可以发送给第三方或发现冲突',
  },
  [TASK_STATUS.SENT_TO_THIRD_PARTY]: {
    allowedTransitions: [TASK_STATUS.THIRD_PARTY_RECEIVED, TASK_STATUS.TIMEOUT, TASK_STATUS.CANCELLED],
    description: '已发送给第三方背调机构，等待回执',
  },
  [TASK_STATUS.THIRD_PARTY_RECEIVED]: {
    allowedTransitions: [TASK_STATUS.PENDING_REVIEW, TASK_STATUS.CONFLICT, TASK_STATUS.CANCELLED],
    description: '收到第三方回执，进入审核或发现冲突',
  },
  [TASK_STATUS.PENDING_REVIEW]: {
    allowedTransitions: [TASK_STATUS.COMPLETED, TASK_STATUS.CONFLICT, TASK_STATUS.CANCELLED],
    description: '等待最终决策',
  },
  [TASK_STATUS.COMPLETED]: {
    allowedTransitions: [],
    description: '背调完成，已做出决策',
  },
  [TASK_STATUS.CONFLICT]: {
    allowedTransitions: [TASK_STATUS.MATERIALS_SUBMITTED, TASK_STATUS.SENT_TO_THIRD_PARTY, TASK_STATUS.CANCELLED],
    description: '存在冲突，需要重新提交材料或重新发送第三方',
  },
  [TASK_STATUS.CANCELLED]: {
    allowedTransitions: [],
    description: '任务已取消',
  },
  [TASK_STATUS.TIMEOUT]: {
    allowedTransitions: [TASK_STATUS.SENT_TO_THIRD_PARTY, TASK_STATUS.CANCELLED],
    description: '第三方超时，可以重试或取消',
  },
};

class StateMachine {
  static canTransition(fromStatus, toStatus) {
    if (!STATE_TRANSITIONS[fromStatus]) {
      return false;
    }
    return STATE_TRANSITIONS[fromStatus].allowedTransitions.includes(toStatus);
  }

  static getDescription(status) {
    return STATE_TRANSITIONS[status]?.description || '未知状态';
  }

  static getAllStatuses() {
    return Object.keys(STATE_TRANSITIONS);
  }

  static mapTaskStatusToCandidateStatus(taskStatus) {
    const mapping = {
      [TASK_STATUS.DRAFT]: CANDIDATE_STATUS.PENDING,
      [TASK_STATUS.PENDING_MATERIALS]: CANDIDATE_STATUS.IN_PROGRESS,
      [TASK_STATUS.MATERIALS_SUBMITTED]: CANDIDATE_STATUS.IN_PROGRESS,
      [TASK_STATUS.SENT_TO_THIRD_PARTY]: CANDIDATE_STATUS.IN_PROGRESS,
      [TASK_STATUS.THIRD_PARTY_RECEIVED]: CANDIDATE_STATUS.IN_PROGRESS,
      [TASK_STATUS.PENDING_REVIEW]: CANDIDATE_STATUS.IN_PROGRESS,
      [TASK_STATUS.COMPLETED]: null,
      [TASK_STATUS.CONFLICT]: CANDIDATE_STATUS.IN_PROGRESS,
      [TASK_STATUS.CANCELLED]: CANDIDATE_STATUS.CANCELLED,
      [TASK_STATUS.TIMEOUT]: CANDIDATE_STATUS.IN_PROGRESS,
    };
    return mapping[taskStatus];
  }
}

module.exports = StateMachine;
