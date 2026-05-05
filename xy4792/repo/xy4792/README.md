# 合同扫描任务系统 (Contract Scanner)

一个基于 FastAPI + Celery 的合同扫描任务管理系统，提供完整的任务状态追踪、重试机制、死信管理和报告导出功能。

## 功能特性

- **任务提交**: 通过 API 提交合同扫描任务
- **三步处理**: 模拟 OCR 识别 → 规则校验 → 报告生成三个步骤
- **状态追踪**: 实时查询任务状态、步骤日志、重试记录
- **任务取消**: 支持取消待执行或重试中的任务
- **重试机制**: 自动重试失败步骤，支持指数退避
- **死信管理**: 重试超限任务进入死信队列，支持手动重放
- **报告导出**: 支持 JSON 和 Markdown 格式的处理报告导出

## 技术栈

- **Web 框架**: FastAPI
- **任务队列**: Celery
- **消息代理**: Redis
- **数据库**: SQLite (SQLAlchemy ORM)

## 前置要求

- Python 3.8+
- Redis Server (运行在 localhost:6379)

## 安装

```bash
# 克隆项目
cd xy4792

# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt
```

## 启动服务

### 1. 启动 Redis (如果未运行)

```bash
# macOS (使用 Homebrew)
brew services start redis

# 或手动启动
redis-server
```

### 2. 启动 FastAPI 服务

```bash
cd /Users/mac/pro/solocoder/pro/xy4792/repo/xy4792
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API 文档地址:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 3. 启动 Celery Worker

```bash
cd /Users/mac/pro/solocoder/pro/xy4792/repo/xy4792
celery -A app.celery_app worker --loglevel=info -P solo
```

> 注意: macOS 上建议使用 `-P solo` 或 `-P threads` 避免多进程问题

## API 接口速查

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /tasks | 提交新任务 |
| GET | /tasks | 获取任务列表 |
| GET | /tasks/{task_id} | 获取任务详情 |
| DELETE | /tasks/{task_id} | 取消任务 |
| GET | /dead-letters | 获取死信列表 |
| POST | /dead-letters/{id}/replay | 重放死信任务 |
| GET | /tasks/{task_id}/export/json | 导出 JSON 报告 |
| GET | /tasks/{task_id}/export/markdown | 导出 Markdown 报告 |

## 使用示例 (curl)

### 1. 健康检查

```bash
curl http://localhost:8000/health
```

### 2. 提交正常任务

```bash
curl -X POST http://localhost:8000/tasks \
  -H "Content-Type: application/json" \
  -d '{"contract_name": "采购合同_2024_v1.pdf"}'
```

响应示例:
```json
{
  "task_id": "task_abc123def456",
  "celery_task_id": "uuid-uuid-uuid",
  "message": "Task task_abc123def456 created and submitted to queue"
}
```

### 3. 提交会失败的任务 (用于测试重试和死信)

`force_fail` 可选值: `ocr`, `validation`, `report`

```bash
# 让 OCR 步骤失败
curl -X POST http://localhost:8000/tasks \
  -H "Content-Type: application/json" \
  -d '{"contract_name": "问题合同.pdf", "force_fail": "validation"}'
```

### 4. 查询任务状态

```bash
# 替换为你的 task_id
TASK_ID="task_abc123def456"
curl http://localhost:8000/tasks/$TASK_ID
```

### 5. 获取所有任务列表

```bash
curl http://localhost:8000/tasks

# 按状态过滤
curl "http://localhost:8000/tasks?status=success"
curl "http://localhost:8000/tasks?status=dead_letter"
```

### 6. 取消待执行任务

```bash
# 只有 pending 或 retrying 状态的任务可以取消
TASK_ID="task_abc123def456"
curl -X DELETE http://localhost:8000/tasks/$TASK_ID
```

### 7. 查看死信队列

```bash
curl http://localhost:8000/dead-letters
```

### 8. 重放死信任务

```bash
# 替换为死信 ID (从 dead-letters 接口获取)
DEAD_LETTER_ID=1
curl -X POST http://localhost:8000/dead-letters/$DEAD_LETTER_ID/replay
```

### 9. 导出处理报告

```bash
TASK_ID="task_abc123def456"

# 导出 JSON 格式
curl http://localhost:8000/tasks/$TASK_ID/export/json

