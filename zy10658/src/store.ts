import { v4 as uuidv4 } from 'uuid';
import {
  Announcement,
  AnnouncementStatus,
  AnnouncementHistory,
  ImportErrorRecord,
  CalendarChange
} from './types';

class DataStore {
  private announcements: Map<string, Announcement> = new Map();
  private histories: Map<string, AnnouncementHistory[]> = new Map();
  private importErrors: ImportErrorRecord[] = [];

  constructor() {
    this.initializeTestData();
  }

  private initializeTestData() {
    this.createFullFlowAnnouncement();
    this.createConflictAnnouncement();
    this.createBadImportRecord();
  }

  private createFullFlowAnnouncement() {
    const announcementId = uuidv4();
    const now = new Date().toISOString();

    const changes: CalendarChange[] = [
      {
        id: uuidv4(),
        metricName: '日活跃用户数(DAU)',
        calendarVersion: 'v2.0',
        oldCalendar: '登录用户去重，统计当日00:00-23:59',
        newCalendar: '登录+访问用户去重，统计当日00:00-23:59',
        changeReason: '口径优化，包含访问未登录用户',
        effectiveDate: '2024-01-15',
        affectedDashboards: [
          { id: 'd1', name: '用户运营看板' },
          { id: 'd2', name: '产品核心指标看板' }
        ],
        businessObject: '用户运营'
      }
    ];

    const announcement: Announcement = {
      id: announcementId,
      title: 'DAU口径升级公告-v2.0',
      changes,
      status: AnnouncementStatus.PUBLISHED,
      announcer: '张三',
      announcerId: 'user001',
      responsiblePerson: '李四',
      responsiblePersonId: 'user002',
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      publishedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
    };

    this.announcements.set(announcementId, announcement);

    const historyRecords: AnnouncementHistory[] = [
      {
        id: uuidv4(),
        announcementId,
        action: '创建公告',
        newStatus: AnnouncementStatus.DRAFT,
        operator: '张三',
        operatorId: 'user001',
        operatedAt: announcement.createdAt,
        remark: '初始创建'
      },
      {
        id: uuidv4(),
        announcementId,
        action: '提交确认',
        oldStatus: AnnouncementStatus.DRAFT,
        newStatus: AnnouncementStatus.PENDING_CONFIRM,
        operator: '张三',
        operatorId: 'user001',
        operatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        remark: '提交给李四确认'
      },
      {
        id: uuidv4(),
        announcementId,
        action: '确认发布',
        oldStatus: AnnouncementStatus.PENDING_CONFIRM,
        newStatus: AnnouncementStatus.PUBLISHED,
        operator: '李四',
        operatorId: 'user002',
        operatedAt: announcement.publishedAt!,
        remark: '口径确认无误，同意发布'
      }
    ];

    this.histories.set(announcementId, historyRecords);
  }

  private createConflictAnnouncement() {
    const announcementId = uuidv4();

    const changes: CalendarChange[] = [
      {
        id: uuidv4(),
        metricName: '订单转化率',
        calendarVersion: 'v1.5',
        oldCalendar: '支付订单数 / 下单订单数',
        newCalendar: '支付订单数 / 商品浏览UV',
        changeReason: '业务调整，改为浏览到支付转化',
        effectiveDate: '2024-02-01',
        affectedDashboards: [
          { id: 'd3', name: '电商交易看板' }
        ],
        businessObject: '电商交易'
      }
    ];

    const announcement: Announcement = {
      id: announcementId,
      title: '订单转化率口径调整公告',
      changes,
      status: AnnouncementStatus.PENDING_MANUAL,
      announcer: '王五',
      announcerId: 'user003',
      responsiblePerson: '赵六',
      responsiblePersonId: 'user004',
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      hasConflict: true,
      conflictNote: '检测到历史截图(2024-01-20)仍按旧口径展示：订单转化率=支付订单数/下单订单数。原因：口径于2024-02-01生效，历史截图时间早于生效时间，需人工确认是否追溯调整历史数据。'
    };

    this.announcements.set(announcementId, announcement);

    const historyRecords: AnnouncementHistory[] = [
      {
        id: uuidv4(),
        announcementId,
        action: '创建公告',
        newStatus: AnnouncementStatus.DRAFT,
        operator: '王五',
        operatorId: 'user003',
        operatedAt: announcement.createdAt,
        remark: '初始创建'
      },
      {
        id: uuidv4(),
        announcementId,
        action: '冲突检测',
        oldStatus: AnnouncementStatus.DRAFT,
        newStatus: AnnouncementStatus.PENDING_MANUAL,
        operator: '系统',
        operatorId: 'system',
        operatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        remark: announcement.conflictNote
      }
    ];

    this.histories.set(announcementId, historyRecords);
  }

