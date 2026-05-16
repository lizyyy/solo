# MCP工具权限审计API

用于审计MCP工具权限声明与实际调用范围一致性的后端服务。

## 功能特性

- **工具管理**: 注册和管理MCP工具信息
- **权限声明**: 记录工具的授权权限范围
- **实际调用**: 归档工具的实际调用记录
- **审批批次**: 批量审批管理，支持幂等性保证
- **异常检测**: 自动检测权限不匹配、范围越界等异常
- **异常复核**: 支持异常状态流转和人工修正
- **审计摘要**: 生成审计报告，支持Excel导出

## 技术栈

- Python 3.8+
- FastAPI - Web框架
- SQLAlchemy - ORM
- SQLite - 本地数据库
- Pandas - 数据导出

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn app.main:app --reload
```

服务将在 `http://localhost:8000` 启动

### 3. 访问API文档

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### 4. 运行样例数据和测试

```bash
python sample_data.py
```

## API接口概览

### 工具管理
- `POST /tools/` - 创建工具
- `GET /tools/` - 查询工具列表
- `GET /tools/{tool_id}` - 查询单个工具

### 权限声明
- `POST /permissions/` - 创建权限声明
- `GET /permissions/` - 查询权限列表

### 实际调用
- `POST /calls/` - 记录实际调用
- `GET /calls/` - 查询调用记录

### 审批批次
- `POST /batches/` - 创建审批批次（幂等）
- `GET /batches/` - 查询批次列表
- `GET /batches/{batch_id}` - 查询单个批次
- `PUT /batches/{batch_id}/status` - 推进审批状态（幂等保护）

### 异常管理
- `POST /anomalies/` - 创建异常记录
- `GET /anomalies/` - 查询异常列表
- `GET /anomalies/{anomaly_id}` - 查询单个异常
- `PUT /anomalies/{anomaly_id}/status` - 更新异常状态
- `PUT /anomalies/{anomaly_id}/manual-fix` - 人工修复异常

### 审计功能
- `GET /audit/comparison` - 权限比对分析
- `POST /audit/generate-anomalies` - 自动生成异常记录
- `POST /audit/summary` - 生成审计摘要
- `GET /audit/summaries/` - 查询审计摘要列表
- `GET /audit/summaries/{summary_id}` - 查询单个审计摘要
- `POST /audit/export/{summary_id}` - 导出审计报告
- `GET /audit/download/{summary_id}` - 下载审计报告

## 核心规则

### 权限比对
- 实际调用范围必须在声明权限范围内
- 声明权限但未调用也会标记为不匹配

### 幂等性保证
- 同一批次号重复提交不会创建新记录
- 已审批的批次无法再次推进状态

### 异常类型
- `permission_mismatch` - 权限不匹配
- `scope_exceeded` - 范围越界
- `unauthorized_call` - 未授权调用
- `declaration_missing` - 缺少声明
- `other` - 其他异常

### 异常状态
- `open` - 待处理
- `reviewing` - 审核中
- `resolved` - 已解决
- `dismissed` - 已忽略

## 数据模型

```
Tool (工具)
  ├── DeclaredPermission (声明权限)
  ├── ActualCall (实际调用)
  └── Anomaly (异常记录)

ApprovalBatch (审批批次)
  ├── ActualCall (实际调用)
  └── AuditSummary (审计摘要)
```

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI应用入口
│   ├── models.py        # SQLAlchemy数据模型
│   ├── schemas.py       # Pydantic数据验证
│   ├── crud.py          # 数据库操作和业务逻辑
│   └── database.py      # 数据库连接配置
├── exports/             # 导出文件目录
├── requirements.txt     # 依赖列表
├── sample_data.py       # 样例数据和测试脚本
├── .env                # 环境变量
└── README.md
```
