# 博物馆藏品出库审批系统 - 使用说明

## 一、系统概述

本系统是一个偏后端的博物馆藏品出库审批 API 系统，用于管理藏品外借展览时的全流程管理。

### 核心功能模块

| 模块 | 说明 |
|------|------|
| 藏品档案管理 | 管理博物馆藏品的基本信息和状态 |
| 出库审批流程 | 多级审批流程（部门主管 → 馆长） |
| 保险单管理 | 藏品运输和展览保险管理 |
| 运输节点追踪 | 记录运输过程中的各节点信息 |
| 环境监测记录 | 温度、湿度、光照等环境参数记录 |
| 归还验收 | 藏品归还时的验收检查 |
| 操作历史 | 完整的操作日志记录 |
| 后台任务 | 异步任务处理和失败重试 |

---

## 二、快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn main:app --reload --port 8000
```

### 3. 访问 API 文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 4. 运行测试脚本

```bash
python test_api.py
```

---

## 三、业务流程详解

### 审批流程状态机

```
draft (草稿)
    ↓ submit
pending_approval (待审批)
    ↓ 部门主管审批
pending_approval (待馆长审批)
    ↓ 馆长审批
approved (已审批)
    ↓ 办理保险 + 签发保险
    ↓ start-transit
in_transit (运输中)
    ↓ arrive
at_destination (到达目的地)
    ↓ start-return
returning (归还中)
    ↓ 归还验收
    ↓ complete
completed (已完成)
```

### 完整流程步骤：

1. **创建审批申请**
2. **提交审批**
3. **部门主管审批**
4. **馆长审批**
5. **创建保险单**
6. **签发保险单**
7. **开始运输**
8. **记录运输节点**
9. **记录环境监测**
10. **到达目的地**
11. **开始归还**
12. **归还验收**
13. **完成审批**

---

## 四、数据关联关系

```
OutboundApproval (出库审批)
    │
    ├── CollectionItem (藏品档案) - 1:1
    │
    ├── InsurancePolicy (保险单) - 1:1
    │
    ├── TransportRecord[] (运输记录) - 1:N
    │       └── EnvironmentLog[] (环境记录) - 1:N
    │
    ├── ReturnInspection (归还验收) - 1:1
    │
    ├── OperationHistory[] (操作历史) - 1:N
    │
    └── BackgroundTask[] (后台任务) - 1:N
```

---

## 五、失败补偿与重试机制

### 5.1 后台任务状态流转

```
pending (待执行)
    ↓
running (执行中)
    ├── success (成功)
    └── failed (失败)
    │       ↑
    └── retrying (重试中)
            │
            └── 重试次数 < 阈值 → 继续重试
            └── 重试次数 >= 阈值 → failed
```

### 5.2 自动重试机制

**配置参数** (在 `app/config.py` 中配置)

```python
RETRY_MAX_ATTEMPTS = 3       # 最大重试次数
RETRY_DELAY_SECONDS = 5     # 重试延迟时间(秒)
TASK_TIMEOUT_SECONDS = 300     # 任务超时时间(秒)
```

**自动重试触发条件**

1. 任务执行抛出异常
2. 重试次数未达上限
3. 状态变为 `retrying`
4. `next_retry_at` 到达后自动执行

### 5.3 手动重试方式

#### 方式一：单个任务重试

```bash
# API 方式
curl -X POST "http://localhost:8000/api/v1/tasks/{task_id}/retry" \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "TASK-20240101120000-ABCDEF12",
    "operator": "管理员张三",
    "force": false
  }'
```

**参数说明**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `task_id` | string | 是 | 任务ID |
| `operator` | string | 是 | 操作人姓名 |
| `force` | boolean | 否 | 是否强制重试成功的任务 |

**返回示例

```json
{
  "success": true,
  "message": "任务重试已触发",
  "data": {
    "task_id": "TASK-20240101120000-ABCDEF12",
    "status": "pending",
    "message": "任务已重置为待执行状态，可以立即执行或等待后台自动处理"
  }
}
```

#### 方式二：批量重试失败任务

```bash
curl -X POST "http://localhost:8000/api/v1/tasks/batch-retry?operator=管理员张三"
```

**查询参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `operator` | string | 是 | 操作人姓名 |
| `approval_id` | int | 否 | 指定审批申请ID |
| `force` | boolean | 否 | 强制重试 |

#### 方式三：立即执行任务

```bash
# 查看待执行任务
curl "http://localhost:8000/api/v1/tasks/pending"

# 手动触发处理所有待执行任务
curl -X POST "http://localhost:8000/api/v1/tasks/process-pending"

