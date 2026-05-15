# 任务取消传播 API

## 项目简介
主任务取消传播、子任务中止、资源清理、通知抑制的后端服务

## 技术栈
- Python 3.8+
- FastAPI
- SQLAlchemy
- SQLite

## 快速启动

### 1. 安装依赖
```bash
cd task_cancel_api
pip install -r requirements.txt
```

### 2. 启动服务
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

或使用启动脚本:
```bash
./start.sh
```

### 3. 访问API文档
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 核心数据对象

| 对象 | 说明 |
|------|------|
| MainTask | 主任务 |
| SubTask | 子任务 |
| CancelReason | 取消原因 |
| TempResource | 临时资源 |
| PropagationState | 传播状态 |
| CleanupResult | 清理结果 |

## 核心状态枚举

### TaskStatus
- pending: 待处理
- running: 运行中
- cancelling: 取消中
- cancelled: 已取消
- completed: 已完成
- failed: 失败

### PropagationStatus
- not_started: 未开始
- propagating: 传播中
- partial_success: 部分成功
- success: 成功
- failed: 失败

## API 接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /tasks/ | 创建主任务 |
| POST | /tasks/{task_id}/sub-tasks/ | 添加子任务 |
| POST | /sub-tasks/{sub_task_id}/resources/ | 添加临时资源 |
| POST | /tasks/cancel | 发起任务取消 |
| POST | /tasks/{task_id}/propagate | 执行取消传播 |
| GET | /tasks/{task_id}/progress | 查询传播进度 |
| GET | /tasks/{task_id} | 查询任务详情 |
| GET | /tasks/ | 查询所有主任务 |
| GET | /tasks/{task_id}/cleanup-results | 查询清理结果 |
| PUT | /tasks/{task_id}/status | 更新任务状态 |
| GET | /health | 健康检查 |

## 使用示例

### 1. 造测试数据

```bash
# 创建主任务
curl -X POST "http://localhost:8000/tasks/" \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "MAIN_TASK_001",
    "name": "数据导出任务",
    "description": "导出年度报表数据"
  }'

# 添加3个子任务
for i in 1 2 3; do
  curl -X POST "http://localhost:8000/tasks/MAIN_TASK_001/sub-tasks/" \
    -H "Content-Type: application/json" \
    -d "{
      \"sub_task_id\": \"SUB_TASK_00${i}\",
      \"name\": \"子任务${i}\",
      \"description\": \"子任务${i}描述\",
      \"order\": ${i}
    }"
done

# 为每个子任务添加临时资源
curl -X POST "http://localhost:8000/sub-tasks/SUB_TASK_001/resources/" \
  -H "Content-Type: application/json" \
  -d '{
    "resource_id": "RES_001",
    "resource_type": "temp_file",
    "resource_location": "/tmp/data_001.csv",
    "size_bytes": 1024000
  }'

curl -X POST "http://localhost:8000/sub-tasks/SUB_TASK_002/resources/" \
  -H "Content-Type: application/json" \
  -d '{
    "resource_id": "RES_002",
    "resource_type": "temp_file",
    "resource_location": "/tmp/data_002.csv",
    "size_bytes": 2048000
  }'

curl -X POST "http://localhost:8000/sub-tasks/SUB_TASK_003/resources/" \
  -H "Content-Type: application/json" \
  -d '{
    "resource_id": "RES_003",
    "resource_type": "database_connection",
    "resource_location": "db://temp_session",
    "size_bytes": 0
  }'
```

### 2. 正常流程演示

```bash
# 发起取消请求
curl -X POST "http://localhost:8000/tasks/cancel" \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "MAIN_TASK_001",
    "reason_code": "USER_CANCELLED",
    "reason_message": "用户主动取消任务",
    "triggered_by": "admin",
    "suppress_notification": false,
    "idempotency_key": "request_12345"
  }'

# 执行取消传播
curl -X POST "http://localhost:8000/tasks/MAIN_TASK_001/propagate"

# 查询传播进度
curl "http://localhost:8000/tasks/MAIN_TASK_001/progress"

# 查询任务详情
curl "http://localhost:8000/tasks/MAIN_TASK_001"

# 查询清理结果
curl "http://localhost:8000/tasks/MAIN_TASK_001/cleanup-results"
```

### 3. 触发异常场景

```bash
# 场景1: 取消已完成的任务（会报错）
# 先把任务状态设为 completed
curl -X PUT "http://localhost:8000/tasks/MAIN_TASK_001/status?status=completed"

# 再尝试取消（会返回 INVALID_TASK_STATUS 错误）
curl -X POST "http://localhost:8000/tasks/cancel" \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "MAIN_TASK_001",
    "reason_code": "TEST",
    "reason_message": "测试取消"
  }'

# 场景2: 模拟传播过程中某个子任务失败
# 先重置一个新任务 MAIN_TASK_002（参考造数据步骤）
# 然后执行传播时指定 fail_at_index 参数
curl -X POST "http://localhost:8000/tasks/MAIN_TASK_002/propagate?fail_at_index=1"

# 场景3: 查询不存在的任务
curl "http://localhost:8000/tasks/NON_EXISTENT"

# 场景4: 重复提交（幂等性测试）
# 使用相同的 idempotency_key 提交两次取消请求
# 第二次会直接返回缓存的结果，不会产生脏数据
curl -X POST "http://localhost:8000/tasks/cancel" \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "MAIN_TASK_003",
    "reason_code": "TEST",
    "reason_message": "幂等测试",
    "idempotency_key": "same_key_001"
  }'

# 第二次提交，结果相同，但不会重复处理
curl -X POST "http://localhost:8000/tasks/cancel" \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "MAIN_TASK_003",
    "reason_code": "TEST",
    "reason_message": "幂等测试",
    "idempotency_key": "same_key_001"
  }'
```

### 4. 查看处理记录

```bash
# 查看所有主任务列表
curl "http://localhost:8000/tasks/"

# 查看特定任务的完整信息（包含子任务、取消原因、传播状态）
curl "http://localhost:8000/tasks/MAIN_TASK_001"

# 查看资源清理的详细结果
curl "http://localhost:8000/tasks/MAIN_TASK_001/cleanup-results"

# SQLite 数据库文件位置: task_cancel.db
# 可以使用 sqlite3 命令行工具直接查询
sqlite3 task_cancel.db "SELECT * FROM main_tasks;"
sqlite3 task_cancel.db "SELECT * FROM propagation_states;"
sqlite3 task_cancel.db "SELECT * FROM cleanup_results;"
```

## 幂等性机制

API 通过 `idempotency_key` 参数实现请求的幂等性：
- 相同的 `idempotency_key` 在 24 小时内重复提交会返回相同的结果
- 不会产生重复的取消记录
- 确保重复提交不会制造脏数据

## 项目结构

```
task_cancel_api/
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI 应用入口
│   ├── models.py        # 数据库模型
│   ├── schemas.py       # Pydantic 数据模型
│   ├── database.py      # 数据库连接
│   └── cancel_engine.py # 取消传播核心引擎
├── tests/
│   └── test_api.py     # 测试脚本
├── docs/
├── requirements.txt
├── start.sh
├── test_data.sh
└── README.md
```

## 错误码说明

| 错误码 | 说明 |
|--------|------|
| TASK_NOT_FOUND | 任务不存在 |
| INVALID_TASK_STATUS | 任务状态不允许取消 |
| PROPAGATION_NOT_FOUND | 传播状态未初始化 |

## 健康检查

```bash
curl http://localhost:8000/health
```
