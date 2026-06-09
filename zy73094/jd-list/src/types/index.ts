export type ItemStatus =
  | 'confirmed'
  | 'supplement_pending'
  | 'override_pending'
  | 'change_late'
  | 'gap';

export type Major = '给水排水' | '暖通' | '电气' | '消防' | '综合';

export interface VersionRecord {
  version: string;
  date: string;
  note?: string;
}

/** 结论：一条清单的最终判断 */
export interface Conclusion {
  canConstruct: boolean;
  clashRisk: 'none' | 'low' | 'medium' | 'high';
  needCoordination: boolean;
  remark: string;
}

/** 人工改判记录：把旧结论改成新结论，要讲清影响 */
export interface OverrideRecord {
  id: string;
  itemId: string;
  createdAt: string;
  operator: string;
  before: Conclusion;
  after: Conclusion;
  reason: string;
  /** 影响的结论点列表，导出时逐条展示 */
  impactPoints: string[];
  /** 影响范围：相关专业 / 楼层 / 系统 */
  scope: string[];
}

/** 补录备注：月底封账前补的BIM备注，要能对比前后变化 */
export interface SupplementRecord {
  id: string;
  itemId: string;
  createdAt: string;
  operator: string;
  /** 补录前的BIM备注 */
  beforeBimNote: string;
  /** 补录后的BIM备注 */
  afterBimNote: string;
  /** 补录改变了哪些导出字段 */
  exportDiff: {
    field: string;
    before: string;
    after: string;
  }[];
  /** 补录后改变了哪些判断 */
  changedJudgements: string[];
}

/** 变更单追踪：变更单晚到的情况要留来源行和影响范围 */
export interface ChangeTrack {
  id: string;
  itemId: string;
  changeNo: string;
  receivedLate: boolean;
  sourceRow: string;
  /** 影响的条目行（清单里的哪些条目被波及） */
  impactRows: string[];
  scope: string;
  receivedAt?: string;
  note: string;
}

/** 机电管综交底清单 主条目 */
export interface JdItem {
  id: string;
  code: string;
  major: Major;
  system: string;
  location: string;
  /** 图纸版本历史，用户最担心哪个是最新版 */
  versions: VersionRecord[];
  bimNote: string;
  status: ItemStatus;
  conclusion: Conclusion;
  overrides: OverrideRecord[];
  supplements: SupplementRecord[];
  changeTracks: ChangeTrack[];
  createdAt: string;
  handler?: string;
}

export type TabKey = 'list' | 'analysis' | 'supplement';
