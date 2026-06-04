# 水槽波浪衰减实验 · 边界规则引擎

本文档定义了"水槽波浪衰减实验"数据管理系统的所有边界规则。

## 1. 摄氏度与开尔文混用判定规则

### 1.1 判定条件

同一批次导入中，当**同一传感器编号**下存在**两种不同温度单位**（°C 和 K）的记录时，触发混用判定。

### 1.2 判定阈值

- 单位不一致的记录数量 ≥ 1 即触发
- 不分比例，只要存在混用即标记
- 仅在同一 `sensor_id` 范围内判定

### 1.3 自动检测逻辑（位于 [recordService.ts](file:///Users/lzy/pro/solo/workspaces/zy72356/api/services/recordService.ts#L57-L69)）

```typescript
// 1. 收集每个传感器编号下的所有单位
const sensorUnits = new Map<string, Set<string>>()
for (const p of parsed) {
  if (!sensorUnits.has(p.sensorId)) {
    sensorUnits.set(p.sensorId, new Set())
  }
  sensorUnits.get(p.sensorId)!.add(p.temperatureUnit)
}

// 2. 找出单位不唯一的传感器编号
const mixedSensorIds = new Set<string>()
for (const [sensorId, units] of sensorUnits) {
  if (units.size > 1) {
    mixedSensorIds.add(sensorId)
  }
}
```

### 1.4 单位自动推断（位于 [recordService.ts](file:///Users/lzy/pro/solo/workspaces/zy72356/api/services/recordService.ts#L34-L44)）

- 明确标注 °C / C / Celsius → 摄氏度
- 明确标注 K / Kelvin → 开尔文
- 未标注但数值 > 100 → 开尔文
- 未标注且数值 ≤ 100 → 摄氏度

### 1.5 处理结果

- 触发混用的所有记录 `status = 'mixed_unit'`（混用待复核）
- 不自动转换单位
- 不自动归类为"正常"
- 必须由**训练教练**最终确认

---

## 2. 修改流程规则

### 2.1 角色权限

| 角色 | 操作 | 权限 |
|------|------|------|
| 实验工程师 | 导入数据 | ✅ |
| 实验工程师 | 标注可信度 | ❌ |
| 维修师傅 | 标注"传感器可信" | ✅ |
| 维修师傅 | 标注"照片可信"（含修正值） | ✅ |
| 维修师傅 | 标注"待确认" | ✅ |
| 维修师傅 | 确认状态 | ❌ |
| 维修师傅 | 回滚 | ❌ |
| 训练教练 | 标注可信度 | ✅ |
| 训练教练 | 确认状态 | ✅ |
| 训练教练 | 回滚至原始值 | ✅ |

### 2.2 状态流转

```
导入 → normal / mixed_unit
         ↓
   维修师傅标注
         ↓
   credibility 变更:
   - sensor_trusted (传感器可信)
   - photo_trusted (照片可信，需提供修正值)
   - pending_confirmation (待确认)
         ↓
   训练教练操作:
   ├─ 确认 → status = confirmed, source = coach_confirmed
   └─ 回滚 → status = rolled_back, source = rolled_back
```

### 2.3 数据来源标记（`source` 字段）

- `sensor_original`：传感器原始值，未经过任何修改
- `photo_corrected`：维修师傅根据工况照片修正
- `coach_confirmed`：训练教练已确认
- `rolled_back`：已回滚至原始值

---

## 3. 回滚规则

### 3.1 回滚条件

- 仅训练教练可执行回滚
- 必须填写回滚原因（非空校验）
- 可在任何状态下回滚

### 3.2 回滚操作效果（位于 [recordService.ts](file:///Users/lzy/pro/solo/workspaces/zy72356/api/services/recordService.ts#L161-L182)）

- `corrected_value` → NULL
- `corrected_unit` → NULL
- `status` → `rolled_back`
- `source` → `rolled_back`
- `credibility` → NULL
- `note` → 回滚原因
- 审计日志记录原值→新值

### 3.3 回滚后

数据回到原始传感器读数状态，但保留所有历史操作记录，永不丢失证据链。

---

## 4. 数据一致性规则

### 4.1 单一数据源原则

**导出明细、页面展示、接口返回，必须读取同一份数据库记录。**

- 禁止在前端做二次计算
- 禁止在 API 层做临时转换
- 所有状态和修正值以数据库为准
- 温度显示优先级：`corrected_value` > `temperature_value`

### 4.2 实现位置

- 显示逻辑统一在 `displayValue()` / `displayUnit()` 函数
- 前端和后端使用相同逻辑
- CSV 导出直接查询数据库，不经过前端处理

---

## 5. 审计日志规则

### 5.1 必须记录的操作（位于 [auditService.ts](file:///Users/lzy/pro/solo/workspaces/zy72356/api/services/auditService.ts)）

| 操作类型 | 触发时机 | 记录内容 |
|----------|----------|----------|
| `import` | 数据导入时 | 导入值 |
| `review` | 标注可信度/修改时 | 原值 → 新值 |
| `confirm` | 教练确认时 | 状态变更 |
| `rollback` | 回滚时 | 原值 → 新值 + 回滚原因 |
| `edit` | 编辑时 | 原值 → 新值 |

### 5.2 日志字段

- `operator_role`：操作人角色（不可伪造，来自系统当前角色）
- `old_value`：操作前值（JSON 格式可包含多个字段）
- `new_value`：操作后值
- `note`：备注/原因
- `created_at`：操作时间

---

## 6. 交接报告规则

### 6.1 数据来源标注

报告中每条数据必须标注数据来源：

| 来源标签 | 颜色 | 含义 |
|----------|------|------|
| 传感器原始 | 灰 | 未经过修改 |
| 照片修正 | 靛 | 维修师傅根据照片修正 |
| 教练确认 | 绿 | 训练教练已确认 |
| 已回滚 | 灰 | 已回滚至原始值 |

### 6.2 待确认提醒

- 所有 `credibility = pending_confirmation` 的记录在报告中用橙色高亮
- 快速查阅面板顶部显示待确认数量
- 按传感器分组时，有待确认记录的组显示警告图标

### 6.3 十分钟临会友好

- 报告顶部一屏即可看到关键统计
- 按传感器分组可折叠/展开
- 颜色编码一目了然

---

## 7. 规则修改流程

**重要：任何规则修改必须同时更新以下三处：**

1. 本文档（`BOUNDARY_RULES.md`）
2. 后端代码（`api/services/recordService.ts`）
3. README.md 中的规则摘要

禁止只改代码不改文档，禁止口头约定规则。
