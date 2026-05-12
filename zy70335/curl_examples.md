# 数据修复工单 API - curl 示例

## 启动服务

```bash
npm install
npm start
```

服务地址: http://localhost:3000

---

## 样例1: 订单状态修复（正常流程）

### 1. 创建工单
```bash
curl -X POST http://localhost:3000/api/v1/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "title": "订单 ORD001 状态异常修复",
    "description": "用户投诉订单状态异常，需要从 PAID 改为 REFUNDING",
    "creator": "zhangsan",
    "department": "订单中心",
    "reason": "用户申请退款，系统未正确更新状态",
    "repair_actions": [
      {
        "table": "orders",
        "record_id": "ORD001",
        "updates": {
            "status": "REFUNDING"
        }
      }
    ]
  }'
```

**返回示例：**
```json
{
  "id": "ticket-uuid-1",
  "status": "draft",
  "required_approval_level": 1,
  "repair_actions_hash": "..."
}
```

### 2. 执行预检
```bash
TICKET_ID="你的工单ID"
curl -X POST "http://localhost:3000/api/v1/tickets/$TICKET_ID/precheck"
```

**返回示例：**
```json
{
  "id": "precheck-uuid",
  "status": "passed",
  "estimated_impact_count": 1,
  "high_risk_fields": [],
  "errors": [],
  "passed": true
}
```

### 3. 审批
```bash
curl -X POST "http://localhost:3000/api/v1/tickets/$TICKET_ID/approve" \
  -H "Content-Type: application/json" \
  -d '{
    "approver": "manager01",
    "level": 1,
    "comment": "已核实，同意修复"
  }'
```

### 4. 执行修复
```bash
curl -X POST "http://localhost:3000/api/v1/tickets/$TICKET_ID/execute" \
  -H "Content-Type: application/json" \
  -d '{
    "executor": "operator01"
  }'
```

**返回示例：**
```json
{
  "id": "execution-uuid",
  "status": "success",
  "actual_impact_count": 1,
  "snapshot_before": [...],
  "snapshot_after": [...]
}
```

### 5. 验证订单状态
```bash
curl http://localhost:3000/api/v1/data/orders/ORD001
```

---

## 样例2: 预检阻断场景

### 1. 创建包含错误的工单
```bash
curl -X POST http://localhost:3000/api/v1/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "title": "测试预检阻断",
    "creator": "zhangsan",
    "department": "测试",
    "reason": "测试预检功能",
    "repair_actions": [
      {
        "table": "orders",
        "record_id": "NOT_EXIST_999",
        "updates": {
            "status": "CANCELLED"
        }
      }
    ]
  }'
```

### 2. 执行预检（会失败）
```bash
TICKET_ID="你的工单ID"
curl -X POST "http://localhost:3000/api/v1/tickets/$TICKET_ID/precheck"
```

**返回示例（预检失败）：**
```json
{
  "status": "failed",
  "errors": ["记录不存在: orders.NOT_EXIST_999"],
  "passed": false
}
```

### 3. 尝试审批（会失败，因为预检未通过）
```bash
curl -X POST "http://localhost:3000/api/v1/tickets/$TICKET_ID/approve" \
  -H "Content-Type: application/json" \
  -d '{
    "approver": "manager01",
    "level": 1,
    "comment": "测试"
  }'
```

**返回：**
```json
{ "error": "预检未通过，不能审批" }
```

---

## 样例3: 会员积分修复（高风险字段，需要二级审批）

### 1. 创建工单
```bash
curl -X POST http://localhost:3000/api/v1/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "title": "会员 USER002 积分补发",
    "description": "活动奖励积分未到账，补发 3000积分",
    "creator": "lisi",
    "department": "会员中心",
    "reason": "营销活动奖励",
    "repair_actions": [
      {
        "table": "members",
        "record_id": "USER002",
        "updates": {
            "points": 5000,
            "level": "GOLD"
        }
      }
    ]
  }'
```

**注意返回中：**
- `required_approval_level`: 2（因为 points 和 level 是高风险字段）

### 2. 预检
```bash
TICKET_ID="你的工单ID"
curl -X POST "http://localhost:3000/api/v1/tickets/$TICKET_ID/precheck"
```

**返回会显示：**
```json
{
  "high_risk_fields": [
    {
      "table": "members",
      "record_id": "USER002",
      "field": "points",
      "old_value": 2000,
      "new_value": 5000
    },
    {
      "table": "members",
      "record_id": "USER002",
      "field": "level",
      "old_value": "SILVER",
      "new_value": "GOLD"
    }
  ],
  "risk_level": "high"
}
```

