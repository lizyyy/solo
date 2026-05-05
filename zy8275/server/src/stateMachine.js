export const ApplicationStatus = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  ENGINEERING_REVIEW: 'ENGINEERING_REVIEW',
  ENGINEERING_APPROVED: 'ENGINEERING_APPROVED',
  ENGINEERING_REJECTED: 'ENGINEERING_REJECTED',
  SECURITY_REVIEW: 'SECURITY_REVIEW',
  SECURITY_APPROVED: 'SECURITY_APPROVED',
  SECURITY_REJECTED: 'SECURITY_REJECTED',
  READY: 'READY',
  IN_PROGRESS: 'IN_PROGRESS',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
  ARCHIVED: 'ARCHIVED',
  CANCELLED: 'CANCELLED',
};

export const ActionType = {
  SUBMIT: 'SUBMIT',
  ENGINEERING_REVIEW_START: 'ENGINEERING_REVIEW_START',
  ENGINEERING_APPROVE: 'ENGINEERING_APPROVE',
  ENGINEERING_REJECT: 'ENGINEERING_REJECT',
  SECURITY_REVIEW_START: 'SECURITY_REVIEW_START',
  SECURITY_APPROVE: 'SECURITY_APPROVE',
  SECURITY_REJECT: 'SECURITY_REJECT',
  CHECK_IN: 'CHECK_IN',
  PAUSE: 'PAUSE',
  RESUME: 'RESUME',
  COMPLETE: 'COMPLETE',
  ARCHIVE: 'ARCHIVE',
  CANCEL: 'CANCEL',
};

export const Role = {
  SHOP_MANAGER: 'SHOP_MANAGER',
  ENGINEERING_SUPERVISOR: 'ENGINEERING_SUPERVISOR',
  SECURITY: 'SECURITY',
  ADMIN: 'ADMIN',
};

export const stateTransitions = {
  [ApplicationStatus.DRAFT]: {
    allowedActions: [ActionType.SUBMIT],
    allowedRoles: [Role.SHOP_MANAGER, Role.ADMIN],
    nextStates: [ApplicationStatus.SUBMITTED],
  },
  [ApplicationStatus.SUBMITTED]: {
    allowedActions: [ActionType.ENGINEERING_APPROVE, ActionType.ENGINEERING_REJECT, ActionType.CANCEL],
    allowedRoles: [Role.ENGINEERING_SUPERVISOR, Role.ADMIN, Role.SHOP_MANAGER],
    nextStates: [ApplicationStatus.ENGINEERING_APPROVED, ApplicationStatus.ENGINEERING_REJECTED, ApplicationStatus.CANCELLED],
  },
  [ApplicationStatus.ENGINEERING_APPROVED]: {
    allowedActions: [ActionType.SECURITY_APPROVE, ActionType.SECURITY_REJECT],
    allowedRoles: [Role.SECURITY, Role.ADMIN],
    nextStates: [ApplicationStatus.SECURITY_APPROVED, ApplicationStatus.SECURITY_REJECTED],
  },
  [ApplicationStatus.ENGINEERING_REJECTED]: {
    allowedActions: [],
    allowedRoles: [],
    nextStates: [],
    isTerminal: true,
  },
  [ApplicationStatus.SECURITY_APPROVED]: {
    allowedActions: [ActionType.CHECK_IN],
    allowedRoles: [Role.SECURITY, Role.ADMIN],
    nextStates: [ApplicationStatus.IN_PROGRESS],
    requiresTimeCheck: true,
  },
  [ApplicationStatus.SECURITY_REJECTED]: {
    allowedActions: [],
    allowedRoles: [],
    nextStates: [],
    isTerminal: true,
  },
  [ApplicationStatus.IN_PROGRESS]: {
    allowedActions: [ActionType.PAUSE, ActionType.COMPLETE],
    allowedRoles: [Role.SECURITY, Role.ADMIN, Role.ENGINEERING_SUPERVISOR],
    nextStates: [ApplicationStatus.PAUSED, ApplicationStatus.COMPLETED],
  },
  [ApplicationStatus.PAUSED]: {
    allowedActions: [ActionType.RESUME],
    allowedRoles: [Role.ENGINEERING_SUPERVISOR, Role.ADMIN],
    nextStates: [ApplicationStatus.IN_PROGRESS],
    requiresPauseResolution: true,
  },
  [ApplicationStatus.COMPLETED]: {
    allowedActions: [ActionType.ARCHIVE],
    allowedRoles: [Role.ADMIN, Role.ENGINEERING_SUPERVISOR],
    nextStates: [ApplicationStatus.ARCHIVED],
  },
  [ApplicationStatus.ARCHIVED]: {
    allowedActions: [],
    allowedRoles: [],
    nextStates: [],
    isTerminal: true,
  },
  [ApplicationStatus.CANCELLED]: {
    allowedActions: [],
    allowedRoles: [],
    nextStates: [],
    isTerminal: true,
  },
};

