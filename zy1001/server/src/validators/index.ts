import { TicketStatus, TicketPriority, CreateTicketRequest, UpdateTicketRequest } from '../types';

export const STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  [TicketStatus.PENDING]: [TicketStatus.IN_PROGRESS],
  [TicketStatus.IN_PROGRESS]: [TicketStatus.PENDING_CONFIRMATION],
  [TicketStatus.PENDING_CONFIRMATION]: [TicketStatus.IN_PROGRESS, TicketStatus.CLOSED],
  [TicketStatus.CLOSED]: [],
};

export const VALID_STATUSES = Object.values(TicketStatus);
export const VALID_PRIORITIES = Object.values(TicketPriority);

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

function isNotEmpty(value: any): boolean {
  return value !== undefined && value !== null && value !== '';
}

export function validateCreateTicket(data: CreateTicketRequest): ValidationResult {
  const errors: string[] = [];

  if (!isNotEmpty(data.title)) {
    errors.push('标题不能为空');
  } else if (typeof data.title !== 'string') {
    errors.push('标题必须是字符串');
  } else if (data.title.length > 200) {
    errors.push('标题不能超过200个字符');
  }

  if (!isNotEmpty(data.customerName)) {
    errors.push('客户名称不能为空');
  } else if (typeof data.customerName !== 'string') {
    errors.push('客户名称必须是字符串');
  } else if (data.customerName.length > 100) {
    errors.push('客户名称不能超过100个字符');
  }

  if (!isNotEmpty(data.customerContact)) {
    errors.push('客户联系方式不能为空');
  } else if (typeof data.customerContact !== 'string') {
    errors.push('客户联系方式必须是字符串');
  } else if (data.customerContact.length > 100) {
    errors.push('客户联系方式不能超过100个字符');
  }

  if (!isNotEmpty(data.description)) {
    errors.push('问题描述不能为空');
  } else if (typeof data.description !== 'string') {
    errors.push('问题描述必须是字符串');
  } else if (data.description.length > 5000) {
    errors.push('问题描述不能超过5000个字符');
  }

  if (data.priority && !VALID_PRIORITIES.includes(data.priority as TicketPriority)) {
    errors.push(`无效的优先级，有效值: ${VALID_PRIORITIES.join(', ')}`);
  }

  if (data.assignee && typeof data.assignee !== 'string') {
    errors.push('负责人必须是字符串');
  } else if (data.assignee && data.assignee.length > 50) {
    errors.push('负责人不能超过50个字符');
  }

  if (data.tags && typeof data.tags !== 'string') {
    errors.push('标签必须是字符串');
  } else if (data.tags && data.tags.length > 200) {
    errors.push('标签不能超过200个字符');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validateUpdateTicket(data: UpdateTicketRequest, currentStatus: TicketStatus): ValidationResult {
  const errors: string[] = [];

  if (currentStatus === TicketStatus.CLOSED) {
    if (data.title !== undefined) {
      errors.push('已关闭的工单不能修改标题');
    }
    if (data.customerName !== undefined) {
      errors.push('已关闭的工单不能修改客户名称');
    }
    if (data.customerContact !== undefined) {
      errors.push('已关闭的工单不能修改客户联系方式');
    }
    if (data.description !== undefined) {
      errors.push('已关闭的工单不能修改问题描述');
    }
  }

  if (data.title !== undefined) {
    if (typeof data.title !== 'string') {
      errors.push('标题必须是字符串');
    } else if (data.title.trim() === '') {
      errors.push('标题不能为空');
    } else if (data.title.length > 200) {
      errors.push('标题不能超过200个字符');
    }
  }

  if (data.customerName !== undefined) {
    if (typeof data.customerName !== 'string') {
      errors.push('客户名称必须是字符串');
    } else if (data.customerName.trim() === '') {
      errors.push('客户名称不能为空');
    } else if (data.customerName.length > 100) {
      errors.push('客户名称不能超过100个字符');
    }
  }

  if (data.customerContact !== undefined) {
    if (typeof data.customerContact !== 'string') {
      errors.push('客户联系方式必须是字符串');
    } else if (data.customerContact.trim() === '') {
      errors.push('客户联系方式不能为空');
    } else if (data.customerContact.length > 100) {
      errors.push('客户联系方式不能超过100个字符');
    }
  }

  if (data.description !== undefined) {
    if (typeof data.description !== 'string') {
      errors.push('问题描述必须是字符串');
    } else if (data.description.trim() === '') {
      errors.push('问题描述不能为空');
    } else if (data.description.length > 5000) {
      errors.push('问题描述不能超过5000个字符');
    }
  }

  if (data.priority !== undefined) {
    if (!VALID_PRIORITIES.includes(data.priority as TicketPriority)) {
      errors.push(`无效的优先级，有效值: ${VALID_PRIORITIES.join(', ')}`);
    }
  }

  if (data.assignee !== undefined) {
    if (typeof data.assignee !== 'string') {
      errors.push('负责人必须是字符串');
    } else if (data.assignee.length > 50) {
      errors.push('负责人不能超过50个字符');
    }
  }

  if (data.tags !== undefined) {
    if (typeof data.tags !== 'string') {
      errors.push('标签必须是字符串');
    } else if (data.tags.length > 200) {
      errors.push('标签不能超过200个字符');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validateStatusTransition(
  currentStatus: TicketStatus,
  newStatus: TicketStatus
): ValidationResult {
  const errors: string[] = [];

  if (!VALID_STATUSES.includes(newStatus)) {
    errors.push(`无效的状态，有效值: ${VALID_STATUSES.join(', ')}`);
    return { isValid: false, errors };
  }

  if (currentStatus === newStatus) {
    return { isValid: true, errors: [] };
  }

  const allowedTransitions = STATUS_TRANSITIONS[currentStatus] || [];

  if (!allowedTransitions.includes(newStatus)) {
    if (currentStatus === TicketStatus.CLOSED) {
      errors.push('已关闭的工单不能再修改状态');
    } else {
      errors.push(
        `状态流转不允许: ${getStatusLabel(currentStatus)} -> ${getStatusLabel(newStatus)}。` +
        `允许的流转: ${currentStatus} -> ${allowedTransitions.map(s => getStatusLabel(s)).join(', ') || '无'}`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validateComment(author: string, content: string): ValidationResult {
  const errors: string[] = [];

  if (!isNotEmpty(author)) {
    errors.push('评论人不能为空');
  } else if (typeof author !== 'string') {
    errors.push('评论人必须是字符串');
  } else if (author.length > 50) {
    errors.push('评论人不能超过50个字符');
  }

  if (!isNotEmpty(content)) {
    errors.push('评论内容不能为空');
  } else if (typeof content !== 'string') {
    errors.push('评论内容必须是字符串');
  } else if (content.length > 2000) {
    errors.push('评论内容不能超过2000个字符');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function getStatusLabel(status: TicketStatus): string {
  const labels: Record<TicketStatus, string> = {
    [TicketStatus.PENDING]: '待处理',
    [TicketStatus.IN_PROGRESS]: '处理中',
    [TicketStatus.PENDING_CONFIRMATION]: '待确认',
    [TicketStatus.CLOSED]: '已关闭',
  };
  return labels[status] || status;
}

export function getPriorityLabel(priority: TicketPriority): string {
  const labels: Record<TicketPriority, string> = {
    [TicketPriority.LOW]: '低',
    [TicketPriority.MEDIUM]: '中',
    [TicketPriority.HIGH]: '高',
    [TicketPriority.URGENT]: '紧急',
  };
  return labels[priority] || priority;
}
