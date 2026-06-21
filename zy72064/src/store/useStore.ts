import { create } from 'zustand';
import type {
  SoundFieldPoint,
  AnalysisParams,
  OperationLog,
  AnalysisReport,
  AnomalyType,
  PointStatus,
} from '@/types';
import { mockPoints, defaultParams, mockOperationLogs, INSTRUMENT_GROUPS } from '@/data/mockData';
import { ANOMALY_LABELS } from '@/types';

interface StoreState {
  points: SoundFieldPoint[];
  params: AnalysisParams;
  operationLogs: OperationLog[];
  selectedPointId: string | null;
  filterStatus: PointStatus | 'all';
  filterAnomaly: AnomalyType | 'all';
  currentOperator: string;

  setParams: (params: Partial<AnalysisParams>, reason?: string) => void;
  updatePointStatus: (pointId: string, status: PointStatus, reason?: string) => void;
  updatePointRemark: (pointId: string, remark: string, reason?: string) => void;
  selectPoint: (pointId: string | null) => void;
  setFilterStatus: (status: PointStatus | 'all') => void;
  setFilterAnomaly: (anomaly: AnomalyType | 'all') => void;
  detectAnomalies: () => void;
  generateReport: () => AnalysisReport;
  exportData: (format: 'json' | 'csv') => string;
  getFilteredPoints: () => SoundFieldPoint[];
  getAnomalyStats: () => Record<AnomalyType, number>;
}

