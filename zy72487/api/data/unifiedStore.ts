import type { AcceptanceRecord, OperationLog } from '../../shared/types.js';

const generateId = (): string => Math.random().toString(36).substring(2, 11);

const now = new Date();
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

const initialRecords: AcceptanceRecord[] = [
  {
    id: generateId(),
    redLineNo: 'HX-2024-001',
    communityName: '阳光花园',
    communityNameOld: '阳光小区',
    redLineRemark: `开挖位置：阳光花园东门北侧50米
开挖面积：120平方米
开挖深度：1.2米
恢复标准：C30混凝土
施工单位：市政三公司
备注：现场有雨水井移位，需特别注意恢复质量。边缘部分有老旧管线，施工时要小心。
网格员巡查记录显示有破损，需重点检查。`,
    gridInspection: `巡查日期：2024-03-15
巡查人：王某某
小区名称：阳光小区
现场情况：恢复表面平整，无明显裂缝。
但东侧边缘约3平方米区域有下沉迹象。
雨水井周围恢复良好。
建议：观察一周后复检下沉区域。`,
    status: 'pending_summary',
    hasConflict: true,
    conflictStatus: 'pending',
    hasNameIssue: true,
    nameReviewStatus: 'pending',
    streetSummary: '',
    importTime: daysAgo(5),
    reviewTime: daysAgo(2),
    operator: '小付',
    conflictPoints: [
      {
        field: '小区名称',
        redLineValue: '阳光花园',
        gridValue: '阳光小区',
        description: '红线图标注为阳光花园，网格员记录为阳光小区，疑似新旧名称',
      },
      {
        field: '恢复质量',
        redLineValue: '网格员巡查记录显示有破损，需重点检查',
        gridValue: '恢复表面平整，无明显裂缝，但东侧边缘约3平方米区域有下沉迹象',
        description: '红线图备注提及有破损，网格员记录为下沉迹象，描述存在差异',
      },
    ],
    calculationMeta: {
      paramVersion: 'v2.1.0',
      decisionReason: '采用2024版市政验收标准，下沉区域小于5平方米暂不判定为不合格，留待观察',
      calculationTime: daysAgo(2),
      algorithm: 'standard_area_calculator_v2',
    },
    operationLogs: [],
  },
  {
    id: generateId(),
    redLineNo: 'HX-2024-002',
    communityName: '翠苑新村',
    redLineRemark: `开挖位置：翠苑新村南门主路
开挖面积：85平方米
恢复标准：沥青路面
施工单位：道桥一处
备注：主路交通流量大，需夜间施工。
原有管线复杂，已标注位置。`,
    gridInspection: `巡查日期：2024-03-18
巡查人：李某某
小区名称：翠苑新村
现场情况：沥青路面恢复平整，接缝处理良好。
无明显跳车感。
路面温度适宜时施工，质量有保障。`,
    status: 'completed',
    hasConflict: false,
    hasNameIssue: false,
    streetSummary: '翠苑新村南门主路开挖恢复验收合格，路面平整，无异常。',
    importTime: daysAgo(10),
    reviewTime: daysAgo(7),
    summaryTime: daysAgo(5),
    operator: '小付',
    operationLogs: [],
  },
  {
    id: generateId(),
    redLineNo: 'HX-2024-001',
    communityName: '阳光花园',
    redLineRemark: `【重复导入】开挖位置：阳光花园东门北侧50米
开挖面积：120平方米
开挖深度：1.2米
恢复标准：C30混凝土
施工单位：市政三公司`,
    gridInspection: '',
    status: 'pending_review',
    hasConflict: false,
    hasNameIssue: false,
    streetSummary: '',
    importTime: daysAgo(3),
    operator: '小付',
    operationLogs: [],
  },
  {
    id: generateId(),
    redLineNo: 'HX-2024-003',
    communityName: '锦绣家园',
    communityNameOld: '锦绣花园',
    redLineRemark: `开挖位置：锦绣家园西门
开挖面积：45平方米
恢复标准：人行道砖
施工单位：市政二公司
备注：靠近绿化带，注意保护植被。`,
    gridInspection: `巡查日期：2024-03-20
巡查人：张某某
小区名称：锦绣花园
现场情况：人行道砖铺设整齐，与原路面衔接自然。
绿化带保护完好。`,
    status: 'pending_review',
    hasConflict: true,
    conflictStatus: 'pending',
    hasNameIssue: true,
    nameReviewStatus: 'pending',
    streetSummary: '',
    importTime: daysAgo(1),
    operator: '小付',
    conflictPoints: [
      {
        field: '小区名称',
        redLineValue: '锦绣家园',
        gridValue: '锦绣花园',
        description: '红线图标注为锦绣家园，网格员记录为锦绣花园，疑似新旧名称',
      },
    ],
    operationLogs: [],
  },
  {
    id: generateId(),
    redLineNo: 'HX-2024-004',
    communityName: '和平里社区',
    redLineRemark: `开挖位置：和平里社区活动中心门前
开挖面积：60平方米
恢复标准：透水砖
施工单位：市政一公司
备注：有燃气管道经过，施工时已通知燃气公司。`,
    gridInspection: `巡查日期：2024-03-22
巡查人：陈某某
小区名称：和平里社区
现场情况：透水砖铺设平整，坡度合理，排水正常。
燃气管道附近区域处理规范。`,
    status: 'pending_summary',
    hasConflict: false,
    hasNameIssue: false,
    streetSummary: '',
    importTime: daysAgo(4),
    reviewTime: daysAgo(1),
    operator: '小付',
    operationLogs: [],
  },
];

class UnifiedDataStore {
  private records: AcceptanceRecord[] = initialRecords;
  private operationLogs: OperationLog[] = [];

  getAllRecords(): AcceptanceRecord[] {
    return [...this.records];
  }

  getRecordById(id: string): AcceptanceRecord | undefined {
    return this.records.find((r) => r.id === id);
  }

  addRecord(record: Omit<AcceptanceRecord, 'id' | 'operationLogs'>): AcceptanceRecord {
    const newRecord: AcceptanceRecord = {
      ...record,
      id: generateId(),
      operationLogs: [],
    };
    this.records.unshift(newRecord);
    this.addLog(newRecord.id, 'import', record.operator, `导入红线图备注，编号：${record.redLineNo}`);
    return newRecord;
  }

  updateRecord(id: string, updates: Partial<AcceptanceRecord>): AcceptanceRecord | undefined {
    const index = this.records.findIndex((r) => r.id === id);
    if (index === -1) return undefined;
    this.records[index] = { ...this.records[index], ...updates };
    return this.records[index];
  }

  addLog(recordId: string, action: string, operator: string, detail: string): void {
    const log: OperationLog = {
      id: generateId(),
      recordId,
      action,
      operator,
      operateTime: new Date().toISOString(),
      detail,
    };
    this.operationLogs.push(log);
    const record = this.records.find((r) => r.id === recordId);
    if (record) {
      if (!record.operationLogs) record.operationLogs = [];
      record.operationLogs.push(log);
    }
  }

  getLogsByRecordId(recordId: string): OperationLog[] {
    return this.operationLogs.filter((log) => log.recordId === recordId);
  }

  getUnifiedView(): AcceptanceRecord[] {
    return this.records.map((r) => ({ ...r }));
  }
}

export const dataStore = new UnifiedDataStore();