# 导出 Markdown 格式
curl http://localhost:8000/tasks/$TASK_ID/export/markdown

# 保存 Markdown 报告到文件
curl http://localhost:8000/tasks/$TASK_ID/export/markdown -o report.md
```

## 完整测试流程

### 测试 1: 正常任务流程

```bash
# 1. 提交任务
RESPONSE=$(curl -s -X POST http://localhost:8000/tasks \
  -H "Content-Type: application/json" \
  -d '{"contract_name": "销售合同_2024.pdf"}')

TASK_ID=$(echo $RESPONSE | python3 -c "import sys,json; print(json.load(sys.stdin)['task_id'])")
echo "任务ID: $TASK_ID"

# 2. 等待几秒让任务执行
sleep 8

# 3. 查询任务状态
curl http://localhost:8000/tasks/$TASK_ID

# 4. 导出报告
curl http://localhost:8000/tasks/$TASK_ID/export/markdown
```

### 测试 2: 失败 → 重试 → 死信流程

```bash
# 1. 提交会失败的任务 (validation 步骤)
RESPONSE=$(curl -s -X POST http://localhost:8000/tasks \
  -H "Content-Type: application/json" \
  -d '{"contract_name": "有问题的合同.pdf", "force_fail": "validation"}')

TASK_ID=$(echo $RESPONSE | python3 -c "import sys,json; print(json.load(sys.stdin)['task_id'])")
echo "任务ID: $TASK_ID"

# 2. 观察重试过程 (需要等待约 14 秒: 2^1 + 2^2 + 2^3 = 14秒)
for i in {1..15}; do
  echo "=== 第 $i 秒 ==="
  curl -s http://localhost:8000/tasks/$TASK_ID | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"状态: {d['status']}, 重试: {d['retry_count']}/{d['max_retries']}\")"
  sleep 1
done

# 3. 查看死信队列
curl http://localhost:8000/dead-letters

# 4. 获取死信 ID并重放 (可选)
# DEAD_LETTER_ID=1
# curl -X POST http://localhost:8000/dead-letters/$DEAD_LETTER_ID/replay
```

### 测试 3: 取消任务

```bash
# 1. 先停止 celery worker，让任务保持 pending
# 2. 提交任务
RESPONSE=$(curl -s -X POST http://localhost:8000/tasks \
  -H "Content-Type: application/json" \
  -d '{"contract_name": "待取消的合同.pdf"}')

TASK_ID=$(echo $RESPONSE | python3 -c "import sys,json; print(json.load(sys.stdin)['task_id'])")
echo "任务ID: $TASK_ID"

# 3. 取消任务
curl -X DELETE http://localhost:8000/tasks/$TASK_ID

# 4. 验证已取消
curl http://localhost:8000/tasks/$TASK_ID
```

## 任务状态说明

| 状态 | 说明 |
|------|------|
| `pending` | 任务已提交，等待执行 |
| `running` | 任务正在执行 |
| `retrying` | 任务失败，正在重试等待 |
| `success` | 任务成功完成 |
| `failed` | 任务失败 (未使用) |
| `cancelled` | 任务已取消 |
| `dead_letter` | 任务重试超限，进入死信队列 |

## 数据库表结构

- **tasks**: 任务主表
- **step_logs**: 步骤执行日志 (OCR/VALIDATION/REPORT)
- **retry_logs**: 重试记录
- **dead_letters**: 死信队列

## 配置说明

环境变量 (可选，创建 `.env` 文件):

```env
DATABASE_URL=sqlite:///./contract_scanner.db
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
MAX_RETRIES=3
```

## 注意事项

1. **Redis 必须运行**: Celery 需要 Redis 作为消息代理
2. **Worker 进程**: macOS 上建议使用 `-P solo` 或 `-P threads`
3. **重试间隔**: 使用指数退避策略 (2^n 秒)
4. **任务取消**: 只能取消 pending 或 retrying 状态的任务

## 故障排查

### 问题 1: 任务一直 pending

检查 Redis 是否运行:
```bash
redis-cli ping
```

检查 Celery worker 是否运行:
```bash
ps aux | grep celery
```

### 问题 2: 数据库文件无法创建

检查目录权限:
```bash
ls -la .
```

### 问题 3: 导入错误

确认 PYTHONPATH 包含当前目录:
```bash
export PYTHONPATH=$PYTHONPATH:.
```
