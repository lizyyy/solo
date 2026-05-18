export enum VisitorStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  PENDING_REVIEW = 'pending_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  WITHDRAWN = 'withdrawn',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired'
}

export enum AccessType {
  SHARED_WORKSTATION = 'shared_workstation',
  RECEPTION_DESK = 'reception_desk',
  CONFERENCE_ROOM = 'conference_room',
  OFFICE_AREA = 'office_area'
}

export enum ApprovalAction {
  SUBMIT = 'submit',
  APPROVE = 'approve',
  REJECT = 'reject',
  WITHDRAW = 'withdraw',
  RESUBMIT = 'resubmit',
  MODIFY = 'modify',
  ADD_COMMENT = 'add_comment',
  CHANGE_FLOOR = 'change_floor'
}

export interface Visitor {
  id: string;
  visitorName: string;
  visitorPhone: string;
  visitorIdCard: string;
  visitorCompany: string;
  hostName: string;
  hostDepartment: string;
  hostPhone: string;
  visitDate: string;
  startTime: string;
  endTime: string;
  accessType: AccessType;
  workstationId?: string;
  floor: number;
  building: string;
  visitPurpose: string;
  numberOfVisitors: number;
  hasCar: boolean;
  plateNumber?: string;
  status: VisitorStatus;
  idCardPhoto?: string;
  healthCodeStatus?: 'green' | 'yellow' | 'red';
  temperature?: number;
  accessCardNumber?: string;
  accessCardIssuedAt?: string;
  accessCardReturned?: boolean;
  accessCardReturnedAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface HistoryRecord {
  id: string;
  visitorId: string;
  action: ApprovalAction;
  operator: string;
  operatorRole: string;
  comment?: string;
  oldValues: Partial<Visitor>;
  newValues: Partial<Visitor>;
  changedFields: string[];
  createdAt: string;
}

export interface AccessControl {
  id: string;
  visitorId: string;
  floor: number;
  isActive: boolean;
  grantedAt: string;
  revokedAt?: string;
  reason?: string;
}
