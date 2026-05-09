# 储能充放电计划 API 使用指南

## 系统概述

这是一个完整的储能电站充放电计划管理后端闭环系统，支持：

- **计划版本管理**：完整的版本快照和历史追溯
- **SOC 约束校验**：充电状态的安全边界控制
- **电价窗口策略**：峰谷电价套利优化
- **执行回执闭环**：实际执行数据反馈
- **偏差告警机制**：异常情况实时感知
- **收益统计分析**：最终收益计算（考虑告警影响）
- **人工修正追踪**：确保统计和历史不矛盾

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 初始化样例数据

```bash
python sample_data.py
```

这会创建：
- 8 个电价窗口（谷、平、尖峰时段）
- SOC 约束（20%-90%，初始 30%）
- 正常充放电计划（3 个时段）
- 自动测试异常拦截、重复操作、人工修正等场景

### 3. 启动服务

```bash
uvicorn main:app --reload --port 8000
```

### 4. 访问 API 文档

打开浏览器访问：http://localhost:8000/docs

## 核心业务流程

### 典型工作流

```
创建计划(draft) → 提交审批(pending) → 审批通过(approved) 
    → 开始执行(executing) → 提交回执 → 自动完成(completed) → 生成收益报表
```

### 状态流转说明

| 状态 | 说明 | 可转换到 |
|------|------|----------|
| draft | 草稿 | pending |
| pending | 待审批 | approved, cancelled |
| approved | 已审批 | executing, manually_corrected, cancelled |
| executing | 执行中 | completed, manually_corrected |
| completed | 已完成 | （终态，不可修改） |
| cancelled | 已取消 | （终态） |
| manually_corrected | 人工修正 | approved, executing, completed |

## 接口使用指南

### 一、基础配置

#### 1. 电价窗口管理

**创建电价窗口**
```
POST /price-windows/
```
请求体：
```json
{
  "start_time": "2024-05-10T00:00:00",
  "end_time": "2024-05-10T06:00:00",
  "price_per_kwh": 0.35,
  "window_type": "谷电",
  "is_charge_window": true,
  "is_discharge_window": false
}
```

**查询电价窗口**
```
GET /price-windows/?is_charge=true
GET /price-windows/?window_type=尖峰
```

#### 2. SOC 约束设置

**创建/更新 SOC 约束**
```
POST /soc-constraints/
```
请求体：
```json
{
  "plan_date": "2024-05-10",
  "min_soc": 20.0,
  "max_soc": 90.0,
  "initial_soc": 30.0,
  "target_soc": 50.0,
  "station_id": "STATION_001"
}
```

**关键点：**
- `min_soc` < `max_soc`，否则报错
- 同一电站同一天只能有一个 SOC 约束（重复提交会更新）
- 计划时段的 SOC 必须始终在 [min_soc, max_soc] 范围内

### 二、计划管理

#### 1. 创建充放电计划

```
POST /plans/?operator=张三
```
请求体：
```json
{
  "station_id": "STATION_001",
  "plan_date": "2024-05-10",
  "plan_name": "峰谷套利计划",
  "description": "低价充电，高价放电",
  "soc_constraint_id": 1,
  "load_forecast_data": {
    "peak_load_kw": 1500,
    "valley_load_kw": 300
  },
  "segments": [
    {
      "start_time": "2024-05-10T00:00:00",
      "end_time": "2024-05-10T06:00:00",
      "operation_type": "charge",
      "power_kw": 500,
      "energy_kwh": 3000,
      "expected_soc": 45.0
    }
  ]
}
```

**创建时的校验：**
1. **SOC 连续性校验**：每个时段结束的 SOC 必须等于下一时段开始的 SOC
2. **边界校验**：所有时段的预期 SOC 必须在 [min_soc, max_soc] 范围内
3. **时间重叠校验**：时段之间不能有时间重叠
4. **重复计划校验**：同一电站同一天不能有多个执行中/已完成的计划

**异常拦截示例：**
- 预期 SOC 超过 90% → 返回 400："时段 X 结束时 SOC 超过最大限制"
- 时段时间重叠 → 返回 400："时段 X 与时段 Y 存在时间重叠"

#### 2. 计划状态操作

**提交审批**
```
POST /plans/{plan_id}/submit?operator=李四
```

**审批通过**
```
POST /plans/{plan_id}/approve?operator=王五
```

**开始执行**
```
POST /plans/{plan_id}/start?operator=赵六
```

**取消计划**
```
POST /plans/{plan_id}/cancel?reason=市场变化&operator=管理员
```

**重复操作会被拦截：**
- 已执行中的计划再次调用 start → 返回 400："计划已在执行中，重复操作"
- 已取消的计划再次取消 → 返回 400："计划已取消，重复操作"
- 已完成的计划无法取消 → 返回 400："已完成的计划不能取消"

