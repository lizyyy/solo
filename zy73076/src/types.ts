// ============================================================
// 盾构刀盘阈值预警 - 核心领域模型
// ============================================================

// ---------- 设备编号规范化 ----------

export type EquipmentIdStatus =
  | 'canonical'      // 已是规范编号
  | 'normalized'     // 已成功规范化
  | 'ambiguous'      // 存在歧义（同一写法映射到多个规范编号）
  | 'duplicate'      // 设备编号重复（多条巡检记录指向同一物理设备但写法不同且未确认）
  | 'unknown';       // 无法识别

export interface EquipmentIdMapping {
  canonicalId: string;           // 规范设备编号（如 "SD-001"）
  aliases: string[];             // 已知别名/历史写法
  projectId: string;             // 所属项目
  description?: string;          // 设备描述
}

export interface NormalizedEquipmentId {
  raw: string;                   // 原始写法
  canonical: string | null;      // 规范化后的编号
  status: EquipmentIdStatus;
  candidates: string[];          // 候选规范编号（歧义时用）
  confidence: number;            // 0~1，规范化置信度
}

// ---------- 巡检表 ----------

export interface InspectionRecord {
  id: string;                    // 巡检记录ID
  inspectionDate: string;        // 巡检日期 YYYY-MM-DD
  rawEquipmentId: string;        // 巡检表上填写的原始设备编号
  projectId: string;             // 所属项目（用于按项目分组、筛选）
  inspector: string;             // 巡检人
  itemName: string;              // 巡检项（如"刀盘磨损量"、"油温"）
  measuredValue: number;         // 测量值
  unit: string;                  // 单位
  remark?: string;               // 巡检表备注（含评审会前临时补的）
  createdAt: string;
}

// ---------- 阈值与预警 ----------

export type WarningLevel = 'normal' | 'attention' | 'warning' | 'critical';

export interface ThresholdRule {
  itemName: string;              // 巡检项名称
  unit: string;
  thresholds: {
    attention?: number;          // 注意阈值（>此值触发）
    warning?: number;
    critical?: number;
  };
  direction: 'upper' | 'lower' | 'both'; // 超上限/下限/双向
  description: string;           // 该阈值判断的业务含义
}

export interface WarningDetail {
  recordId: string;              // 关联巡检记录ID
  inspectionDate: string;
  projectId: string;             // 所属项目
  equipmentId: string;           // 此处为规范编号（若能规范化）
  rawEquipmentId: string;        // 原始写法，便于追溯
  itemName: string;
  measuredValue: number;
  unit: string;
  level: WarningLevel;
  thresholdBreached: {
    ruleName: string;
    limit: number;
    direction: 'above' | 'below';
  } | null;
  evidenceGap: EvidenceGap[];   // 证据缺口
}

export interface EvidenceGap {
  type:
    | 'no_previous_record'       // 缺少历史对比数据
    | 'equipment_not_confirmed'  // 设备编号未确认（挂起中）
    | 'threshold_not_defined'    // 阈值规则缺失
    | 'inspection_remark_missing' // 巡检备注缺失
    | 'followup_needed';         // 需要现场复核/跟进
  description: string;
  priority: 'high' | 'medium' | 'low';
}

// ---------- 筛选 & 统计（与 WarningResultSet 同源） ----------

export interface FilterCriteria {
  dateRange: { start: string; end: string } | null;
  projectId: string | null;
  equipmentIds: string[] | null;
  warningLevels: WarningLevel[] | null;
  includeSuspended: boolean;
}

export interface WarningStatistics {
  totalInspections: number;
  totalEquipments: number;
  byLevel: Record<WarningLevel, number>;
  suspendedCount: number;           // 挂起等待确认数
  evidenceGapCount: number;         // 含证据缺口的预警数
  byEquipment: Record<string, number>; // 按规范设备编号统计
}

// ---------- 异常队列 & 挂起机制 ----------

export type AnomalyStatus =
  | 'pending_confirmation'   // 等待项目经理确认（设备编号歧义/重复）
  | 'confirmed_warning'      // 已确认预警，待处理
  | 'false_alarm'            // 误报，已排除
  | 'resolved'               // 已处理闭环
  | 'transferred';           // 已交接给下一角色

export interface AnomalyQueueItem {
  id: string;
  warningDetailId: string;
  equipmentId: string;           // 规范编号（挂起时可能为候选）
  rawEquipmentIds: string[];     // 导致重复/歧义的所有原始写法
  level: WarningLevel;
  status: AnomalyStatus;
  suspensionReason?:
    | 'duplicate_equipment'      // 设备编号重复：同一物理设备多种写法未确认
    | 'ambiguous_equipment'      // 写法歧义
    | 'judgment_change_review';  // 判断变更需评审
  duplicateConfirmationId?: string; // 关联的设备编号待确认事项ID
  assignedTo: 'project_manager' | 'assistant_xiaolin' | 'developer';
  createdAt: string;
  updatedAt: string;
  history: AnomalyStatusLog[];
}

export interface AnomalyStatusLog {
  timestamp: string;
  from: AnomalyStatus | null;
  to: AnomalyStatus;
  operator: string;
  comment?: string;
}