# 立即执行特定任务
curl -X POST "http://localhost:8000/api/v1/tasks/{task_id}/execute"
```

### 5.4 任务失败后的恢复步骤

**场景：通知保险公司任务失败

**步骤 1：查看失败任务**

```bash
curl "http://localhost:8000/api/v1/tasks/failed"
```

返回示例

```json
[
  {
    "task_id": "TASK-20240101120000-ABCDEF12",
    "task_type": "notify_insurance",
    "approval_id": 1,
    "status": "failed",
    "attempts": 3,
    "max_attempts": 3,
    "error_message": "保险公司API连接超时",
    "error_trace": "... 堆栈信息 ...",
    "last_attempt_at": "2024-01-01T12:05:00",
    "next_retry_at": null
  }
]

```

**步骤 2：查看审批申请详情（可选)

```bash
curl "http://localhost:8000/api/v1/approvals/1"
```

**步骤 3：查看操作历史**

```bash
curl "http://localhost:8000/api/v1/approvals/1/trace"
```

**步骤 4：修复问题后重试任务

```bash
# 方式 A：重置任务状态
curl -X POST "http://localhost:8000/api/v1/tasks/TASK-20240101120000-ABCDEF12/retry" \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "TASK-20240101120000-ABCDEF12",
    "operator": "系统管理员",
    "force": false
  }'

# 方式 B：立即执行
curl -X POST "http://localhost:8000/api/v1/tasks/TASK-20240101120000-ABCDEF12/execute"
```

**步骤 5：验证执行结果**

```bash
curl "http://localhost:8000/api/v1/tasks/TASK-20240101120000-ABCDEF12"
```

### 5.5 审批流程失败后的处理

**场景：运输中需要重新处理

**方式：标记失败状态

```bash
# 查看当前审批状态
curl "http://localhost:8000/api/v1/approvals/1"

# 如果审批状态为 failed 时，可以：

# 1. 查看完整历史
curl "http://localhost:8000/api/v1/trace"

# 2. 标记为失败
curl -X POST "http://localhost:8000/api/v1/failed?operator=管理员&reason=运输途中环境异常"

# 3. 查看失败原因（查看操作历史
curl "http://localhost:8000/api/v1/approvals/1/trace"
```

---

## 六、查询和追踪 API

### 6.1 查询审批申请

```bash
# 查看审批详情
curl "http://localhost:8000/api/v1/approvals/{approval_id}"

# 查看完整追踪信息
curl "http://localhost:8000/api/v1/approvals/{approval_id}/trace"
```

**返回数据结构

```json
{
  "approval": { ... },
  "insurance": { ... },
  "transport_records": [...],
  "environment_logs": [...],
  "return_inspection": { ... },
  "operation_history": [...],
  "timeline": [
    {
      "type": "insurance",
      "time": "2024-01-01T10:00:00",
      "title": "保险单签发",
      "description": "...",
      "details": {...}
    },
    {
      "type": "transport",
      "time": "2024-01-01T11:00:00",
      "title": "运输节点：北京博物馆出库",
      "description": "...",
      "details": {...}
    }
  ]
}
```

### 6.2 查询操作历史

```bash
# 按审批申请查询
curl "http://localhost:8000/api/v1/approvals/{approval_id}/trace"
# operation_history 字段包含完整历史
```

**操作类型说明**

| 类型 | 说明 |
|------|------|
| `create` | 创建审批申请 |
| `update` | 更新审批申请 |
| `submit` | 提交审批 |
| `approve` | 审批通过 |
| `reject` | 审批拒绝 |
| `issue_insurance` | 保险签发 |
| `update_transport` | 运输节点更新 |
| `environment_record` | 环境记录 |
| `return_inspection` | 归还验收 |
| `complete` | 完成审批 |
| `cancel` | 取消审批 |
| `retry` | 任务重试 |
| `rollback` | 回滚操作 |

### 6.3 查询后台任务

```bash
# 所有任务
curl "http://localhost:8000/api/v1/tasks"

# 待执行任务
curl "http://localhost:8000/api/v1/tasks/pending"

# 失败任务
curl "http://localhost:8000/api/v1/tasks/failed"

# 按审批查询
curl "http://localhost:8000/api/v1/tasks?approval_id=1&status=failed"
```

---

## 七、完整业务示例

### 7.1 创建藏品

```bash
curl -X POST "http://localhost:8000/api/v1/collection" \
  -H "Content-Type: application/json" \
  -d '{
    "item_code": "COL-2024-0001",
    "name": "清代青花瓷瓶",
    "category": "瓷器",
    "era": "清代康熙年间",
    "description": "清代官窑青花瓷瓶",
    "current_location": "一号库房 A-12",
    "condition": "良好",
    "value": 500000.0
  }'