#### 3. 人工修正

当计划需要人工干预时：

```
POST /plans/manual-correct
```
请求体：
```json
{
  "plan_id": 1,
  "target_status": "manually_corrected",
  "reason": "设备故障，需要调整计划",
  "corrected_by": "运维管理员",
  "correction_data": {
    "fault_device": "PCS_002",
    "estimated_recovery": "2小时"
  }
}
```

**修正后的影响：**
1. 计划版本号 +1
2. 自动创建版本快照（保存修正前的完整状态）
3. 记录历史变更（可追溯）
4. 后续统计基于最新版本，但历史查询可看到完整变更轨迹

#### 4. 历史和版本查询

**查看状态变更历史**
```
GET /plans/{plan_id}/history
```
返回按时间顺序的所有状态变更：
```json
[
  {
    "action": "创建计划",
    "old_status": null,
    "new_status": "draft",
    "operator": "张三",
    "created_at": "2024-05-10T10:00:00"
  },
  {
    "action": "人工修正",
    "old_status": "executing",
    "new_status": "manually_corrected",
    "operator": "运维管理员",
    "reason": "设备故障，需要调整计划",
    "created_at": "2024-05-10T14:30:00"
  }
]
```

**查看版本快照**
```
GET /plans/{plan_id}/versions
```
返回所有版本，包含完整的计划数据快照：
```json
[
  {
    "version_number": 1,
    "status": "draft",
    "change_reason": "初始版本",
    "snapshot_data": {
      "plan_name": "峰谷套利计划",
      "segments": [...]
    }
  },
  {
    "version_number": 2,
    "status": "executing",
    "change_reason": "人工修正: 设备故障，需要调整计划"
  }
]
```

### 三、执行与监控

#### 1. 提交执行回执

```
POST /execution-receipts/
```
请求体：
```json
{
  "plan_id": 1,
  "segment_id": 1,
  "actual_start_time": "2024-05-10T00:05:00",
  "actual_end_time": "2024-05-10T05:58:00",
  "actual_power_kw": 480,
  "actual_energy_kwh": 2880,
  "actual_soc": 44.5,
  "equipment_status": "available",
  "remarks": "实际运行略有偏差"
}
```

**提交回执时自动触发：**

| 检查项 | 触发条件 | 告警级别 |
|--------|----------|----------|
| SOC 低于下限 | actual_soc < min_soc | CRITICAL |
| SOC 高于上限 | actual_soc > max_soc | CRITICAL |
| 电量偏差 | 偏差 > 10% | WARNING |
| 电量严重偏差 | 偏差 > 20% | CRITICAL |
| 功率偏差 | 偏差 > 10% | WARNING |
| 设备故障 | equipment_status = fault | CRITICAL |
| 设备受限 | equipment_status = limited | WARNING |

**重复提交会被拦截：**
- 同一时段只能提交一次回执
- 第二次提交 → 返回 400："该时段已有执行回执，重复操作"

#### 2. 告警管理

**查询告警**
```
GET /alerts/?plan_id=1&is_resolved=false
GET /alerts/?alert_level=critical
```

**处理告警**
```
POST /alerts/{alert_id}/resolve?resolved_by=运维人员
```

### 四、收益与导出

#### 1. 收益报表

计划完成后自动生成收益报表：

```
GET /revenue-reports/?plan_id=1
```
返回：
```json
{
  "total_charge_kwh": 3000,
  "total_discharge_kwh": 2850,
  "charge_cost": 1050.0,
  "discharge_revenue": 3562.5,
  "net_profit": 2512.5,
  "efficiency_rate": 95.0,
  "deviation_rate": 3.2
}
```

**收益计算说明：**
- 充电成本 = Σ(充电电量 × 对应时段电价)
- 放电收益 = Σ(放电电量 × 对应时段电价)
- 净利润 = 放电收益 - 充电成本 - 告警惩罚
- 效率 = 放电总量 / 充电总量 × 100%
- 每条未处理的 CRITICAL 告警会扣除 100 元惩罚

#### 2. 导出业务复核报表

**导出 CSV**
```
GET /plans/{plan_id}/export/csv
```

**导出 Excel（推荐）**
```
GET /plans/{plan_id}/export/excel
```

**Excel 报表包含以下工作表：**

| 工作表 | 内容 | 用途 |
|--------|------|------|
| 计划信息 | 基本信息 + SOC 约束 | 复核计划参数 |
| 计划时段 | 所有计划时段明细 | 比对实际执行 |
| 执行回执 | 所有回执记录 | 核对实际数据 |
| 偏差告警 | 所有告警（未处理标红） | 问题追踪 |
| 收益报表 | 收益计算结果 | 经营分析 |
| 状态历史 | 完整状态变更轨迹（人工修正标黄） | 审计追溯 |
| 版本快照 | 所有版本清单 | 版本管理 |

