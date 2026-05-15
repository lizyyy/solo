# BFF 端点编排器

一个全栈 Web 应用，用于编排和管理 BFF (Backend for Frontend) 端点。

## 功能特性

### 后端功能
- **BFF 端点管理** - 创建、编辑、删除、状态转换端点
- **上游接口管理** - 配置和管理后端 API 接口
- **页面模块管理** - 组织端点到不同页面模块
- **编排引擎** - 支持并行/串行调用多个上游接口
- **降级策略** - 缓存返回、默认值、静态返回等
- **缓存管理** - 内存 + 数据库双层缓存，支持 TTL 配置
- **调用历史** - 完整记录每次调用，支持导出 Excel
- **批量导入** - 支持 JSON/CSV 批量导入端点配置
- **接口审计** - 统计成功率、响应时间、缓存命中率等

### 前端功能
- **列表筛选** - 支持按名称、状态、分页展示端点列表
- **详情页面** - 端点配置详情、调用历史、统计图表
- **时间线** - 事件时间线，展示创建和调用历史
- **统计仪表盘** - 调用次数、成功率、平均响应时间等
- **批量导入** - 支持文件上传批量导入端点
- **报告导出** - 导出调用历史为 Excel 格式

## 技术栈

### 后端
- **框架**: FastAPI (Python)
- **数据库**: SQLite (可扩展到 PostgreSQL/MySQL)
- **ORM**: SQLAlchemy 2.0
- **缓存**: 内存缓存 (cachetools) + 数据库持久化
- **HTTP客户端**: httpx
- **导出**: pandas + openpyxl

### 前端
- **框架**: React 18
- **UI组件**: Ant Design 5
- **路由**: React Router v6
- **图表**: ECharts
- **HTTP客户端**: axios
- **日期处理**: dayjs

## 快速开始

### 后端启动

```bash
cd backend

# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 启动服务
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API 文档: http://localhost:8000/docs

### 前端启动

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm start
```

访问: http://localhost:3000

## 核心数据模型

### BFF Endpoint (端点)
- name: 端点名称
- path: API 路径
- method: HTTP 方法 (GET/POST/PUT/DELETE)
- status: 状态 (draft/active/degraded/disabled)
- orchestration_rules: 编排规则
- cache_enabled: 是否启用缓存
- cache_ttl: 缓存 TTL (秒)
- degradation_strategy: 降级策略
- degradation_default_value: 降级默认值

### Upstream API (上游接口)
- name: 接口名称
- base_url: 基础 URL
- path: 路径
- method: HTTP 方法
- timeout: 超时时间
- retry_count: 重试次数
- circuit_breaker_enabled: 是否启用熔断

### Call History (调用历史)
- endpoint_id: 端点 ID
- request_id: 请求 ID
- response_status: 响应状态码
- response_time_ms: 响应时间 (毫秒)
- cache_hit: 是否命中缓存
- degraded: 是否降级返回
- error_message: 错误信息
- upstream_calls: 上游调用详情

## API 接口

### Endpoints
- `GET /bff-endpoints/` - 获取端点列表
- `GET /bff-endpoints/{id}` - 获取端点详情
- `POST /bff-endpoints/` - 创建端点
- `PUT /bff-endpoints/{id}` - 更新端点
- `DELETE /bff-endpoints/{id}` - 删除端点
- `POST /bff-endpoints/{id}/status` - 状态转换
- `POST /execute` - 执行端点
- `POST /bff-endpoints/batch-import` - 批量导入
- `GET /bff-endpoints/{id}/statistics` - 获取统计

### Upstream APIs
- `GET /upstream-apis/` - 获取上游接口列表
- `POST /upstream-apis/` - 创建上游接口
- `PUT /upstream-apis/{id}` - 更新上游接口
- `DELETE /upstream-apis/{id}` - 删除上游接口

### Page Modules
- `GET /page-modules/` - 获取页面模块列表
- `POST /page-modules/` - 创建页面模块
- `PUT /page-modules/{id}` - 更新页面模块
- `DELETE /page-modules/{id}` - 删除页面模块

### Call History
- `GET /call-history/` - 获取调用历史列表
- `GET /call-history/export` - 导出调用历史

## 降级策略

1. **RETURN_CACHE** - 返回缓存数据（即使过期）
2. **RETURN_DEFAULT** - 返回配置的默认值
3. **SKIP_FIELD** - 跳过该字段（返回空）
4. **RETURN_STATIC** - 返回静态 JSON 数据

## 状态流转

```
draft ──> active ──> degraded
  │         │           │
  └─────── disabled <───┘
           │
           ▼
         error
```

- **draft (草稿)**: 配置中，未上线
- **active (启用)**: 正常提供服务
- **degraded (降级)**: 部分功能降级
- **disabled (禁用)**: 已下线
- **error (错误)**: 异常状态

## 项目结构

```
bff-orchestrator/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py          # FastAPI 入口
│   │   ├── models.py        # SQLAlchemy 模型
│   │   ├── schemas.py       # Pydantic 模型
│   │   ├── crud.py          # CRUD 操作
│   │   ├── database.py      # 数据库连接
│   │   └── orchestrator.py  # 编排引擎核心
│   ├── requirements.txt
│   └── .env
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── pages/           # 页面组件
│   │   ├── services/        # API 服务
│   │   ├── App.js           # 主应用组件
│   │   ├── index.js         # 入口文件
│   │   └── index.css        # 全局样式
│   └── package.json
└── README.md
```

## 使用说明

1. **创建上游接口**: 首先配置需要调用的后端 API
2. **创建 BFF 端点**: 配置端点信息，关联上游接口
3. **配置聚合字段**: 定义如何从上游响应提取数据
4. **启用端点**: 将状态从 draft 转为 active
5. **测试执行**: 使用执行功能测试端点
6. **查看监控**: 在详情页查看调用历史和统计数据

## 验收要点

- ✅ 重复操作稳定性（幂等性）
- ✅ 失败原因可追溯到历史记录
- ✅ 状态流转符合预期
- ✅ 降级策略生效
- ✅ 缓存命中正确
- ✅ 批量导入导出功能正常
- ✅ 前端页面操作流畅
- ✅ API 接口响应正确
