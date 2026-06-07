import {
  ComplaintRecord,
  UnifiedQueryParams,
  ExportField,
  ComplaintStatus,
} from '../types';
import { dataStore } from '../store';
import { HeatmapService } from './heatmap-service';

const STATUS_LABELS: Record<ComplaintStatus, string> = {
  [ComplaintStatus.IMPORTED]: '已导入',
  [ComplaintStatus.COMPLAINT_LINKED]: '已关联投诉',
  [ComplaintStatus.HEATMAP_PENDING_REVIEW]: '待复核',
  [ComplaintStatus.HEATMAP_NORMAL]: '热力图正常',
  [ComplaintStatus.REVIEWED_NORMAL]: '复核通过-正常',
  [ComplaintStatus.REVIEWED_ABNORMAL]: '复核通过-异常',
  [ComplaintStatus.ARCHIVED]: '已归档',
};

export class UnifiedDataService {
  static query(params: UnifiedQueryParams = {}): ComplaintRecord[] {
    return dataStore.queryRecords(params);
  }

  static getDetail(id: string): ComplaintRecord | undefined {
    return dataStore.getRecord(id);
  }

  static getForHeatmapDisplay(params: UnifiedQueryParams = {}): Array<{
    id: string;
    pointId: string;
    name: string;
    lng: number;
    lat: number;
    displayOdorLevel: number;
    status: ComplaintStatus;
    statusLabel: string;
    isLowDueToMissing: boolean;
  }> {
    const records = this.query(params);
    return records.map(r => ({
      id: r.id,
      pointId: r.samplingPoint.pointId,
      name: r.samplingPoint.name,
      lng: r.samplingPoint.lng,
      lat: r.samplingPoint.lat,
      displayOdorLevel: HeatmapService.getDisplayOdorLevel(r),
      status: r.currentStatus,
      statusLabel: STATUS_LABELS[r.currentStatus],
      isLowDueToMissing: r.heatmap?.isLowDueToMissing || false,
    }));
  }

  static getExportFields(): ExportField[] {
    return [
      {
        key: 'originalRowNumber',
        label: '原始行号',
        getter: r => r.originalRowNumber,
      },
      {
        key: 'pointId',
        label: '采样点编号',
        getter: r => r.samplingPoint.pointId,
      },
      {
        key: 'pointName',
        label: '采样点名称',
        getter: r => r.samplingPoint.name,
      },
      {
        key: 'address',
        label: '地址',
        getter: r => r.samplingPoint.address,
      },
      {
        key: 'district',
        label: '区县',
        getter: r => r.samplingPoint.district,
      },
      {
        key: 'street',
        label: '街道',
        getter: r => r.samplingPoint.street,
      },
      {
        key: 'complaintId',
        label: '投诉编号',
        getter: r => r.complaint?.complaintId,
      },
      {
        key: 'complaintTime',
        label: '投诉时间',
        getter: r => r.complaint?.complaintTime,
      },
      {
        key: 'complaintContent',
        label: '投诉内容',
        getter: r => r.complaint?.complaintContent,
      },
      {
        key: 'complaintRemark',
        label: '投诉备注',
        getter: r => r.complaint?.remark,
      },
      {
        key: 'odorLevel',
        label: '异味等级',
        getter: r => r.heatmap?.odorLevel,
      },
      {
        key: 'displayOdorLevel',
        label: '显示热力值',
        getter: r => HeatmapService.getDisplayOdorLevel(r),
      },
      {
        key: 'samplingTime',
        label: '采样时间',
        getter: r => r.heatmap?.samplingTime,
      },
      {
        key: 'isMissingSampling',
        label: '是否缺采样',
        getter: r => (r.heatmap?.isMissingSampling ? '是' : '否'),
      },
      {
        key: 'isLowDueToMissing',
        label: '缺采样致偏低',
        getter: r => (r.heatmap?.isLowDueToMissing ? '是' : '否'),
      },
      {
        key: 'status',
        label: '当前状态',
        getter: r => STATUS_LABELS[r.currentStatus],
      },
      {
        key: 'reviewNote',
        label: '复核备注',
        getter: r => r.heatmap?.reviewNote,
      },
      {
        key: 'reviewedBy',
        label: '复核人',
        getter: r => r.heatmap?.reviewedBy,
      },
      {
        key: 'createdAt',
        label: '创建时间',
        getter: r => r.createdAt,
      },
    ];
  }

  static exportToCSV(params: UnifiedQueryParams = {}): string {
    const records = this.query(params);
    const fields = this.getExportFields();

    const header = fields.map(f => f.label).join(',');
    const rows = records.map(record =>
      fields
        .map(f => {
          const value = f.getter(record);
          const str = value !== undefined && value !== null ? String(value) : '';
          return str.includes(',') || str.includes('"')
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        })
        .join(',')
    );

    return [header, ...rows].join('\n');
  }

  static getPageList(
    page: number = 1,
    pageSize: number = 20,
    params: UnifiedQueryParams = {}
  ): {
    list: ComplaintRecord[];
    total: number;
    page: number;
    pageSize: number;
  } {
    const all = this.query(params);
    const start = (page - 1) * pageSize;
    const list = all.slice(start, start + pageSize);

    return {
      list,
      total: all.length,
      page,
      pageSize,
    };
  }

  static getStatistics() {
    const all = this.query();
    const grouped = all.reduce((acc, r) => {
      acc[r.currentStatus] = (acc[r.currentStatus] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const missingLow = all.filter(
      r => r.heatmap?.isLowDueToMissing
    ).length;

    return {
      total: all.length,
      byStatus: Object.entries(grouped).map(([status, count]) => ({
        status,
        statusLabel: STATUS_LABELS[status as ComplaintStatus],
        count,
      })),
      missingLowCount: missingLow,
      pendingReviewCount: grouped[ComplaintStatus.HEATMAP_PENDING_REVIEW] || 0,
    };
  }
}