### 3. 一级审批
```bash
curl -X POST "http://localhost:3000/api/v1/tickets/$TICKET_ID/approve" \
  -H "Content-Type: application/json" \
  -d '{
    "approver": "manager01",
    "level": 1,
    "comment": "一级审批通过"
  }'
```

### 4. 尝试执行（会失败）
```bash
curl -X POST "http://localhost:3000/api/v1/tickets/$TICKET_ID/execute" \
  -H "Content-Type: application/json" \
  -d '{ "executor": "operator01" }'
```

**返回：**
```json
{ "error": "当前状态不允许执行" }
```

### 5. 二级审批
```bash
curl -X POST "http://localhost:3000/api/v1/tickets/$TICKET_ID/approve" \
  -H "Content-Type: application/json" \
  -d '{
    "approver": "director01",
    "level": 2,
    "comment": "二级审批通过，同意"
  }'
```

### 6. 再次执行
```bash
curl -X POST "http://localhost:3000/api/v1/tickets/$TICKET_ID/execute" \
  -H "Content-Type: application/json" \
  -d '{ "executor": "operator01" }'
```

### 7. 验证会员信息
```bash
curl http://localhost:3000/api/v1/data/members/USER002
```

---

## 样例4: 发票状态修复与回滚

### 1. 创建工单
```bash
curl -X POST http://localhost:3000/api/v1/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "title": "发票 INV001 状态修复",
    "creator": "wangwu",
    "department": "财务中心",
    "reason": "发票已开具",
    "repair_actions": [
      {
        "table": "invoices",
        "record_id": "INV001",
        "updates": {
            "status": "ISSUED"
        }
      }
    ]
  }'
```

### 2. 预检、审批、执行
```bash
TICKET_ID="你的工单ID"

# 预检
curl -X POST "http://localhost:3000/api/v1/tickets/$TICKET_ID/precheck"

# 审批
curl -X POST "http://localhost:3000/api/v1/tickets/$TICKET_ID/approve" \
  -H "Content-Type: application/json" \
  -d '{ "approver": "manager01", "level": 1 }'

# 执行
EXECUTION=$(curl -s -X POST "http://localhost:3000/api/v1/tickets/$TICKET_ID/execute" \
  -H "Content-Type: application/json" \
  -d '{ "executor": "operator01" }')

# 从返回中获取 execution_id
echo $EXECUTION | python3 -m json.tool
```

### 3. 回滚（必须引用执行记录）
```bash
EXECUTION_ID="你的执行记录ID"

curl -X POST "http://localhost:3000/api/v1/tickets/$TICKET_ID/rollback" \
  -H "Content-Type: application/json" \
  -d '{
    "executor": "operator01",
    "reference_execution_id": "$EXECUTION_ID"
  }'
```

### 4. 验证回滚结果
```bash
curl http://localhost:3000/api/v1/data/invoices/INV001
```

---

## 其他查询接口

### 查看工单列表
```bash
curl http://localhost:3000/api/v1/tickets
```

### 查看工单详情
```bash
TICKET_ID="你的工单ID"
curl "http://localhost:3000/api/v1/tickets/$TICKET_ID"
```

**返回包含：**
- 工单基本信息
- 预检记录 (precheck)
- 审批记录列表 (approvals)
- 执行记录 (execution)
- 回滚记录 (rollback)
- 审计记录 (audit)

### 查看审计报告
```bash
AUDIT_ID="你的审计ID"
curl "http://localhost:3000/api/v1/audits/$AUDIT_ID"
```

**审计报告包含：**
- 影响记录数 (affected_count)
- 前后差异 (differences)
- 操作者信息 (executor)
- 预检信息
- 审批信息
- 回滚状态
- 残留差异（如果回滚失败）

### 关闭工单
```bash
TICKET_ID="你的工单ID"
curl -X POST "http://localhost:3000/api/v1/tickets/$TICKET_ID/close" \
  -H "Content-Type: application/json" \
  -d '{
    "closer": "operator01",
    "comment": "处理完成"
  }'
```

---

## 重复执行场景测试

```bash
# 先执行一次（成功）
curl -X POST "http://localhost:3000/api/v1/tickets/$TICKET_ID/execute" \
  -H "Content-Type: application/json" \
  -d '{ "executor": "operator01" }'

# 再次执行（会被阻止）
curl -X POST "http://localhost:3000/api/v1/tickets/$TICKET_ID/execute" \
  -H "Content-Type: application/json" \
  -d '{ "executor": "operator01" }'
```

**返回：**
```json
{ "error": "已执行成功，禁止重复执行" }
```
