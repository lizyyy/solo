import { Ticket, TicketStatus, User, UserRole } from '../types';
import { updateTicket, getTicketById } from '../storage/ticketRepository';
import { createAuditLog, createVersionRecord } from '../storage/auditRepository';

export interface StateTransition {
  from: TicketStatus[];
  to: TicketStatus;
  allowedRoles: UserRole[];
  description: string;
}

export const stateTransitions: StateTransition[] = [
  {
    from: [TicketStatus.CREATED],
    to: TicketStatus.ASSIGNED,
    allowedRoles: [UserRole.ADMIN, UserRole.SUPERVISOR],
    description: '派发整改工单'
  },
  {
    from: [TicketStatus.ASSIGNED],
    to: TicketStatus.IN_PROGRESS,
    allowedRoles: [UserRole.STORE_STAFF, UserRole.SUPERVISOR, UserRole.ADMIN],
    description: '开始整改'
  },
  {
    from: [TicketStatus.IN_PROGRESS, TicketStatus.RETEST_FAILED],
    to: TicketStatus.RETEST_REQUESTED,
    allowedRoles: [UserRole.STORE_STAFF, UserRole.SUPERVISOR, UserRole.ADMIN],
    description: '申请复测'
  },
  {
    from: [TicketStatus.RETEST_REQUESTED],
    to: TicketStatus.IN_PROGRESS,
    allowedRoles: [UserRole.SUPERVISOR, UserRole.ADMIN],
    description: '复测不通过，需重新整改'
  },
  {
    from: [TicketStatus.RETEST_REQUESTED],
    to: TicketStatus.REOPEN_REQUESTED,
    allowedRoles: [UserRole.SUPERVISOR, UserRole.ADMIN],
    description: '复测通过，申请复开'
  },
  {
    from: [TicketStatus.REOPEN_REQUESTED],
    to: TicketStatus.CLOSED,
    allowedRoles: [UserRole.ADMIN, UserRole.SUPERVISOR],
    description: '批准复开，工单关闭'
  },
  {
    from: [TicketStatus.CLOSED],
    to: TicketStatus.ARCHIVED,
    allowedRoles: [UserRole.ADMIN],
    description: '归档工单'
  },
  {
    from: [
      TicketStatus.CREATED,
      TicketStatus.ASSIGNED,
      TicketStatus.IN_PROGRESS,
      TicketStatus.RETEST_REQUESTED,
      TicketStatus.RETEST_FAILED,
      TicketStatus.REOPEN_REQUESTED
    ],
    to: TicketStatus.CLOSED,
    allowedRoles: [UserRole.ADMIN],
    description: '管理员直接关闭工单'
  }
];

export interface TransitionResult {
  success: boolean;
  ticket?: Ticket;
  error?: string;
}

export function canTransition(
  currentStatus: TicketStatus,
  targetStatus: TicketStatus,
  userRole: UserRole
): { allowed: boolean; reason?: string } {
  const transition = stateTransitions.find(
    t => t.from.includes(currentStatus) && t.to === targetStatus
  );

  if (!transition) {
    return {
      allowed: false,
      reason: `不允许从状态 "${currentStatus}" 转换到 "${targetStatus}"`
    };
  }

  if (!transition.allowedRoles.includes(userRole)) {
    return {
      allowed: false,
      reason: `角色 "${userRole}" 没有权限执行此状态转换`
    };
  }

  return { allowed: true };
}

export function getAvailableTransitions(
  currentStatus: TicketStatus,
  userRole: UserRole
): StateTransition[] {
  return stateTransitions.filter(
    t => t.from.includes(currentStatus) && t.allowedRoles.includes(userRole)
  );
}

export interface AssignTicketParams {
  ticketId: string;
  assignedTo: string;
  user: User;
}

