# 试验参数冻结API系统

## 项目概述

这是一个为AB实验设计的参数冻结与变更管理系统，核心是解决实验中途参数变更导致的指标解释不清问题，特别关注异常路径追溯。

## 核心功能

### 1. 数据模型

- **ExperimentFreeze** - 实验冻结记录：实验编号、参数版本、冻结时间、指标窗口、状态
- **ParameterSnapshot** - 参数快照：版本号、快照时间、参数内容、哈希校验
- **ChangeRequest** - 变更申请：变更类型、原参数、提议参数、审批状态、拦截标识
- **ExceptionRecord** - 异常记录：异常类型、原始输入、处理依据、最终结论
- **FreezeReport** - 冻结报告：报告类型、内容、导出格式
- **AuditLog** - 审计日志：操作、前后状态、操作人、时间

### 2. 状态管理

- **pending** - 待处理
- **confirmed** - 已确认
- **blocked** - 被拦截
- **revoked** - 已撤销
- **compensated** - 已补偿

### 3. 关键规则实现

- **参数快照**：每次变更自动保存参数哈希
- **修改拦截**：已确认/已拦截状态下自动拦截变更
- **人工审批**：变更需审批流程
- **指标关联**：完整的指标窗口配置
- **报告导出**：支持JSON和Excel格式导出

### 4. 异常追溯

- 完整保留原始输入
- 记录处理依据
- 记录最终结论
- 全链路审计日志

## API接口

### 实验冻结管理
- `POST /freezes` - 创建冻结记录
- `GET /freezes` - 查询冻结列表
- `GET /freezes/{id}` - 查询冻结详情
- `POST /freezes/status` - 推进状态

### 变更申请管理
- `POST /change-requests` - 创建变更申请
- `POST /change-requests/{id}/approve` - 审批变更
- `GET /change-requests` - 查询变更列表

### 异常处理
- `POST /exceptions` - 记录异常
- `POST /exceptions/{id}/resolve` - 解决异常
- `GET /exceptions` - 查询异常列表

### 人工修正
- `POST /manual-correction` - 人工修正参数

### 报告导出
- `POST /reports` - 生成报告
- `POST /export` - 导出冻结数据（JSON/Excel）

### 查询接口
- `GET /audit-logs` - 查询审计日志
- `GET /snapshots` - 查询参数快照

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI应用入口
│   ├── models.py        # SQLAlchemy数据模型
│   ├── schemas.py       # Pydantic数据验证
│   ├── services.py      # 核心业务逻辑
│   ├── database.py      # 数据库配置
│   ├── enums.py         # 枚举定义
│   └── export_service.py # 导出服务
├── exports/             # 导出文件目录
├── requirements.txt     # 依赖配置
├── .env                # 环境配置
└── experiment_freeze.db # SQLite数据库（自动生成）
```

## 启动方式

```bash
# 安装依赖
pip3 install -r requirements.txt

# 启动服务
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

服务启动后，访问:
- API文档: http://localhost:8000/docs
- Redoc文档: http://localhost:8000/redoc

## 技术栈

- **FastAPI** - Web框架
- **SQLAlchemy** - ORM
- **Pydantic** - 数据验证
- **Pandas/OpenPyXL** - Excel导出
- **SQLite** - 数据库
