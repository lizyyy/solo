export enum TicketStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  PENDING_CONFIRMATION = 'pending_confirmation',
  CLOSED = 'closed',
}

export enum TicketPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export const STATUS_LABELS: Record<TicketStatus, string> = {
  [TicketStatus.PENDING]: '待处理',
  [TicketStatus.IN_PROGRESS]: '处理中',
  [TicketStatus.PENDING_CONFIRMATION]: '待确认',
  [TicketStatus.CLOSED]: '已关闭',
};

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  [TicketPriority.LOW]: '低',
  [TicketPriority.MEDIUM]: '中',
  [TicketPriority.HIGH]: '高',
  [TicketPriority.URGENT]: '紧急',
};

export interface Ticket {
  id: number;
  title: string;
  customerName: string;
  customerContact: string;
  priority: TicketPriority;
  status: TicketStatus;
  assignee: string;
  tags: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: number;
  ticketId: number;
  author: string;
  content: string;
  createdAt: string;
}

export interface StatusHistory {
  id: number;
  ticketId: number;
  oldStatus: TicketStatus | null;
  newStatus: TicketStatus;
  changedBy: string;
  changedAt: string;
  remark: string;
}

export interface TicketWithDetails extends Ticket {
  comments: Comment[];
  statusHistory: StatusHistory[];
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface CreateTicketRequest {
  title: string;
  customerName: string;
  customerContact: string;
  priority: TicketPriority;
  assignee: string;
  tags: string;
  description: string;
}

export interface UpdateTicketRequest {
  title?: string;
  customerName?: string;
  customerContact?: string;
  priority?: TicketPriority;
  assignee?: string;
  tags?: string;
  description?: string;
}

export interface UpdateStatusRequest {
  newStatus: TicketStatus;
  remark?: string;
  changedBy: string;
}

export interface CreateCommentRequest {
  author: string;
  content: string;
}

export interface ImportResult {
  success: number;
  failed: number;
  errors: { row: number; message: string }[];
  importedIds: number[];
}

export interface FilterParams {
  assignee?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  tags?: string;
  keyword?: string;
}

export interface Metadata {
  assignees: string[];
  tags: string[];
  statuses: { value: TicketStatus; label: string }[];
  priorities: { value: TicketPriority; label: string }[];
}
