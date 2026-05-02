import {
  BloodBag,
  BloodBagStatus,
  Application,
  ApplicationStatus,
} from '../types';
import {
  updateBloodBagStatus,
  updateApplicationStatus,
  getBloodBagById,
  getApplicationById,
  getBloodBags,
  logBloodBagAction,
  logApplicationAction,
  checkTemperatureAnomaly,
} from '../storage';

type BloodBagTransition = {
  from: BloodBagStatus[];
  to: BloodBagStatus;
  action: string;
  validator?: (bloodBag: BloodBag, context?: Record<string, unknown>) => boolean;
};

type ApplicationTransition = {
  from: ApplicationStatus[];
  to: ApplicationStatus;
  action: string;
  validator?: (
    application: Application,
    context?: Record<string, unknown>
  ) => { valid: boolean; reason?: string };
};

const bloodBagTransitions: Record<string, BloodBagTransition> = {
  RESERVE: {
    from: ['AVAILABLE'],
    to: 'RESERVED',
    action: 'RESERVE',
    validator: (bloodBag, context) => {
      if (checkTemperatureAnomaly(bloodBag)) {
        return false;
      }
      if (context?.applicationId && bloodBag.reservedForApplicationId) {
        return false;
      }
      return true;
    },
  },
  RELEASE: {
    from: ['RESERVED'],
    to: 'AVAILABLE',
    action: 'RELEASE',
  },
  ISSUE: {
    from: ['RESERVED', 'AVAILABLE'],
    to: 'ISSUED',
    action: 'ISSUE',
    validator: (bloodBag) => {
      return !checkTemperatureAnomaly(bloodBag);
    },
  },
  EXPIRE: {
    from: ['AVAILABLE', 'RESERVED', 'QUARANTINE'],
    to: 'EXPIRED',
    action: 'EXPIRE',
  },
  QUARANTINE: {
    from: ['AVAILABLE', 'RESERVED'],
    to: 'QUARANTINE',
    action: 'QUARANTINE',
  },
};

const applicationTransitions: Record<string, ApplicationTransition> = {
  MATCH: {
    from: ['PENDING'],
    to: 'MATCHED',
    action: 'MATCH',
    validator: (application, context) => {
      const matchedBags = context?.matchedBloodBagIds as string[] | undefined;
      if (!matchedBags || matchedBags.length === 0) {
        return { valid: false, reason: '未找到匹配的血袋' };
      }
      if (matchedBags.length < application.quantity) {
        return { valid: true, reason: `库存不足，仅匹配到 ${matchedBags.length} 袋，需要 ${application.quantity} 袋` };
      }
      return { valid: true };
    },
  },
  RESERVE: {
    from: ['PENDING', 'MATCHED'],
    to: 'RESERVED',
    action: 'RESERVE',
    validator: (application, context) => {
      const reservedBags = context?.reservedBloodBagIds as string[] | undefined;
      if (!reservedBags || reservedBags.length === 0) {
        return { valid: false, reason: '没有可预留的血袋' };
      }
      if (reservedBags.length < application.quantity) {
        return { valid: false, reason: `预留血袋数量不足，预留了 ${reservedBags.length} 袋，需要 ${application.quantity} 袋` };
      }
      return { valid: true };
    },
  },
  ISSUE: {
    from: ['RESERVED'],
    to: 'ISSUED',
    action: 'ISSUE',
    validator: (application, context) => {
      const issuedBags = context?.issuedBloodBagIds as string[] | undefined;
      if (!issuedBags || issuedBags.length === 0) {
        return { valid: false, reason: '没有可出库的血袋' };
      }
      return { valid: true };
    },
  },
  CANCEL: {
    from: ['PENDING', 'MATCHED', 'RESERVED'],
    to: 'CANCELLED',
    action: 'CANCEL',
  },
  REJECT: {
    from: ['PENDING', 'MATCHED'],
    to: 'REJECTED',
    action: 'REJECT',
    validator: (_application, context) => {
      const reason = context?.rejectedReason as string | undefined;
      if (!reason || reason.trim().length === 0) {
        return { valid: false, reason: '必须提供拒绝原因' };
      }
      return { valid: true };
    },
  },
};

export function canTransitionBloodBag(
  bloodBag: BloodBag,
  transitionAction: string
): boolean {
  const transition = bloodBagTransitions[transitionAction];
  if (!transition) return false;
  return transition.from.includes(bloodBag.status);
}