```

### 7.2 创建审批申请

```bash
curl -X POST "http://localhost:8000/api/v1/approvals" \
  -H "Content-Type: application/json" \
  -d '{
    "item_id": 1,
    "borrower": "上海博物馆",
    "borrower_contact": "张馆长 138-0000-1234",
    "purpose": "参加『中国清代瓷器特展』展览",
    "destination": "上海市黄浦区人民大道201号",
    "start_date": "2024-02-01T00:00:00",
    "end_date": "2024-05-01T00:00:00",
    "applicant": "李明",
    "applicant_department": "展览部",
    "comments": "展品要求：恒温恒湿运输"
  }'
```

### 7.3 提交审批

```bash
curl -X POST "http://localhost:8000/api/v1/approvals/1/submit?operator=李明"
```

### 7.4 部门主管审批

```bash
curl -X POST "http://localhost:8000/api/v1/approvals/1/approve" \
  -H "Content-Type: application/json" \
  -d '{
    "approver": "王主任",
    "approver_role": "部门主管",
    "comments": "同意出借，注意运输安全"
  }'
```

### 7.5 馆长审批

```bash
curl -X POST "http://localhost:8000/api/v1/approvals/1/approve" \
  -H "Content-Type: application/json" \
  -d '{
    "approver": "赵馆长",
    "approver_role": "馆长",
    "comments": "同意，保险请确保覆盖全程"
  }'
```

### 7.6 创建保险单

```bash
curl -X POST "http://localhost:8000/api/v1/insurance?operator=保险专员-陈" \
  -H "Content-Type: application/json" \
  -d '{
    "approval_id": 1,
    "item_id": 1,
    "insurance_company": "中国人民财产保险股份有限公司",
    "insured_value": 600000.0,
    "coverage_start": "2024-01-15T00:00:00",
    "coverage_end": "2024-05-10T00:00:00",
    "coverage_details": "全险：运输险、展览险、失窃险"
  }'
```

### 7.7 签发保险单

```bash
curl -X POST "http://localhost:8000/api/v1/insurance/1/issue?operator=保险专员-陈&policy_document_url=/documents/insurance/INS-001.pdf"
```

### 7.8 开始运输

```bash
curl -X POST "http://localhost:8000/api/v1/approvals/1/start-transit?operator=运输管理员-刘"
```

### 7.9 记录运输节点

```bash
curl -X POST "http://localhost:8000/api/v1/tracking/transport?operator=运输管理员-刘" \
  -H "Content-Type: application/json" \
  -d '{
    "approval_id": 1,
    "sequence": 1,
    "node_name": "北京博物馆出库",
    "node_type": "起点",
    "location": "北京市东城区五四大街1号",
    "handler": "库房管理员-周",
    "handler_contact": "139-0000-5678",
    "arrival_time": "2024-01-20T08:00:00",
    "departure_time": "2024-01-20T09:00:00",
    "condition_check": "藏品检查完好，包装完好",
    "remarks": "使用专用恒温恒湿包装箱"
  }'
```

### 7.10 记录环境监测

```bash
curl -X POST "http://localhost:8000/api/v1/tracking/environment?operator=运输押运员-赵" \
  -H "Content-Type: application/json" \
  -d '{
    "approval_id": 1,
    "record_time": "2024-01-20T10:00:00",
    "temperature": 20.5,
    "humidity": 55.0,
    "light_level": 0,
    "vibration": 0.1,
    "status": "normal",
    "notes": "运输途中环境监测正常",
    "operator": "运输押运员-赵"
  }'
```

### 7.11 到达目的地

```bash
curl -X POST "http://localhost:8000/api/v1/approvals/1/arrive?operator=上海博物馆-李"
```

### 7.12 开始归还

```bash
curl -X POST "http://localhost:8000/api/v1/approvals/1/start-return?operator=上海博物馆-李"
```

### 7.13 归还验收

```bash
curl -X POST "http://localhost:8000/api/v1/tracking/inspection?operator=库房管理员-周" \
  -H "Content-Type: application/json" \
  -d '{
    "approval_id": 1,
    "return_date": "2024-05-02T10:00:00",
    "inspector": "库房管理员-周",
    "inspector_department": "保管部",
    "condition_before": "出库时状态：完好，无损伤",
    "condition_after": "归还时状态：整体完好，轻微包装磨损",
    "damage_found": false,
    "damage_description": null,
    "packaging_check": "外包装有轻微划痕，但内部防护完好",
    "documents_complete": true,
    "missing_items": null,
    "overall_status": "normal",
    "recommendations": "下次运输建议加强边角防护",
    "signature_url": "/signatures/inspection-001.png"
  }'
