import type { Experiment, DataSource, Metric, Judgment, EvaluationRecord, OperationLog } from "@/types"

export const mockExperiments: Experiment[] = [
  { id: "exp-001", name: "首页推荐V2.3", status: "confirmed", createdAt: "2026-05-28" },
  { id: "exp-002", name: "猜你喜欢A/B测试", status: "pending", createdAt: "2026-05-29" },
  { id: "exp-003", name: "搜索排序优化", status: "manual_modified", createdAt: "2026-05-30" },
  { id: "exp-004", name: "信息流推荐迭代", status: "importing", createdAt: "2026-05-31" },
]

export const mockDataSources: DataSource[] = [
  { id: "ds-001", experimentId: "exp-001", type: "evaluation", fileName: "首页推荐V2.3_评估表.xlsx", importedAt: "2026-05-28 10:00", importedBy: "张明", rolledBack: false },
  { id: "ds-002", experimentId: "exp-001", type: "online_feedback", fileName: "首页推荐V2.3_线上反馈.csv", importedAt: "2026-05-28 10:05", importedBy: "张明", rolledBack: false },
  { id: "ds-003", experimentId: "exp-001", type: "config", fileName: "首页推荐V2.3_配置.json", importedAt: "2026-05-28 10:10", importedBy: "张明", rolledBack: false },
  { id: "ds-004", experimentId: "exp-002", type: "evaluation", fileName: "猜你喜欢_评估表.xlsx", importedAt: "2026-05-29 14:00", importedBy: "李薇", rolledBack: false },
  { id: "ds-005", experimentId: "exp-002", type: "online_feedback", fileName: "猜你喜欢_线上反馈.csv", importedAt: "2026-05-29 14:05", importedBy: "李薇", rolledBack: false },
  { id: "ds-006", experimentId: "exp-003", type: "evaluation", fileName: "搜索排序_评估表.xlsx", importedAt: "2026-05-30 09:00", importedBy: "王浩", rolledBack: false },
  { id: "ds-007", experimentId: "exp-003", type: "online_feedback", fileName: "搜索排序_线上反馈.csv", importedAt: "2026-05-30 09:05", importedBy: "王浩", rolledBack: true },
  { id: "ds-008", experimentId: "exp-003", type: "config", fileName: "搜索排序_配置.json", importedAt: "2026-05-30 09:10", importedBy: "王浩", rolledBack: false },
  { id: "ds-009", experimentId: "exp-002", type: "config", fileName: "猜你喜欢_配置.json", importedAt: "2026-05-30 16:00", importedBy: "李薇", rolledBack: false },
]

export const mockMetrics: Metric[] = [
  { id: "m-001", experimentId: "exp-001", name: "CTR", value: "3.21%", source: "evaluation", caliberVersion: "v2", caliberNote: "点击/曝光，去除爬虫流量", caliberChanged: false, caliberChangeSource: null, caliberChangeNextStep: null },
  { id: "m-002", experimentId: "exp-001", name: "CTR", value: "3.18%", source: "online_feedback", caliberVersion: "v2", caliberNote: "点击/曝光，去除爬虫流量", caliberChanged: false, caliberChangeSource: null, caliberChangeNextStep: null },
  { id: "m-003", experimentId: "exp-001", name: "CVR", value: "1.85%", source: "evaluation", caliberVersion: "v1", caliberNote: "转化/点击", caliberChanged: false, caliberChangeSource: null, caliberChangeNextStep: null },
  { id: "m-004", experimentId: "exp-001", name: "CVR", value: "1.72%", source: "online_feedback", caliberVersion: "v2", caliberNote: "转化/点击，含加购行为", caliberChanged: true, caliberChangeSource: "online_feedback", caliberChangeNextStep: "请联系李薇补全线上反馈CVR口径说明" },
  { id: "m-005", experimentId: "exp-001", name: "曝光量", value: "1,234,567", source: "config", caliberVersion: "v1", caliberNote: "日均曝光PV", caliberChanged: false, caliberChangeSource: null, caliberChangeNextStep: null },
  { id: "m-006", experimentId: "exp-002", name: "CTR", value: "2.89%", source: "evaluation", caliberVersion: "v2", caliberNote: "点击/曝光，去除爬虫流量", caliberChanged: false, caliberChangeSource: null, caliberChangeNextStep: null },
  { id: "m-007", experimentId: "exp-002", name: "CTR", value: "2.95%", source: "online_feedback", caliberVersion: "v1", caliberNote: "点击/曝光（含爬虫）", caliberChanged: true, caliberChangeSource: "evaluation", caliberChangeNextStep: "请联系张明确认评估表CTR口径版本" },
  { id: "m-008", experimentId: "exp-002", name: "人均停留时长", value: "4.2min", source: "online_feedback", caliberVersion: "v1", caliberNote: "会话内平均停留", caliberChanged: false, caliberChangeSource: null, caliberChangeNextStep: null },
  { id: "m-009", experimentId: "exp-003", name: "CTR", value: "4.10%", source: "evaluation", caliberVersion: "v2", caliberNote: "点击/曝光，去除爬虫流量", caliberChanged: false, caliberChangeSource: null, caliberChangeNextStep: null },
  { id: "m-010", experimentId: "exp-003", name: "NDCG@5", value: "0.82", source: "evaluation", caliberVersion: "v1", caliberNote: "搜索排序NDCG，前5位", caliberChanged: false, caliberChangeSource: null, caliberChangeNextStep: null },
  { id: "m-011", experimentId: "exp-003", name: "NDCG@5", value: "0.79", source: "online_feedback", caliberVersion: "v2", caliberNote: "搜索排序NDCG，前5位，含长尾query", caliberChanged: true, caliberChangeSource: "online_feedback", caliberChangeNextStep: "请联系王浩补全线上反馈NDCG口径说明" },
]

