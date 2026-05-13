# 变更冻结日历 API

集中式变更冻结管理系统，将散落在各处的变更冻结判断逻辑收回到API层统一管理。

## 技术栈

- **后端框架**: FastAPI
- **ORM**: SQLAlchemy
- **数据库**: SQLite（可扩展）
- **协议**: REST/JSON

## 核心数据对象

1. **ServiceGroup (服务分组)**: 按业务域划分变更管理范围
2. **FreezeCalendar (冻结日历)**: 定义冻结时间段和规则
3. **ChangeOrder (变更单)**: 变更申请记录
4. **ExceptionRequest (例外申请)**: 冻结期例外审批
5. **Approver (审批人)**: 审批权限管理
6. **BlockLog (拦截日志)**: 变更拦截记录

## 核心规则

- **日历匹配**: 自动检测变更时间是否落在冻结期
- **变更拦截**: 冻结期内变更自动拦截
- **例外审批**: 支持普通例外和紧急放行
- **日志导出**: 完整的拦截记录审计

## 快速启动

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn app.main:app --reload
```

服务默认运行在: `http://localhost:8000`

### 3. 访问API文档

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## 关键接口

### 服务分组管理

```bash
# 创建服务分组
POST /api/v1/service-groups/
GET  /api/v1/service-groups/
```

### 冻结日历管理

```bash
# 创建冻结日历
POST /api/v1/freeze-calendars/

# 查询冻结日历
GET  /api/v1/freeze-calendars/

# 匹配冻结期
GET  /api/v1/freeze-calendars/match?service_group_id=1&planned_time=2024-05-01T00:00:00

# 更新冻结状态
PATCH /api/v1/freeze-calendars/{id}/status
```

### 变更单管理

```bash
# 创建变更（自动校验）
POST /api/v1/change-orders/

# 查询变更列表
GET  /api/v1/change-orders/

# 获取单个变更
GET  /api/v1/change-orders/{id}

# 手动触发校验
POST /api/v1/change-orders/{id}/validate
```

### 例外申请管理

```bash
# 创建例外申请
POST /api/v1/exception-requests/

# 查询例外申请
GET  /api/v1/exception-requests/

# 审批例外
PATCH /api/v1/exception-requests/{id}/approve
```

### 拦截日志管理

```bash
# 查询拦截日志
GET  /api/v1/block-logs/

# 导出拦截日志
GET  /api/v1/block-logs/export

# 标记已解决
PATCH /api/v1/block-logs/{id}/resolve
```

## 一条会被拦截的路径

### 场景: 五一假期冻结期变更被拦截

#### 步骤1: 创建服务分组

```bash
curl -X POST "http://localhost:8000/api/v1/service-groups/" \
  -H "Content-Type: application/json" \
  -d '{"name": "支付核心服务", "description": "支付系统核心变更管理"}'
```

#### 步骤2: 创建五一冻结日历

```bash
curl -X POST "http://localhost:8000/api/v1/freeze-calendars/" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "五一假期冻结期",
    "service_group_id": 1,
    "start_time": "2024-04-28T00:00:00",
    "end_time": "2024-05-05T23:59:59",
    "reason": "五一假期期间禁止核心变更",
    "created_by": "admin"
  }'
```

#### 步骤3: 提交冻结期内变更 → **被拦截**

```bash
curl -X POST "http://localhost:8000/api/v1/change-orders/" \
  -H "Content-Type: application/json" \
  -d '{
    "change_id": "CHG-2024-0501-001",
    "title": "支付网关配置调整",
    "description": "调整支付超时配置",
    "service_group_id": 1,
    "planned_time": "2024-05-02T14:00:00",
    "requester": "dev001",
    "idempotency_key": "pay-gateway-config-20240501"
  }'
```

**拦截响应示例**:

```json
{
  "change_id": "CHG-2024-0501-001",
  "title": "支付网关配置调整",
  "status": "blocked",
  "created_at": "2024-04-25T10:00:00"
}
```

#### 步骤4: 查看拦截日志

```bash
curl "http://localhost:8000/api/v1/block-logs/?change_id=1"
```

## 运行测试场景

```bash
pip install requests
python test_data.py
```

测试场景覆盖:
1. ✓ 正常变更（不在冻结期）
2. ✓ 被拦截变更（在冻结期）
3. ✓ 重复请求幂等性保证
4. ✓ 例外审批人工处理
5. ✓ 拦截日志导出

## 状态枚举

### 变更单状态 (ChangeStatus)
- `pending`: 待处理
- `approved`: 已批准
- `rejected`: 已拒绝
- `blocked`: 已拦截
- `exception`: 例外放行
- `emergency`: 紧急放行

### 例外申请状态 (ExceptionStatus)
- `pending`: 待审批
- `approved`: 已批准
- `rejected`: 已拒绝

### 冻结日历状态 (FreezeStatus)
- `active`: 生效中
- `inactive`: 已失效

## 幂等性说明

创建变更单时支持 `idempotency_key` 参数:
- 相同幂等键重复提交不会创建新记录
- 直接返回已存在的变更单信息
- 避免重复提交制造脏结果

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── database.py      # 数据库连接
│   ├── models.py        # 数据模型
│   ├── schemas.py       # Pydantic模式
│   ├── services.py      # 业务逻辑
│   └── main.py          # API路由
├── requirements.txt     # 依赖
├── test_data.py         # 测试脚本
└── README.md
```