export const actionToStateMap = {
  [ActionType.SUBMIT]: ApplicationStatus.SUBMITTED,
  [ActionType.ENGINEERING_REVIEW_START]: ApplicationStatus.ENGINEERING_REVIEW,
  [ActionType.ENGINEERING_APPROVE]: ApplicationStatus.ENGINEERING_APPROVED,
  [ActionType.ENGINEERING_REJECT]: ApplicationStatus.ENGINEERING_REJECTED,
  [ActionType.SECURITY_REVIEW_START]: ApplicationStatus.SECURITY_REVIEW,
  [ActionType.SECURITY_APPROVE]: ApplicationStatus.SECURITY_APPROVED,
  [ActionType.SECURITY_REJECT]: ApplicationStatus.SECURITY_REJECTED,
  [ActionType.CHECK_IN]: ApplicationStatus.IN_PROGRESS,
  [ActionType.PAUSE]: ApplicationStatus.PAUSED,
  [ActionType.RESUME]: ApplicationStatus.IN_PROGRESS,
  [ActionType.COMPLETE]: ApplicationStatus.COMPLETED,
  [ActionType.ARCHIVE]: ApplicationStatus.ARCHIVED,
  [ActionType.CANCEL]: ApplicationStatus.CANCELLED,
};

export const validateTransition = (currentStatus, action, userRole, applicationData = {}) => {
  const stateConfig = stateTransitions[currentStatus];
  
  if (!stateConfig) {
    return { valid: false, reason: `无效的状态: ${currentStatus}` };
  }

  if (stateConfig.isTerminal) {
    return { valid: false, reason: '该申请已处于最终状态，无法继续操作' };
  }

  if (!stateConfig.allowedActions.includes(action)) {
    return { valid: false, reason: `当前状态下不允许执行此操作: ${action}` };
  }

  if (!stateConfig.allowedRoles.includes(userRole) && userRole !== Role.ADMIN) {
    return { valid: false, reason: `您的角色 (${userRole}) 没有权限执行此操作` };
  }

  if (stateConfig.requiresTimeCheck && action === ActionType.CHECK_IN) {
    const now = new Date();
    const startTime = new Date(applicationData.start_time);
    const endTime = new Date(applicationData.end_time);
    
    if (now < startTime) {
      return { valid: false, reason: '施工时间尚未开始，无法进场' };
    }
    if (now > endTime) {
      return { valid: false, reason: '施工时间已过期，通行证已失效' };
    }
  }

  return { valid: true };
};

export const getAvailableActions = (currentStatus, userRole) => {
  const stateConfig = stateTransitions[currentStatus];
  
  if (!stateConfig || stateConfig.isTerminal) {
    return [];
  }

  if (userRole === Role.ADMIN) {
    return stateConfig.allowedActions;
  }

  return stateConfig.allowedActions.filter(action => {
    return stateConfig.allowedRoles.includes(userRole);
  });
};

export const statusDisplayNames = {
  [ApplicationStatus.DRAFT]: '草稿',
  [ApplicationStatus.SUBMITTED]: '已提交',
  [ApplicationStatus.ENGINEERING_REVIEW]: '工程审核中',
  [ApplicationStatus.ENGINEERING_APPROVED]: '工程审核通过',
  [ApplicationStatus.ENGINEERING_REJECTED]: '工程审核拒绝',
  [ApplicationStatus.SECURITY_REVIEW]: '安保审核中',
  [ApplicationStatus.SECURITY_APPROVED]: '安保已放行',
  [ApplicationStatus.SECURITY_REJECTED]: '安保拒绝',
  [ApplicationStatus.READY]: '待进场',
  [ApplicationStatus.IN_PROGRESS]: '施工中',
  [ApplicationStatus.PAUSED]: '暂停整改',
  [ApplicationStatus.COMPLETED]: '已完成',
  [ApplicationStatus.ARCHIVED]: '已归档',
  [ApplicationStatus.CANCELLED]: '已取消',
};

export const actionDisplayNames = {
  [ActionType.SUBMIT]: '提交申请',
  [ActionType.ENGINEERING_APPROVE]: '工程审核通过',
  [ActionType.ENGINEERING_REJECT]: '工程审核拒绝',
  [ActionType.SECURITY_APPROVE]: '安保放行',
  [ActionType.SECURITY_REJECT]: '安保拒绝',
  [ActionType.CHECK_IN]: '登记进场',
  [ActionType.PAUSE]: '暂停整改',
  [ActionType.RESUME]: '复工',
  [ActionType.COMPLETE]: '完成施工',
  [ActionType.ARCHIVE]: '归档',
  [ActionType.CANCEL]: '取消申请',
};

export const roleDisplayNames = {
  [Role.SHOP_MANAGER]: '店长',
  [Role.ENGINEERING_SUPERVISOR]: '工程主管',
  [Role.SECURITY]: '安保',
  [Role.ADMIN]: '管理员',
};
