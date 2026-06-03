# 冷链库温区三维分层系统

## 项目概述

本系统用于冷链库温区的三维分层管理，支持CAD图层导入、测距仪记录关联、温区边界校验、3D可视化展示以及完整的工作流管理。

---

## 边界规则（Boundary Rules）

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

---

## 补录路线处理规则

### 判断条件

**补录路线未重新计算长度的判定：**
- `lengthRecalculated === false` 时，标记为"未重新计算"
- 新建路线后未调用 `recalculateLength()` 方法
- 修改路线坐标点后未重新计算长度

### 处理流程

```
检测到未重新计算长度
    ↓
1. 显示友好提示："补录路线未重新计算长度，请先确认测距仪记录后再继续"
2. 自动标记为：needsCustomerReview = true
3. 状态设置为：customerReviewStatus = 'pending'
4. 阻止后续导出操作，直到复核完成
```

### 修改方法

调用重新计算长度方法：
```javascript
measurementService.recalculateRouteLength(routeId, operator)
```

### 回滚方法

通过历史记录回滚到指定版本：
```javascript
measurementService.historyManager.rollback(snapshotId)
```

---

## CAD图层重复导入防翻倍机制

### 检测原理
系统使用"图层名称 + 排序后的温区列表"生成指纹（fingerprint）：
```javascript
fingerprint = `${layerName}-${sortedZonesJSON}`
```

### 处理结果
- **首次导入**：正常创建记录，指纹加入已导入集合
- **重复导入**：自动跳过，返回友好提示"检测到重复的CAD图层名，系统已自动跳过重复项，未新增温区记录"
- **不会**出现数量翻倍问题

---

## 历史记录与版本对比

### 记录内容
每条历史快照包含：
- `before`：修改前的完整数据
- `after`：修改后的完整数据
- `diff`：具体的字段变更差异
- `timestamp`：操作时间
- `operator`：操作人
- `operation`：操作类型

### 仅修改备注的特殊处理
- 当检测到只修改了 `remark` 字段时
- 历史记录标记为 `update_remark` 操作
- 提示："仅更新了备注信息，温区三维分层数据未变更，历史记录已保存"

### 版本对比
```javascript
// 获取历史记录
const history = temperatureZoneService.getZoneHistory(zoneId)

// 对比两个版本
const comparison = temperatureZoneService.compareZoneVersions(snap1Id, snap2Id)
// 返回差异详情：{ "remark": { "before": "旧备注", "after": "新备注" } }
```

---

## 3D/图表展示与服务复核联动

### 数据溯源机制

在3D视图中点击任意图层时，系统自动追溯原始数据：

```
3D温区点击
    ↓
├─→ 关联CAD图层 (layerId)
│    └─→ 返回：图层名称、导入时间、导入人
└─→ 关联补录路线 (routeId)
     ├─→ 路线详情（坐标点、长度）
     └─→ 关联测距仪记录 (measurementId)
          └─→ 设备号、记录时间、测量点
```

### 复核联动
- 如果关联的补录路线 `lengthRecalculated === false`
- 立即显示提示："补录路线未重新计算长度，请先确认测距仪记录后再继续"
- 提供一键跳转：回到CAD图层或测距仪记录页面

---

## 标准工作流（三步法）

### 整体流程
```
Step 1: CAD图层第一次导入
    ↓
Step 2: 园区运维小陶补看测距仪记录
    ↓ （碰到补录路线未重新计算时）
    ├─→ 标记为待复核
    ├─→ 不急着归正常
    └─→ 留给展陈客户复核
    ↓
Step 3: 导出截图更新（复核全部通过后才能导出）
```

### 详细说明

**Step 1: CAD图层导入**
- 操作员：任何人
- 输入：CAD图层文件/数据
- 校验：重复检测 → 边界校验
- 输出：图层记录 + 指纹缓存

**Step 2: 测距仪记录复核**
- 操作员：园区运维小陶
- 检查项：补录路线长度是否重新计算
- 异常处理：标记 `needsCustomerReview = true`
- **关键规则：即使发现问题，也不自动归为正常，留给客户复核**

**Step 3: 导出截图**
- 前置检查：所有待复核的路线必须完成复核
- 检查不通过：提示"存在待复核的补录路线，请先完成客户复核后再导出截图"
- 检查通过：正常导出

---

## 错误提示对照表

| 错误码 | 提示文本 | 触发场景 |
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

---

## 快速开始

### 安装依赖
```bash
npm install
```

### 运行演示
```bash
node src/controllers/WorkflowController.js
```

### 运行测试
```bash
npm test
```

### 查看边界规则
```bash
node src/index.js
```

---

## 核心模块说明

| 模块 | 文件 | 功能 |
|------|------|------|
| CAD图层服务 | [CADLayerService.js](file:///Users/lzy/pro/solo/workspaces/zy72295/src/services/CADLayerService.js) | 导入、重复检测、历史记录 |
| 测量服务 | [MeasurementService.js](file:///Users/lzy/pro/solo/workspaces/zy72295/src/services/MeasurementService.js) | 测距仪记录、补录路线管理 |
| 温区服务 | [TemperatureZoneService.js](file:///Users/lzy/pro/solo/workspaces/zy72295/src/services/TemperatureZoneService.js) | 温区创建、边界校验、版本对比 |
| 可视化服务 | [VisualizationService.js](file:///Users/lzy/pro/solo/workspaces/zy72295/src/services/VisualizationService.js) | 3D视图、数据溯源 |
| 导出服务 | [ExportService.js](file:///Users/lzy/pro/solo/workspaces/zy72295/src/services/ExportService.js) | 导出控制、工作流检查 |
| 错误工具 | [errors.js](file:///Users/lzy/pro/solo/workspaces/zy72295/src/utils/errors.js) | 友好错误提示 |
| 历史管理 | [history.js](file:///Users/lzy/pro/solo/workspaces/zy72295/src/utils/history.js) | 快照、差异对比、回滚 |

---

## 维护说明

- 所有边界规则定义在 [TemperatureZone3D.js](file:///Users/lzy/pro/solo/workspaces/zy72295/src/models/TemperatureZone3D.js#L3-L13) 的 `BOUNDARY_RULES` 常量中
- 所有错误提示定义在 [errors.js](file:///Users/lzy/pro/solo/workspaces/zy72295/src/utils/errors.js#L1-L11) 的 `ERROR_MESSAGES` 常量中
- 修改规则请同步更新本文档
