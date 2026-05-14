# OAuth 回调调试站

一个完整的 OAuth 回调调试工具，包含 FastAPI 后端和 Vue 3 前端。

## 功能特性

### 核心功能
- **会话管理**：创建和管理 OAuth 调试会话
- **回调记录**：自动捕获和记录 OAuth 回调请求
- **Token 交换**：记录 Token 交换过程和结果
- **状态追踪**：实时追踪 OAuth 流程状态

### 调试路径
- ✅ **成功路径**：正常完成 OAuth 流程
- 🚫 **拦截路径**：回调被拦截或拒绝授权
- 🔄 **补偿路径**：Token 交换失败进入补偿流程
- 👀 **复核路径**：需要人工复核的异常情况

### 高级功能
- **调试时间线**：可视化展示完整流程时间线
- **会话差异比较**：对比两个会话的执行差异
- **数据导出**：支持 Excel、CSV、JSON 格式导出
- **统计看板**：成功率统计和状态分布图表
- **状态重算**：修改参数后重新计算会话状态

## 技术栈

### 后端
- **FastAPI**：高性能 Web 框架
- **SQLAlchemy**：ORM 数据库操作
- **SQLite**：内置数据库（重启数据不丢失）
- **Pandas + OpenPyXL**：数据导出处理

### 前端
- **Vue 3**：渐进式 JavaScript 框架
- **Vue Router**：路由管理
- **Pinia**：状态管理
- **Element Plus**：UI 组件库
- **ECharts**：数据可视化
- **Vite**：构建工具

## 快速开始

### 方式一：一键启动（推荐）

```bash
# 给启动脚本添加执行权限
chmod +x start.sh

# 运行启动脚本
./start.sh
```

### 方式二：手动启动

#### 1. 启动后端服务

```bash
cd backend

# 安装依赖（首次运行）
pip install -r requirements.txt

# 启动服务
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

后端 API 文档：http://localhost:8000/docs

#### 2. 启动前端服务

```bash
cd frontend

# 安装依赖（首次运行）
npm install

# 启动开发服务
npm run dev
```

前端访问地址：http://localhost:3000

## 使用说明

### 1. 创建调试会话
- 访问「新建会话」页面
- 填写 State 参数（或自动生成）
- 可选填写 Client ID、Redirect URI 等信息
- 点击「创建会话」

### 2. 配置回调地址
将回调地址配置到 OAuth 应用中：
```
http://localhost:8000/api/v1/callback
```

### 3. 触发 OAuth 流程
- 在 OAuth 应用中发起授权请求
- 确保 state 参数与会话匹配
- 系统会自动捕获回调请求

### 4. 查看调试结果
- 访问「会话列表」查看所有会话
- 点击会话 ID 查看详细信息
- 查看「调试时间线」追踪执行路径
- 检查「回调记录」和「Token 交换」详情

### 5. 差异比较
- 访问「差异比较」页面
- 选择两个需要对比的会话
- 点击「比较」查看差异

### 6. 数据导出
- 访问「导出面板」
- 选择导出类型和格式
- 点击「生成导出」下载文件

## API 接口

### 会话管理
- `POST /api/v1/sessions` - 创建会话
- `GET /api/v1/sessions` - 获取会话列表
- `GET /api/v1/sessions/{id}` - 获取会话详情
- `PATCH /api/v1/sessions/{id}` - 更新会话

### 回调处理
- `GET/POST /api/v1/callback` - OAuth 回调入口（支持所有 HTTP 方法）

### Token 交换
- `POST /api/v1/token-exchange` - 创建 Token 交换记录
- `PATCH /api/v1/token-exchange/{id}` - 更新交换结果

### 其他功能
- `POST /api/v1/recalculate` - 重算会话状态
- `POST /api/v1/diff` - 比较两个会话
- `POST /api/v1/export` - 创建导出任务
- `GET /api/v1/exports` - 获取导出列表
- `GET /api/v1/exports/{id}/download` - 下载导出文件
- `GET /api/v1/stats` - 获取统计数据

## 项目结构

```
oauth-debugger/
├── backend/
│   ├── app/
│   │   ├── api/           # API 路由
│   │   ├── services/      # 业务逻辑
│   │   ├── models.py      # 数据模型
│   │   ├── schemas.py     # Pydantic 模式
│   │   ├── database.py    # 数据库配置
│   │   └── main.py        # 应用入口
│   ├── requirements.txt   # Python 依赖
│   └── oauth_debug.db     # SQLite 数据库（自动创建）
├── frontend/
│   ├── src/
│   │   ├── views/         # 页面组件
│   │   ├── router/        # 路由配置
│   │   └── utils/         # 工具函数
│   ├── package.json       # Node 依赖
│   └── vite.config.js     # Vite 配置
└── start.sh              # 一键启动脚本
```

## 数据持久化

所有数据存储在 `backend/oauth_debug.db` SQLite 数据库中，重启服务后数据不会丢失。

导出文件存储在 `backend/exports/` 目录中。

## 注意事项

1. 这是一个调试工具，**不要**在生产环境中使用
2. State 参数需要与会话创建时的 state 一致才能正确关联
3. 回调接口支持所有 HTTP 方法（GET、POST、PUT 等）
4. Token 交换可以手动模拟，也可以通过 API 更新真实结果

## License

MIT
