# API性能压测面板

一个全栈API性能压测管理工具，集成压测计划管理、并发阶梯、响应分位、错误分布、瓶颈分析等功能。

## 技术栈

- **后端**: Python 3.x + FastAPI + SQLAlchemy + SQLite
- **前端**: Vue 2.x + Element UI + Vue Router + Axios

## 功能特性

### 核心数据模块
1. **压测计划管理** - 压测计划的创建、编辑、查询
2. **并发阶梯配置** - 多阶梯并发用户数、持续时间、爬升时间配置
3. **响应分位数据** - P50/P75/P90/P95/P99/P999响应时间、成功/失败请求统计
4. **错误分布统计** - 错误类型、错误码、数量、占比、异常标记
5. **瓶颈分析** - 瓶颈类型、描述、严重程度、确认状态、优化建议

### 状态区分
- **成功 (success)** - 正常完成的压测
- **待复核 (pending_review)** - 存在未确认瓶颈或高严重程度问题
- **已拦截 (intercepted)** - 检测到异常错误分布
- **可重试 (retryable)** - 草稿状态，可重试创建

### 核心功能
1. **幂等处理** - 重复请求自动识别拦截，防止重复创建
2. **瓶颈人工确认** - 支持人工确认瓶颈、记录确认人和优化建议
3. **错误分布异常标记** - 支持标记/取消异常错误，记录异常原因
4. **审批/回滚** - 压测计划审批流程，支持回滚到草稿状态
5. **重试创建** - 基于现有计划创建新的重试版本
6. **数据导出** - 压测详情JSON导出
7. **筛选表格** - 按版本、状态、API名称、创建人筛选

## 项目结构

```
xy10770/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── endpoints.py    # API路由
│   │   ├── core/
│   │   │   ├── database.py     # 数据库配置
│   │   │   └── config.py       # 配置文件
│   │   ├── models/
│   │   │   └── load_test.py    # 数据模型
│   │   ├── schemas/
│   │   │   └── load_test.py    # Pydantic模式
│   │   └── services/
│   │       └── load_test_service.py  # 业务逻辑
│   ├── main.py                  # 应用入口
│   ├── requirements.txt         # Python依赖
│   └── .env                     # 环境变量
├── frontend/
│   ├── src/
│   │   ├── views/
│   │   │   ├── Dashboard.vue    # 列表页
│   │   │   └── PlanDetail.vue   # 详情页
│   │   ├── router/
│   │   │   └── index.js         # 路由配置
│   │   ├── App.vue              # 根组件
│   │   └── main.js              # 应用入口
│   ├── public/
│   ├── package.json             # npm依赖
│   └── vue.config.js            # Vue配置
├── start_backend.sh             # 后端启动脚本
└── start_frontend.sh            # 前端启动脚本
```

## 快速开始

### 方式一：使用启动脚本

#### 启动后端
```bash
# Mac/Linux
chmod +x start_backend.sh
./start_backend.sh
```

后端服务启动后访问: http://localhost:8000/docs - Swagger API文档

#### 启动前端（新终端）
```bash
# Mac/Linux
chmod +x start_frontend.sh
./start_frontend.sh
```

前端服务启动后访问: http://localhost:8080

### 方式二：手动启动

#### 后端启动
```bash
cd backend

# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate

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

# 启动服务
npm run serve
```

## API接口

### 压测计划
- `POST /api/v1/plans` - 创建压测计划
- `GET /api/v1/plans` - 获取计划列表（支持分页筛选）
- `GET /api/v1/plans/{id}` - 获取计划详情
- `POST /api/v1/plans/{id}/approve` - 审批计划
- `POST /api/v1/plans/{id}/rollback` - 回滚计划
- `POST /api/v1/plans/{id}/retry` - 创建重试版本
- `GET /api/v1/plans/{id}/export` - 导出计划数据

### 错误分布
- `POST /api/v1/errors/{id}/anomaly` - 标记/取消异常

### 瓶颈分析
- `POST /api/v1/bottlenecks/{id}/confirm` - 确认瓶颈

## 状态流转

```
草稿(draft/retryable) 
    ↓
创建 → 自动判断状态
    ├─ 无异常、无待确认瓶颈 → 成功(success)
    ├─ 有未确认瓶颈或高严重程度 → 待复核(pending_review)
    └─ 检测到异常错误分布 → 已拦截(intercepted)
    ↓
审批 → 已审批(approved)
    ↓
回滚 → 草稿(draft)
```

## 幂等性说明

系统通过MD5哈希（计划名称 + 版本 + API地址）生成唯一标识，重复创建相同压测计划时会被拦截并返回已存在的计划ID。

## 注意事项

1. Python版本要求 3.7+
2. Node.js版本要求 12.x+
3. 首次启动会自动创建SQLite数据库文件
4. 生产环境建议更换为MySQL/PostgreSQL数据库