**报表设计原则：**
1. 不是调试日志，而是业务复核工具
2. 人工修正的记录有高亮标识，一眼可见
3. 未处理的严重告警标红，提醒复核人员注意
4. 所有数据可追溯，支持从报表反向定位到具体接口

## 样例场景演示

### 场景 1：正常流程

```bash
# 1. 创建计划（初始状态 draft）
# POST /plans/

# 2. 提交审批
# POST /plans/1/submit → pending

# 3. 审批通过
# POST /plans/1/approve → approved

# 4. 开始执行
# POST /plans/1/start → executing

# 5. 提交回执（3 个时段）
# POST /execution-receipts/ × 3

# 6. 自动完成 + 自动生成收益报表
# 状态变为 completed

# 7. 导出报表
# GET /plans/1/export/excel
```

### 场景 2：异常拦截

```bash
# 尝试创建 SOC 超出限制的计划
# POST /plans/ （预期 SOC 95% > max_soc 90%）
# ↓
# 返回 400: "时段 1 结束时 SOC (95.00%) 超过最大限制 (90.0%)"
```

### 场景 3：重复操作

```bash
# 第一次开始执行
# POST /plans/1/start → 成功，状态 executing

# 第二次开始执行
# POST /plans/1/start
# ↓
# 返回 400: "计划已在执行中，重复操作"
```

### 场景 4：人工修正

```bash
# 执行中发现设备问题
# POST /plans/manual-correct
# {
#   "plan_id": 1,
#   "target_status": "manually_corrected",
#   "reason": "PCS 故障需要处理",
#   "corrected_by": "运维张工"
# }
# ↓
# 版本号 +1
# 记录历史变更
# 创建版本快照

# 查询历史
# GET /plans/1/history
# 可看到完整的变更轨迹

# 查询版本
# GET /plans/1/versions
# 可看到修正前后的完整数据对比
```

## 常见问题排查

### Q: 计划创建失败，提示 "SOC 校验失败"
**排查步骤：**
1. 检查每个时段的 `expected_soc` 是否连续
2. 计算公式：当前 SOC ± 电量变化 = 预期 SOC
3. 确保所有预期 SOC 在 [min_soc, max_soc] 范围内

### Q: 执行回执提交后，计划没有自动完成
**排查步骤：**
1. 检查是否所有时段都已提交回执
2. 访问 GET /plans/{id} 查看 plan.segments 数量
3. 访问 GET /execution-receipts/?plan_id={id} 查看已提交的回执数量
4. 两者数量必须相等才会自动完成

### Q: 收益报表的净利润和预期不符
**排查步骤：**
1. 检查是否有未处理的 CRITICAL 告警（每条扣 100 元）
2. 检查电价窗口是否正确关联
3. 访问 GET /alerts/?plan_id={id}&is_resolved=false 查看未处理告警
4. 导出 Excel 报表，查看"偏差告警"工作表

### Q: 人工修正后数据不一致
**说明：** 系统设计确保一致性
- 当前状态：基于最新版本
- 历史查询：GET /plans/{id}/history 显示完整变更轨迹
- 版本对比：GET /plans/{id}/versions 可查看任意时点的快照
- 导出报表：包含所有历史和版本，审计线索完整

## 下一步该查哪里

当你遇到问题时，按以下顺序排查：

| 问题 | 先查这个接口 | 再查这个 |
|------|--------------|----------|
| 计划参数不对 | GET /plans/{id} | GET /soc-constraints/ |
| 执行有问题 | GET /execution-receipts/?plan_id={id} | GET /alerts/?plan_id={id} |
| 收益不对 | GET /revenue-reports/?plan_id={id} | GET /price-windows/ |
| 状态变更异常 | GET /plans/{id}/history | GET /plans/{id}/versions |
| 需要完整复核 | GET /plans/{id}/export/excel | （报表包含所有信息） |

## 数据库表说明

系统使用 SQLite（可轻松切换到 MySQL/PostgreSQL），主要表：

| 表名 | 用途 |
|------|------|
| price_windows | 电价窗口配置 |
| soc_constraints | SOC 约束配置 |
| charge_plans | 充放电计划主表 |
| plan_segments | 计划时段明细 |
| plan_versions | 版本快照（JSON 格式） |
| execution_receipts | 执行回执 |
| deviation_alerts | 偏差告警 |
| revenue_reports | 收益报表 |
| plan_history | 状态变更历史 |
