import { AuditStatus, AuditAction, AuditTransition } from '../types';

export const AUDIT_TRANSITIONS: AuditTransition[] = [
  {
    from: AuditStatus.DRAFT,
    action: AuditAction.SUBMIT,
    to: AuditStatus.PENDING_REVIEW,
    allowedRoles: ['APPLICANT', 'TEAM_LEADER'],
    conditions: ['hasRequiredFields', 'safetyEquipmentsValid']
  },
  {
    from: AuditStatus.PENDING_REVIEW,
    action: AuditAction.REVIEW,
    to: AuditStatus.SAFETY_CHECK,
    allowedRoles: ['REVIEWER', 'SAFETY_OFFICER'],
    conditions: ['basicInfoComplete']
  },
  {
    from: AuditStatus.PENDING_REVIEW,
    action: AuditAction.REJECT,
    to: AuditStatus.REJECTED,
    allowedRoles: ['REVIEWER', 'SAFETY_OFFICER', 'MANAGER']
  },
  {
    from: AuditStatus.SAFETY_CHECK,
    action: AuditAction.SAFETY_VERIFY,
    to: AuditStatus.WIND_WARNING_CHECK,
    allowedRoles: ['SAFETY_OFFICER'],
    conditions: ['teamCertificationValid']
  },
  {
    from: AuditStatus.SAFETY_CHECK,
    action: AuditAction.REJECT,
    to: AuditStatus.REJECTED,
    allowedRoles: ['SAFETY_OFFICER', 'MANAGER']
  },
  {
    from: AuditStatus.WIND_WARNING_CHECK,
    action: AuditAction.WIND_VERIFY,
    to: AuditStatus.APPROVED,
    allowedRoles: ['WEATHER_OFFICER', 'MANAGER'],
    conditions: ['noHighWindWarning']
  },
  {
    from: AuditStatus.WIND_WARNING_CHECK,
    action: AuditAction.REJECT,
    to: AuditStatus.REJECTED,
    allowedRoles: ['WEATHER_OFFICER', 'MANAGER']
  },
  {
    from: AuditStatus.APPROVED,
    action: AuditAction.COMPLETE,
    to: AuditStatus.COMPLETED,
    allowedRoles: ['APPLICANT', 'TEAM_LEADER', 'SAFETY_OFFICER']
  },
  {
    from: AuditStatus.APPROVED,
    action: AuditAction.CANCEL,
    to: AuditStatus.CANCELLED,
    allowedRoles: ['APPLICANT', 'TEAM_LEADER', 'MANAGER']
  },
  {
    from: AuditStatus.REJECTED,
    action: AuditAction.RESUBMIT,
    to: AuditStatus.PENDING_REVIEW,
    allowedRoles: ['APPLICANT', 'TEAM_LEADER'],
    conditions: ['hasRequiredFields', 'hasCorrections']
  },
  {
    from: AuditStatus.CANCELLED,
    action: AuditAction.RESUBMIT,
    to: AuditStatus.PENDING_REVIEW,
    allowedRoles: ['APPLICANT', 'TEAM_LEADER'],
    conditions: ['hasRequiredFields']
  }
];

export const WIND_WARNING_THRESHOLD = {
  [AuditStatus.WIND_WARNING_CHECK]: {
    maxWindSpeed: 17.2,
    forbiddenLevels: ['LEVEL_3', 'LEVEL_4']
  }
};

export const getNextStatus = (currentStatus: AuditStatus, action: AuditAction): AuditStatus | null => {
  const transition = AUDIT_TRANSITIONS.find(
    t => t.from === currentStatus && t.action === action
  );
  return transition ? transition.to : null;
};

export const isValidTransition = (currentStatus: AuditStatus, action: AuditAction): boolean => {
  return AUDIT_TRANSITIONS.some(
    t => t.from === currentStatus && t.action === action
  );
};

export const getAllowedActions = (currentStatus: AuditStatus): AuditAction[] => {
  return AUDIT_TRANSITIONS
    .filter(t => t.from === currentStatus)
    .map(t => t.action);
};

export const getTransitionConditions = (
  currentStatus: AuditStatus,
  action: AuditAction
): string[] => {
  const transition = AUDIT_TRANSITIONS.find(
    t => t.from === currentStatus && t.action === action
  );
  return transition?.conditions || [];
};
