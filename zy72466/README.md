# 垃圾投放点异味投诉处理系统

## 系统概述

本系统用于处理"垃圾投放点异味投诉"数据的全流程管理，确保从夜间采样点导入、居民投诉编号关联、热力图更新到街道规划员复核的全链路数据一致性。

## 核心设计原则

1. **单一数据源**：页面展示、明细导出、API接口返回统一读取同一份数据
2. **证据可追溯**：保留原始行号、操作历史、人工改动记录、字段级diff
3. **异常不消失**：缺采样导致热力图偏低的记录不会自动归为正常，必须人工复核
4. **快照先于修改**：每次操作先拍快照再改字段，回滚时能真正恢复操作前数据
5. **边界规则代码化**：所有判定逻辑写在代码中，不靠口头约定

---

## 核心业务流程

### 标准三步流程

```
夜间采样点导入 → 交通协管关联投诉编号 → 热力图更新 → (可选)街道规划员复核
     ↓                 ↓                       ↓                    ↓
  已导入         已关联投诉            热力图正常/待复核        复核通过
```

### 步骤1：夜间采样点第一次导入

**责任人**：夜间巡查员

**操作**：批量导入夜间采样点数据

**系统行为**：
- 为每条记录分配唯一ID
- 保留**原始行号**（originalRowNumber），用于追溯
- 状态置为 `imported`（已导入）
- 记录导入操作日志，diff记录从空到有