export function assignTicket(params: AssignTicketParams): TransitionResult {
  const { ticketId, assignedTo, user } = params;
  
  const ticket = getTicketById(ticketId);
  if (!ticket) {
    return { success: false, error: '工单不存在' };
  }

  const transitionCheck = canTransition(ticket.status, TicketStatus.ASSIGNED, user.role);
  if (!transitionCheck.allowed) {
    return { success: false, error: transitionCheck.reason };
  }

  const beforeState = { ...ticket };
  
  const updatedTicket = updateTicket(
    ticketId,
    {
      status: TicketStatus.ASSIGNED,
      assignedTo
    },
    user
  );

  if (!updatedTicket) {
    return { success: false, error: '更新工单失败' };
  }

  createAuditLog(
    'ticket',
    ticketId,
    'assign',
    user,
    {
      beforeState,
      afterState: updatedTicket,
      changes: {
        status: { from: ticket.status, to: TicketStatus.ASSIGNED },
        assignedTo: { from: ticket.assignedTo, to: assignedTo }
      }
    }
  );

  createVersionRecord('ticket', ticketId, updatedTicket, user);

  return { success: true, ticket: updatedTicket };
}

export interface StartRectificationParams {
  ticketId: string;
  user: User;
}

export function startRectification(params: StartRectificationParams): TransitionResult {
  const { ticketId, user } = params;
  
  const ticket = getTicketById(ticketId);
  if (!ticket) {
    return { success: false, error: '工单不存在' };
  }

  const transitionCheck = canTransition(ticket.status, TicketStatus.IN_PROGRESS, user.role);
  if (!transitionCheck.allowed) {
    return { success: false, error: transitionCheck.reason };
  }

  const beforeState = { ...ticket };
  
  const updatedTicket = updateTicket(
    ticketId,
    {
      status: TicketStatus.IN_PROGRESS
    },
    user
  );

  if (!updatedTicket) {
    return { success: false, error: '更新工单失败' };
  }

  createAuditLog(
    'ticket',
    ticketId,
    'start_rectification',
    user,
    {
      beforeState,
      afterState: updatedTicket,
      changes: {
        status: { from: ticket.status, to: TicketStatus.IN_PROGRESS }
      }
    }
  );

  createVersionRecord('ticket', ticketId, updatedTicket, user);

  return { success: true, ticket: updatedTicket };
}

export interface SubmitRectificationParams {
  ticketId: string;
  description: string;
  evidenceUrls: string[];
  user: User;
}

export function submitRectification(params: SubmitRectificationParams): TransitionResult {
  const { ticketId, description, evidenceUrls, user } = params;
  
  const ticket = getTicketById(ticketId);
  if (!ticket) {
    return { success: false, error: '工单不存在' };
  }

  const transitionCheck = canTransition(ticket.status, TicketStatus.RETEST_REQUESTED, user.role);
  if (!transitionCheck.allowed) {
    return { success: false, error: transitionCheck.reason };
  }

  const now = new Date().toISOString();
  const beforeState = { ...ticket };
  
  const updatedTicket = updateTicket(
    ticketId,
    {
      status: TicketStatus.RETEST_REQUESTED,
      rectificationDescription: description,
      rectificationEvidenceUrls: evidenceUrls,
      rectificationTime: now
    },
    user
  );

  if (!updatedTicket) {
    return { success: false, error: '更新工单失败' };
  }

  createAuditLog(
    'ticket',
    ticketId,
    'submit_rectification',
    user,
    {
      beforeState,
      afterState: updatedTicket,
      changes: {
        status: { from: ticket.status, to: TicketStatus.RETEST_REQUESTED },
        rectificationDescription: description,
        rectificationEvidenceUrls: evidenceUrls,
        rectificationTime: now
      }
    }
  );

  createVersionRecord('ticket', ticketId, updatedTicket, user);

  return { success: true, ticket: updatedTicket };
}

export interface SubmitRetestParams {
  ticketId: string;
  retestValue: number;
  retestSampleRecordId: string;
  passed: boolean;
  user: User;
}

