# 权益扣减修正审批余额重算后端API

基于 FastAPI + SQLite 实现的企业客户权益扣减管理系统，支持扣减规则、事件去重、修正审批、余额重算、对账导出。

## 快速启动

### 1. 安装依赖
```bash
pip install -r requirements.txt
```

### 2. 造测试数据
```bash
python seed_data.py
```

### 3. 启动服务
```bash
python main.py
```
服务启动后访问: http://localhost:8000/docs

## API 接口列表

| 接口 | 方法 | 说明 |
|------|------|------|
| `/customers/` | POST | 创建客户 |
| `/packages/` | POST | 创建权益包 |
| `/packages/{package_id}` | GET | 查询权益包及扣减明细 |
| `/events/` | POST | 创建调用事件（幂等） |
| `/events/deduct` | POST | 执行权益扣减 |
| `/deductions/` | GET | 查询扣减记录列表 |
| `/corrections/` | POST | 创建修正申请 |
| `/corrections/{application_id}` | GET | 查询修正审批详情 |
| `/corrections/approve` | POST | 审批修正申请（通过/拒绝/关闭） |
| `/reconciliations/` | POST | 创建对账结果 |
| `/export/deductions/{customer_id}` | GET | 导出扣减CSV |

## CURL 主流程示例

### 1. 创建客户
```bash
curl -X POST "http://localhost:8000/customers/" \
  -H "Content-Type: application/json" \
  -d '{"id": "CUST001", "name": "测试企业客户"}'
```

### 2. 创建权益包
```bash
curl -X POST "http://localhost:8000/packages/" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "PKG001",
    "customer_id": "CUST001",
    "package_type": "API调用套餐",
    "total_quota": 10000.0,
    "start_time": "2024-01-01T00:00:00",
    "end_time": "2024-12-31T23:59:59"
  }'
```

### 3. 创建调用事件（幂等）
```bash
curl -X POST "http://localhost:8000/events/" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "EVENT001",
    "event_idempotent_key": "req_20240101_001",
    "customer_id": "CUST001",
    "package_id": "PKG001",
    "api_name": "人脸识别接口",
    "request_body": "{\"image\": \"base64...\"}"
  }'
```

### 4. 执行权益扣减
```bash
curl -X POST "http://localhost:8000/events/deduct" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "DEDUCT001",
    "event_id": "EVENT001",
    "package_id": "PKG001",
    "customer_id": "CUST001",
    "deduct_amount": 100.0,
    "deduct_reason": "人脸识别V3接口调用"
  }'
```

### 5. 查询权益包及扣减明细
```bash
curl -X GET "http://localhost:8000/packages/PKG001"
```

### 6. 创建修正申请（客户反馈扣错）
```bash
curl -X POST "http://localhost:8000/corrections/" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "CORR001",
    "customer_id": "CUST001",
    "deduction_id": "DEDUCT001",
    "applicant": "客服小王",
    "apply_reason": "客户反馈该次调用失败，不应扣减权益",
    "correction_amount": 100.0
  }'
```

### 7. 审批修正申请 - 通过（冲正）
```bash
curl -X POST "http://localhost:8000/corrections/approve" \
  -H "Content-Type: application/json" \
  -d '{
    "application_id": "CORR001",
    "approver": "审批人老李",
    "action": "approve",
    "comment": "核查日志确认调用失败，予以全额冲正"
  }'
```

### 8. 审批修正申请 - 拒绝
```bash
curl -X POST "http://localhost:8000/corrections/approve" \
  -H "Content-Type: application/json" \
  -d '{
    "application_id": "CORR001",
    "approver": "审批人老李",
    "action": "reject",
    "comment": "扣减正常，不予冲正"
  }'
```

### 9. 审批修正申请 - 关闭
```bash
curl -X POST "http://localhost:8000/corrections/approve" \
  -H "Content-Type: application/json" \
  -d '{
    "application_id": "CORR001",
    "approver": "审批人老李",
    "action": "close",
    "comment": "客户撤销申诉"
  }'
```

### 10. 查询修正审批详情
```bash
curl -X GET "http://localhost:8000/corrections/CORR001"
```

### 11. 对账
```bash
curl -X POST "http://localhost:8000/reconciliations/?customer_id=CUST001&package_id=PKG001&created_by=对账员小张"
```

### 12. 导出扣减记录CSV
```bash
curl -X GET "http://localhost:8000/export/deductions/CUST001" -o deductions.csv
```

