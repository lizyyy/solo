# 工地塔吊吊次排程 API - 使用指南

## 从空数据走到报表/看板

### 前置准备

```bash
cd /Users/lzy/pro/solo/workspaces/zy70291
npm install
npm start
```

服务运行在 `http://localhost:3001`

---

### 第一步：建立基础档案

**1.1 创建塔吊**

每台塔吊定义：编号、服务楼栋范围、最大允许风速、最大起重。

```bash
curl -X POST http://localhost:3001/api/cranes \
  -H "Content-Type: application/json" \
  -d '{
    "code": "TC-001",
    "name": "1号塔吊",
    "max_wind_speed": 20.0,
    "max_load": 12.0,
    "building_range": "1-5"
  }'
```

要点：
- `building_range` 支持格式：`1-5` 或 `1,3,5` 或 `ALL`
- `max_wind_speed` 单位：m/s，超过此值禁止作业
- `max_load` 单位：吨

**1.2 创建材料（带优先级）**

```bash
curl -X POST http://localhost:3001/api/cranes/materials \
  -H "Content-Type: application/json" \
  -d '{
    "code": "STEEL-001",
    "name": "钢筋",
    "priority": 90,
    "average_weight": 2.5
  }'
```

要点：
- `priority` 范围 1-100，数值越大优先级越高
- 优先级是排程顺序的核心依据

**1.3 记录当前风速**

```bash
curl -X POST http://localhost:3001/api/cranes/weather/wind-speed \
  -H "Content-Type: application/json" \
  -d '{"wind_speed": 12}'
```

---

### 第二步：提交吊次申请

**2.1 基本申请**

```bash
curl -X POST http://localhost:3001/api/applications \
  -H "Content-Type: application/json" \
  -d '{
    "crane_code": "TC-001",
    "material_code": "STEEL-001",
    "building_no": "3",
    "floor": 12,
    "quantity": 5,
    "requested_by": "张工长"
  }'
```

返回的 `application_no` 是唯一申请单号（格式 LA-YYYYMMDD-NNNN）。

申请自动继承材料的 `priority`，可覆盖：
```json
{
  ...
  "priority": 95
}
```

**2.2 带来源记录的插单**

如果是从某历史记录重复吊次，需指定 `source_record_id`：

```bash
curl -X POST http://localhost:3001/api/applications \
  -H "Content-Type: application/json" \
  -d '{
    "crane_code": "TC-001",
    "material_code": "STEEL-001",
    "building_no": "3",
    "floor": 12,
    "quantity": 5,
    "requested_by": "张工长",
    "source_record_id": "历史记录ID"
  }'
```

如果来源记录不存在 → 返回 `SOURCE_RECORD_MISSING` 错误。

---

### 第三步：查看排程引擎结果

**3.1 生成排程**

```bash
curl http://localhost:3001/api/schedule/generate
```

返回结构：
```json
{
  "current_wind_speed": 12,
  "total_pending": 3,
  "can_execute_count": 2,
  "blocked_count": 1,
  "schedule": [
    {
      "application_no": "LA-20260512-0001",
      "material_name": "钢筋",
      "material_priority": 90,
      "crane_max_wind_speed": 20,
      "constraints": {
        "can_execute": true,
        "blocks": [],
        "warnings": []
      },
      "recommended_action": "SCHEDULE"
    }
  ]
}
```

**排程优先级规则：**
1. 先检查 `constraints.can_execute`（可执行排在前）
2. 再按 `application_priority` 降序
3. 同优先级按创建时间升序

**3.2 复核面板**

```bash
curl http://localhost:3001/api/schedule/review-panel
```

返回：
- `ready_list`：可直接执行
- `warning_list`：有警告但可执行（需人工确认）
- `blocked_list`：被阻挡，需先解决问题
- `violation_breakdown`：按风速、载重、楼栋分类的阻挡原因

---

### 第四步：推进状态

申请状态流转：
```
PENDING → SCHEDULED → IN_PROGRESS → COMPLETED
              ↓            ↓
           CANCELLED    CANCELLED
```

