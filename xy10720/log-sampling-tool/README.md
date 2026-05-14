# 日志采样检索工具

一个集创建、拦截、修正、导出于一体的全栈日志采样管理工具，Python FastAPI 后端 + Vue 3 前端。

## 功能特性

### 核心功能
- **创建记录**：支持服务名称、采样规则、Trace ID、错误片段、排障摘要等字段录入
- **幂等处理**：自动生成幂等键，防止重复请求
- **复核修正**：侧边抽屉式复核界面，支持修改错误状态和排障摘要
- **版本管理**：完整的版本历史记录，支持一键回滚到任意版本
- **人工确认**：每条记录可进行人工确认标记
- **错误分析**：自动识别错误类型（超时、空指针、数据库、网络、认证等）

### 数据管理
- **保存查询**：保存常用搜索条件，一键加载
- **导出Excel**：导出格式化的Excel文件，字段名称已转为中文，便于非研发人员阅读
- **搜索过滤**：支持按服务名称、状态等条件搜索

## 技术栈

### 后端
- Python 3.8+
- FastAPI - 高性能Web框架
- SQLAlchemy 2.0 - ORM框架
- SQLite - 数据库（可替换为MySQL/PostgreSQL）
- Pandas + OpenPyXL - Excel导出

### 前端
- Vue 3 + Vite
- Element Plus - UI组件库
- Vue Router - 路由管理
- Pinia - 状态管理
- Axios - HTTP客户端

## 快速开始

### 后端启动

1. 进入后端目录
```bash
cd backend
```

2. 安装依赖
```bash
pip install -r requirements.txt
```

3. 启动服务
```bash
python main.py
```

或使用 uvicorn 直接启动：
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

后端服务将在 http://localhost:8000 启动

API文档地址：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 前端启动

1. 进入前端目录
```bash
cd frontend
```

2. 安装依赖
```bash
npm install
```

3. 启动开发服务器
```bash
npm run dev
```

前端服务将在 http://localhost:3000 启动

## 项目结构

```
log-sampling-tool/
├── backend/
│   ├── main.py              # FastAPI主应用，API路由
│   ├── models.py            # SQLAlchemy数据模型
│   ├── schemas.py           # Pydantic模式定义
│   ├── services.py          # 业务逻辑服务
│   ├── export_service.py    # Excel导出服务
│   ├── database.py          # 数据库连接配置
│   ├── requirements.txt     # Python依赖
│   └── .env                # 环境变量配置
├── frontend/
│   ├── src/
│   │   ├── main.js         # 应用入口
│   │   ├── App.vue         # 根组件
│   │   ├── router/
│   │   │   └── index.js    # 路由配置
│   │   ├── views/
│   │   │   └── RecordList.vue  # 记录列表主页面
│   │   └── api/
│   │       └── records.js  # API接口封装
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── README.md
```

## 核心数据模型

### 日志采样记录 (LogSamplingRecord)
- id: 主键
- service_name: 服务名称
- sampling_rule: 采样规则
- trace_id: 链路追踪ID
- error_fragment: 错误片段
- error_fragment_status: 错误状态（pending/analyzed/resolved/none）
- troubleshooting_summary: 排障摘要
- is_manually_confirmed: 是否已人工确认
- confirmed_by: 确认人
- confirmed_at: 确认时间
- request_idempotency_key: 请求幂等键
- status: 记录状态（active/inactive/archived）
- created_at: 创建时间
- updated_at: 更新时间
- created_by: 创建人

### 版本历史 (LogSamplingVersion)
- 记录每次变更的完整快照
- 包含版本号、变更原因、操作人等信息

### 保存查询 (SavedQuery)
- 保存用户的搜索条件
- 支持查询名称和描述

## API接口

### 记录管理
- `POST /api/records` - 创建记录（幂等）
- `GET /api/records` - 分页查询记录列表
- `GET /api/records/{id}` - 获取单个记录详情
- `PUT /api/records/{id}` - 更新记录
- `POST /api/records/{id}/confirm` - 人工确认记录
- `POST /api/records/{id}/analyze-error` - 分析错误片段

### 版本管理
- `GET /api/records/{id}/versions` - 获取版本历史列表
- `POST /api/records/{id}/rollback/{version}` - 回滚到指定版本

### 导出功能
- `POST /api/export/excel` - 导出Excel文件
- `GET /api/export/summary` - 获取导出摘要

### 保存查询
- `POST /api/saved-queries` - 创建保存的查询
- `GET /api/saved-queries` - 获取保存的查询列表
- `DELETE /api/saved-queries/{id}` - 删除保存的查询

### 幂等性
- `POST /api/idempotency/generate` - 生成幂等键
- `GET /api/idempotency/check/{key}` - 检查幂等键是否已存在

## 使用说明

### 1. 创建记录
点击"新建记录"按钮，填写服务名称、采样规则等必填字段，点击创建。

### 2. 复核记录
点击列表中的"复核"按钮，在右侧抽屉中查看详细信息并进行修改。

### 3. 查看版本历史
点击"版本"按钮查看所有历史版本，可选择回滚到任意版本。

### 4. 错误分析
对于包含错误片段的记录，点击"分析错误"按钮，系统将自动识别错误类型。

### 5. 人工确认
点击"确认"按钮，输入确认人姓名进行人工确认标记。

### 6. 导出
点击"导出Excel"按钮，系统将导出格式化的Excel文件，字段名称均为中文，方便产品运营等非研发人员阅读。

### 7. 保存查询
设置好搜索条件后，点击"保存查询"按钮，下次可通过"已保存查询"下拉菜单快速加载。

## 配置说明

### 后端配置 (backend/.env)
```
DATABASE_URL=sqlite:///./log_sampling.db
HOST=0.0.0.0
PORT=8000
```

### 前端配置 (frontend/vite.config.js)
代理配置已设置为将 `/api` 请求转发到 `http://localhost:8000`

## 注意事项

1. 数据库默认使用SQLite，生产环境建议更换为MySQL或PostgreSQL
2. 导出的Excel文件包含完整的中文表头，适合非技术人员阅读
3. 所有修改操作都会创建版本记录，确保数据可追溯
4. 创建记录时自动生成幂等键，防止重复提交

## License

MIT