export const mockJudgments: Judgment[] = [
  { id: "j-001", metricId: "m-001", result: "pass", reason: "CTR 3.21% 高于基线 2.80%，提升幅度 +14.6%，满足≥5%的提升要求" },
  { id: "j-002", metricId: "m-002", result: "pass", reason: "线上反馈CTR 3.18% 与评估表3.21%偏差<1%，口径一致，确认达标" },
  { id: "j-003", metricId: "m-003", result: "pass", reason: "CVR 1.85% 高于基线 1.60%，提升幅度 +15.6%，满足≥5%的提升要求" },
  { id: "j-004", metricId: "m-004", result: "fail", reason: "线上反馈CVR 1.72% 口径变更（v1→v2），含加购行为后数值偏低，需口径对齐后再判断" },
  { id: "j-005", metricId: "m-006", result: "pass", reason: "评估表CTR 2.89% 高于基线 2.50%，提升幅度 +15.6%，满足要求" },
  { id: "j-006", metricId: "m-007", result: "fail", reason: "线上反馈CTR 2.95% 口径版本(v1)与评估表(v2)不一致，需统一口径后重新评估" },
  { id: "j-007", metricId: "m-008", result: "pass", reason: "人均停留时长 4.2min 高于基线 3.8min，提升 +10.5%，达标" },
  { id: "j-008", metricId: "m-009", result: "pass", reason: "搜索CTR 4.10% 高于基线 3.50%，提升 +17.1%，达标" },
  { id: "j-009", metricId: "m-010", result: "pass", reason: "NDCG@5 0.82 高于基线 0.75，提升 +9.3%，达标" },
  { id: "j-010", metricId: "m-011", result: "fail", reason: "线上反馈NDCG@5 0.79 口径变更（v1→v2，含长尾query），低于评估表0.82，需口径对齐" },
]

