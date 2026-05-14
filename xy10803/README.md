# 🛢️ 沙箱数据种子 API

一个偏技术方向的全栈 Web/API 应用，用于解决测试环境造数问题，支持模板参数化、依赖顺序、幂等性、清理回滚等核心功能。

## 核心功能

### 业务规则
- ✅ **模板参数化**: 支持 `{{param}}` 语法的 SQL 模板
- ✅ **幂等造数**: 相同参数重复执行不会重复创建数据
- ✅ **清理回滚**: 支持按批次或全量回滚种子数据
- ✅ **批次报告**: 完整的执行日志和状态追踪
- ✅ **依赖顺序**: 支持模板间的依赖关系管理

### 数据模型
- **数据模板 (DataTemplate)**: SQL 模板及参数定义
- **租户沙箱 (TenantSandbox)**: 测试环境/租户隔离
- **种子批次 (SeedBatch)**: 每次造数的批次记录
- **依赖关系 (Dependency)**: 模板间的依赖配置
- **清理任务 (CleanupTask)**: 回滚/清理任务管理
- **造数日志 (SeedLog)**: 详细的执行日志记录

## 快速开始

### 1. 安装依赖
```bash
pip install -r requirements.txt
```

### 2. 初始化数据库
```bash
cd backend
python3 create_tables.py
python3 init_data.py  # 初始化示例数据
```

### 3. 运行自检脚本
```bash
python3 self_check.py
```

### 4. 运行测试
```bash
python3 -m pytest ../tests/test_core_rules.py -v
```

### 5. 启动服务
```bash
python3 -m uvicorn main:app --host 0.0.0.0 --port 8001
```

访问:
- 前端界面: http://localhost:8001/
- API 文档: http://localhost:8001/docs

## API 接口

### 数据模板
- `GET /api/v1/templates/` - 获取模板列表
- `POST /api/v1/templates/` - 创建模板
- `GET /api/v1/templates/{id}` - 获取模板详情
- `PUT /api/v1/templates/{id}` - 更新模板
- `DELETE /api/v1/templates/{id}` - 删除模板

### 租户沙箱
- `GET /api/v1/sandboxes/` - 获取沙箱列表
- `POST /api/v1/sandboxes/` - 创建沙箱
- `GET /api/v1/sandboxes/{id}` - 获取沙箱详情
- `PUT /api/v1/sandboxes/{id}` - 更新沙箱

### 种子批次
- `GET /api/v1/batches/` - 获取批次列表
- `POST /api/v1/batches/` - 创建批次
- `POST /api/v1/batches/{id}/execute` - 执行批次
- `GET /api/v1/batches/{id}/report` - 获取批次报告

### 清理回滚
- `GET /api/v1/cleanup/tasks` - 获取清理任务列表
- `POST /api/v1/cleanup/tasks` - 创建清理任务
- `POST /api/v1/cleanup/tasks/{id}/execute` - 执行清理任务
- `POST /api/v1/cleanup/rollback/batch/{batch_id}` - 回滚指定批次

### 执行日志
- `GET /api/v1/logs/` - 获取日志列表
- `GET /api/v1/logs/{id}` - 获取日志详情
- `GET /api/v1/logs/{id}/diff` - 获取状态变更对比

## 项目结构
```
sandbox-data-seed-api/
├── backend/
│   ├── app/
│   │   ├── core/           # 配置和数据库连接
│   │   ├── models/         # 数据模型
│   │   ├── schemas/        # Pydantic 模式
│   │   ├── services/       # 业务逻辑
│   │   └── api/            # API 路由
│   ├── main.py             # FastAPI 入口
│   ├── create_tables.py    # 数据库表创建
│   ├── init_data.py        # 示例数据初始化
│   └── self_check.py       # 系统自检脚本
├── frontend/
│   ├── templates/          # Jinja2 模板
│   └── static/css/         # 样式文件
├── tests/
│   └── test_core_rules.py  # 核心规则测试
└── requirements.txt        # 依赖列表
```

## 核心技术栈
- **后端框架**: FastAPI
- **ORM**: SQLAlchemy 2.0
- **前端模板**: Jinja2
- **数据库**: SQLite (可扩展)
- **测试**: pytest

## 使用流程示例

1. **创建 SQL 模板**: 定义参数化的 SQL 脚本
2. **配置沙箱环境**: 添加租户/测试环境配置
3. **创建种子批次**: 选择模板和沙箱，填入参数
4. **执行造数**: 点击执行，系统自动处理幂等性
5. **查看报告**: 查看执行日志、前后状态对比
6. **复核操作**: 确认无误或执行回滚清理

## 状态说明
- `pending`: 待执行
- `running`: 执行中
- `completed`: 执行成功
- `failed`: 执行失败
- `rolled_back`: 已回滚

## 开发说明

### 运行自检
```bash
cd backend
python3 self_check.py
```

### 运行测试
```bash
cd backend
python3 -m pytest ../tests/test_core_rules.py -v
```

### 启动开发服务器
```bash
cd backend
python3 -m uvicorn main:app --reload --port 8001
```
