# 内部服务健康巡检系统

这是一个全栈内部服务健康巡检工具，集成了服务清单管理、探活接口、依赖检查、故障等级判定、人工复核和恢复确认等功能。

## 技术栈

- **后端**: Python 3.8+, FastAPI, SQLAlchemy
- **前端**: Vue 3, Element Plus, Axios
- **数据库**: SQLite（可配置MySQL/PostgreSQL）

## 项目结构

```
xy10730/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py          # FastAPI主应用，API路由
│   │   ├── models.py        # 数据模型
│   │   ├── schemas.py       # Pydantic数据验证
│   │   ├── services.py      # 业务逻辑服务
│   │   └── database.py      # 数据库配置
│   ├── requirements.txt     # Python依赖
│   └── .env                # 环境变量
└── frontend/
    ├── src/
    │   ├── main.js         # Vue入口
    │   ├── App.vue         # 主组件
    │   ├── api/
    │   │   └── index.js    # API封装
    │   ├── router/
    │   │   └── index.js    # 路由配置
    │   └── views/
    │       ├── HealthRecords.vue  # 巡检记录页面
    │       ├── Services.vue       # 服务管理页面
    │       └── DutyReports.vue    # 值班报告页面
    ├── index.html
    ├── vite.config.js
    └── package.json
```

## 功能特性

### 核心功能
1. **服务清单管理** - 管理所有需要巡检的服务信息
2. **探活接口检测** - 记录服务探活结果
3. **依赖检查** - 记录服务依赖项检查结果
4. **故障等级判定** - 自动判定故障等级（超时、连接错误、多重故障等）
5. **人工复核** - 支持人工复核巡检结果
6. **恢复确认** - 支持故障恢复后的人工确认
7. **值班报告** - 记录和管理值班期间的问题报告
8. **数据导出** - 支持导出Excel格式的巡检记录

### 检查状态分类
- **成功** - 服务运行正常
- **待复核** - 需要人工确认的异常情况
- **已拦截** - 已确认的严重故障
- **可重试** - 重试次数不足的异常情况

### 幂等性处理
- 支持通过 `request_id` 实现重复请求的幂等性
- 重试请求不会创建重复记录，只会更新重试次数

## 快速开始

### 后端启动

```bash
cd backend

# 安装依赖
pip install -r requirements.txt

# 启动服务
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

后端API文档: http://localhost:8000/docs

### 前端启动

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端访问地址: http://localhost:3000

## API接口说明

### 服务管理
- `GET /api/services` - 获取服务列表
- `GET /api/services/{id}` - 获取单个服务
- `POST /api/services` - 创建服务
- `PUT /api/services/{id}` - 更新服务

### 健康巡检
- `POST /api/health-check` - 创建健康检查记录（支持幂等）
- `GET /api/health-records` - 分页查询巡检记录
- `GET /api/health-records/{id}` - 获取单条记录
- `POST /api/health-records/{id}/review` - 复核记录
- `POST /api/health-records/{id}/confirm-recovery` - 恢复确认
- `GET /api/health-records/export` - 导出Excel

### 值班报告
- `GET /api/duty-reports` - 获取报告列表
- `POST /api/duty-reports` - 创建报告
- `POST /api/duty-reports/{id}/handle` - 处理报告

### 统计
- `GET /api/statistics` - 获取统计数据

## 数据模型

### Service（服务）
- id, name, description, service_type, status, health_check_url, dependencies, owner, created_at, updated_at

### HealthRecord（巡检记录）
- id, service_id, request_id, check_time, health_status, check_status, probe_result, dependency_check_result, error_details, fault_level, is_idempotent, retry_count, reviewed, reviewed_by, reviewed_at, review_comment, recovery_confirmed, confirmed_by, confirmed_at, created_at

### DutyReport（值班报告）
- id, record_id, reporter, report_time, report_content, handle_status, handler, handle_time, handle_comment, created_at

## 使用说明

1. 首先在"服务管理"页面添加需要巡检的服务
2. 通过调用 `POST /api/health-check` 接口创建巡检记录
3. 在"巡检记录"页面查看所有巡检结果，进行筛选、复核和恢复确认操作
4. 可以导出巡检记录为Excel文件
5. 在"值班报告"页面记录和处理值班期间的问题

## 注意事项

- 生产环境建议使用MySQL或PostgreSQL数据库
- 建议配置适当的CORS策略
- 生产环境需要添加用户认证和权限控制
- 建议配置日志记录和监控告警