  private createBadImportRecord() {
    const batchId = uuidv4();

    this.importErrors.push({
      id: uuidv4(),
      importBatchId: batchId,
      rowNumber: 3,
      rowData: {
        标题: '',
        指标名称: 'GMV',
        口径版本: 'v1.0',
        新口径: '成交额',
        生效日期: '无效日期',
        负责人: '不存在的用户'
      },
      errorMessage: '标题不能为空；生效日期格式错误；负责人不存在',
      importedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'pending'
    });
  }

  getAnnouncements(): Announcement[] {
    return Array.from(this.announcements.values());
  }

  getAnnouncementById(id: string): Announcement | undefined {
    return this.announcements.get(id);
  }

  createAnnouncement(data: Omit<Announcement, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Announcement {
    const now = new Date().toISOString();
    const announcement: Announcement = {
      ...data,
      id: uuidv4(),
      status: AnnouncementStatus.DRAFT,
      createdAt: now,
      updatedAt: now
    };
    this.announcements.set(announcement.id, announcement);
    this.addHistory(announcement.id, {
      action: '创建公告',
      newStatus: AnnouncementStatus.DRAFT,
      operator: data.announcer,
      operatorId: data.announcerId,
      operatedAt: now,
      remark: '初始创建'
    });
    return announcement;
  }

  updateAnnouncement(id: string, data: Partial<Announcement>): Announcement | undefined {
    const announcement = this.announcements.get(id);
    if (!announcement) return undefined;

    const updated = {
      ...announcement,
      ...data,
      updatedAt: new Date().toISOString()
    };
    this.announcements.set(id, updated);
    return updated;
  }

  updateStatus(id: string, newStatus: AnnouncementStatus, operator: string, operatorId: string, remark?: string): Announcement | undefined {
    const announcement = this.announcements.get(id);
    if (!announcement) return undefined;

    const oldStatus = announcement.status;
    const now = new Date().toISOString();

    const updated: Announcement = {
      ...announcement,
      status: newStatus,
      updatedAt: now
    };

    if (newStatus === AnnouncementStatus.PUBLISHED) {
      updated.publishedAt = now;
    } else if (newStatus === AnnouncementStatus.WITHDRAWN) {
      updated.withdrawnAt = now;
    }

    this.announcements.set(id, updated);

    this.addHistory(id, {
      action: this.getStatusActionName(oldStatus, newStatus),
      oldStatus,
      newStatus,
      operator,
      operatorId,
      operatedAt: now,
      remark
    });

    return updated;
  }

  private getStatusActionName(oldStatus: AnnouncementStatus, newStatus: AnnouncementStatus): string {
    const transitions: Record<string, string> = {
      [`${AnnouncementStatus.DRAFT}->${AnnouncementStatus.PENDING_CONFIRM}`]: '提交确认',
      [`${AnnouncementStatus.PENDING_CONFIRM}->${AnnouncementStatus.PUBLISHED}`]: '确认发布',
      [`${AnnouncementStatus.PUBLISHED}->${AnnouncementStatus.WITHDRAWN}`]: '撤回公告',
      [`${AnnouncementStatus.DRAFT}->${AnnouncementStatus.PENDING_MANUAL}`]: '冲突检测'
    };
    return transitions[`${oldStatus}->${newStatus}`] || '状态变更';
  }

  private addHistory(announcementId: string, history: Omit<AnnouncementHistory, 'id' | 'announcementId'>) {
    const record: AnnouncementHistory = {
      ...history,
      id: uuidv4(),
      announcementId
    };
    if (!this.histories.has(announcementId)) {
      this.histories.set(announcementId, []);
    }
    this.histories.get(announcementId)!.push(record);
  }

  getHistoryByAnnouncementId(announcementId: string): AnnouncementHistory[] {
    return this.histories.get(announcementId) || [];
  }

  getImportErrors(): ImportErrorRecord[] {
    return this.importErrors;
  }

  addImportError(error: Omit<ImportErrorRecord, 'id' | 'importedAt'>): ImportErrorRecord {
    const record: ImportErrorRecord = {
      ...error,
      id: uuidv4(),
      importedAt: new Date().toISOString()
    };
    this.importErrors.push(record);
    return record;
  }
}

export const store = new DataStore();
