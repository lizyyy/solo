# 社区药房库存管理系统

## 项目概述

本系统是专为社区药房设计的疫苗和胰岛素等冷链药品库存管理工具，支持完整的入库流程、规则校验、库存管理以及月底复盘功能。

## 核心功能

### 业务流程
- **批次创建**: 支持手动创建或Excel批量导入药品批次
- **签收**: 药品到店后完成签收，自动触发规则校验
- **隔离**: 对有问题的批次进行隔离处理
- **复核**: 质量人员对批次进行复核检查
- **核准**: 管理人员最终审核通过
- **放行**: 批次正常放行可使用
- **退回**: 退回供应商处理

### 规则校验引擎
- **温度越界校验**: 自动检查到店温度是否在2-8℃范围内（可配置）
- **批号重复校验**: 防止重复录入相同批号
- **缺照片校验**: 检查温度记录照片和破损照片是否上传
- **有效期校验**: 提前预警即将过期或已过期药品
- **库存变更校验**: 记录库存数量变更情况

### 数据导入导出
- Excel批量导入批次数据，支持幂等性，重复导入不重复创建
- 导出批次数据，支持按状态、日期范围筛选
- 导出操作日志，完整记录所有变更历史
- 月底复盘报表导出，方便对账核对

### 权限控制与数据安全
- 基于角色的访问控制（RBAC）：管理员、库管员、复核员、查看者
- 敏感字段（手机号、邮箱等）自动脱敏处理
- 完整的操作日志，记录所有变更前后的数据
- 操作人、IP地址、时间戳完整记录

## 技术架构

```
┌─────────────────────────────────────────────────────────┐
│                    API 层 (FastAPI)                      │
├─────────────────────────────────────────────────────────┤
│                    业务服务层 (Services)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ BatchService │  │ ImportExport │  │  RuleEngine  │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
├─────────────────────────────────────────────────────────┤
│                   仓储层 (Repositories)                   │
├─────────────────────────────────────────────────────────┤
│                   数据模型层 (Models)                      │
├─────────────────────────────────────────────────────────┤
│                   核心组件 (Core)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Database   │  │   Security   │  │    Config    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## 快速开始

### 环境要求
- Python 3.10+
- pip 或 poetry

### 安装依赖

```bash
pip install fastapi uvicorn sqlalchemy pydantic pydantic-settings python-multipart pandas openpyxl python-jose passlib python-dotenv
```

或使用 poetry：

```bash
poetry install
```

### 启动服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

访问 http://localhost:8000/docs 查看API文档

### 默认账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | admin123 | 管理员 |
| keeper | keeper123 | 库管员 |
| reviewer | reviewer123 | 复核员 |

## API 接口说明

### 认证相关
- `POST /token` - 用户登录获取Token

### 用户管理
- `POST /users` - 创建用户
- `GET /users/me` - 获取当前用户信息

### 药品管理
- `POST /medicines` - 创建药品
- `GET /medicines` - 获取药品列表

### 批次管理
- `POST /batches` - 创建批次
- `GET /batches` - 获取批次列表
- `GET /batches/{batch_id}` - 获取批次详情
- `POST /batches/{batch_id}/receive` - 签收批次
- `POST /batches/{batch_id}/isolate` - 隔离批次
- `POST /batches/{batch_id}/review` - 复核批次
- `POST /batches/{batch_id}/approve` - 核准批次
- `POST /batches/{batch_id}/release` - 放行批次
- `POST /batches/{batch_id}/return` - 退回批次

### 导入导出
- `POST /import/batches` - 批量导入批次
- `GET /export/batches` - 导出批次数据
- `GET /export/logs` - 导出操作日志
- `GET /export/monthly-reconciliation?year=2024&month=5` - 导出月度复盘报表

### 库存管理
- `GET /inventory` - 获取库存列表

### 日志与规则
- `GET /logs/operations` - 获取操作日志
- `GET /rules/{batch_id}` - 获取批次规则校验结果

## 项目结构

```
pharmacy-inventory/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI主应用
│   ├── schemas.py              # Pydantic数据模型
│   ├── core/                   # 核心组件
│   │   ├── __init__.py
│   │   ├── config.py           # 配置管理
│   │   ├── database.py         # 数据库连接
│   │   └── security.py         # 安全相关
│   ├── models/                 # 数据模型
│   │   ├── __init__.py
│   │   ├── enums.py            # 枚举定义
│   │   └── models.py           # SQLAlchemy模型
│   ├── repositories/           # 仓储层
│   │   ├── __init__.py
│   │   ├── base.py
│   │   ├── user_repository.py
│   │   ├── medicine_repository.py
│   │   ├── batch_repository.py
│   │   ├── inventory_repository.py
│   │   ├── rule_result_repository.py
│   │   └── operation_log_repository.py
│   └── services/               # 业务服务层
│       ├── __init__.py
│       ├── batch_service.py
│       ├── rule_engine.py
│       └── import_export_service.py
├── pyproject.toml
├── .env.example
└── README.md
```

## 数据模型

### 主要实体
- **User**: 用户账号，支持角色权限管理
- **Medicine**: 药品基础信息，支持温度范围配置
- **Batch**: 药品批次，完整状态流转记录
- **Inventory**: 库存记录，数量精确管理
- **RuleResult**: 规则校验结果，每条记录拦截原因
- **OperationLog**: 操作日志，变更前后完整记录
- **SystemLog**: 系统日志，用于问题排查

### 批次状态流转

```
PENDING (待处理)
    ↓
RECEIVED (已签收) ←→ ISOLATED (已隔离)
    ↓                    ↓
REVIEWING (复核中)        │
    ↓                    ↓
APPROVED (已核准)   REJECTED (已拒绝)
    ↓                    ↓
RELEASED (已放行)   RETURNED (已退回)
```

## 配置说明

复制 `.env.example` 为 `.env`，根据需要修改配置：

```env
DATABASE_URL=sqlite:///./pharmacy_inventory.db
SECRET_KEY=your-secret-key-here-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
TEMPERATURE_MIN=2.0
TEMPERATURE_MAX=8.0
```

## 注意事项

1. **数据一致性**: 所有操作均为事务性，确保数据一致性
2. **幂等性设计**: 重复导入相同数据不会重复创建
3. **敏感数据**: 手机号、邮箱等敏感字段自动脱敏
4. **操作审计**: 所有变更均有完整日志记录，可追溯
5. **温度监控**: 严格按照药品冷链要求进行温度校验

## 月底复盘流程

1. 调用 `/export/monthly-reconciliation` 导出当月数据
2. 导出文件包含：
   - 汇总页：总批次、总数量、各状态批次统计
   - 明细页：每批次的完整信息和状态记录
3. 与纸质记录、温度记录进行核对
4. 如有差异，可通过操作日志追溯具体变更原因
