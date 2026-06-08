# 冷链库温区三维分层系统

## 项目概述

本系统用于冷链库温区的三维分层管理，支持CAD图层导入、测距仪记录关联、温区边界校验、3D可视化展示以及完整的工作流管理。核心目标：把口头约定变成明面上的返工留痕。

---

## 一、历史记录排序与暂停续局机制

### 根因修复

**之前问题**：`getHistory()` 仅按 `timestamp`（毫秒精度）排序，同一毫秒内的 create 和 update 操作顺序不稳定，导致 `history[0]` 可能取到 create 而非 update，用户看到"最新记录"错了。

**修复方案**：引入全局单调自增操作序号 `seq`（monotonic counter）。

代码参考：[history.js#L3-L6](file:///Users/lzy/pro/solo/workspaces/zy72295/src/utils/history.js#L3-L6)
```javascript
class HistoryManager {
  constructor() {
    this.history = [];
    this._seq = 0;  // 单调自增序号
  }
  createSnapshot(...) {
    const seq = ++this._seq;  // 每次创建快照自增
    snapshot.seq = seq;
    ...
  }
  getHistory(entityId, limit = 10) {
    return this.history
      .filter(h => h.entityId === entityId)
      .sort((a, b) => b.seq - a.seq)  // 用seq降序，绝对稳定
      .slice(0, limit);
  }
}
```

### 暂停续局保证

同一系统实例反复操作（暂停→续局），`seq` 只增不减，历史记录的相对顺序绝对稳定，导出检查、客户复核状态一致延续。

---

## 二、边界规则（Boundary Rules）

### 温区边界约束
| 规则项 | 约束值 | 说明 |
|--------|--------|------|
| MAX_TEMPERATURE_DIFF | 15°C | 单一温区最大温差 |
| MIN_ZONE_HEIGHT | 0.5m | 温区最小高度 |
| MAX_ZONE_HEIGHT | 10m | 温区最大高度 |
| OVERLAP_THRESHOLD | 5% | 温区重叠超过此比例视为违规 |

### 冷链库坐标范围
```
X轴: 0 - 100m
Y轴: 0 - 100m
Z轴: 0 - 20m
```

### 违规处理
- 超出边界的温区无法创建或更新
- 重叠超过5%的温区会被阻止
- 所有违规操作都有友好的中文提示

代码参考：[TemperatureZone3D.js#L3-L13](file:///Users/lzy/pro/solo/workspaces/zy72295/src/models/TemperatureZone3D.js#L3-L13)

---

## 三、补录路线处理规则（怎么判 / 怎么改 / 怎么回滚）

### 怎么判 — 判断条件

**补录路线未重新计算长度的判定：**
- `lengthRecalculated === false` → 未重新计算
- 新建路线后未调用 `recalculateLength()` → 标记
- 修改坐标点后未重新计算 → 标记

### 怎么改 — 修改方法

```javascript
// 重新计算长度
measurementService.recalculateRouteLength(routeId, operator)
// 完成客户复核（通过才归正常，不提前归正常）
measurementService.completeCustomerReview(routeId, operator, approved, remark)
```

### 怎么回滚 — 回滚方法

```javascript
// 1. 通过历史快照回滚
const data = historyManager.rollback(snapshotId)
// 2. 温区服务带操作人回滚
temperatureZoneService.rollbackZone(zoneId, snapshotId, operator)
```

### 处理流程（不提前归为正常）

```
检测到未重新计算长度
    ↓
1. 友好提示："补录路线未重新计算长度，请先确认测距仪记录后再继续"
2. needsCustomerReview = true
3. customerReviewStatus = 'pending'
4. status = 'reviewing'（≠ 'normal'）
5. 阻止导出直到完成客户复核
```

**即使重新计算了长度但客户没批准，也不归为 normal**（reviewing → 只有approved后才变normal）。

代码参考：[MeasurementService.js#L61-L109](file:///Users/lzy/pro/solo/workspaces/zy72295/src/services/MeasurementService.js#L61-L109)

---

## 四、CAD图层重复导入防翻倍机制

### 检测原理
系统使用"图层名称 + 排序后的温区列表"生成指纹：
```javascript
fingerprint = `${layerName}-${sortedZonesJSON}`
```

### 处理结果
- **首次导入**：正常创建，指纹加入已导入集合
- **重复导入**：自动跳过，提示："检测到重复的CAD图层名，系统已自动跳过重复项，未新增温区记录"
- **不会**出现数量翻倍

代码参考：[CADLayerService.js#L12-L54](file:///Users/lzy/pro/solo/workspaces/zy72295/src/services/CADLayerService.js#L12-L54)

---

## 五、历史记录数据结构（原始说法 / 改后值 / 原因 / 下一步 / 需复核）

每条快照都包含 `context` 字段，结构如下：

```javascript
{
  seq: 3,                              // 全局单调序号（排序用）
  operation: 'update_remark',          // 操作类型
  operator: '小陶',                    // 操作人
  timestamp: '2026-06-08T16:52:21.877Z',
  before: { ... },                     // 改前完整数据
  after:  { ... },                     // 改后完整数据
  diff:   { 'remark': { before: '', after: '小陶备注：...' } },  // 具体字段差异
  context: {                           // ✅ 新增：完整上下文
    originalValue: { remark: '' },           // 原始说法
    changedValue:  { remark: '小陶备注：...' },// 改后的值
    reason: '运维人员修改备注',                // 处理原因
    nextStep: '备注已更新，温区三维分层数据未变更', // 下一步找谁 / 做什么
    reviewRequired: false                     // 是否需要复核，不提前归为正常
  }
}
```

### 仅修改备注的特殊处理
- 检测到只改 `remark` 字段时：
  - `operation = 'update_remark'`
  - `context.reason = '运维人员修改备注'`
  - `context.reviewRequired = false`
  - 提示："仅更新了备注信息，温区三维分层数据未变更，历史记录已保存"

### 历史上改前改后怎么看

```javascript
// 列表：getZoneHistory / getRouteHistory / getLayerHistory
const history = temperatureZoneService.getZoneHistory(zoneId);
// history[0] 是最新的，按seq降序，绝对稳定

// 详情：getZoneDetail 自动提取 remarkDiff 展示
const detail = temperatureZoneService.getZoneDetail(zoneId);
// detail.remarkDiff = [{ 改前, 改后, 时间, 操作人, context... }, ...]

// 两条版本对比
const comparison = temperatureZoneService.compareZoneVersions(snap1, snap2);
// comparison.diff = { 逐字段差异 }
```

代码参考：[TemperatureZoneService.js#L147-L164](file:///Users/lzy/pro/solo/workspaces/zy72295/src/services/TemperatureZoneService.js#L147-L164)

---

## 六、3D/图表展示与服务复核联动

### 数据溯源机制（点击温区 → 追溯到原始CAD图层和测距仪记录，不只剩漂亮画面）

```
3D温区点击
    ↓
├─→ 关联CAD图层 (layerId)
│    └─→ 返回：图层名称、导入时间、导入人、图层详情
└─→ 关联补录路线 (routeId)
     ├─→ 路线详情（坐标点、长度、复核状态）
     └─→ 关联测距仪记录 (measurementId)
          └─→ 设备号、记录时间、测量点
```

### 复核联动（未完成复核时不只剩漂亮画面）
- 若路线 `lengthRecalculated === false`：
  - 立即提示："补录路线未重新计算长度，请先确认测距仪记录后再继续"
  - 返回 `reviewContext.issue / originalValue / nextStep`
- 若路线 `needsCustomerReview === true`：
  - 提示："该路线正处于客户复核中，请勿提前归为正常"

### 一键导航回到数据源
- `navigateToCADLayer(viewId, zoneId)` → 回到CAD图层详情
- `navigateToMeasurement(viewId, zoneId)` → 回到测距仪记录+路线详情

代码参考：[VisualizationService.js#L45-L132](file:///Users/lzy/pro/solo/workspaces/zy72295/src/services/VisualizationService.js#L45-L132)

---

## 七、标准工作流（三步法 + 同一条记录全链路更新）

### 整体流程
```
Step 1: CAD图层第一次导入
    ↓
Step 2: 园区运维小陶补看测距仪记录
    ↓ （碰到补录路线未重新计算时）
    ├─→ 标记 needsCustomerReview = true
    ├─→ status = 'reviewing'（不提前归为 normal）
    └─→ 留给展陈客户复核
    ↓
Step 3: 导出截图更新（全部复核通过后才能导出）
```

### 全链路同一条记录更新（摘要/详情/列表/历史/导出 全部一致）

**每次更新温区或路线时，以下接口读取同一条最新记录，数据全部一致：**

| 接口 | 说明 | 文件 |
|------|------|------|
| `getZoneById(id)` | 原始实体 | [TemperatureZoneService.js#L107-L109](file:///Users/lzy/pro/solo/workspaces/zy72295/src/services/TemperatureZoneService.js#L107-L109) |
| `getZoneSummary(id)` | 列表/卡片用摘要（含latestOperation+context） | [TemperatureZoneService.js#L119-L145](file:///Users/lzy/pro/solo/workspaces/zy72295/src/services/TemperatureZoneService.js#L119-L145) |
| `getZoneDetail(id)` | 详情页用（含完整历史+备注变更+路线） | [TemperatureZoneService.js#L151-L164](file:///Users/lzy/pro/solo/workspaces/zy72295/src/services/TemperatureZoneService.js#L151-L164) |
| `getZoneHistory(id)` | 历史记录按seq降序 | [TemperatureZoneService.js#L147-L149](file:///Users/lzy/pro/solo/workspaces/zy72295/src/services/TemperatureZoneService.js#L147-L149) |
| `clickZoneInView(view, zone)` | 3D点击→zoneSummary | [VisualizationService.js#L45-L100](file:///Users/lzy/pro/solo/workspaces/zy72295/src/services/VisualizationService.js#L45-L100) |
| `canExportScreenshot()` | 导出前置检查（看route的needsCustomerReview） | [ExportService.js#L10-L40](file:///Users/lzy/pro/solo/workspaces/zy72295/src/services/ExportService.js#L10-L40) |

### 需人工复核的记录保留什么
对于所有 `reviewRequired = true` 或 `needsCustomerReview = true` 的记录：
- ✅ 保留 `originalValue`（原始说法）
- ✅ 保留 `changedValue`（改后的值）
- ✅ 保留 `reason`（处理原因）
- ✅ 保留 `nextStep`（下一步找谁）
- ❌ 不提前把 status 归为 normal
- ❌ 不允许通过导出检查

---

## 八、错误提示对照表

| 错误码 | 提示文本（人话，不含内部字段） | 触发场景 |
|--------|----------|----------|
| CAD_LAYER_DUPLICATE | 检测到重复的CAD图层名，系统已自动跳过重复项，未新增温区记录 | 重复导入相同图层 |
| ROUTE_LENGTH_NOT_RECALCULATED | 补录路线未重新计算长度，请先确认测距仪记录后再继续 | 路线长度未计算 |
| TEMPERATURE_ZONE_INVALID | 温区数据不完整，请检查CAD图层和测距仪记录是否匹配 | 温区边界校验失败 |
| HISTORY_NOT_FOUND | 未找到历史记录，无法进行版本对比 | 历史记录不存在 |
| EXPORT_FAILED_CUSTOMER_REVIEW | 存在待复核的补录路线，请先完成客户复核后再导出截图 | 导出前检查不通过 |
| REMARK_UPDATE_ONLY | 仅更新了备注信息，温区三维分层数据未变更，历史记录已保存 | 只修改备注字段 |
| THREE_D_LINK_BROKEN | 3D展示链接失效，无法追溯到原始CAD图层或测距仪记录 | 溯源失败 |
| DATA_NEEDS_REVIEW | 数据存在异常，已标记为待复核，请勿直接标记为正常 | 异常数据处理 |
| MEASUREMENT_RECORD_MISMATCH | 测距仪记录与CAD图层不匹配，请核对后再导入 | 关联失败 |
| BOUNDARY_RULE_VIOLATION | 违反温区分层边界规则，请检查温区范围是否重叠或超出冷链库 | 边界违规 |

代码参考：[errors.js#L1-L23](file:///Users/lzy/pro/solo/workspaces/zy72295/src/utils/errors.js#L1-L23)

---

## 九、三条关键场景核对说明

### ✅ 场景一：历史记录可查看改前改后差别
- 历史按 `seq` 降序，同毫秒也稳定
- `diff` 字段明确：`{ before, after }`
- `context` 字段完整：`originalValue / changedValue / reason / nextStep / reviewRequired`

### ✅ 场景二：测距仪记录
- 路线创建 → 补录标记为待复核 → status = reviewing
- 重新计算长度（客户未通过）：仍保持 reviewing，不提前归 normal
- 客户拒绝 → status = rejected，needsCustomerReview 仍 true
- 客户通过 → status = normal，needsCustomerReview = false

### ✅ 场景三：小陶只改一条备注，全链路一致
- `getZoneById` → `remark` 最新
- `getZoneSummary` → `remark / latestOperation.context` 最新
- `getZoneDetail` → `zone.remark / remarkDiff[0]` 最新
- `getZoneHistory[0]` → `after.remark / diff.remark.after` 最新
- `3D点击 zoneSummary.remark` → 最新
- `canExportScreenshot` → remark-only不触发阻挡，结果一致

---

## 十、快速开始

### 安装依赖
```bash
npm install
```

### 运行完整工作流演示（三步法+备注修改+复核+导出）
```bash
node src/controllers/WorkflowController.js
```

### 运行测试（11项，包含三条关键场景）
```bash
npm test
```

### 查看边界规则
```bash
node src/index.js
```

---

## 十一、核心模块说明

| 模块 | 文件 | 功能 |
|------|------|------|
| CAD图层服务 | [CADLayerService.js](file:///Users/lzy/pro/solo/workspaces/zy72295/src/services/CADLayerService.js) | 导入、重复检测、历史记录 |
| 测量服务 | [MeasurementService.js](file:///Users/lzy/pro/solo/workspaces/zy72295/src/services/MeasurementService.js) | 测距仪记录、补录路线、客户复核（不提前归正常）|
| 温区服务 | [TemperatureZoneService.js](file:///Users/lzy/pro/solo/workspaces/zy72295/src/services/TemperatureZoneService.js) | 温区创建、边界校验、版本对比、摘要/详情一致 |
| 可视化服务 | [VisualizationService.js](file:///Users/lzy/pro/solo/workspaces/zy72295/src/services/VisualizationService.js) | 3D视图、数据溯源、复核联动 |
| 导出服务 | [ExportService.js](file:///Users/lzy/pro/solo/workspaces/zy72295/src/services/ExportService.js) | 导出控制、三步工作流检查 |
| 错误工具 | [errors.js](file:///Users/lzy/pro/solo/workspaces/zy72295/src/utils/errors.js) | 友好错误提示 |
| 历史管理 | [history.js](file:///Users/lzy/pro/solo/workspaces/zy72295/src/utils/history.js) | seq序号排序、diff、context、回滚 |

---

## 十二、维护说明

- **边界规则**：定义在 [TemperatureZone3D.js#L3-L13](file:///Users/lzy/pro/solo/workspaces/zy72295/src/models/TemperatureZone3D.js#L3-L13) `BOUNDARY_RULES`
- **错误提示**：定义在 [errors.js#L1-L11](file:///Users/lzy/pro/solo/workspaces/zy72295/src/utils/errors.js#L1-L11) `ERROR_MESSAGES`
- **历史快照结构**：创建在 [history.js#L9-L35](file:///Users/lzy/pro/solo/workspaces/zy72295/src/utils/history.js#L9-L35)，新增操作时勿忘传 `context`
- **客户复核不提前归 normal**：逻辑在 [SupplementaryRoute.js#L44-L55](file:///Users/lzy/pro/solo/workspaces/zy72295/src/models/SupplementaryRoute.js#L44-L55)
- 修改规则请同步更新本文档