export function transitionBloodBag(
  bloodBagId: string,
  transitionAction: string,
  operator: string,
  context?: {
    applicationId?: string;
    wardId?: string;
    notes?: string;
  }
): { success: boolean; bloodBag?: BloodBag; error?: string } {
  const bloodBag = getBloodBagById(bloodBagId);
  if (!bloodBag) {
    return { success: false, error: '血袋不存在' };
  }

  const transition = bloodBagTransitions[transitionAction];
  if (!transition) {
    return { success: false, error: `无效的状态转换操作: ${transitionAction}` };
  }

  if (!transition.from.includes(bloodBag.status)) {
    return {
      success: false,
      error: `无法从状态 ${bloodBag.status} 执行操作 ${transitionAction}`,
    };
  }

  if (transition.validator && !transition.validator(bloodBag, context)) {
    if (transitionAction === 'RESERVE' || transitionAction === 'ISSUE') {
      if (checkTemperatureAnomaly(bloodBag)) {
        return { success: false, error: '血袋存在温控异常，无法预留/出库' };
      }
    }
    return { success: false, error: '状态转换验证失败' };
  }

  const previousState = { ...bloodBag };

  let options: Parameters<typeof updateBloodBagStatus>[2] = {};

  if (transitionAction === 'RESERVE' && context?.applicationId) {
    options = { reservedForApplicationId: context.applicationId };
  } else if (transitionAction === 'RELEASE') {
    options = { reservedForApplicationId: undefined };
  } else if (transitionAction === 'ISSUE' && context?.wardId) {
    options = { issuedToWardId: context.wardId };
  }

  const updatedBag = updateBloodBagStatus(bloodBagId, transition.to, options);

  if (!updatedBag) {
    return { success: false, error: '状态更新失败' };
  }

  logBloodBagAction(bloodBagId, transitionAction, operator, {
    previousState: previousState as unknown as Record<string, unknown>,
    newState: updatedBag as unknown as Record<string, unknown>,
    changes: [`状态: ${previousState.status} -> ${updatedBag.status}`],
    notes: context?.notes,
  });

  return { success: true, bloodBag: updatedBag };
}

export function canTransitionApplication(
  application: Application,
  transitionAction: string
): boolean {
  const transition = applicationTransitions[transitionAction];
  if (!transition) return false;
  return transition.from.includes(application.status);
}

export function transitionApplication(
  applicationId: string,
  transitionAction: string,
  operator: string,
  context?: {
    matchedBloodBagIds?: string[];
    reservedBloodBagIds?: string[];
    issuedBloodBagIds?: string[];
    rejectedReason?: string;
    notes?: string;
  }
): { success: boolean; application?: Application; warning?: string; error?: string } {
  const application = getApplicationById(applicationId);
  if (!application) {
    return { success: false, error: '申请单不存在' };
  }

  const transition = applicationTransitions[transitionAction];
  if (!transition) {
    return { success: false, error: `无效的状态转换操作: ${transitionAction}` };
  }

  if (!transition.from.includes(application.status)) {
    return {
      success: false,
      error: `无法从状态 ${application.status} 执行操作 ${transitionAction}`,
    };
  }

  let validationResult: { valid: boolean; reason?: string } | undefined;
  if (transition.validator) {
    validationResult = transition.validator(application, context);
    if (!validationResult.valid) {
      return { success: false, error: validationResult.reason || '验证失败' };
    }
  }

  const previousState = { ...application };

  let options: Parameters<typeof updateApplicationStatus>[2] = {};

  if (context?.matchedBloodBagIds !== undefined) {
    options.matchedBloodBagIds = context.matchedBloodBagIds;
  }
  if (context?.reservedBloodBagIds !== undefined) {
    options.reservedBloodBagIds = context.reservedBloodBagIds;
  }
  if (context?.issuedBloodBagIds !== undefined) {
    options.issuedBloodBagIds = context.issuedBloodBagIds;
  }
  if (context?.rejectedReason !== undefined) {
    options.rejectedReason = context.rejectedReason;
  }

  const updatedApp = updateApplicationStatus(applicationId, transition.to, options);

  if (!updatedApp) {
    return { success: false, error: '状态更新失败' };
  }

  logApplicationAction(applicationId, transitionAction, operator, {
    previousState: previousState as unknown as Record<string, unknown>,
    newState: updatedApp as unknown as Record<string, unknown>,
    changes: [`状态: ${previousState.status} -> ${updatedApp.status}`],
    notes: context?.notes,
  });

  return {
    success: true,
    application: updatedApp,
    warning: validationResult?.reason,
  };
}

export function checkAndMarkExpiredBags(operator: string): number {
  const now = new Date();
  const allAvailableBags = getBloodBags({ status: 'AVAILABLE' });
  
  let expiredCount = 0;

  for (const bag of allAvailableBags) {
    const expiryDate = new Date(bag.expiryDate);
    if (expiryDate <= now) {
      const result = transitionBloodBag(bag.id, 'EXPIRE', operator, {
        notes: '系统自动检测过期',
      });
      if (result.success) {
        expiredCount++;
      }
    }
  }

  return expiredCount;
}
