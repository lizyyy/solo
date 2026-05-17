import { LeaseStatus } from './types';
import { errors } from './errors';

type Transition = {
  from: LeaseStatus[];
  to: LeaseStatus;
  condition?: (context: any) => boolean;
};

const validStatuses: LeaseStatus[] = ['leasing', 'renewal_pending', 'renewed', 'pending_return'];

const transitions: Transition[] = [
  {
    from: ['leasing'],
    to: 'renewal_pending',
    condition: (ctx) => ctx.autoRenewalEligible || ctx.hasManualRenewal
  },
  {
    from: ['renewal_pending'],
    to: 'renewed',
    condition: (ctx) => ctx.allConflictsResolved && ctx.paymentStatus === 'paid'
  },
  {
    from: ['renewal_pending', 'leasing'],
    to: 'pending_return',
    condition: () => true
  },
  {
    from: ['renewed', 'pending_return'],
    to: 'leasing',
    condition: () => true
  },
  {
    from: ['renewed'],
    to: 'pending_return',
    condition: () => true
  }
];

export function canTransition(
  from: LeaseStatus,
  to: LeaseStatus,
  context: any = {}
): boolean {
  const transition = transitions.find(t => t.from.includes(from) && t.to === to);
  if (!transition) return false;
  if (transition.condition && !transition.condition(context)) return false;
  return true;
}

export function validateTransition(
  from: LeaseStatus,
  to: LeaseStatus,
  context: any = {}
): { valid: boolean; error?: any } {
  if (!validStatuses.includes(to)) {
    return { valid: false, error: errors.invalidStatusTransition(from, to) };
  }
  const transition = transitions.find(t => t.from.includes(from) && t.to === to);
  if (!transition) {
    return { valid: false, error: errors.invalidStatusTransition(from, to) };
  }
  if (transition.condition && !transition.condition(context)) {
    if (context.unresolvedConflicts > 0) {
      return { valid: false, error: errors.conflictNotResolved(context.unresolvedConflicts) };
    }
    if (context.paymentStatus !== 'paid') {
      return { valid: false, error: errors.paymentRequired() };
    }
    return { valid: false, error: errors.invalidStatusTransition(from, to) };
  }
  return { valid: true };
}

export function getNextStates(current: LeaseStatus): LeaseStatus[] {
  return transitions
    .filter(t => t.from.includes(current))
    .map(t => t.to);
}

export function canResolveConflict(context: any): boolean {
  return !!context.hasRemark;
}

export function validateConflictResolution(context: any): { valid: boolean; error?: any } {
  if (!context.hasRemark) {
    return { valid: false, error: errors.remarkRequired() };
  }
  return { valid: true };
}
