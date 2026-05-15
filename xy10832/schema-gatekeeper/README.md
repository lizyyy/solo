# Schema 兼容门禁

数据平台 Schema 变更兼容性检测与门禁系统，防止字段变更导致下游任务解析失败。

## 功能特性

- Schema 版本管理
- 消费者登记与订阅
- 兼容性自动检测
- 变更申请审批门禁
- 异常队列与状态管理
- 历史轨迹追踪
- 影响报告导出

## 技术栈

- **后端**: Python + FastAPI + SQLite
- **前端**: React + TypeScript + Vite
- **样式**: Tailwind CSS

## 快速开始

### 后端启动

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

后端运行在: http://localhost:8000

API 文档: http://localhost:8000/docs

### 前端启动

```bash
cd frontend
npm install
npm run dev
```

前端运行在: http://localhost:5173

---

## API 接口示例

以下是可以直接调用的 API 示例：

### 1. 创建 Schema

```bash
curl -X POST "http://localhost:8000/api/schemas" \
  -H "Content-Type: application/json" \
  -d '{
    "schema_name": "user_profile",
    "version": "1.0.0",
    "fields": {
      "user_id": { "type": "string", "required": true },
      "username": { "type": "string", "required": true },
      "email": { "type": "string", "required": false },
      "age": { "type": "integer", "required": false }
    },
    "created_by": "admin",
    "description": "用户个人信息 Schema"
  }'
```

### 2. 查询所有 Schema

```bash
curl "http://localhost:8000/api/schemas"
```

### 3. 创建消费者

```bash
curl -X POST "http://localhost:8000/api/consumers" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "用户中心服务",
    "team": "数据平台",
    "email": "user-center@example.com",
    "subscribed_schema_id": 1,
    "subscribed_fields": ["user_id", "username", "email"]
  }'
```

### 4. 创建变更申请（**兼容变更示例**）

```bash
curl -X POST "http://localhost:8000/api/change-requests" \
  -H "Content-Type: application/json" \
  -d '{
    "schema_id": 1,
    "title": "添加可选字段 avatar",
    "change_type": "field_add",
    "old_schema": {
      "fields": {
        "user_id": { "type": "string", "required": true },
        "username": { "type": "string", "required": true },
        "email": { "type": "string", "required": false },
        "age": { "type": "integer", "required": false }
      }
    },
    "new_schema": {
      "fields": {
        "user_id": { "type": "string", "required": true },
        "username": { "type": "string", "required": true },
        "email": { "type": "string", "required": false },
        "age": { "type": "integer", "required": false },
        "avatar": { "type": "string", "required": false }
      }
    },
    "created_by": "developer",
    "comments": "添加用户头像字段"
  }'
```

### 5. 提交破坏性变更（**触发拦截**）

```bash
curl -X POST "http://localhost:8000/api/change-requests" \
  -H "Content-Type: application/json" \
  -d '{
    "schema_id": 1,
    "title": "删除必填字段 user_id",
    "change_type": "field_remove",
    "old_schema": {
      "fields": {
        "user_id": { "type": "string", "required": true },
        "username": { "type": "string", "required": true },
        "email": { "type": "string", "required": false },
        "age": { "type": "integer", "required": false }
      }
    },
    "new_schema": {
      "fields": {
        "username": { "type": "string", "required": true },
        "email": { "type": "string", "required": false },
        "age": { "type": "integer", "required": false }
      }
    },
    "created_by": "developer",
    "comments": "删除 user_id 字段"
  }'
```

### 6. 查询异常队列

```bash
curl "http://localhost:8000/api/intercept-records?status=open"
```

### 7. 解决异常记录

```bash
curl -X PATCH "http://localhost:8000/api/intercept-records/1/resolve" \
  -H "Content-Type: application/json" \
  -d '{
    "resolved_by": "admin",
    "resolution_note": "已通知消费者团队进行适配，确认可以发布"
  }'
```

### 8. 仪表盘统计

```bash
curl "http://localhost:8000/api/dashboard/stats"
```

---

## 故意失败的路径演示

### 场景 1: 状态流转失败 - 无效的状态转换

尝试直接从 `pending` 跳转到 `deployed`（不符合状态机规则）：

```bash
curl -X PATCH "http://localhost:8000/api/change-requests/1/status" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "deployed",
    "approved_by": "admin"
  }'
```

**预期结果**: 返回 400 错误，提示无效的状态转换

### 场景 2: 创建变更申请 - 字段类型变更导致不兼容

```bash
curl -X POST "http://localhost:8000/api/change-requests" \
  -H "Content-Type: application/json" \
  -d '{
    "schema_id": 1,
    "title": "修改 age 字段类型为 string",
    "change_type": "type_change",
    "old_schema": {
      "fields": {
        "user_id": { "type": "string", "required": true },
        "age": { "type": "integer", "required": false }
      }
    },
    "new_schema": {
      "fields": {
        "user_id": { "type": "string", "required": true },
        "age": { "type": "string", "required": false }
      }
    },
    "created_by": "developer"
  }'
```

**预期结果**: 变更创建成功，但 `compatibility_result.is_compatible = false`，同时会生成拦截记录

### 场景 3: 创建变更申请 - 字段从可选变为必填

```bash
curl -X POST "http://localhost:8000/api/change-requests" \
  -H "Content-Type: application/json" \
  -d '{
    "schema_id": 1,
    "title": "将 email 改为必填字段",
    "change_type": "required_change",
    "old_schema": {
      "fields": {
        "user_id": { "type": "string", "required": true },
        "email": { "type": "string", "required": false }
      }
    },
    "new_schema": {
      "fields": {
        "user_id": { "type": "string", "required": true },
        "email": { "type": "string", "required": true }
      }
    },
    "created_by": "developer"
  }'
```

**预期结果**: 检测到破坏性变更，自动拦截，影响所有订阅该字段的消费者

### 场景 4: 导出影响报告 - 不存在的变更申请

```bash
curl -X POST "http://localhost:8000/api/export/impact-report?change_request_id=99999" \
  -o report.xlsx
```

**预期结果**: 返回 404 错误，提示变更申请不存在

---

## 状态流转图

```
pending ──► approved ──► deployed ──► completed
   │         │
   ▼         ▼
blocked   rejected
```

## 数据模型关系

```
SchemaVersion
    ├── Consumer (多对一)
    └── ChangeRequest (多对一)
            ├── InterceptRecord (多对一)
            └── ImpactReport (多对一)
```

## 核心检测规则

1. **字段删除检测**: 检查新 Schema 是否删除了旧 Schema 中的字段
2. **类型变更检测**: 检查字段类型是否发生变化
3. **必填属性变更**: 检查字段是否从可选变为必填
4. **新增必填字段**: 检查是否新增了必填字段

所有检测到的破坏性变更都会自动创建拦截记录，并关联到受影响的消费者。
