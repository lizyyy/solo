# 仓库叉车充电调度系统

夜班班长内部使用的叉车充电调度工具。

## 功能特性

### 核心规则引擎
1. **低电量优先** - 电量低于30%的叉车享有优先充电权
2. **跨班占用检查** - 防止不同班次占用同一充电桩
3. **重复锁桩幂等** - 同一叉车在同一班次不能重复锁桩

### 数据追踪
- 每条记录都包含拦截/放行原因
- 完整的操作日志记录
- 支持按负责人、时间、状态、异常类型筛选

### 批量操作
- 批量创建任务失败时，明确列出成功和失败项
- 失败重试不会破坏已成功的记录

### 报告导出
- 导出Excel格式的任务报告
- 导出Excel格式的操作日志报告

## 快速开始

### 1. 安装依赖
```bash
pip install -r requirements.txt
```

### 2. 启动服务
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 3. 访问接口文档
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API 接口说明

### 叉车管理 (`/forklifts`)
- `POST /forklifts/` - 创建叉车
- `GET /forklifts/` - 获取所有叉车
- `GET /forklifts/{id}` - 获取单个叉车
- `PUT /forklifts/{id}` - 更新叉车信息
- `DELETE /forklifts/{id}` - 删除叉车

### 充电桩管理 (`/charging-piles`)
- `POST /charging-piles/` - 创建充电桩
- `GET /charging-piles/` - 获取所有充电桩
- `GET /charging-piles/{id}` - 获取单个充电桩
- `PUT /charging-piles/{id}` - 更新充电桩信息
- `DELETE /charging-piles/{id}` - 删除充电桩

### 充电任务 (`/tasks`)
- `POST /tasks/` - 创建单个充电任务（带规则检查）
- `POST /tasks/batch` - 批量创建充电任务
- `GET /tasks/` - 获取任务列表（支持筛选）
- `GET /tasks/{id}` - 获取单个任务详情
- `GET /tasks/{id}/reason` - 获取任务拦截/放行原因

### 操作日志 (`/logs`)
- `GET /logs/` - 获取操作日志列表（支持多维度筛选）

### 报告导出 (`/reports`)
- `GET /reports/tasks` - 导出任务报告
- `GET /reports/logs` - 导出操作日志报告

## 使用示例

### 1. 初始化基础数据
```bash
# 创建叉车
curl -X POST "http://localhost:8000/forklifts/" \
  -H "Content-Type: application/json" \
  -d '{"name": "叉车001", "battery_level": 25.0, "status": "idle"}'

# 创建充电桩
curl -X POST "http://localhost:8000/charging-piles/" \
  -H "Content-Type: application/json" \
  -d '{"name": "充电桩A", "status": "available"}'
```

### 2. 创建充电任务
```bash
curl -X POST "http://localhost:8000/tasks/?operator=张班长" \
  -H "Content-Type: application/json" \
  -d '{
    "forklift_id": 1,
    "charging_pile_id": 1,
    "shift": "夜班",
    "requested_by": "张班长"
  }'
```

### 3. 批量创建任务
```bash
curl -X POST "http://localhost:8000/tasks/batch?operator=张班长" \
  -H "Content-Type: application/json" \
  -d '[
    {"forklift_id": 1, "charging_pile_id": 1, "shift": "夜班", "requested_by": "张班长"},
    {"forklift_id": 2, "charging_pile_id": 2, "shift": "夜班", "requested_by": "张班长"}
  ]'
```

### 4. 查看任务被拦截原因
```bash
curl "http://localhost:8000/tasks/1/reason"
```

### 5. 导出报告
```bash
# 导出任务报告
curl "http://localhost:8000/reports/tasks?status=rejected" -o report.xlsx

# 导出日志报告
curl "http://localhost:8000/reports/logs?operator=张班长" -o logs.xlsx
```

## 数据库
- 使用 SQLite 本地数据库
- 数据库文件: `forklift_charging.db`
- 自动创建表结构

## 项目结构
```
forklift_charging_system/
├── app/
│   ├── __init__.py
│   ├── database.py          # 数据库配置
│   ├── models.py            # 数据模型
│   ├── schemas.py           # Pydantic 模式
│   ├── api/                 # API 路由
│   │   ├── __init__.py
│   │   ├── forklifts.py
│   │   ├── charging_piles.py
│   │   ├── tasks.py
│   │   ├── logs.py
│   │   └── reports.py
│   └── services/            # 业务逻辑
│       ├── __init__.py
│       ├── rules_engine.py  # 规则引擎
│       ├── task_service.py  # 任务服务
│       ├── log_service.py   # 日志服务
│       └── report_service.py # 报告服务
├── main.py                  # 应用入口
├── requirements.txt         # 依赖列表
└── README.md               # 说明文档
```
