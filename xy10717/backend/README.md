# 数据库迁移审批台 - 后端服务

## 技术栈
- FastAPI: Web框架
- SQLAlchemy: ORM框架
- SQLite: 数据库（可替换为MySQL/PostgreSQL）
- Pandas + OpenPyXL: Excel导出

## 项目结构
```
backend/
├── app/
│   ├── __init__.py
│   ├── api/
│   │   ├── __init__.py
│   │   ├── migration.py      # 迁移脚本相关接口
│   │   ├── approval.py       # 审批链路相关接口
│   │   ├── execution.py      # 执行日志相关接口
│   │   └── export.py         # 导出相关接口
│   ├── core/
│   │   ├── __init__.py
│   │   ├── database.py        # 数据库连接配置
│   │   └── config.py          # 应用配置
│   ├── models/
│   │   ├── __init__.py
│   │   ├── migration.py       # 迁移脚本、影响表、回滚脚本等模型
│   │   ├── approval.py        # 审批链路相关模型
│   │   └── execution.py       # 执行日志相关模型
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── migration.py       # 迁移相关Pydantic模型
│   │   ├── approval.py        # 审批相关Pydantic模型
│   │   └── execution.py       # 执行相关Pydantic模型
│   ├── crud/
│   │   ├── __init__.py
│   │   ├── migration.py       # 迁移相关数据库操作
│   │   ├── approval.py        # 审批相关数据库操作
│   │   └── execution.py       # 执行相关数据库操作
│   └── initial_data.py        # 初始化数据
├── main.py                    # 应用入口
├── .env                      # 环境变量
├── .env.example                 # 环境变量示例
└── requirements.txt            # Python依赖
```

## 快速开始

### 1. 安装依赖
```bash
cd backend
pip install -r requirements.txt
```

### 2. 配置环境变量
```bash
cp .env.example .env
# 编辑 .env 文件，配置数据库连接等信息
```

### 3. 启动服务
```bash
python main.py
# 或使用uvicorn
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 4. 访问API文档
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API接口说明

### 迁移脚本接口 (`/api/migration`)
- `GET /` - 获取迁移脚本列表
- `GET /{id}` - 获取单个迁移脚本详情
- `POST /` - 创建新的迁移脚本
- `PUT /{id}` - 更新迁移脚本
- `DELETE /{id}` - 删除迁移脚本
- `POST /{id}/recalculate-tables` - 重新计算影响表
- `POST /{id}/affected-tables` - 添加影响表
- `POST /{id}/rollback-scripts` - 添加回滚脚本

### 审批链路接口 (`/api/approval`)
- `GET /chain/{migration_id}` - 获取迁移脚本的审批链路
- `POST /chain/{migration_id}` - 创建审批链路
- `POST /chain/{chain_id}/start` - 启动审批流程
- `POST /step/{step_id}/approve` - 审批通过
- `POST /step/{step_id}/reject` - 审批驳回

### 执行日志接口 (`/api/execution`)
- `GET /logs` - 获取执行日志列表
- `GET /logs/{log_id}` - 获取单个执行日志
- `POST /{migration_id}/start` - 启动迁移执行
- `POST /logs/{log_id}/complete` - 完成执行（更新状态）
- `POST /logs/{log_id}/replay` - 回放执行
- `POST /{migration_id}/manual-fix` - 人工修正

### 导出接口 (`/api/export`)
- `GET /migration/{migration_id}/excel` - 导出迁移脚本详情Excel
- `GET /migration/{migration_id}/trace` - 获取追溯链数据

## 数据模型

### 迁移脚本 (MigrationScript)
- id: 主键
- name: 脚本名称
- description: 描述
- script_content: SQL脚本内容
- database_type: 数据库类型（mysql/postgresql等
- status: 状态（草稿/待审批/已审批/执行中/成功/失败/已回滚）
- created_by: 创建人
- created_at: 创建时间
- updated_at: 更新时间
- executed_at: 执行时间
- version: 版本号
- parent_id: 父版本ID

### 影响表 (AffectedTable)
- 迁移脚本与影响表是一对多关系
- 包含表名、操作类型、预估行数、实际行数、是否备份等字段

### 回滚脚本 (RollbackScript)
- 迁移脚本与回滚脚本是一对多关系
- 包含脚本内容、版本、是否有效、验证结果等字段

### 审批链路 (ApprovalChain)
- 迁移脚本与审批链路是一对一关系
- 包含状态、当前步骤索引、开始/完成时间等字段
- 审批步骤 (ApprovalStep) 是一对多关系，包含角色、审批人、状态、审批规则等

### 执行日志 (ExecutionLog)
- 迁移脚本与执行日志是一对多关系
- 包含执行类型（迁移/回滚/回放/人工修正）、状态、执行人、开始/结束时间、脚本内容、输出、错误信息、影响行数、耗时、父日志ID等

## 边界处理

### 回滚脚本验证
- 创建回滚脚本时会进行语法验证
- 回滚脚本执行前会检查是否有效
- 回滚脚本版本管理，支持多版本回滚脚本

### 审批规则校验
- 审批步骤支持配置规则（如 required_role）
- 审批时会校验审批人角色是否匹配
- 规则不匹配时自动驳回审批

### 影响表重新计算
- 当迁移脚本内容变更时，可重新计算影响表
- 根据SQL脚本内容自动识别操作类型（ALTER/CREATE/DROP等

## 初始化数据
系统启动时会自动初始化示例数据，包括：
1.  3个示例迁移脚本（用户表优化、订单表分区、商品表添加字段）
2.  对应的影响表和回滚脚本
3.  审批链路和审批步骤
4.  执行日志示例

## 规则被挡住的操作示例
- 当审批人角色不匹配时会被规则挡住（如DBA步骤只能由DBA角色审批）
- 回滚脚本无效时无法执行回滚操作
- 影响表未备份时无法执行删除操作（可配置）

## 常见问题

### 1. 如何更换数据库？
修改 `.env` 文件中的 `DATABASE_URL`，支持MySQL/PostgreSQL等。

MySQL示例:
```
DATABASE_URL=mysql+pymysql://user:password@host:port/dbname
```

### 2. 如何添加新的审批规则？
在创建审批步骤时，rules字段传入JSON格式的规则。

### 3. 如何导出Excel导出格式？
修改 `app/api/export.py` 中的导出逻辑，自定义列名、格式等。

## 开发说明

### 添加新接口
1. 在 `app/models/` 中定义数据模型
2. 在 `app/schemas/` 中定义Pydantic模型
3. 在 `app/crud/` 中实现数据库操作
4. 在 `app/api/` 中创建API路由

### 数据库迁移
使用Alembic管理数据库迁移：
```bash
alembic init alembic
alembic revision --autogenerate -m "init"
alembic upgrade head
```