```

### 7.14 完成审批

```bash
curl -X POST "http://localhost:8000/api/v1/approvals/1/complete?operator=库房管理员-周"
```

---

## 八、常见问题

### Q1: 审批状态流转异常怎么办？

**A**: 查看操作历史：
```bash
curl "http://localhost:8000/api/v1/approvals/{approval_id}/trace"
```

查看完整的操作历史会显示每个状态变更记录，查看具体哪里出了问题。

### Q2: 后台任务失败了如何处理？

**A**: 
1. 查看失败任务列表
2. 查看任务详情（错误信息）
3. 修复问题
4. 手动重试任务

### Q3: 如何查看所有失败原因？

**A**: 查看操作历史中的 `details` 字段包含详细信息。

### Q4: 审批流程卡住了怎么办？

**A**: 
1. 查看当前状态
2. 查看是否有失败的后台任务
3. 检查保险单是否已签发
4. 检查运输节点是否完整
5. 检查归还验收是否完成

### Q5: 如何查看完整流程中保险、运输、环境记录是如何关联的？

**A**: 通过 `approval_id` 关联所有数据。

通过 `trace` API 可以一次性获取所有关联的数据。

---

## 九、API 端点汇总

| 模块 | 方法 | 端点 | 说明 |
|------|------|------|------|
| 藏品档案 | POST | `/api/v1/collection | 创建藏品 |
| 藏品档案 | GET | `/api/v1/collection | 列表查询 |
| 藏品档案 | GET | `/api/v1/collection/{id}` | 详情查询 |
| 藏品档案 | PATCH | `/api/v1/collection/{id}` | 更新藏品 |
| 出库审批 | POST | `/api/v1/approvals` | 创建审批 |
| 出库审批 | GET | `/api/v1/approvals` | 列表查询 |
| 出库审批 | GET | `/api/v1/approvals/{id}` | 详情查询 |
| 出库审批 | POST | `/api/v1/approvals/{id}/submit` | 提交审批 |
| 出库审批 | POST | `/api/v1/approvals/{id}/approve` | 审批通过 |
| 出库审批 | POST | `/api/v1/approvals/{id}/reject` | 审批拒绝 |
| 出库审批 | POST | `/api/v1/approvals/{id}/start-transit` | 开始运输 |
| 出库审批 | POST | `/api/v1/approvals/{id}/arrive` | 到达目的地 |
| 出库审批 | POST | `/api/v1/approvals/{id}/start-return` | 开始归还 |
| 出库审批 | POST | `/api/v1/approvals/{id}/complete` | 完成审批 |
| 出库审批 | GET | `/api/v1/approvals/{id}/trace` | 完整追踪 |
| 保险单 | POST | `/api/v1/insurance` | 创建保险 |
| 保险单 | POST | `/api/v1/insurance/{id}/issue` | 签发保险 |
| 保险单 | POST | `/api/v1/insurance/{id}/cancel` | 取消保险 |
| 运输追踪 | POST | `/api/v1/tracking/transport` | 创建运输节点 |
| 运输追踪 | POST | `/api/v1/tracking/environment` | 环境记录 |
| 运输追踪 | POST | `/api/v1/tracking/inspection` | 归还验收 |
| 后台任务 | POST | `/api/v1/tasks` | 创建任务 |
| 后台任务 | GET | `/api/v1/tasks` | 任务列表 |
| 后台任务 | GET | `/api/v1/tasks/pending` | 待执行任务 |
| 后台任务 | GET | `/api/v1/tasks/failed` | 失败任务 |
| 后台任务 | POST | `/api/v1/tasks/{id}/execute` | 立即执行 |
| 后台任务 | POST | `/api/v1/tasks/{id}/retry` | 重试任务 |
| 后台任务 | POST | `/api/v1/tasks/process-pending` | 处理所有待执行任务 |
| 后台任务 | POST | `/api/v1/tasks/batch-retry` | 批量重试失败任务 |

---

## 十、扩展自定义后台任务

### 注册自定义任务处理器

```python
from app.services.task_service import task_service

def my_custom_handler(db, payload, approval_id):
    # 你的业务逻辑
    # 如果抛出异常会自动进入重试流程
    # 返回值会保存到 result 字段
    return {"status": "success"

# 注册处理器
task_service.register_handler('my_custom_task', my_custom_handler)
```

### 调用自定义任务

```python
from app.services.task_service import task_service
from app.database import SessionLocal

db = SessionLocal()
try:
    task = task_service.create_task(
        db,
        task_type='my_custom_task',
        payload={'key': 'value'},
        approval_id=1
    )
finally:
    db.close()
```