export const mockEvaluationRecords: EvaluationRecord[] = [
  { id: "er-001", experimentId: "exp-001", status: "confirmed", caliberLabel: "取评估表均值，线上反馈交叉验证", modifiedBy: null, modifiedAt: null, modificationReason: null, originalValue: null, modifiedValue: null, pendingItem: null, responsiblePerson: null },
  { id: "er-002", experimentId: "exp-001", status: "confirmed", caliberLabel: "CVR口径以评估表v1为准", modifiedBy: null, modifiedAt: null, modificationReason: null, originalValue: null, modifiedValue: null, pendingItem: null, responsiblePerson: null },
  { id: "er-003", experimentId: "exp-002", status: "pending", caliberLabel: "待补全：线上反馈CTR口径版本需确认", modifiedBy: null, modifiedAt: null, modificationReason: null, originalValue: null, modifiedValue: null, pendingItem: "线上反馈CTR口径版本与评估表不一致", responsiblePerson: "张明" },
  { id: "er-004", experimentId: "exp-002", status: "pending", caliberLabel: "待补全：配置文件缺失", modifiedBy: null, modifiedAt: null, modificationReason: null, originalValue: null, modifiedValue: null, pendingItem: "实验缺少配置文件数据", responsiblePerson: "李薇" },
  { id: "er-005", experimentId: "exp-003", status: "manual_modified", caliberLabel: "人工修正：NDCG口径对齐至评估表v1", modifiedBy: "王浩", modifiedAt: "2026-05-30 15:30", modificationReason: "线上反馈口径含长尾query，与评估表不可比，修正为评估表口径", originalValue: "0.79 (v2，含长尾query)", modifiedValue: "0.82 (v1，不含长尾query)", pendingItem: null, responsiblePerson: null },
  { id: "er-006", experimentId: "exp-003", status: "pending", caliberLabel: "待补全：线上反馈文件已撤回，需重新导入", modifiedBy: null, modifiedAt: null, modificationReason: null, originalValue: null, modifiedValue: null, pendingItem: "线上反馈文件已被撤回，需重新上传正确口径版本", responsiblePerson: "王浩" },
  { id: "er-007", experimentId: "exp-001", status: "manual_modified", caliberLabel: "人工修正：CVR评估表值由1.85%调整为1.80%", modifiedBy: "张明", modifiedAt: "2026-05-29 09:00", modificationReason: "评估表原始数据中含异常样本，剔除后重新计算", originalValue: "1.85%", modifiedValue: "1.80%", pendingItem: null, responsiblePerson: null },
]

export const mockOperationLogs: OperationLog[] = [
  { id: "ol-001", experimentId: "exp-001", action: "import", operator: "张明", timestamp: "2026-05-28 10:00", detail: "导入评估表：首页推荐V2.3_评估表.xlsx" },
  { id: "ol-002", experimentId: "exp-001", action: "import", operator: "张明", timestamp: "2026-05-28 10:05", detail: "导入线上反馈：首页推荐V2.3_线上反馈.csv" },
  { id: "ol-003", experimentId: "exp-001", action: "import", operator: "张明", timestamp: "2026-05-28 10:10", detail: "导入配置文件：首页推荐V2.3_配置.json" },
  { id: "ol-004", experimentId: "exp-001", action: "confirm", operator: "刘总监", timestamp: "2026-05-28 16:00", detail: "确认首页推荐V2.3评估结论" },
  { id: "ol-005", experimentId: "exp-002", action: "import", operator: "李薇", timestamp: "2026-05-29 14:00", detail: "导入评估表：猜你喜欢_评估表.xlsx" },
  { id: "ol-006", experimentId: "exp-002", action: "import", operator: "李薇", timestamp: "2026-05-29 14:05", detail: "导入线上反馈：猜你喜欢_线上反馈.csv" },
  { id: "ol-007", experimentId: "exp-003", action: "import", operator: "王浩", timestamp: "2026-05-30 09:00", detail: "导入评估表：搜索排序_评估表.xlsx" },
  { id: "ol-008", experimentId: "exp-003", action: "import", operator: "王浩", timestamp: "2026-05-30 09:05", detail: "导入线上反馈：搜索排序_线上反馈.csv" },
  { id: "ol-009", experimentId: "exp-003", action: "rollback", operator: "王浩", timestamp: "2026-05-30 11:00", detail: "撤回线上反馈：搜索排序_线上反馈.csv（口径版本错误）" },
  { id: "ol-010", experimentId: "exp-003", action: "modify", operator: "王浩", timestamp: "2026-05-30 15:30", detail: "人工修正NDCG@5：0.79(v2) → 0.82(v1)，原因：线上反馈口径含长尾query，与评估表不可比" },
  { id: "ol-011", experimentId: "exp-002", action: "import", operator: "李薇", timestamp: "2026-05-30 16:00", detail: "导入配置文件：猜你喜欢_配置.json" },
  { id: "ol-012", experimentId: "exp-001", action: "modify", operator: "张明", timestamp: "2026-05-29 09:00", detail: "人工修正CVR：1.85% → 1.80%，原因：评估表原始数据中含异常样本，剔除后重新计算" },
]
