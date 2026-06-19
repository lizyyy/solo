# A/B 实验提前停止判断系统

## 项目概述

统一管理 A/B 实验的边界值说明和评分权重表，确保数据一致性和可追溯性。

---

## 核心特性

### 1. 统一证据存储
- **两边证据合一**：边界值说明的「主流程」和评分权重表的「现场说法」存放在同一条记录
- **原始行号保留**：记录数据来源的 Excel 行号，复核时可追溯
- **人工改动追踪**：所有修改记录操作人、时间、原因，支持回滚

### 2. 边界规则引擎

#### 规则一：分母为空字符串
```
【现象】Excel 分母单元格为空（什么都没填）
【判断】标记为「需复核」，不自动处理
【显示】统一显示 "[需复核 - 分母为空]"
  - 页面展示：显示黄色警告
  - 导出明细：保留原始空值 + 警告标记
  - 接口返回：返回原始值 + reviewRequired=true
【操作】数据复核人确认是漏填还是业务上就是0
【回滚】人工修改后可在变更历史中回滚
【代码位置】BoundaryRuleEngine.js 第 63-72 行
```

#### 规则二：分母为 0
```
【现象】分母填的是 0
【判断】标记为「需复核」，不自动处理
【显示】统一显示 "[需复核 - 分母为 0]"
【操作】请确认分母为 0 的业务场景
【代码位置】BoundaryRuleEngine.js 第 74-83 行
```

#### 规则三：分子缺失
```
【现象】分子为空
【判断】自动按 0 处理
【显示】显示计算结果 0.0000
【代码位置】BoundaryRuleEngine.js 第 85-93 行
```

#### 规则四：正常数据
```
【现象】分子分母都有有效值
【判断】正常计算
【显示】显示计算结果（保留 4 位小数）
【代码位置】BoundaryRuleEngine.js 第 95-100 行
```

### 3. 三步工作流

#### 步骤 1：边界值说明第一次导入
- 导入边界值说明 Excel，包含「主流程」、分子、分母
- 系统自动应用边界规则，标记需复核记录
- 保留原始行号和导入时间，同时快照保存 `originalRawData`（永不修改）

#### 步骤 2：运营规划阿岚补看评分权重表
- 补充导入评分权重表，包含「现场说法」权重
- 与已有记录关联，形成完整证据链
- 两边证据齐全后才可进入下一步

#### 步骤 3：课堂演示结果更新
- **人工改动**：真正写入 `rawData`，同时记录字段/原值/新值/操作人/原因/下一步处理人
- **复核更新**：状态、复核人、备注完整写入 `reviewTimeline`
- **回滚操作**：真正恢复字段原始值，不是只改状态
- 最终结果可用于课堂演示

---

### 4. 改动→同步→回滚 全链路（修复的核心）

> 之前的问题：只写日志不写数据，页面显示改了但导出和结果还是旧值

**现在的数据流转**：

```
人工改动分母
  ↓
applyManualChange()
  ├─ 通过嵌套路径真正写入 boundaryEvidence.rawData.denominator
  ├─ 原值保存在 manualChanges[].oldValue + boundaryEvidence.originalRawData（双备份）
  ├─ 记录操作人、原因、下一步处理人
  └─ 快照写入 auditTrail[].snapshot

规则引擎重新评估（基于改动后的值）
  ↓ 例如：分母空→300，规则从 DENOMINATOR_EMPTY_STRING → NORMAL

列表/详情/CSV/API/报告 全链路读取同一份 rawData
  ↓
所有输出 displayValue 同步变化（四处一致）

────────────────────────────

用户点「回滚」
  ↓
rollbackChange()
  ├─ 真正把 manualChanges[].oldValue 写回 rawData 对应字段
  ├─ 标记 canRollback=false，记录 rolledBackAt/rolledBackBy
  └─ 快照写入 auditTrail[].snapshot

规则引擎重新评估（基于恢复后的原始值）
  ↓
列表/详情/CSV/API/报告 → 四处再次同步恢复原状
```

**关键点**：
- 原始值存在 `originalRawData`（只读，永不覆盖），改动后值存在 `rawData`（读写）
- 规则引擎始终基于 `rawData` 计算 → 改了就变、回了就还原
- 所有输出模块（列表/详情/CSV/API/摘要/报告）统一从同一份 `rawData` 取数据

---

## 数据结构

### 统一记录结构

| 字段 | 说明 | 来源 |
|------|------|------|
| recordId | 实验记录唯一ID | 系统生成 |
| boundaryEvidence | 边界值证据 | 步骤1导入 |
| ├── mainProcess | 主流程 | 边界值说明 |
| ├── numerator | 分子 | 边界值说明 |
| ├── denominator | 分母 | 边界值说明 |
| └── originalLineNumber | 原始行号 | Excel行号 |
| scoringEvidence | 评分权重证据 | 步骤2导入 |
| ├── sceneStatement | 现场说法 | 评分权重表 |
| └── originalLineNumber | 原始行号 | Excel行号 |
| reviewStatus | 复核状态 | pending/approved/rejected |
| manualChanges | 人工变更历史 | 操作记录 |
| auditTrail | 完整审计日志 | 所有操作 |