**相关代码**：[ImportService.batchImport](file:///Users/lzy/pro/solo/workspaces/zy72466/src/services/import-service.ts#L83-L107)

---

### 步骤2：交通协管老马补看居民投诉编号

**责任人**：交通协管（如老马）

**操作**：为采样点关联对应的居民投诉编号

**系统行为**：
- 校验投诉编号格式：`/^TS-\d{6,}$/`
- 关联投诉人、投诉时间、投诉内容、备注等信息
- 状态流转为 `complaint_linked`（已关联投诉）
- 已关联的记录不允许重复关联，需回滚后重新操作或使用 `relinkComplaint`
- **快照在字段修改前生成**：snapshotBefore中complaint为空，diff准确记录变更

**相关代码**：
- [ComplaintLinkService.linkComplaint](file:///Users/lzy/pro/solo/workspaces/zy72466/src/services/complaint-link-service.ts#L12-L46)
- [ComplaintLinkService.relinkComplaint](file:///Users/lzy/pro/solo/workspaces/zy72466/src/services/complaint-link-service.ts#L48-L78)（返工修改投诉编号）

---

### 步骤3：热力图更新

**责任人**：系统自动 / 数据录入员

**操作**：更新采样点的异味热力值

**关键边界规则**：

| 场景 | 判定条件 | 系统行为 |
|------|---------|---------|
| 正常采样 | `isMissingSampling = false` | 状态置为 `heatmap_normal`，直接使用实际热力值 |
| 缺采样但值不低 | `isMissingSampling = true` 且 `odorLevel > 2` | 状态置为 `heatmap_normal` |
| **缺采样致偏低** | `isMissingSampling = true` 且 `odorLevel ≤ 2` | **状态置为 `heatmap_pending_review`（待复核），不自动归正常** |

**关于"晚上缺采样导致热力图偏低"的处理**：

- 判定函数：[isMissingSamplingCausingLow](file:///Users/lzy/pro/solo/workspaces/zy72466/src/boundary-rules.ts#L38-L40)
- 阈值配置：`isLowDueToMissingThreshold = 2`
- **核心原则**：缺采样导致的低值不能自动忽略，必须留给街道规划员复核
- 待复核期间，热力图显示值固定为 `1`（而不是实际低值），避免误导

**相关代码**：[HeatmapService.updateHeatmap](file:///Users/lzy/pro/solo/workspaces/zy72466/src/services/heatmap-service.ts#L17-L55)

---

### 步骤4（可选）：街道规划员复核

**责任人**：街道规划员

**操作**：对待复核记录进行人工判定

**系统行为**：
- 仅 `heatmap_pending_review` 状态的记录可复核
- 复核结论二选一：
  - `reviewed_normal`（复核通过-正常）：采信该低值，后续显示实际热力值
  - `reviewed_abnormal`（复核通过-异常）：标记为异常数据，继续显示 `1`
- 记录复核人、复核时间、复核备注

**复核后显示逻辑**：

| 状态 | 是否缺采样 | 显示热力值 |
|------|-----------|-----------|
| 待复核 | 是 | 1 |
| 复核通过-正常 | 是 | 实际 odorLevel |
| 复核通过-异常 | 是 | 1 |
| 热力图正常 | 否 | 实际 odorLevel |

**相关代码**：
- [HeatmapService.reviewHeatmap](file:///Users/lzy/pro/solo/workspaces/zy72466/src/services/heatmap-service.ts#L57-L94)
- [HeatmapService.getDisplayOdorLevel](file:///Users/lzy/pro/solo/workspaces/zy72466/src/services/heatmap-service.ts#L147-L163)

---

### 补录与返工流程

#### 修改投诉备注/误差说明

**责任人**：交通协管、数据录入员

**操作**：修改已关联投诉的备注或误差说明

**系统行为**：
- 使用 `ComplaintLinkService.updateComplaintRemark`
- 产生 `MANUAL_EDIT` 操作日志
- diff记录变更前后值，导出时可见谁改了什么

**相关代码**：[ComplaintLinkService.updateComplaintRemark](file:///Users/lzy/pro/solo/workspaces/zy72466/src/services/complaint-link-service.ts#L80-L103)

#### 修改投诉编号（返工）

**责任人**：交通协管

**操作**：修改已关联的投诉编号

**系统行为**：
- 使用 `ComplaintLinkService.relinkComplaint`
- 产生 `MANUAL_EDIT` 操作日志，备注记录返工原因
- diff记录投诉编号变更前后

**相关代码**：[ComplaintLinkService.relinkComplaint](file:///Users/lzy/pro/solo/workspaces/zy72466/src/services/complaint-link-service.ts#L48-L78)

#### 回滚复核后补录新热力值

**责任人**：交通协管、数据录入员

**操作**：回滚复核后，补录新的采样数据

**系统行为**：
- 使用 `StatusManager.executeManualEdit` 修改热力值
- 产生 `MANUAL_EDIT` 日志，备注记录补录原因
- 状态保持 `heatmap_pending_review`，等待再次复核

---

## 统一数据读取机制

### 三处同构

**页面列表、明细导出、API接口**均通过 `UnifiedDataService` 读取同一份数据：

| 用途 | 方法 | 说明 |
|------|------|------|
| 页面列表 | [getPageList](file:///Users/lzy/pro/solo/workspaces/zy72466/src/services/unified-data-service.ts#L417-L437) | 分页查询 |
| 热力图展示 | [getForHeatmapDisplay](file:///Users/lzy/pro/solo/workspaces/zy72466/src/services/unified-data-service.ts#L141-L170) | 包含计算后的显示热力值、来源、结论 |
| CSV导出 | [exportToCSV](file:///Users/lzy/pro/solo/workspaces/zy72466/src/services/unified-data-service.ts#L327-L348) | 标准导出格式 |
| 变更日志CSV | [exportChangeLogsCSV](file:///Users/lzy/pro/solo/workspaces/zy72466/src/services/unified-data-service.ts#L350-L415) | 所有操作记录含字段级diff |
| 统计概览 | [getStatistics](file:///Users/lzy/pro/solo/workspaces/zy72466/src/services/unified-data-service.ts#L457-L489) | 各状态数量统计 |
| 单条详情 | [getRecordWithDetail](file:///Users/lzy/pro/solo/workspaces/zy72466/src/services/unified-data-service.ts#L439-L455) | 含来源、结论、变更人、diff |

### 导出字段定义

共28个导出字段，包括：
- 原始行号、数据来源（含"夜间采样点主材料"标记）
- 采样点基础信息
- 投诉关联信息（含备注/误差说明）
- 热力图数据（含原始值、显示值、缺采样标记）
- 处理状态、处理结论说明（同屏展示来源、状态、结论）
- 复核信息（复核人、时间、备注）
- 最后修改人、最后修改操作、最后修改时间
- 本次变更字段、本次变更前后值
- 完整变更历史

完整字段列表：[UnifiedDataService.getExportFields](file:///Users/lzy/pro/solo/workspaces/zy72466/src/services/unified-data-service.ts#L172-L325)

---

## 状态流转规则

### 状态枚举

| 状态值 | 显示标签 | 说明 |
|--------|---------|------|
| `imported` | 已导入 | 采样点刚导入，未关联投诉 |
| `complaint_linked` | 已关联投诉 | 已关联居民投诉编号 |
| `heatmap_pending_review` | 待复核 | 缺采样致偏低，等街道规划员复核 |
| `heatmap_normal` | 热力图正常 | 热力值正常，无需复核 |
| `reviewed_normal` | 复核通过-正常 | 复核后判定为正常数据 |
| `reviewed_abnormal` | 复核通过-异常 | 复核后判定为异常数据 |
| `archived` | 已归档 | 流程结束 |

### 允许的流转路径

```
imported → complaint_linked → heatmap_normal → reviewed_normal → archived
        ↘ heatmap_pending_review → reviewed_abnormal ↗
                           ↗
imported → heatmap_normal / heatmap_pending_review（可跳过关联投诉直接更新热力图）
```

配置位置：[BoundaryRules.status.canTransition](file:///Users/lzy/pro/solo/workspaces/zy72466/src/boundary-rules.ts#L10-L18)

---

## 证据留存与回滚机制

### 操作历史留存

每条记录的所有状态变更都记录在 `statusLogs` 中，包含：
- 操作前后状态
- 操作类型
- 操作人
- 操作时间
- 操作备注
- **操作前数据快照**（snapshotBefore）——在字段修改前拍摄
- **变更字段列表**（fieldsChanged）
- **字段级diff**（diff）：每个变更字段的前后值

查询历史：[StatusManager.getOperationHistory](file:///Users/lzy/pro/solo/workspaces/zy72466/src/services/status-manager.ts#L269-L271)

### 快照机制（关键修复点）

**问题**：旧版本中业务服务先改字段再调 `transitionStatus`，导致 `snapshotBefore` 拍的是操作后的数据，回滚形同虚设。

**修复**：引入 `executeWithTransition` 原子操作模式：
1. 从数据源获取记录
2. **立即深拷贝作为snapshotBefore**（此时字段还是操作前状态）
3. 执行mutator修改字段
4. 计算diff
5. 保存记录和日志

**相关代码**：[StatusManager.executeWithTransition](file:///Users/lzy/pro/solo/workspaces/zy72466/src/services/status-manager.ts#L98-L137)

### 回滚机制

支持对指定操作进行回滚：

**限制条件**：
- 仅支持回滚：关联投诉、更新热力图、复核热力图
- 回滚时限：操作后24小时内
- 回滚后产生新的操作日志，记录回滚行为

**回滚行为**：
- 从 `snapshotBefore` 恢复记录数据（状态和字段都恢复）
- 截断该操作之后的所有日志
- 产生 `ROLLBACK` 日志，包含回滚影响的字段列表

**回滚方法**：[StatusManager.rollbackToLog](file:///Users/lzy/pro/solo/workspaces/zy72466/src/services/status-manager.ts#L171-L267)

### 回滚后可重新操作

回滚关联投诉后：
- `complaint` 字段真的清空
- 状态回到 `imported`
- 可正常再次 `linkComplaint`，不会报"该记录已关联投诉编号"

---

## 边界规则配置清单

所有可配置的边界参数集中在 [boundary-rules.ts](file:///Users/lzy/pro/solo/workspaces/zy72466/src/boundary-rules.ts) 中：

### 热力图相关
```
heatmap.normalLevelMin = 3          // 正常热力值下限
heatmap.normalLevelMax = 10         // 正常热力值上限
heatmap.missingSamplingDisplayLevel = 1  // 缺采样待复核时显示值
heatmap.isLowDueToMissingThreshold = 2   // 缺采样致偏低阈值
```

### 复核相关
```
review.requiredRoles = ['street_planner']  // 复核所需角色
review.autoPendingWhenMissing = true       // 缺采样低值自动待复核
```

### 回滚相关
```
rollback.allowedWindowHours = 24    // 回滚时限（小时）
rollback.allowedOperations = [...]  // 允许回滚的操作类型
```

### 校验相关
```
validation.complaintIdPattern = /^TS-\d{6,}$/  // 投诉编号格式
validation.pointIdPattern = /^P\d{4,}$/        // 采样点编号格式
```

---

## 目录结构

```
src/
├── types.ts                    # 类型定义（含FieldDiff）
├── boundary-rules.ts           # 边界规则配置
├── store.ts                    # 统一数据存储
├── utils.ts                    # 工具函数
├── index.ts                    # 统一导出入口
├── services/
│   ├── status-manager.ts       # 状态管理与回滚（原子操作+diff）
│   ├── import-service.ts       # 采样点导入
│   ├── complaint-link-service.ts  # 投诉编号关联+返工
│   ├── heatmap-service.ts      # 热力图处理与复核+返工
│   └── unified-data-service.ts # 统一数据查询/导出（含变更日志）
└── test-flow.ts                # 14场景端到端回归测试
```

---

## 快速开始

```bash
# 安装依赖
npm install

# 运行完整流程测试（14个场景）
npm test
```

测试覆盖：导入→关联投诉→回滚关联→重新关联→热力图更新→修改备注→复核→三处同数据源验证→CSV导出→夜间采样点核对→证据链追溯→快照验证→回滚复核→补录返工→最终复核

---

## 常见问题处理

### Q1：发现投诉编号关联错了怎么办？
A：使用 `StatusManager.rollbackToLog` 回滚到关联操作之前，然后重新关联。回滚后complaint字段真正清空，可正常再次linkComplaint。或直接使用 `relinkComplaint` 返工修改。

### Q2：缺采样导致的低值，复核时应该怎么判？
A：
- 如果确认是设备故障导致缺采样，但现场实际正常 → 选"正常"
- 如果缺采样且现场情况不明 → 选"异常"，后续跟进

### Q3：导出的数据和页面显示不一致？
A：系统设计上三处共用数据源。如出现不一致，请检查是否使用了 `UnifiedDataService` 以外的读取方式。

### Q4：如何追溯某条记录的来源？
A：查看 `originalRowNumber` 字段，对应导入文件的原始行号；再配合 `statusLogs` 查看完整操作历史。导出CSV中"数据来源"列会标注"夜间采样点主材料（第N行）"。

### Q5：回滚后投诉编号字段还在怎么办？
A：这是已修复的bug。旧版本快照在字段修改后生成，回滚只恢复状态不恢复字段。新版本使用 `executeWithTransition` 原子操作，快照在修改前拍摄，回滚后字段和状态都真正恢复。

### Q6：修改备注/误差说明后，导出能看出来谁改了什么吗？
A：可以。导出CSV包含"最后修改人"、"本次变更字段"、"本次变更前后值"、"完整变更历史"列。单独的变更日志CSV（`exportChangeLogsCSV`）更详细，列出每条操作的diff。

### Q7：夜间采样点记录和缺采样偏低记录怎么对上？
A：导出CSV的"数据来源"列同时标注"夜间采样点主材料"和"缺采样致热力图偏低"，一条记录的来源、处理状态和结论在同一行可见。
