# 资源标签继承 API - 测试请求示例

## 1. 正常流程 - 创建并执行任务

### 1.1 创建任务
```bash
curl -X POST http://localhost:8080/api/v1/tag-inheritance/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "REQ_001",
    "targetNodeId": "PROJ_001",
    "createdBy": "admin"
  }'
```

**预期响应**:
```json
{
  "code": 200,
  "message": "Success",
  "data": {
    "taskId": "uuid-generated",
    "requestId": "REQ_001",
    "targetNodeId": "PROJ_001",
    "status": "PENDING"
  }
}
```

### 1.2 验证任务
```bash
curl -X POST http://localhost:8080/api/v1/tag-inheritance/tasks/{taskId}/validate
```

**预期响应**: 状态变为 VALIDATING，然后 INHERITING

### 1.3 执行继承计算
```bash
curl -X POST http://localhost:8080/api/v1/tag-inheritance/tasks/{taskId}/calculate
```

**预期响应**: 状态变为 CONFLICT（如果有冲突）或 COMPLETED

### 1.4 查看任务状态
```bash
curl http://localhost:8080/api/v1/tag-inheritance/tasks/{taskId}/status
```

### 1.5 查看计算结果
```bash
curl http://localhost:8080/api/v1/tag-inheritance/tasks/{taskId}/results
```

### 1.6 查看冲突列表
```bash
curl http://localhost:8080/api/v1/tag-inheritance/tasks/{taskId}/conflicts
```

### 1.7 查看变更历史
```bash
curl http://localhost:8080/api/v1/tag-inheritance/tasks/{taskId}/history
```

### 1.8 导出历史
```bash
curl http://localhost:8080/api/v1/tag-inheritance/tasks/{taskId}/history/export
```

---

## 2. 异常场景 - 节点不存在

```bash
curl -X POST http://localhost:8080/api/v1/tag-inheritance/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "REQ_002",
    "targetNodeId": "NON_EXISTENT_NODE",
    "createdBy": "admin"
  }'
```

**预期响应**:
```json
{
  "code": 404,
  "message": "Target node not found: NON_EXISTENT_NODE",
  "data": null
}
```

---

## 3. 重复请求 - 幂等性测试（会被拦截！）

### 3.1 第一次请求（正常）
```bash
curl -X POST http://localhost:8080/api/v1/tag-inheritance/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "REQ_003",
    "targetNodeId": "PROJ_001",
    "createdBy": "admin"
  }'
```

### 3.2 第二次请求（相同 requestId，会被拦截！）
```bash
curl -v -X POST http://localhost:8080/api/v1/tag-inheritance/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "REQ_003",
    "targetNodeId": "PROJ_001",
    "createdBy": "admin"
  }'
```

**预期响应 (真正的 HTTP 409 Conflict 状态码)**:
```
< HTTP/1.1 409 Conflict
< Content-Type: application/json

{
  "code": 409,
  "message": "Duplicate request - task already exists",
  "data": {
    "taskId": "uuid-from-first-request",
    "requestId": "REQ_003",
    "targetNodeId": "PROJ_001",
    "status": "PENDING"
  }
}
```

**关键说明**: 重复提交不会产生脏数据！系统会检测到相同 requestId 并返回 **真正的 HTTP 409 状态码**，同时返回已有任务的状态，**不会创建新任务**。

---

## 4. 人工处理冲突

### 4.1 先获取冲突列表中的 conflictId
```bash
curl http://localhost:8080/api/v1/tag-inheritance/tasks/{taskId}/conflicts
```

### 4.2 解决冲突 - 父级值获胜
```bash
curl -X POST http://localhost:8080/api/v1/tag-inheritance/tasks/{taskId}/conflicts/{conflictId}/resolve \
  -H "Content-Type: application/json" \
  -d '{
    "resolution": "PARENT_WINS",
    "resolvedBy": "admin"
  }'
```

### 4.3 解决冲突 - 子级值获胜
```bash
curl -X POST http://localhost:8080/api/v1/tag-inheritance/tasks/{taskId}/conflicts/{conflictId}/resolve \
  -H "Content-Type: application/json" \
  -d '{
    "resolution": "CHILD_WINS",
    "resolvedBy": "admin"
  }'
```

### 4.4 解决冲突 - 手动覆盖
```bash
curl -X POST http://localhost:8080/api/v1/tag-inheritance/tasks/{taskId}/conflicts/{conflictId}/resolve \
  -H "Content-Type: application/json" \
  -d '{
    "resolution": "MANUAL_OVERRIDE",
    "resolvedBy": "admin",
    "resolvedValue": "custom_value"
  }'
```

### 4.5 解决冲突 - 跳过
```bash
curl -X POST http://localhost:8080/api/v1/tag-inheritance/tasks/{taskId}/conflicts/{conflictId}/resolve \
  -H "Content-Type: application/json" \
  -d '{
    "resolution": "SKIP",
    "resolvedBy": "admin"
  }'
```

---

## 5. 状态推进错误（不在正确状态时操作）

```bash
# 直接计算未验证的任务
curl -X POST http://localhost:8080/api/v1/tag-inheritance/tasks/{taskId}/calculate
```

**预期响应**:
```json
{
  "code": 400,
  "message": "Task status is not PENDING, current status: ...",
  "data": null
}
```

---

## 预加载的测试数据

### 资源节点层级:
- ORG_001 (Root Organization)
  - DEPT_001 (Engineering Department)
    - TEAM_001 (Backend Team)
      - PROJ_001 (Tag Inheritance Project)

### 覆盖规则:
- RULE_001: environment -> production (针对 PROJ_001)
- RULE_002: security_level -> top_secret (针对 PROJ_001)
