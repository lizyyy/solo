import {
  ComplaintRecord,
  UnifiedQueryParams,
  ExportField,
  ComplaintStatus,
  OperationType,
  StatusChangeLog,
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

const OPERATION_LABELS: Record<OperationType, string> = {
  [OperationType.IMPORT]: '导入采样点',
  [OperationType.LINK_COMPLAINT]: '关联投诉编号',
  [OperationType.UPDATE_HEATMAP]: '更新热力图',
  [OperationType.REVIEW_HEATMAP]: '复核热力图',
  [OperationType.ROLLBACK]: '回滚操作',
  [OperationType.MANUAL_EDIT]: '人工补录/修改',
};

function getLastLog(record: ComplaintRecord): StatusChangeLog | undefined {
  if (!record.statusLogs || record.statusLogs.length === 0) return undefined;
  return record.statusLogs[record.statusLogs.length - 1];
}

function getDataOrigin(record: ComplaintRecord): string {
  const parts: string[] = [];

  parts.push(`夜间采样点主材料（第${record.originalRowNumber}行）`);

  if (record.heatmap?.isMissingSampling) {
    parts.push('夜间缺采样');
  }
  if (record.heatmap?.isLowDueToMissing) {
    parts.push('缺采样致热力图偏低');
  }

  const hasRework = record.statusLogs.some(
    l =>
      l.operationType === OperationType.MANUAL_EDIT ||
      l.operationType === OperationType.ROLLBACK
  );
  if (hasRework) parts.push('补录返工处理');

  return parts.join(' / ');
}

function getProcessingConclusion(record: ComplaintRecord): string {
  const parts: string[] = [];

  if (record.heatmap?.isLowDueToMissing) {
    if (record.currentStatus === ComplaintStatus.HEATMAP_PENDING_REVIEW) {
      parts.push(
        `夜间缺采样致热力值偏低(${record.heatmap.odorLevel})，等待街道规划员复核，暂按低值(1)展示`
      );
    } else if (record.currentStatus === ComplaintStatus.REVIEWED_NORMAL) {
      parts.push(
        `复核通过-正常：采信热力值(${record.heatmap.odorLevel})，${record.heatmap.reviewNote || '无备注'}`
      );
    } else if (record.currentStatus === ComplaintStatus.REVIEWED_ABNORMAL) {
      parts.push(
        `复核通过-异常：标记异常，展示低值(1)，${record.heatmap.reviewNote || '无备注'}`
      );
    } else {
      parts.push(
        `缺采样偏低(${record.heatmap.odorLevel})，当前状态: ${STATUS_LABELS[record.currentStatus]}`
      );
    }
  } else if (record.heatmap) {
    parts.push(
      `热力值 ${record.heatmap.odorLevel}${record.heatmap.isMissingSampling ? '（缺采样但非偏低）' : ''}`
    );
  }

  if (!record.complaint) {
    parts.push('未关联居民投诉编号');
  } else {
    parts.push(`关联投诉: ${record.complaint.complaintId}`);
  }

  return parts.join(' | ');
}

function getLastDiffSummary(record: ComplaintRecord): string {
  const log = getLastLog(record);
  if (!log || !log.fieldsChanged || log.fieldsChanged.length === 0) return '';

  const details = log.fieldsChanged
    .slice(0, 5)
    .map(field => {
      const d = log.diff[field];
      if (!d) return field;
      const b =
        d.before === undefined || d.before === null
          ? '(空)'
          : JSON.stringify(d.before);
      const a =
        d.after === undefined || d.after === null
          ? '(空)'
          : JSON.stringify(d.after);
      return `${field}: ${b}→${a}`;
    })
    .join('; ');

  return details;
}

function getChangeHistorySummary(record: ComplaintRecord): string {
  if (!record.statusLogs) return '';
  return record.statusLogs
    .map((log, i) => {
      const op = OPERATION_LABELS[log.operationType] || log.operationType;
      const fields =
        log.fieldsChanged && log.fieldsChanged.length > 0
          ? `[${log.fieldsChanged.join(',')}]`
          : '';
      return `${i + 1}.${op}${fields}(${log.operator})`;
    })
    .join(' → ');
}

export class UnifiedDataService {
  static query(params: UnifiedQueryParams = {}): ComplaintRecord[] {
    return dataStore.queryRecords(params);
  }

  static getDetail(id: string): ComplaintRecord | undefined {
    return dataStore.getRecord(id);
  }

  static getForHeatmapDisplay(
    params: UnifiedQueryParams = {}
  ): Array<{
    id: string;
    pointId: string;
    name: string;
    lng: number;
    lat: number;
    displayOdorLevel: number;
    status: ComplaintStatus;
    statusLabel: string;
    isLowDueToMissing: boolean;
    dataOrigin: string;
    conclusion: string;
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
      dataOrigin: getDataOrigin(r),
      conclusion: getProcessingConclusion(r),
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
        key: 'dataOrigin',
        label: '数据来源',
        getter: r => getDataOrigin(r),
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
        label: '投诉备注/误差说明',
        getter: r => r.complaint?.remark,
      },
      {
        key: 'odorLevel',
        label: '原始异味等级',
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
        label: '是否夜间缺采样',
        getter: r => (r.heatmap?.isMissingSampling ? '是' : '否'),
      },
      {
        key: 'isLowDueToMissing',
        label: '缺采样致热力图偏低',
        getter: r => (r.heatmap?.isLowDueToMissing ? '是' : '否'),
      },
      {
        key: 'status',
        label: '处理状态',
        getter: r => STATUS_LABELS[r.currentStatus],
      },
      {
        key: 'conclusion',
        label: '处理结论说明',
        getter: r => getProcessingConclusion(r),
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
        key: 'reviewedAt',
        label: '复核时间',
        getter: r => r.heatmap?.reviewedAt,
      },
      {
        key: 'lastOperator',
        label: '最后修改人',
        getter: r => getLastLog(r)?.operator,
      },
      {
        key: 'lastOperation',
        label: '最后修改操作',
        getter: r => {
          const l = getLastLog(r);
          if (!l) return '';
          return (
            (OPERATION_LABELS[l.operationType] || l.operationType) +
            (l.remark ? ` - ${l.remark}` : '')
          );
        },
      },
      {
        key: 'lastOperationTime',
        label: '最后修改时间',
        getter: r => getLastLog(r)?.operationTime,
      },
      {
        key: 'lastChangedFields',
        label: '本次变更字段',
        getter: r => {
          const l = getLastLog(r);
          return l && l.fieldsChanged ? l.fieldsChanged.join('; ') : '';
        },
      },
      {
        key: 'lastDiffSummary',
        label: '本次变更前后值',
        getter: r => getLastDiffSummary(r),
      },
      {
        key: 'changeHistory',
        label: '完整变更历史',
        getter: r => getChangeHistorySummary(r),
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
          const str =
            value !== undefined && value !== null ? String(value) : '';
          return str.includes(',') ||
            str.includes('"') ||
            str.includes('\n')
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        })
        .join(',')
    );

    return [header, ...rows].join('\n');
  }

  static exportChangeLogsCSV(recordId?: string): string {
    const records = recordId
      ? this.query()
          .filter(r => r.id === recordId)
      : this.query();

    const header = [
      '原始行号',
      '采样点编号',
      '采样点名称',
      '操作序号',
      '操作类型',
      '操作人',
      '操作时间',
      '操作前状态',
      '操作后状态',
      '变更字段数',
      '变更字段列表',
      '变更详情(前→后)',
      '操作备注',
    ].join(',');

    const rows: string[] = [];

    records.forEach(record => {
      record.statusLogs.forEach((log, idx) => {
        const fieldList =
          log.fieldsChanged && log.fieldsChanged.length > 0
            ? log.fieldsChanged.join(';')
            : '';
        const diffStr = Object.entries(log.diff)
          .slice(0, 10)
          .map(([k, v]) => {
            const b =
              v.before === undefined || v.before === null
                ? '(空)'
                : JSON.stringify(v.before).replace(/"/g, "'");
            const a =
              v.after === undefined || v.after === null
                ? '(空)'
                : JSON.stringify(v.after).replace(/"/g, "'");
            return `${k}:${b}→${a}`;
          })
          .join(' | ');

        const line = [
          record.originalRowNumber,
          record.samplingPoint.pointId,
          record.samplingPoint.name,
          idx + 1,
          OPERATION_LABELS[log.operationType] || log.operationType,
          log.operator,
          log.operationTime,
          log.fromStatus ? STATUS_LABELS[log.fromStatus] : '(空)',
          STATUS_LABELS[log.toStatus],
          log.fieldsChanged ? log.fieldsChanged.length : 0,
          `"${fieldList}"`,
          `"${diffStr}"`,
          `"${(log.remark || '').replace(/"/g, '""')}"`,
        ].join(',');
        rows.push(line);
      });
    });

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

  static getRecordWithDetail(id: string) {
    const record = this.getDetail(id);
    if (!record) return undefined;

    return {
      ...record,
      statusLabel: STATUS_LABELS[record.currentStatus],
      displayOdorLevel: HeatmapService.getDisplayOdorLevel(record),
      dataOrigin: getDataOrigin(record),
      conclusion: getProcessingConclusion(record),
      lastOperator: getLastLog(record)?.operator,
      lastOperation: getLastLog(record)
        ? `${OPERATION_LABELS[getLastLog(record)!.operationType]} - ${getLastLog(record)!.remark || ''}`
        : '',
      lastDiff: getLastDiffSummary(record),
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

    const hasRework = all.filter(r =>
      r.statusLogs.some(
        l =>
          l.operationType === OperationType.MANUAL_EDIT ||
          l.operationType === OperationType.ROLLBACK
      )
    ).length;

    return {
      total: all.length,
      byStatus: Object.entries(grouped).map(([status, count]) => ({
        status,
        statusLabel: STATUS_LABELS[status as ComplaintStatus],
        count,
      })),
      missingLowCount: missingLow,
      pendingReviewCount:
        grouped[ComplaintStatus.HEATMAP_PENDING_REVIEW] || 0,
      reworkCount: hasRework,
    };
  }
}