## 异常场景 CURL 示例

### 场景1: 余额不足扣减失败
```bash
# 先创建一个只有50额度的权益包
curl -X POST "http://localhost:8000/packages/" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "PKG002",
    "customer_id": "CUST001",
    "package_type": "小额度套餐",
    "total_quota": 50.0,
    "start_time": "2024-01-01T00:00:00",
    "end_time": "2024-12-31T23:59:59"
  }'

# 尝试扣减100
curl -X POST "http://localhost:8000/events/deduct" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "DEDUCT_ERR001",
    "event_id": "EVENT001",
    "package_id": "PKG002",
    "customer_id": "CUST001",
    "deduct_amount": 100.0,
    "deduct_reason": "测试扣减"
  }'
```
预期返回: 400 错误，"权益余额不足"

### 场景2: 重复扣减同一条记录
```bash
curl -X POST "http://localhost:8000/events/deduct" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "DEDUCT001",
    "event_id": "EVENT001",
    "package_id": "PKG001",
    "customer_id": "CUST001",
    "deduct_amount": 100.0,
    "deduct_reason": "重复扣减测试"
  }'
```
预期返回: 400 错误，"扣减记录已存在"

### 场景3: 对已冲正的扣减再次申请修正
```bash
# 假设 DEDUCT001 已被冲正
curl -X POST "http://localhost:8000/corrections/" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "CORR_ERR001",
    "customer_id": "CUST001",
    "deduction_id": "DEDUCT001",
    "applicant": "客服小王",
    "apply_reason": "重复申请测试",
    "correction_amount": 100.0
  }'
```
预期返回: 400 错误，"该扣减已被冲正"

### 场景4: 事件幂等性测试
```bash
# 第一次请求
curl -X POST "http://localhost:8000/events/" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "EVENT_IDEMP_001",
    "event_idempotent_key": "same_key_12345",
    "customer_id": "CUST001",
    "api_name": "测试接口"
  }'

# 第二次相同幂等键，不同事件ID
curl -X POST "http://localhost:8000/events/" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "EVENT_IDEMP_002",
    "event_idempotent_key": "same_key_12345",
    "customer_id": "CUST001",
    "api_name": "测试接口"
  }'
```
预期第二次返回: "事件已存在（幂等）"

## 核心规则说明

### 扣减规则
1. 扣减前校验权益包状态必须为 active
2. 剩余额度必须大于等于扣减金额
3. 每次扣减必须关联一个调用事件
4. 扣减成功后同步更新权益包余额

### 事件去重
1. 基于 `event_idempotent_key` 做幂等校验
2. 相同幂等键的事件只会被处理一次
3. 重复请求返回已存在的事件信息

### 修正审批
1. 修正申请状态: pending -> approved/rejected/closed
2. 审批通过后自动执行余额重算（冲正）
3. 所有审批操作留痕（审批人、动作、意见、时间）
4. 已冲正的扣减不能再次申请修正

### 余额重算
1. 审批通过后自动将冲正金额加回权益包
2. 标记原扣减记录为已冲正状态
3. 记录冲正人、冲正时间、冲正原因

### 对账导出
1. 自动比对系统计算总额与实际已用总额
2. 差异为0标记为对账完成，否则标记为异常
3. 支持按客户+时间范围导出CSV明细

## 运行测试

```bash
pytest test_main.py -v
```

测试覆盖场景：
- ✅ 客户和权益包创建
- ✅ 事件幂等性
- ✅ 正常扣减流程
- ✅ 余额不足异常
- ✅ 修正申请审批通过（含余额重算）
- ✅ 修正申请审批拒绝
- ✅ 对账功能
- ✅ CSV导出
- ✅ 扣减记录查询

## 数据库表结构

| 表名 | 说明 | 关键字段 |
|------|------|----------|
| customers | 客户信息 | id, name |
| equity_packages | 权益包 | total_quota, used_quota, remaining_quota, status |
| call_events | 调用事件 | event_idempotent_key, api_name, request_body, status |
| deduction_details | 扣减明细 | deduct_amount, deduct_reason, is_reversed, reversed_by |
| correction_applications | 修正申请 | applicant, apply_reason, correction_amount, status, final_conclusion |
| approval_records | 审批记录 | approver, action, comment |
| reconciliation_results | 对账结果 | system_total, manual_total, difference, status |
