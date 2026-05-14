# 图片转码任务控制台

一个完整的图片转码任务管理系统，包含 Python FastAPI 后端和 Vue 3 前端。

## 功能特性

### 核心功能
- 📋 **任务列表**：分页展示所有转码任务，支持状态筛选、关键词搜索
- ➕ **创建任务**：完整的任务创建表单，包含原图信息、目标规格、水印配置
- 🔍 **任务详情**：详细展示任务的所有信息，包括原图信息、目标规格、水印配置、状态日志
- 🔄 **失败重试**：任务失败后支持手动重试，有重试次数限制
- 📦 **版本管理**：支持查看历史版本和回滚到指定版本
- 💧 **水印确认**：支持水印配置的人工确认流程
- 📊 **导出Excel**：支持按条件筛选后导出任务数据到Excel
- 🔑 **幂等性保障**：通过幂等性Key防止重复提交

### 数据字段
- **原图信息**：URL、文件名、尺寸、格式
- **目标规格**：尺寸、格式、质量
- **水印配置**：启用水印、文字、位置、透明度、字体大小、颜色
- **处理队列**：队列位置、优先级、状态
- **错误日志**：详细的错误信息和堆栈追踪
- **产物清单**：输出URL、文件大小

## 技术栈

### 后端
- **框架**：FastAPI 0.104.1
- **数据库**：SQLite (SQLAlchemy 2.0)
- **数据导出**：pandas + openpyxl
- **其他**：python-multipart (文件上传支持)

### 前端
- **框架**：Vue 3 (Composition API)
- **路由**：Vue Router 4
- **UI组件**：Element Plus
- **HTTP客户端**：Axios
- **日期处理**：Day.js

## 项目结构

```
.
├── backend/                 # 后端项目
│   ├── app/
│   │   ├── api/            # API路由
│   │   │   └── tasks.py
│   │   ├── core/           # 核心配置
│   │   │   ├── config.py
│   │   │   └── database.py
│   │   ├── models/         # 数据模型
│   │   │   └── models.py
│   │   ├── schemas/        # Pydantic模式
│   │   │   └── schemas.py
│   │   ├── services/       # 业务逻辑
│   │   │   └── task_service.py
│   │   └── utils/          # 工具函数
│   ├── main.py             # 应用入口
│   ├── requirements.txt    # Python依赖
│   └── .env               # 环境变量
├── frontend/               # 前端项目
│   ├── src/
│   │   ├── views/          # 页面组件
│   │   │   ├── TaskList.vue
│   │   │   ├── TaskDetail.vue
│   │   │   └── CreateTask.vue
│   │   ├── router/         # 路由配置
│   │   │   └── index.js
│   │   ├── api/            # API封装
│   │   │   └── task.js
│   │   ├── utils/          # 工具函数
│   │   │   └── request.js
│   │   ├── App.vue
│   │   └── main.js
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── start_backend.sh        # 后端启动脚本
├── start_frontend.sh       # 前端启动脚本
└── README.md
```

## 快速开始

### 环境要求
- Python 3.8+
- Node.js 16+

### 方式一：使用启动脚本（推荐）

#### 启动后端
```bash
cd /Users/mac/pro/solo/workspaces/xy10710
chmod +x start_backend.sh
./start_backend.sh
```
后端服务将在 http://localhost:8000 启动

#### 启动前端（新终端）
```bash
cd /Users/mac/pro/solo/workspaces/xy10710
chmod +x start_frontend.sh
./start_frontend.sh
```
前端服务将在 http://localhost:3000 启动

### 方式二：手动启动

#### 后端启动
```bash
cd backend

# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate  # macOS/Linux
# 或
venv\Scripts\activate     # Windows

# 安装依赖
pip install -r requirements.txt

# 启动服务
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

#### 前端启动
```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

## API文档

启动后端服务后，访问以下地址查看API文档：

- **Swagger UI**：http://localhost:8000/docs
- **ReDoc**：http://localhost:8000/redoc