export const useStore = create<StoreState>((set, get) => ({
  points: mockPoints,
  params: defaultParams,
  operationLogs: mockOperationLogs,
  selectedPointId: null,
  filterStatus: 'all',
  filterAnomaly: 'all',
  currentOperator: '阿乔',

  setParams: (newParams, reason = '参数调整') => {
    const { params: oldParams, currentOperator, detectAnomalies } = get();
    const updatedParams = { ...oldParams, ...newParams };

    const changedFields: string[] = [];
    (Object.keys(newParams) as Array<keyof AnalysisParams>).forEach((key) => {
      if (oldParams[key] !== newParams[key]) {
        changedFields.push(key);
      }
    });

    if (changedFields.length > 0) {
      const log: OperationLog = {
        id: `log${Date.now()}`,
        operator: currentOperator,
        action: 'param_change',
        before: Object.fromEntries(changedFields.map((f) => [f, oldParams[f as keyof AnalysisParams]])),
        after: Object.fromEntries(changedFields.map((f) => [f, newParams[f as keyof AnalysisParams]])),
        timestamp: new Date().toISOString(),
        reason,
      };

      set((state) => ({
        params: updatedParams,
        operationLogs: [...state.operationLogs, log],
      }));

      if (updatedParams.autoDetect) {
        setTimeout(() => {
          detectAnomalies();
        }, 0);
      }
    }
  },

  updatePointStatus: (pointId, status, reason = '人工确认') => {
    const { currentOperator } = get();

    set((state) => ({
      points: state.points.map((p) =>
        p.id === pointId
          ? {
              ...p,
              status,
              confirmedBy: currentOperator,
              confirmedAt: new Date().toISOString(),
              anomalies: status === 'normal' ? [] : p.anomalies,
              diffHistory: [
                ...p.diffHistory,
                {
                  timestamp: new Date().toISOString(),
                  operator: currentOperator,
                  field: 'status',
                  oldValue: p.status,
                  newValue: status,
                  reason,
                },
              ],
            }
          : p
      ),
      operationLogs: [
        ...state.operationLogs,
        {
          id: `log${Date.now()}`,
          operator: currentOperator,
          action: 'confirm',
          targetId: pointId,
          before: { status: get().points.find((p) => p.id === pointId)?.status },
          after: { status },
          timestamp: new Date().toISOString(),
          reason,
        },
      ],
    }));
  },

  updatePointRemark: (pointId, remark, reason = '补录备注') => {
    const { currentOperator, points } = get();
    const oldRemark = points.find((p) => p.id === pointId)?.remark || '';

    set((state) => ({
      points: state.points.map((p) =>
        p.id === pointId
          ? {
              ...p,
              remark,
              diffHistory: [
                ...p.diffHistory,
                {
                  timestamp: new Date().toISOString(),
                  operator: currentOperator,
                  field: 'remark',
                  oldValue: oldRemark,
                  newValue: remark,
                  reason,
                },
              ],
            }
          : p
      ),
      operationLogs: [
        ...state.operationLogs,
        {
          id: `log${Date.now()}`,
          operator: currentOperator,
          action: 'remark',
          targetId: pointId,
          before: { remark: oldRemark },
          after: { remark },
          timestamp: new Date().toISOString(),
          reason,
        },
      ],
    }));
  },

  selectPoint: (pointId) => {
    set({ selectedPointId: pointId });
  },

  setFilterStatus: (status) => {
    set({ filterStatus: status });
  },

  setFilterAnomaly: (anomaly) => {
    set({ filterAnomaly: anomaly });
  },

  detectAnomalies: () => {
    const { params } = get();

    set((state) => {
      const nameCounts: Record<string, string[]> = {};
      state.points.forEach((p) => {
        if (!nameCounts[p.name]) nameCounts[p.name] = [];
        nameCounts[p.name].push(p.id);
      });

      const instrumentToGroup: Record<string, string> = {};
      Object.entries(INSTRUMENT_GROUPS).forEach(([groupName, instruments]) => {
        instruments.forEach((inst) => {
          instrumentToGroup[inst] = groupName;
        });
      });

      const groupFloors: Record<string, Set<number>> = {};
      state.points.forEach((p) => {
        const groupName = instrumentToGroup[p.instrument];
        if (groupName) {
          if (!groupFloors[groupName]) groupFloors[groupName] = new Set();
          groupFloors[groupName].add(p.floor);
        }
      });

      const updatedPoints = state.points.map((p) => {
        const anomalies: AnomalyType[] = [];
        const judgmentParts: string[] = [];

        if (p.x < 50 || p.x > 500 || p.y < 50 || p.y > 600) {
          anomalies.push('coordinate_offset');
          judgmentParts.push(`坐标(${p.x}, ${p.y})超出常规范围`);
        }

        if (nameCounts[p.name].length > 1) {
          anomalies.push('duplicate_name');
          const dupIds = nameCounts[p.name].filter((id) => id !== p.id);
          judgmentParts.push(`设备名称"${p.name}"与${dupIds.join('、')}重复`);
        }

        if (!p.photoUrl || p.photoUrl.trim() === '') {
          anomalies.push('missing_photo');
          judgmentParts.push('photoUrl字段为空，缺少设备照片');
        }

        const groupName = instrumentToGroup[p.instrument];
        if (groupName && groupFloors[groupName] && groupFloors[groupName].size > 1) {
          anomalies.push('cross_floor');
          const floors = Array.from(groupFloors[groupName]).sort();
          const groupInstruments = INSTRUMENT_GROUPS[groupName as keyof typeof INSTRUMENT_GROUPS];
          const sameGroupDiffFloor = state.points.filter(
            (pp) => groupInstruments.includes(pp.instrument) && pp.floor !== p.floor
          );
          judgmentParts.push(
            `${groupName}分布在${floors.join('、')}层，该点位在${p.floor}层，同组其他设备在${sameGroupDiffFloor.map((pp) => `${pp.name}(${pp.floor}层)`).join('、')}，跨楼层异常，需要确认是否为舞台纵深分层设计`
          );
        }

        if (p.coordinateSystem !== params.coordinateSystem) {
          anomalies.push('coordinate_mismatch');
          judgmentParts.push(
            `坐标系${p.coordinateSystem}与主坐标系${params.coordinateSystem}不一致，已标注但不硬画`
          );
        }

        const newStatus: PointStatus =
          anomalies.length === 0
            ? 'normal'
            : anomalies.includes('coordinate_offset') || anomalies.includes('cross_floor')
            ? 'pending'
            : 'anomaly';

        return {
          ...p,
          anomalies,
          status: newStatus,
          judgmentProcess:
            anomalies.length === 0
              ? '坐标在合理范围内，乐器类型与设备名称匹配，照片齐全，坐标系与主坐标系一致，数据来源可靠。'
              : judgmentParts.join('；') + '。',
        };
      });

      return { points: updatedPoints };
    });
  },

  generateReport: () => {
    const { points, params, currentOperator } = get();
    const anomalyStats = get().getAnomalyStats();

    const normalCount = points.filter((p) => p.status === 'normal').length;
    const pendingCount = points.filter((p) => p.status === 'pending').length;
    const anomalyCount = points.filter((p) => p.status === 'anomaly').length;

    const judgmentProcess: string[] = [
      `[${new Date().toLocaleString('zh-CN')}] 开始执行交响乐团站位声场分析`,
      `分析参数：频率范围${params.frequencyMin}-${params.frequencyMax}Hz，采样率${params.sampleRate}Hz，声场阈值${params.soundFieldThreshold}dB，主坐标系${params.coordinateSystem}`,
      `共计检测点位${points.length}个，其中正常${normalCount}个，待确认${pendingCount}个，异常${anomalyCount}个`,
    ];

    Object.entries(anomalyStats).forEach(([type, count]) => {
      if (count > 0) {
        judgmentProcess.push(`检测到${ANOMALY_LABELS[type as AnomalyType]}共${count}处`);
      }
    });

    const coordMismatchPoints = points.filter((p) => p.anomalies.includes('coordinate_mismatch'));
    if (coordMismatchPoints.length > 0) {
      judgmentProcess.push(
        `以下点位坐标系与主坐标系不一致，已标注但未硬画：${coordMismatchPoints.map((p) => `${p.name}(${p.coordinateSystem})`).join('、')}`
      );
    }

    const pendingPoints = points.filter((p) => p.status === 'pending');
    if (pendingPoints.length > 0) {
      judgmentProcess.push(
        `以下点位需要人工确认：${pendingPoints.map((p) => p.name).join('、')}`
      );
    }

    const gisLegacyPoints = points.filter((p) => p.dataSource === 'gis_legacy');
    if (gisLegacyPoints.length > 0) {
      judgmentProcess.push(
        `以下点位来自GIS底图旧口径：${gisLegacyPoints.map((p) => p.name).join('、')}`
      );
    }

    judgmentProcess.push(`[${new Date().toLocaleString('zh-CN')}] 分析完成`);

    return {
      id: `report-${Date.now()}`,
      generatedAt: new Date().toISOString(),
      generatedBy: currentOperator,
      params: { ...params },
      summary: {
        totalPoints: points.length,
        normalCount,
        pendingCount,
        anomalyCount,
        anomalies: anomalyStats,
      },
      judgmentProcess,
      points: [...points],
    };
  },

  exportData: (format) => {
    const { generateReport, currentOperator } = get();
    const report = generateReport();

    const exportMeta = {
      exportTime: new Date().toISOString(),
      exportedBy: currentOperator,
      project: '交响乐团站位声场',
      judgmentProcess: report.judgmentProcess,
    };

    const exportLog: OperationLog = {
      id: `log${Date.now()}`,
      operator: currentOperator,
      action: 'export',
      timestamp: new Date().toISOString(),
      reason: `导出${format.toUpperCase()}格式数据`,
    };

    set((state) => ({
      operationLogs: [...state.operationLogs, exportLog],
    }));

    if (format === 'json') {
      return JSON.stringify(
        {
          meta: exportMeta,
          params: report.params,
          summary: report.summary,
          points: report.points.map((p) => ({
            ...p,
            anomalyLabels: p.anomalies.map((a) => ANOMALY_LABELS[a]),
          })),
        },
        null,
        2
      );
    } else {
      const headers = [
        '点位ID',
        '设备名称',
        '乐器类型',
        'X坐标',
        'Y坐标',
        '坐标系',
        '楼层',
        '状态',
        '照片',
        '数据来源',
        '异常类型',
        '判断过程',
        '备注',
        '确认人',
        '确认时间',
      ];

      const statusMap: Record<PointStatus, string> = {
        normal: '正常',
        pending: '待确认',
        anomaly: '异常',
      };

      const sourceMap: Record<string, string> = {
        primary: '主数据源',
        gis_legacy: 'GIS旧口径',
        manual: '人工补录',
      };

      const rows = report.points.map((p) => [
        p.id,
        p.name,
        p.instrument,
        p.x,
        p.y,
        p.coordinateSystem,
        p.floor,
        statusMap[p.status],
        p.photoUrl || '无',
        sourceMap[p.dataSource],
        p.anomalies.map((a) => ANOMALY_LABELS[a]).join('；'),
        p.judgmentProcess,
        p.remark || '',
        p.confirmedBy || '',
        p.confirmedAt ? new Date(p.confirmedAt).toLocaleString('zh-CN') : '',
      ]);

      const metaRows = [
        ['# 导出时间', new Date().toLocaleString('zh-CN')],
        ['# 导出人', currentOperator],
        ['# 项目', '交响乐团站位声场'],
        ['# 总点数', report.summary.totalPoints],
        ['# 正常', report.summary.normalCount],
        ['# 待确认', report.summary.pendingCount],
        ['# 异常', report.summary.anomalyCount],
        ['# 判断过程', report.judgmentProcess.join(' | ')],
        [],
      ];

      return (
        metaRows.map((row) => row.join(',')).join('\n') +
        '\n' +
        headers.join(',') +
        '\n' +
        rows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n')
      );
    }
  },

  getFilteredPoints: () => {
    const { points, filterStatus, filterAnomaly } = get();

    return points.filter((p) => {
      if (filterStatus !== 'all' && p.status !== filterStatus) return false;
      if (filterAnomaly !== 'all' && !p.anomalies.includes(filterAnomaly)) return false;
      return true;
    });
  },

  getAnomalyStats: () => {
    const { points } = get();
    const stats: Record<AnomalyType, number> = {
      coordinate_offset: 0,
      duplicate_name: 0,
      missing_photo: 0,
      cross_floor: 0,
      coordinate_mismatch: 0,
    };

    points.forEach((p) => {
      p.anomalies.forEach((a) => {
        stats[a]++;
      });
    });

    return stats;
  },
}));
