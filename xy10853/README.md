# 分片上传协调器 (Chunk Upload Coordinator)

一个偏技术向的全栈 Web/API 应用，用于管理大文件分片上传的进度、断点续传、失败重试和状态追踪。

## 技术栈

- **后端**: Python + FastAPI + SQLAlchemy + SQLite
- **前端**: 原生 HTML/JavaScript (无框架依赖)

## 项目结构

```
.
├── backend/
│   ├── __init__.py
│   ├── main.py          # FastAPI 应用入口
│   ├── models.py        # 数据模型定义
│   ├── schemas.py       # Pydantic 验证模型
│   └── services.py      # 业务逻辑层
├── frontend/
│   └── index.html       # 管理前端
├── requirements.txt     # Python 依赖
└── README.md           # 本文档
```

## 数据模型

### UploadTask (上传任务)
- `id`: 任务唯一标识
- `file_name`: 文件名
- `file_size`: 文件总大小
- `total_chunks`: 总分片数
- `chunk_size`: 单个分片大小
- `file_hash`: 文件整体哈希
- `status`: 任务状态 (pending/initialized/uploading/verifying/completed/failed/paused)
- `resume_point`: 断点续传点 (从第几个分片继续)
- `retry_count`: 已重试次数
- `max_retries`: 最大重试次数
- `callback_url`: 完成回调地址
- `created_at/updated_at/completed_at`: 时间戳
- `error_message`: 错误信息

### FileChunk (文件分片)
- `id`: 分片唯一标识
- `task_id`: 所属任务ID
- `chunk_number`: 分片序号
- `chunk_size`: 分片大小
- `chunk_hash`: 分片哈希
- `status`: 分片状态 (pending/uploading/uploaded/verified/failed/retrying)
- `retry_count`: 分片重试次数
- `uploaded_at/verified_at`: 时间戳
- `error_message`: 错误信息

### StatusHistory (状态变更历史)
- 记录每次状态变更，包括变更前状态、变更后状态、操作人、备注

## 核心规则

1. **分片登记**: 每个分片上传前先登记，标记为 uploading
2. **摘要校验**: 分片上传完成后验证哈希，不匹配标记为 failed
3. **断点续传**: 记录续传点，客户端从该分片继续上传
4. **失败重试**: 单个分片失败自动重试，超过次数任务失败
5. **完成通知**: 所有分片验证通过后触发回调

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
cd backend
python main.py
```

服务将在 `http://localhost:8000` 启动

### 3. 访问应用

打开浏览器访问: `http://localhost:8000`

- **API 文档**: `http://localhost:8000/docs` (Swagger UI)
- **前端界面**: `http://localhost:8000`

## API 接口示例

以下是可直接调用的 curl 命令示例：

### 创建上传任务

```bash
curl -X POST "http://localhost:8000/api/tasks" \
  -H "Content-Type: application/json" \
  -d '{
    "file_name": "large_video.mp4",
    "file_size": 104857600,
    "chunk_size": 1048576,
    "file_hash": "abcdef123456",
    "max_retries": 3
  }'
```

### 查询任务列表

```bash
# 查询所有任务
curl "http://localhost:8000/api/tasks"

# 按状态筛选
curl "http://localhost:8000/api/tasks?status=failed"
```

### 查询单个任务详情

```bash
curl "http://localhost:8000/api/tasks/{task_id}"
```

### 登记分片上传

```bash
curl -X POST "http://localhost:8000/api/chunks/register" \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "task_abc123",
    "chunk_number": 0,
    "chunk_size": 1048576,
    "chunk_hash": "chunk0_hash_xyz"
  }'
```

### 完成分片上传（验证）

```bash
curl -X POST "http://localhost:8000/api/chunks/complete" \
  -H "Content-Type: application/json" \
  -d '{
    "chunk_id": "task_abc123_chunk_0",
    "chunk_hash": "chunk0_hash_xyz"
  }'
```

### 标记分片失败

```bash
curl -X POST "http://localhost:8000/api/chunks/{chunk_id}/fail" \
  -H "Content-Type: application/json" \
  -d '{"error_message": "网络连接超时"}'
```