### 主要API端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/tasks | 创建任务 |
| GET | /api/tasks | 获取任务列表 |
| GET | /api/tasks/{id} | 获取任务详情 |
| POST | /api/tasks/{id}/confirm-watermark | 确认水印配置 |
| POST | /api/tasks/{id}/approve | 审批任务 |
| POST | /api/tasks/{id}/retry | 重试失败任务 |
| POST | /api/tasks/{id}/rollback | 回滚到指定版本 |
| GET | /api/tasks/{id}/versions | 获取任务版本历史 |
| GET | /api/tasks/{id}/errors | 获取任务错误日志 |
| POST | /api/tasks/export | 导出任务数据 |
| GET | /api/tasks/export/download/{filename} | 下载导出文件 |
| GET | /api/tasks/export/records | 获取导出记录 |

## 数据模型

### TranscodeTask（转码任务）
- `id`: 主键
- `request_id`: 请求ID（唯一）
- `original_image_url/name/width/height/size/format`: 原图信息
- `target_width/height/format/quality`: 目标规格
- `watermark_config`: 水印配置（JSON）
- `watermark_confirmed`: 水印是否确认
- `status`: 状态（pending/queued/processing/completed/failed）
- `queue_position`: 队列位置
- `priority`: 优先级
- `retry_count`: 当前重试次数
- `max_retries`: 最大重试次数
- `last_error`: 最后错误信息
- `output_url/size/width/height`: 输出信息
- `product_list`: 产物清单（JSON）
- `created_at/updated_at/completed_at`: 时间字段
- `created_by/approved_by/approved_at`: 操作人员
- `version`: 版本号
- `parent_task_id`: 父任务ID

### ErrorLog（错误日志）
- `id`: 主键
- `task_id`: 任务ID
- `error_message`: 错误信息
- `error_stack`: 错误堆栈
- `retry_attempt`: 重试次数
- `created_at`: 创建时间

### IdempotencyKey（幂等性Key）
- `id`: 主键
- `key`: 幂等性Key
- `task_id`: 关联的任务ID
- `response_data`: 缓存的响应数据
- `expires_at`: 过期时间

### ExportRecord（导出记录）
- `id`: 主键
- `export_type`: 导出类型
- `filters`: 筛选条件
- `file_path/file_name`: 文件信息
- `record_count/file_size`: 文件统计
- `created_by/created_at`: 创建信息

## 使用说明

### 创建任务
1. 点击首页的"新建任务"按钮
2. 填写原图信息（URL、文件名、尺寸、格式）
3. 设置目标规格（目标尺寸、格式、质量）
4. 配置水印（可选）：启用水印、设置文字、位置、透明度等
5. 填写创建人信息（可选）
6. 可选择设置幂等性Key防止重复提交
7. 点击"创建任务"

### 处理任务
1. 在任务列表中找到需要处理的任务
2. 如果有水印配置且未确认，点击"确认水印"按钮
3. 任务失败后，可点击"重试"按钮重新处理
4. 点击"版本"按钮查看历史版本并可回滚

### 导出数据
1. 在任务列表页点击"导出"按钮
2. 选择筛选条件（状态、日期范围等）
3. 点击确定，系统生成Excel文件并自动下载

## 注意事项

1. **数据库**：使用SQLite数据库，数据存储在 `backend/image_transcode.db`
2. **导出文件**：导出的Excel文件存储在 `backend/exports/` 目录
3. **幂等性**：建议创建任务时传入 `idempotency_key` 以防止重复提交
4. **CORS**：后端已配置允许跨域请求，前端可直接访问

## 开发说明

### 后端开发
- 数据模型修改：修改 `backend/app/models/models.py`
- API修改：修改 `backend/app/api/tasks.py`
- 业务逻辑：修改 `backend/app/services/task_service.py`

### 前端开发
- 页面修改：修改 `frontend/src/views/` 下的文件
- API封装：修改 `frontend/src/api/task.js`
- 路由配置：修改 `frontend/src/router/index.js`

## License

MIT