---

## 操作指南

### 快速开始

```bash
# 运行完整工作流演示
npm run demo

# 运行端到端全链路验证（补录→保存→复核→回滚→导出→报告）
npm run verify

# 运行测试
npm test
```

### 代码示例

```javascript
const ThreeStepWorkflow = require('./src/workflow/ThreeStepWorkflow');

const workflow = new ThreeStepWorkflow();

// 步骤1：导入边界值说明
await workflow.executeStep1([
  { lineNumber: 2, mainProcess: '支付流程', numerator: 50, denominator: 100 },
  { lineNumber: 3, mainProcess: '注册流程', numerator: 30, denominator: '' }  // 分母为空
], '数据专员');

// 步骤2：补评分权重表
await workflow.executeStep2([
  { recordId: 'EXP-001', lineNumber: 2, sceneStatement: '高权重' },
  { recordId: 'EXP-002', lineNumber: 3, sceneStatement: '中权重' }
], '阿岚');

// 步骤3：课堂演示结果更新（支持人工改动/回滚/复核多种操作）
await workflow.executeStep3([
  {
    type: 'manual_fix',
    recordId: 'EXP-002',
    payload: {
      field: 'boundaryEvidence.rawData.denominator',
      oldValue: '',
      newValue: 200,
      reason: '现场确认分母漏填，实际200',
      nextHandler: '阿岚'
    },
    operator: '复核人A'
  },
  {
    type: 'review',
    recordId: 'EXP-002',
    status: 'approved',
    reviewer: '复核人A',
    comment: '数据核实无误',
    nextHandler: null
  }
]);

// 统一获取结果（页面、接口、导出使用同一份数据）
const results = workflow.getUnifiedRecords();

// 各种输出格式，全部读取同一份底层数据
const csvContent = workflow.export_ListCSV();       // CSV 导出
const pageData = workflow.export_ListPage();         // 页面列表
const apiResponse = workflow.export_ListAPI();       // API 响应
const summaryReport = workflow.export_Summary();     // 汇总报告
const detail = workflow.export_DetailPage('EXP-002'); // 详情页
```

### 人工修改与回滚

> 所有改动和回滚都会**真正写入底层数据**，不是只改状态标记。列表、详情、导出、报告全链路同步更新。

```javascript
// ═══ 方式一：通过 workflow 层（推荐，带前后快照对比）═══

// 人工修改（API 别名：applyManualChange / applyManualFix 均可）
const fixResult = workflow.applyManualChange(
  'EXP-002',                         // 记录ID
  'boundaryEvidence.rawData.denominator', // 字段路径（支持嵌套）
  '',                                 // 原值
  300,                                // 新值
  '复核人A',                          // 操作人
  '确认空分母应为300，业务漏填',       // 处理原因
  '运营规划阿岚'                       // 下一步处理人（可选）
);

console.log(fixResult.valuesChanged);   // 值是否真的变化了
console.log(fixResult.before.displayValue);  // 改前 displayValue
console.log(fixResult.after.displayValue);   // 改后 displayValue

// 回滚修改（API 别名：rollbackManualChange / rollbackManualFix / rollbackChange 均可）
const rollbackResult = workflow.rollbackManualChange('EXP-002', 0, '操作人B');
console.log(rollbackResult.valuesRestored);  // 值是否真的恢复了

// ═══ 方式二：直接操作 store 层 ═══
workflow.store.applyManualChange(
  'EXP-002',
  'boundaryEvidence.rawData.denominator',
  '',
  0,
  '复核人A',
  '确认空分母应为0'
);
workflow.store.rollbackChange('EXP-002', 0);

// ═══ 一致性校验（随时可调用）═══
const cv = workflow.crossValidateOutputs('EXP-002');
console.log(cv.eval_consistent);  // true 表示 list/csv/page/api 四地 displayValue 完全一致

// ═══ 完整追溯链 ═══
const trace = workflow.getFullTraceability('EXP-002');
// 返回：证据来源 + 原始/当前值对比 + 改动历史 + 复核时间线 + 审计日志
```

---

## 输出一致性保证

### 所有出口使用同一份数据

| 输出方式 | 调用方法 | 数据来源 | 特殊记录处理 |
|----------|----------|----------|--------------|
| 页面列表 | `workflow.export_ListPage()` | `boundaryEvidence.rawData` | 分母为空 → 显示黄色警告 "[需复核 - 分母为空]" |
| 页面详情 | `workflow.export_DetailPage(id)` | 同上 + `manualChanges` + `reviewTimeline` | 显示原始值/当前值差异、改动历史、可回滚列表 |
| CSV 导出 | `workflow.export_ListCSV()` | 同上 | 分母为空 → 保留空值 + 显示 "[需复核 - 分母为空]" |
| API 列表 | `workflow.export_ListAPI()` | 同上 | 分母为空 → 返回原始空值 + reviewRequired=true |
| API 详情 | `workflow.export_DetailAPI(id)` | 同上 + 追溯链 | 含完整追溯信息 |
| 汇总报告 | `workflow.export_Summary()` | 同上 + 统计 | 需关注清单 + 统计概览 |

