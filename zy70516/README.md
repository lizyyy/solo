# 变更窗口预约 API 服务

用于管理多个团队的发布窗口预约，替代靠聊天和表格推进的低效流程。

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化样例数据

```bash
npm run init
```

这将插入5条示例预约记录，涵盖不同的服务、风险等级和状态。

### 3. 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动

开发模式（自动重启）:
```bash
npm run dev
```

### 4. 健康检查

```bash
curl http://localhost:3000/health
```

---

## API 接口列表

所有接口前缀: `/api`

### 1. 创建预约

```bash
curl -X POST http://localhost:3000/api/appointments \
  -H "Content-Type: application/json" \
  -d '{
    "service_name": "消息队列",
    "window_start": "2026-05-25T00:00:00Z",
    "window_end": "2026-05-25T02:00:00Z",
    "risk_level": "medium",
    "dependent_services": "订单服务",
    "created_by": "技术部-小李"
  }'
```

### 2. 查询预约列表

```bash
# 查询所有
curl http://localhost:3000/api/appointments

# 按服务名称筛选
curl "http://localhost:3000/api/appointments?service_name=订单"

# 按状态筛选
curl "http://localhost:3000/api/appointments?status=approved"

# 分页查询
curl "http://localhost:3000/api/appointments?page=1&limit=10"

# 按时间范围查询
curl "http://localhost:3000/api/appointments?start_date=2026-05-20T00:00:00Z&end_date=2026-05-30T00:00:00Z"
```

### 3. 查询单条预约详情（含审计日志）

```bash
curl http://localhost:3000/api/appointments/1
```

### 4. 状态推进

```bash
curl -X PATCH http://localhost:3000/api/appointments/2/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved",
    "approver": "王经理",
    "conclusion": "同意发布，请做好回滚预案",
    "operator": "审批系统"
  }'
```

### 5. 人工修正（绕过规则）

```bash
curl -X POST http://localhost:3000/api/appointments/1/manual-fix \
  -H "Content-Type: application/json" \
  -d '{
    "window_end": "2026-05-20T03:00:00Z",
    "status": "approved",
    "operator": "运维主管",
    "reason": "紧急情况，特批延长窗口期"
  }'
```

### 6. 导出日历 (iCal格式)

```bash
# 导出已确认的预约
curl -o windows.ics http://localhost:3000/api/export/calendar

# 按时间范围导出
curl -o may-windows.ics "http://localhost:3000/api/export/calendar?start_date=2026-05-01T00:00:00Z&end_date=2026-05-31T23:59:59Z"
```

### 7. 导出 JSON

```bash
curl http://localhost:3000/api/export/json
```

### 8. 查询审计日志

```bash
curl http://localhost:3000/api/audit-logs

# 查询特定预约的操作记录
curl "http://localhost:3000/api/audit-logs?appointment_id=1"
```

---

## 被规则拦住的路径示例

### 示例1: 窗口冲突

先创建第一个预约:
```bash
curl -X POST http://localhost:3000/api/appointments \
  -H "Content-Type: application/json" \
  -d '{
    "service_name": "库存服务",
    "window_start": "2026-06-01T00:00:00Z",
    "window_end": "2026-06-01T02:00:00Z",
    "risk_level": "low",
    "created_by": "运维A"
  }'
```

再创建冲突的预约（同一时间段），会被拦截:
```bash
curl -X POST http://localhost:3000/api/appointments \
  -H "Content-Type: application/json" \
  -d '{
    "service_name": "库存服务",
    "window_start": "2026-06-01T01:00:00Z",
    "window_end": "2026-06-01T03:00:00Z",
    "risk_level": "low",
    "created_by": "运维B"
  }'
```

返回错误:
```json
{
  "success": false,
  "error": "预约创建失败，规则校验未通过",
  "details": ["检测到 1 个窗口冲突: #6-库存服务"],
  "rules_applied": ["时间格式校验", "风险等级时长校验", "窗口冲突检测", "依赖服务校验"]
}
```

### 示例2: 风险等级时长限制

critical风险窗口超过2小时，会被拦截:
```bash
curl -X POST http://localhost:3000/api/appointments \
  -H "Content-Type: application/json" \
  -d '{
    "service_name": "核心交易",
    "window_start": "2026-07-01T00:00:00Z",
    "window_end": "2026-07-01T03:00:00Z",
    "risk_level": "critical",
    "created_by": "架构师"
  }'
```

返回错误:
```json
{
  "success": false,
  "error": "预约创建失败，规则校验未通过",
  "details": ["严重风险变更窗口时长不得超过2小时"],
  "rules_applied": ["时间格式校验", "风险等级时长校验", "窗口冲突检测", "依赖服务校验"]
}
```

### 示例3: 依赖服务校验失败

预约一个不存在的依赖服务，会被拦截:
```bash
curl -X POST http://localhost:3000/api/appointments \
  -H "Content-Type: application/json" \
  -d '{
    "service_name": "新业务系统",
    "window_start": "2026-08-01T00:00:00Z",
    "window_end": "2026-08-01T02:00:00Z",
    "risk_level": "high",
    "dependent_services": "不存在的服务",
    "created_by": "开发团队"
  }'
```

返回错误:
```json
{
  "success": false,
  "error": "预约创建失败，规则校验未通过",
  "details": ["依赖校验失败: 依赖服务 不存在的服务 在该时间窗口内没有有效预约"],
  "rules_applied": ["时间格式校验", "风险等级时长校验", "窗口冲突检测", "依赖服务校验"]
}
```

---

## 核心规则说明

| 规则 | 说明 |
|------|------|
| **窗口冲突检测** | 同一服务不能有重叠的有效预约（pending/approved/confirmed状态） |
| **依赖服务校验** | 依赖的服务必须在同一时间窗口内有有效预约 |
| **风险等级时长限制** | critical ≤ 2小时, high ≤ 4小时, low/medium 无限制 |
| **时间格式校验** | 必须使用有效的 ISO 格式时间 |

---

## 状态流转

```
pending → approved → confirmed → completed
           ↓            ↓
        rejected     delayed → cancelled
```

- **pending**: 待审批
- **approved**: 已审批
- **rejected**: 已拒绝
- **delayed**: 已延期
- **confirmed**: 已确认执行
- **completed**: 已完成
- **cancelled**: 已取消

---

## 审计日志

所有操作（包括失败的创建和状态变更）都会记录审计日志，包含:
- 原始输入数据
- 应用的规则列表
- 最终结论
- 操作人
- 操作时间

可通过 `/api/audit-logs` 接口查询完整的操作历史。

---

## 数据模型

### appointments 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| service_name | TEXT | 服务名称 |
| window_start | DATETIME | 窗口开始时间 |
| window_end | DATETIME | 窗口结束时间 |
| risk_level | TEXT | 风险等级: low/medium/high/critical |
| dependent_services | TEXT | 依赖服务（逗号分隔） |
| status | TEXT | 状态 |
| conflict_reason | TEXT | 冲突原因 |
| conclusion | TEXT | 审批结论 |
| approver | TEXT | 审批人 |
| created_by | TEXT | 创建人 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### audit_logs 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| appointment_id | INTEGER | 关联预约ID |
| action | TEXT | 操作类型 |
| original_input | TEXT | 原始输入（JSON） |
| processing_rules | TEXT | 应用规则（JSON） |
| final_conclusion | TEXT | 最终结论（JSON） |
| operator | TEXT | 操作人 |
| created_at | DATETIME | 创建时间 |