### 人工复核操作

```bash
# 重试任务
curl -X POST "http://localhost:8000/api/tasks/{task_id}/review" \
  -H "Content-Type: application/json" \
  -d '{"task_id": "{task_id}", "action": "retry"}'

# 暂停任务
curl -X POST "http://localhost:8000/api/tasks/{task_id}/review" \
  -H "Content-Type: application/json" \
  -d '{"task_id": "{task_id}", "action": "pause"}'

# 恢复任务
curl -X POST "http://localhost:8000/api/tasks/{task_id}/review" \
  -H "Content-Type: application/json" \
  -d '{"task_id": "{task_id}", "action": "resume"}'
```

### 导出任务数据

```bash
curl "http://localhost:8000/api/tasks/{task_id}/export"
```

### 获取统计信息

```bash
curl "http://localhost:8000/api/stats"
```

## 故意失败的路径

以下是一个会导致任务失败的操作序列：

```bash
# 1. 创建任务（设置 max_retries=2）
TASK_ID=$(curl -s -X POST "http://localhost:8000/api/tasks" \
  -H "Content-Type: application/json" \
  -d '{
    "file_name": "will_fail.dat",
    "file_size": 5242880,
    "chunk_size": 1048576,
    "file_hash": "test_hash",
    "max_retries": 2
  }' | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" )

echo "Created task: $TASK_ID"

# 2. 登记分片 0 和 1
curl -X POST "http://localhost:8000/api/chunks/register" \
  -H "Content-Type: application/json" \
  -d "{\"task_id\": \"$TASK_ID\", \"chunk_number\": 0, \"chunk_size\": 1048576, \"chunk_hash\": \"hash0\"}"

curl -X POST "http://localhost:8000/api/chunks/register" \
  -H "Content-Type: application/json" \
  -d "{\"task_id\": \"$TASK_ID\", \"chunk_number\": 1, \"chunk_size\": 1048576, \"chunk_hash\": \"hash1\"}"

# 3. 分片 0 正常完成
curl -X POST "http://localhost:8000/api/chunks/complete" \
  -H "Content-Type: application/json" \
  -d "{\"chunk_id\": \"${TASK_ID}_chunk_0\", \"chunk_hash\": \"hash0\"}"

# 4. 分片 1 第一次失败（哈希不匹配）
curl -X POST "http://localhost:8000/api/chunks/complete" \
  -H "Content-Type: application/json" \
  -d "{\"chunk_id\": \"${TASK_ID}_chunk_1\", \"chunk_hash\": \"WRONG_HASH\"}"

# 5. 分片 1 第二次失败（超过 max_retries）
curl -X POST "http://localhost:8000/api/chunks/${TASK_ID}_chunk_1/fail" \
  -H "Content-Type: application/json" \
  -d '{"error_message": "网络超时，重试2次仍失败"}'

# 6. 查看最终状态（应该是 failed）
curl "http://localhost:8000/api/tasks/$TASK_ID"
```

## 前端功能

访问 `http://localhost:8000` 即可使用管理前端：

1. **任务列表**: 查看所有上传任务，支持按状态筛选
2. **任务详情**:
   - 查看任务基本信息
   - 可视化分片状态（彩色网格）
   - 分片详情表格
   - 状态变更历史记录
3. **复核操作**:
   - 重试任务
   - 暂停任务
   - 恢复任务
   - 导出任务数据
4. **创建任务**: 新建上传任务
5. **流程演示**:
   - 成功上传演示
   - 失败场景演示

## 数据库

使用 SQLite 数据库，文件位于 `backend/upload_coordinator.db`，首次启动时自动创建。

## 注意事项

1. 这是一个演示项目，生产环境请考虑：
   - 使用 PostgreSQL/MySQL 替代 SQLite
   - 添加用户认证和权限控制
   - 添加日志系统
   - 实现真实的文件存储和合并逻辑
   - 添加 WebSocket 支持实时状态推送

2. 当前版本的文件合并逻辑仅为演示，实际使用时需要：
   - 存储真实的分片数据
   - 所有分片完成后进行合并
   - 验证合并后的文件整体哈希