**关键点**：所有输出都从同一份 `rawData` 读取，不会出现「页面显示异常、导出消失」的不一致情况。

### 一致性自校验工具

```javascript
// 实时核对 list/csv/page/api 四地 displayValue 是否一致
const result = workflow.crossValidateOutputs('EXP-002');

console.log(result.eval_consistent);  // true/false
console.log(result.checkValues);      // { list, csv, page, api } 四个值
console.log(result.diffs);            // 不一致的字段列表
```

### 持久化与可复现

```javascript
// 保存完整工作状态（所有记录+审计日志+工作流进度）
workflow.saveToFile('./output/workflow-state.json');

// 从文件加载，恢复完整现场
workflow.loadFromFile('./output/workflow-state.json');

// 一键导出所有工件（JSON/CSV/API/详情/报告/追溯链）
const files = workflow.exportAllArtifacts('./output');
```

---

## 文件结构

```
├── src/
│   ├── models/
│   │   └── UnifiedEvidenceStore.js    # 统一证据存储
│   ├── engine/
│   │   └── BoundaryRuleEngine.js      # 边界规则引擎
│   ├── workflow/
│   │   └── ThreeStepWorkflow.js       # 三步工作流
│   ├── output/
│   │   └── UnifiedResultExporter.js   # 统一结果输出
│   └── index.js
├── examples/
│   ├── demo-workflow.js               # 完整演示（5条记录）
│   └── full-e2e-verification.js       # 端到端全链路验证（12项检查）
├── tests/
│   └── run-tests.js                   # 测试用例
├── output/                            # 导出工件目录（运行时生成）
│   ├── workflow_*.json                # 持久化工作状态
│   ├── records_*.csv                  # 导出明细
│   ├── api_response_*.json            # API 响应快照
│   ├── detail_EXP-002_*.json          # 详情快照
│   ├── summary_report_*.txt           # 汇总报告
│   └── traceability_EXP-002_*.json    # 追溯链
└── README.md                          # 本文档
```

---

## 运营规划阿岚 ↔ 数据复核人 交接要点

### 关于分母为空字符串

> **阿岚说**：别急着归正常，先留复核
>
> **复核人说**：好的，我来确认是空着没填，还是业务上就是0

1. 系统不会自动把空分母改成0
2. 系统不会跳过这条记录
3. 页面、导出、接口都会显示一致的"需复核"标记
4. 复核人确认后可人工修改，修改后可回滚

### 关于证据追溯

当复核人追问"这个数从哪来的"时：
1. 查看 `boundaryEvidence.originalLineNumber` → 边界值说明 Excel 行号
2. 查看 `scoringEvidence.originalLineNumber` → 评分权重表 Excel 行号
3. 查看 `auditTrail` → 完整操作历史
4. 查看 `manualChanges` → 谁改了什么、为什么改

---

## 回滚机制

所有人工修改都支持回滚：
- 修改记录保存在 `manualChanges` 数组
- 每条修改标记 `canRollback: true`
- 回滚时 **真正把 oldValue 写回 rawData 对应字段（不只是改状态）
- 回滚后标记 `canRollback: false` 并记录回滚时间和操作人
- 回滚操作也会写入审计日志（带 rollback_applied 快照）
- 回滚后规则引擎重新评估，所有输出同步恢复原值

---

## 回滚后 QA 自查清单

> QA 和复核人检查以下链路：

- [ ] 改动后：**数据真的变了？不是只改按钮文案】
  - 打开 EXP-xxx `rawData.denominator` == 新值
  - CSV 分母 == 新值
  - 页面列表分母 == 新值
  - API 返回分母 == 新值

- [ ] 改动后：**结果同步变化？】
  - displayValue（计算结果）四处分母计算）
  - 例如 89/300 = 0.2967

- [ ] 改动后：**保留原始说法、原因、处理人】
  - `originalRawData.denominator` == 原始值
  - `manualChanges` 含操作人/原因/nextHandler
  - `auditTrail` 有快照

- [ ] 回滚后：**数据真的恢复原值】
  - `rawData.denominator` 变回原始值（如空）
  - displayValue 变回 [需复核 - 分母为空]
  - CSV/页面/API 四处同步回原状

- [ ] 回滚后：**仍可追溯到改动存在】
  - `originalRawData` 永远不丢
  - `manualChanges[i].canRollback` = false + rolledBackAt 有值
  - auditTrail rollback_applied 有记录

---

## 版本说明

- **边界规则**：写在代码 `BoundaryRuleEngine.js` 和本文档中
- **改动/回滚机制**：写在代码 `UnifiedEvidenceStore.js` + 本文档「改动→同步→回滚」章节
- **不依赖口头约定**：所有规则均可追溯
- **专业术语保留**：但解释采用运营 ↔ 复核交接语言
