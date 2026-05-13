# 文件预览转换 API

一个小而完整的 API 状态闭环验证项目，实现文件预览转换的全流程管理。

## 功能特性

- **源文件管理**：上传和管理待转换文件
- **转换任务**：任务排队、状态追踪、阶段记录
- **失败重试**：自动失败重试机制，可配置重试次数
- **预览链接**：转换成功后生成预览链接
- **状态查询**：实时查询任务状态和历史记录
- **幂等性**：重复提交不会产生脏数据

## 技术栈

- FastAPI - 现代化 Web 框架
- SQLAlchemy - ORM 数据库
- SQLite - 嵌入式数据库（重启后数据不丢失）
- Jinja2 - 模板引擎

## 快速开始

### 安装依赖

```bash
pip install -r requirements.txt
```

### 启动服务

```bash
python main.py
```

或使用 uvicorn：

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 访问地址

- API 文档：http://localhost:8000/docs
- 管理页面：http://localhost:8000/
- Redoc 文档：http://localhost:8000/redoc

## API 接口

### 1. 创建转换任务

```bash
POST /api/tasks
Content-Type: multipart/form-data

file: 待转换文件
handler: 处理人姓名（可选）
```

### 2. 查询任务状态

```bash
GET /api/tasks/{task_id}
```

### 3. 查询所有任务

```bash
GET /api/tasks
```

### 4. 重试失败任务

```bash
POST /api/tasks/{task_id}/retry
```

### 5. 获取预览链接

```bash
GET /api/tasks/{task_id}/preview
```

## 数据模型

### Task（转换任务）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 任务唯一标识 |
| filename | String | 源文件名 |
| file_size | Integer | 文件大小 |
| status | Enum | 任务状态 |
| handler | String | 处理人 |
| retry_count | Integer | 重试次数 |
| max_retries | Integer | 最大重试次数 |
| error_message | String | 错误信息 |
| failed_stage | String | 失败阶段 |
| preview_url | String | 预览链接 |
| created_at | DateTime | 创建时间 |
| updated_at | DateTime | 更新时间 |
| completed_at | DateTime | 完成时间 |

### TaskStatus（任务状态）

- `PENDING` - 排队中
- `UPLOADED` - 已上传
- `PROCESSING` - 转换中
- `GENERATING_PREVIEW` - 生成预览中
- `COMPLETED` - 已完成
- `FAILED` - 已失败

## 示例流程

### 成功流程

```bash
# 1. 上传文件创建任务
curl -X POST "http://localhost:8000/api/tasks" \
  -F "file=@test.pdf" \
  -F "handler=张三"

# 2. 查询任务状态
curl "http://localhost:8000/api/tasks/{task_id}"

# 3. 获取预览链接
curl "http://localhost:8000/api/tasks/{task_id}/preview"
```

### 问题流程（失败重试）

```bash
# 1. 创建会失败的任务（上传 .fail 后缀文件）
curl -X POST "http://localhost:8000/api/tasks" \
  -F "file=@test.fail" \
  -F "handler=李四"

# 2. 查看失败状态
curl "http://localhost:8000/api/tasks/{task_id}"

# 3. 手动重试
curl -X POST "http://localhost:8000/api/tasks/{task_id}/retry"
```

## 项目结构

```
.
├── main.py              # 主应用入口
├── models.py            # 数据模型
├── schemas.py           # Pydantic 模式
├── services.py          # 业务逻辑服务
├── database.py          # 数据库配置
├── requirements.txt     # 依赖配置
├── README.md           # 项目说明
├── uploads/            # 上传文件目录
├── previews/           # 预览文件目录
└── templates/          # HTML 模板
    └── index.html      # 管理页面
```

## 状态闭环说明

1. **创建任务**：文件上传后进入 PENDING 状态
2. **排队处理**：任务队列按顺序处理
3. **状态推进**：PENDING → UPLOADED → PROCESSING → GENERATING_PREVIEW → COMPLETED
4. **异常处理**：任何阶段失败 → FAILED，记录失败阶段和错误信息
5. **重试机制**：自动重试（最多 3 次）或手动重试
6. **结果输出**：成功生成预览链接，失败保留错误日志
