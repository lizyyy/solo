export enum AnnouncementStatus {
  DRAFT = '草稿',
  PENDING_CONFIRM = '待确认',
  PUBLISHED = '已发布',
  WITHDRAWN = '已撤回',
  PENDING_MANUAL = '待人工处理'
}

export interface AffectedDashboard {
  id: string;
  name: string;
  url?: string;
}

export interface CalendarChange {
  id: string;
  metricName: string;
  calendarVersion: string;
  oldCalendar?: string;
  newCalendar: string;
  changeReason: string;
  effectiveDate: string;
  affectedDashboards: AffectedDashboard[];
  businessObject: string;
}

export interface Announcement {
  id: string;
  title: string;
  changes: CalendarChange[];
  status: AnnouncementStatus;
  announcer: string;
  announcerId: string;
  responsiblePerson: string;
  responsiblePersonId: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  withdrawnAt?: string;
  conflictNote?: string;
  hasConflict?: boolean;
}

export interface AnnouncementHistory {
  id: string;
  announcementId: string;
  action: string;
  oldStatus?: AnnouncementStatus;
  newStatus?: AnnouncementStatus;
  operator: string;
  operatorId: string;
  operatedAt: string;
  remark?: string;
  changes?: Partial<Announcement>;
}

export interface ImportErrorRecord {
  id: string;
  importBatchId: string;
  rowNumber: number;
  rowData: Record<string, any>;
  errorMessage: string;
  importedAt: string;
  status: 'pending' | 'resolved' | 'ignored';
}

export interface FilterParams {
  startDate?: string;
  endDate?: string;
  status?: AnnouncementStatus;
  responsiblePerson?: string;
  businessObject?: string;
  announcer?: string;
  metricName?: string;
}

export interface ExportFieldMapping {
  key: keyof Announcement | string;
  label: string;
  getValue?: (announcement: Announcement) => string;
}