// ---------- 设备编号重复待确认事项（独立维度，整合同一组重复写法） ----------
// 设计意图：把同一项目、同一物理设备（候选规范编号）的所有不同原始写法，
// 归集到同一个待确认事项里。无论对应巡检记录阈值判断是 normal 还是 warning，
// 只要属于这个重复组，就能从巡检表索引查到这个待确认事项。

export interface DuplicateIdConfirmation {
  id: string;                              // 如 "DC-20260622-001"
  projectId: string;                       // 所属项目（用于筛选）
  candidateCanonicalId: string;            // 候选规范编号
  rawVariants: string[];                   // 所有不同的原始写法（重复证据链）
  affectedRecordIds: string[];             // 所有关联的巡检记录ID（含 normal）
  affectedWarningCount: number;            // 其中有多少条是非 normal 的（便于判断风险）
  status: 'pending' | 'confirmed' | 'rejected';
  confirmedCanonicalId?: string;           // 项目经理确认后的最终规范编号
  riskOfFalseStability: string;            // 不确认的假稳定风险描述
  createdAt: string;
  updatedAt: string;
  history: DuplicateIdConfirmationLog[];
}

export interface DuplicateIdConfirmationLog {
  timestamp: string;
  from: DuplicateIdConfirmation['status'] | null;
  to: DuplicateIdConfirmation['status'];
  operator: string;
  comment?: string;
}

// ---------- 判断变更追踪（巡检表备注 & 评审会说明） ----------

export interface JudgmentChange {
  id: string;
  equipmentId: string;
  itemName: string;
  previousJudgment: {
    level: WarningLevel;
    conclusion: string;
    basis: string;
  } | null;                                 // null 表示首次纳入
  currentJudgment: {
    level: WarningLevel;
    conclusion: string;
    basis: string;
  };
  changeReason:
    | 'equipment_id_unified'       // 设备编号统一后重新归集
    | 'threshold_updated'          // 阈值更新
    | 'new_evidence'               // 新证据（巡检记录）
    | 'false_stability_removed';   // 移除假稳定结论（设备编号重复导致的虚假稳定）
  affectedRecordIds: string[];     // 受影响的巡检记录ID
  remarkForReview?: string;        // 评审会备注内容
}

// ---------- 统一预警结果（筛选/统计/明细/异常队列共用同一数据源） ----------

export interface WarningResultSet {
  generatedAt: string;
  filterCriteria: FilterCriteria;          // 生成时使用的筛选条件
  statistics: WarningStatistics;           // 统计数字
  details: WarningDetail[];                // 明细表
  anomalyQueue: AnomalyQueueItem[];        // 异常队列（按级别+设备分组）
  duplicateConfirmations: DuplicateIdConfirmation[]; // 设备编号重复待确认事项（整合维度）
  judgmentChanges: JudgmentChange[];       // 本批次预警改变了哪些判断
}

export interface ManagerDashboardView {
  overview: WarningStatistics;
  summaryBreakdown: {
    // 汇总口径 → 异常明细的对接结构
    level: WarningLevel;
    count: number;
    equipmentCount: number;
    evidenceGapSummary: { type: EvidenceGap['type']; count: number }[];
    drillDownFilter: Partial<FilterCriteria>; // 点击下钻时携带的筛选条件
  }[];
  pendingConfirmations: {
    // 项目经理待确认清单（来自 anomalyQueue，按预警级别拆分）
    queueId: string;
    rawEquipmentIds: string[];
    candidateCanonicalIds: string[];
    affectedWarningCount: number;
    riskOfFalseStability: string; // 描述：若不确认可能导致什么假稳定结论
  }[];
  duplicateConfirmations: {
    // 设备编号重复待确认事项（整合同一组，来自 duplicateConfirmations）
    confirmationId: string;
    projectId: string;
    candidateCanonicalId: string;
    rawVariants: string[];
    affectedRecordIds: string[];
    affectedWarningCount: number;
    status: DuplicateIdConfirmation['status'];
    confirmedCanonicalId?: string;
    riskOfFalseStability: string;
  }[];
  outstandingEvidenceGaps: {
    // 还剩哪些证据没补齐（项目经理最关心）
    gapType: EvidenceGap['type'];
    count: number;
    relatedEquipments: string[];
    suggestedAction: string;
  }[];
}

// ---------- 交接流程（项目助理小林视角） ----------

export interface HandoverChecklistItem {
  step: number;
  description: string;
  completed: boolean;
  relatedInspectionRecordIds: string[];
  relatedAnomalyQueueIds: string[];
  relatedDuplicateConfirmationIds?: string[];
  evidence?: string;              // 交接凭证（链接/编号）
}

export interface HandoverPackage {
  generatedAt: string;
  generatedFor: 'assistant_xiaolin';
  checklist: HandoverChecklistItem[];
  inspectionIndex: {
    // 巡检表 → 异常队列 + 待确认事项 索引（小林顺着巡检表就能找到所有待办）
    inspectionRecordId: string;
    rawEquipmentId: string;
    canonicalEquipmentId: string | null;
    anomalyQueueIds: string[];
    duplicateConfirmationIds: string[]; // 关联的设备编号待确认事项（即使是 normal 也可能有）
    judgmentChangeIds: string[];
  }[];
  pendingActionCount: number;
  completedActionCount: number;
}
