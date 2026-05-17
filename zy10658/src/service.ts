import {
  Announcement,
  AnnouncementStatus,
  FilterParams,
  ExportFieldMapping
} from './types';
import { store } from './store';

class AnnouncementService {
  filterAnnouncements(params: FilterParams): Announcement[] {
    let announcements = store.getAnnouncements();

    if (params.startDate) {
      const start = new Date(params.startDate);
      announcements = announcements.filter(a => new Date(a.createdAt) >= start);
    }

    if (params.endDate) {
      const end = new Date(params.endDate);
      end.setHours(23, 59, 59, 999);
      announcements = announcements.filter(a => new Date(a.createdAt) <= end);
    }

    if (params.status) {
      announcements = announcements.filter(a => a.status === params.status);
    }

    if (params.responsiblePerson) {
      announcements = announcements.filter(a =>
        a.responsiblePerson.includes(params.responsiblePerson!)
      );
    }

    if (params.businessObject) {
      announcements = announcements.filter(a =>
        a.changes.some(c => c.businessObject.includes(params.businessObject!))
      );
    }

    if (params.announcer) {
      announcements = announcements.filter(a =>
        a.announcer.includes(params.announcer!)
      );
    }

    if (params.metricName) {
      announcements = announcements.filter(a =>
        a.changes.some(c => c.metricName.includes(params.metricName!))
      );
    }

    return announcements.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  getExportFieldMappings(): ExportFieldMapping[] {
    return [
      { key: 'title', label: '公告标题' },
      { key: 'status', label: '状态' },
      { key: 'announcer', label: '公告人' },
      { key: 'responsiblePerson', label: '负责人' },
      {
        key: 'metrics',
        label: '涉及指标',
        getValue: (a) => a.changes.map(c => c.metricName).join('、')
      },
      {
        key: 'calendarVersions',
        label: '口径版本',
        getValue: (a) => a.changes.map(c => c.calendarVersion).join('、')
      },
      {
        key: 'affectedDashboards',
        label: '影响看板',
        getValue: (a) => a.changes.flatMap(c => c.affectedDashboards.map(d => d.name)).join('、')
      },
      {
        key: 'businessObjects',
        label: '业务对象',
        getValue: (a) => [...new Set(a.changes.map(c => c.businessObject))].join('、')
      },
      {
        key: 'effectiveDates',
        label: '生效日期',
        getValue: (a) => [...new Set(a.changes.map(c => c.effectiveDate))].join('、')
      },
      {
        key: 'hasConflict',
        label: '是否有冲突',
        getValue: (a) => a.hasConflict ? '是' : '否'
      },
      {
        key: 'conflictNote',
        label: '冲突说明',
        getValue: (a) => a.conflictNote || ''
      },
      {
        key: 'createdAt',
        label: '创建时间',
        getValue: (a) => this.formatDate(a.createdAt)
      },
      {
        key: 'publishedAt',
        label: '发布时间',
        getValue: (a) => a.publishedAt ? this.formatDate(a.publishedAt) : ''
      }
    ];
  }

  exportToCSV(announcements: Announcement[]): string {
    const mappings = this.getExportFieldMappings();
    const headers = mappings.map(m => m.label).join(',');

    const rows = announcements.map(a =>
      mappings.map(m => {
        const value = m.getValue
          ? m.getValue(a)
          : String(a[m.key as keyof Announcement] || '');
        return `"${value.replace(/"/g, '""')}"`;
      }).join(',')
    );

    return [headers, ...rows].join('\n');
  }

  checkForConflicts(announcement: Announcement): { hasConflict: boolean; note?: string } {
    const now = new Date();

    for (const change of announcement.changes) {
      const effectiveDate = new Date(change.effectiveDate);
      const daysUntilEffective = Math.ceil(
        (effectiveDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysUntilEffective < 7 && announcement.status !== AnnouncementStatus.PUBLISHED) {
        return {
          hasConflict: true,
          note: `检测到指标"${change.metricName}"生效日期(${change.effectiveDate})距离当前不足7天。历史截图可能仍按旧口径"${change.oldCalendar}"展示。原因：生效时间临近，历史数据可能未追溯更新，需人工确认是否需要通知相关看板使用者。`
        };
      }

      if (change.oldCalendar && change.oldCalendar === change.newCalendar) {
        return {
          hasConflict: true,
          note: `指标"${change.metricName}"的新旧口径完全相同，请确认是否为误操作。`
        };
      }
    }

    return { hasConflict: false };
  }

  handleConflictDetection(id: string): Announcement | undefined {
    const announcement = store.getAnnouncementById(id);
    if (!announcement) return undefined;

    const conflictCheck = this.checkForConflicts(announcement);

    if (conflictCheck.hasConflict) {
      return store.updateStatus(
        id,
        AnnouncementStatus.PENDING_MANUAL,
        '系统',
        'system',
        conflictCheck.note
      );
    }

    return announcement;
  }

  private formatDate(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  validateAnnouncementData(data: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.title || data.title.trim() === '') {
      errors.push('公告标题不能为空');
    }

    if (!data.changes || data.changes.length === 0) {
      errors.push('至少需要包含一条口径变更记录');
    } else {
      data.changes.forEach((change: any, index: number) => {
        if (!change.metricName) {
          errors.push(`第${index + 1}条变更：指标名称不能为空`);
        }
        if (!change.calendarVersion) {
          errors.push(`第${index + 1}条变更：口径版本不能为空`);
        }
        if (!change.newCalendar) {
          errors.push(`第${index + 1}条变更：新口径描述不能为空`);
        }
        if (!change.effectiveDate) {
          errors.push(`第${index + 1}条变更：生效日期不能为空`);
        } else if (!/^\d{4}-\d{2}-\d{2}$/.test(change.effectiveDate)) {
          errors.push(`第${index + 1}条变更：生效日期格式错误，请使用YYYY-MM-DD格式`);
        }
        if (!change.affectedDashboards || change.affectedDashboards.length === 0) {
          errors.push(`第${index + 1}条变更：至少需要指定一个影响看板`);
        }
        if (!change.businessObject) {
          errors.push(`第${index + 1}条变更：业务对象不能为空`);
        }
      });
    }

    if (!data.announcer) {
      errors.push('公告人不能为空');
    }

    if (!data.responsiblePerson) {
      errors.push('负责人不能为空');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export const service = new AnnouncementService();