export function submitRetest(params: SubmitRetestParams): TransitionResult {
  const { ticketId, retestValue, retestSampleRecordId, passed, user } = params;
  
  const ticket = getTicketById(ticketId);
  if (!ticket) {
    return { success: false, error: '工单不存在' };
  }

  const targetStatus = passed ? TicketStatus.REOPEN_REQUESTED : TicketStatus.RETEST_FAILED;
  
  const transitionCheck = canTransition(ticket.status, targetStatus, user.role);
  if (!transitionCheck.allowed) {
    return { success: false, error: transitionCheck.reason };
  }

  const now = new Date().toISOString();
  const beforeState = { ...ticket };
  
  const updatedTicket = updateTicket(
    ticketId,
    {
      status: targetStatus,
      retestValue,
      retestSampleRecordId,
      retestTime: now,
      retestPassed: passed
    },
    user
  );

  if (!updatedTicket) {
    return { success: false, error: '更新工单失败' };
  }

  createAuditLog(
    'ticket',
    ticketId,
    passed ? 'retest_passed' : 'retest_failed',
    user,
    {
      beforeState,
      afterState: updatedTicket,
      changes: {
        status: { from: ticket.status, to: targetStatus },
        retestValue,
        retestSampleRecordId,
        retestTime: now,
        retestPassed: passed
      }
    }
  );

  createVersionRecord('ticket', ticketId, updatedTicket, user);

  return { success: true, ticket: updatedTicket };
}

export interface CloseTicketParams {
  ticketId: string;
  closeReason: string;
  user: User;
}

export function closeTicket(params: CloseTicketParams): TransitionResult {
  const { ticketId, closeReason, user } = params;
  
  const ticket = getTicketById(ticketId);
  if (!ticket) {
    return { success: false, error: '工单不存在' };
  }

  const transitionCheck = canTransition(ticket.status, TicketStatus.CLOSED, user.role);
  if (!transitionCheck.allowed) {
    return { success: false, error: transitionCheck.reason };
  }

  const now = new Date().toISOString();
  const beforeState = { ...ticket };
  
  const updatedTicket = updateTicket(
    ticketId,
    {
      status: TicketStatus.CLOSED,
      closeReason,
      closedTime: now,
      closedBy: user.id
    },
    user
  );

  if (!updatedTicket) {
    return { success: false, error: '更新工单失败' };
  }

  createAuditLog(
    'ticket',
    ticketId,
    'close',
    user,
    {
      beforeState,
      afterState: updatedTicket,
      changes: {
        status: { from: ticket.status, to: TicketStatus.CLOSED },
        closeReason,
        closedTime: now,
        closedBy: user.id
      }
    }
  );

  createVersionRecord('ticket', ticketId, updatedTicket, user);

  return { success: true, ticket: updatedTicket };
}

export interface ArchiveTicketParams {
  ticketId: string;
  user: User;
}

export function archiveTicket(params: ArchiveTicketParams): TransitionResult {
  const { ticketId, user } = params;
  
  const ticket = getTicketById(ticketId);
  if (!ticket) {
    return { success: false, error: '工单不存在' };
  }

  const transitionCheck = canTransition(ticket.status, TicketStatus.ARCHIVED, user.role);
  if (!transitionCheck.allowed) {
    return { success: false, error: transitionCheck.reason };
  }

  const now = new Date().toISOString();
  const beforeState = { ...ticket };
  
  const updatedTicket = updateTicket(
    ticketId,
    {
      status: TicketStatus.ARCHIVED,
      archivedTime: now,
      archivedBy: user.id
    },
    user
  );

  if (!updatedTicket) {
    return { success: false, error: '更新工单失败' };
  }

  createAuditLog(
    'ticket',
    ticketId,
    'archive',
    user,
    {
      beforeState,
      afterState: updatedTicket,
      changes: {
        status: { from: ticket.status, to: TicketStatus.ARCHIVED },
        archivedTime: now,
        archivedBy: user.id
      }
    }
  );

  createVersionRecord('ticket', ticketId, updatedTicket, user);

  return { success: true, ticket: updatedTicket };
}