**4.1 安排吊次**
```bash
curl -X POST http://localhost:3001/api/applications/{id}/schedule \
  -H "Content-Type: application/json" \
  -d '{"performed_by": "调度员A", "reason": "紧急材料优先"}'
```

**4.2 开始执行**
```bash
curl -X POST http://localhost:3001/api/applications/{id}/start \
  -H "Content-Type: application/json" \
  -d '{"performed_by": "老王", "operator": "老王"}'
```

此步骤会校验当前风速是否超过塔吊限制。

**4.3 完成吊次**
```bash
curl -X POST http://localhost:3001/api/applications/{id}/complete \
  -H "Content-Type: application/json" \
  -d '{"performed_by": "老王"}'
```

**4.4 撤回/取消**
```bash
curl -X POST http://localhost:3001/api/applications/{id}/cancel \
  -H "Content-Type: application/json" \
  -d '{"performed_by": "调度员", "reason": "材料延迟"}'
```

**4.5 修正（仅 PENDING/SCHEDULED 状态可修正）**
```bash
curl -X POST http://localhost:3001/api/applications/{id}/revise \
  -H "Content-Type: application/json" \
  -d '{
    "floor": 15,
    "quantity": 6,
    "performed_by": "张工长",
    "reason": "楼层调整"
  }'
```

---

### 第五步：查看报表/看板

**5.1 看板总览**
```bash
curl http://localhost:3001/api/reports/dashboard
```

返回：
- 今日完成/总数
- 各状态数量（PENDING/SCHEDULED/IN_PROGRESS）
- 高优先级等待列表
- 最近完成记录

**5.2 日报**
```bash
curl "http://localhost:3001/api/reports/daily?date=2026-05-12"
```

按塔吊、材料、楼栋三个维度统计。

**5.3 塔吊绩效**
```bash
curl "http://localhost:3001/api/reports/crane-performance/{craneId}?start_date=2026-05-01&end_date=2026-05-12"
```

**5.4 材料优先级分析**
```bash
curl http://localhost:3001/api/reports/material-priority
```

---

### 边界情况说明

| 场景 | 错误码 | 说明 |
|------|--------|------|
| 重复提交同申请单 | DUPLICATE_REQUEST | 但单号是生成的，实际通过版本号控制并发 |
| 已完成状态再次推进 | STATE_CONFLICT | 状态机保护 |
| 版本号冲突（并发修改） | STATE_CONFLICT | 乐观锁，需刷新重试 |
| 来源记录不存在 | SOURCE_RECORD_MISSING | source_record_id 校验 |
| 风速超过塔吊限制 | VALIDATION_ERROR | 开始执行时检查 |
| 楼栋不在塔吊服务范围 | SCHEDULE 时显示 BLOCK | 排程引擎提示 |

---

### 一键演示

运行快速演示脚本，走通完整流程：

```bash
node scripts/quickstart.js
```

---

### API 端点速查

| 模块 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 塔吊 | POST | /api/cranes | 创建塔吊 |
| 塔吊 | GET | /api/cranes | 列表 |
| 材料 | POST | /api/cranes/materials | 创建材料 |
| 风速 | POST | /api/cranes/weather/wind-speed | 记录风速 |
| 申请 | POST | /api/applications | 创建申请 |
| 申请 | GET | /api/applications | 列表（支持过滤） |
| 状态 | POST | /api/applications/:id/schedule | 安排 |
| 状态 | POST | /api/applications/:id/start | 开始 |
| 状态 | POST | /api/applications/:id/complete | 完成 |
| 状态 | POST | /api/applications/:id/cancel | 取消 |
| 状态 | POST | /api/applications/:id/revise | 修正 |
| 排程 | GET | /api/schedule/generate | 生成排程 |
| 排程 | GET | /api/schedule/review-panel | 复核面板 |
| 报表 | GET | /api/reports/dashboard | 看板 |
| 报表 | GET | /api/reports/daily | 日报 |
| 报表 | GET | /api/reports/material-priority | 材料优先级分析 |
