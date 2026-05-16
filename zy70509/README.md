# 分布式锁续约审计API

用于追踪和审计分布式锁的获取、续约、执行阶段和释放的完整生命周期系统，解决"拿锁后偶尔续约失败，重跑时又不知道前一次到底有没有执行到危险步骤"的问题。

## 核心功能

### 1. 完整锁生命周期追踪
- 锁获取、续约、执行阶段、危险步骤标记、释放的全流程记录
- 自动超时检测和状态更新

### 2. 续约审计
- 每次续约的成功/失败记录
- 续约时间、前后过期时间、客户端信息
- 续约冲突检测（5秒内多次续约）

### 3. 执行阶段留痕
- 锁获取阶段、续约阶段、业务逻辑阶段、危险步骤、锁释放阶段
- 每个阶段的进入/退出时间、持续时长
- 阶段自定义数据存储

### 4. 危险步骤标记
- 明确标记危险步骤是否已执行
- 记录执行时间
- 支持人工修正标记

### 5. 异常记录
- 失败路径保留原始输入
- 处理依据记录
- 最终结论存储
- 完整错误信息和堆栈追踪

### 6. 人工修正机制
- 支持人工修正锁状态
- 支持人工修正执行阶段
- 支持人工标记危险步骤执行情况
- 所有修正操作留痕

### 7. 数据导出
- 支持JSON和CSV格式导出
- 导出字段包含：续约统计、阶段统计、失败记录等完整信息
- 支持按任务名、锁键、状态、时间范围筛选导出

### 8. 最小自检功能
- 超时锁检查（已超时但未标记）
- 状态-阶段一致性检查
- 阶段退出完整性检查
- 续约冲突检测
- 数据完整性统计

## 技术栈

- **框架**: FastAPI 0.104.1
- **数据库**: SQLAlchemy 2.0.23 + SQLite（可扩展至其他数据库）
- **Web服务器**: Uvicorn

## 项目结构

```
zy70509/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI主应用
│   ├── core/                   # 核心配置
│   │   ├── __init__.py
│   │   ├── config.py           # 配置管理
│   │   └── database.py         # 数据库连接
│   ├── models/                 # 数据模型
│   │   ├── __init__.py
│   │   └── lock_audit.py       # 锁审计模型
│   ├── schemas/                # Pydantic模式
│   │   ├── __init__.py
│   │   └── lock_audit.py       # 请求/响应模式
│   ├── crud/                   # 数据操作层
│   │   ├── __init__.py
│   │   └── lock_audit.py       # 审计业务逻辑
│   └── api/                    # API路由
│       ├── __init__.py
│       └── lock_audit.py       # 审计API
├── .env                        # 环境变量
├── .env.example               # 环境变量示例
├── requirements.txt           # Python依赖
├── run.py                     # 启动脚本
└── README.md                  # 项目文档
```

## 数据模型

### LockAudit（锁审计主记录）
- `id`: 主键
- `task_name`: 任务名称
- `lock_key`: 锁键
- `status`: 锁状态 (acquired, renewing, renew_failed, executing, executed, releasing, released, timeout_released, manually_released, expired)
- `execution_phase`: 执行阶段 (lock_acquire, lock_renew, business_logic, dangerous_step, lock_release)
- `acquired_at`: 获取时间
- `last_renewed_at`: 最后续约时间
- `expired_at`: 过期时间
- `release_reason`: 释放原因 (normal, timeout, manual, exception, renewal_failure)
- `release_time`: 释放时间
- `audit_summary`: 审计摘要
- `is_dangerous_step_executed`: 危险步骤是否执行
- `dangerous_step_executed_at`: 危险步骤执行时间
- `created_at`, `updated_at`: 创建/更新时间

### RenewHistory（续约历史）
- 每次续约的详细记录，包括成功/失败、时间戳、客户端信息等

### PhaseHistory（阶段历史）
- 每个执行阶段的进入/退出时间、持续时长、阶段数据

### FailureRecord（失败记录）
- 失败类型、原始输入、处理依据、最终结论、错误信息、堆栈追踪

### ManualCorrection（人工修正记录）
- 修正人、修正类型、前后状态、原因、修正数据

## API接口

### 创建审计记录
```
POST /api/lock-audit/
{
  "task_name": "order_processing",
  "lock_key": "order:12345",
  "ttl_seconds": 300,
  "client_info": "service-a"
}
```

### 查询审计记录
```
GET  /api/lock-audit/{audit_id}
POST /api/lock-audit/query
GET  /api/lock-audit/lock-key/{lock_key}
```

### 续约操作
```
POST /api/lock-audit/{audit_id}/renew
{
  "lock_key": "order:12345",
  "ttl_seconds": 300,
  "client_info": "service-a"
}
```

### 更新执行阶段
```
POST /api/lock-audit/{audit_id}/phase
{
  "phase": "business_logic",
  "phase_data": {"step": "validate"},
  "mark_dangerous_step": false
}
```

### 记录失败事件
```
POST /api/lock-audit/{audit_id}/failure
{
  "failure_type": "renew_timeout",
  "original_input": {"lock_key": "order:12345"},
  "processing_basis": {"retry_count": 3},
  "final_conclusion": "锁续约失败，建议人工确认",
  "error_message": "Redis连接超时",
  "stack_trace": "..."
}
```

### 人工修正
```
POST /api/lock-audit/{audit_id}/correct
{
  "corrected_by": "admin",
  "correction_type": "status_fix",
  "new_status": "released",
  "new_phase": null,
  "reason": "人工确认任务已完成",
  "correction_data": {"ticket_id": "TICKET-001"},
  "mark_dangerous_step": true
}
```

### 释放锁
```
POST /api/lock-audit/{audit_id}/release
{
  "release_reason": "normal",
  "audit_summary": "任务正常完成"
}
```

### 查询子记录
```
GET /api/lock-audit/{audit_id}/renew-history   # 续约历史
GET /api/lock-audit/{audit_id}/phase-history   # 阶段历史
GET /api/lock-audit/{audit_id}/failures        # 失败记录
GET /api/lock-audit/{audit_id}/corrections     # 修正记录
```

### 导出数据
```
POST /api/lock-audit/export
{
  "task_name": "order_processing",
  "status": "renew_failed",
  "start_time": "2024-01-01T00:00:00",
  "end_time": "2024-12-31T23:59:59",
  "export_format": "csv"
}
```

### 自检和维护
```
GET  /api/lock-audit/self-check/run        # 运行自检
POST /api/lock-audit/maintenance/clean-timeout  # 清理超时锁
```

### 枚举查询
```
GET /api/lock-audit/enums/status         # 锁状态枚举
GET /api/lock-audit/enums/phase          # 执行阶段枚举
GET /api/lock-audit/enums/release-reason # 释放原因枚举
```

## 快速开始

### 1. 安装依赖
```bash
pip install -r requirements.txt
```

### 2. 配置环境变量（可选）
```bash
cp .env.example .env
# 编辑 .env 文件
```

### 3. 启动服务
```bash
python run.py
# 或者
python -m app.main
```

### 4. 访问API文档
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 典型使用场景

### 场景1: 完整任务执行流程
1. 获取锁时创建审计记录
2. 进入业务逻辑阶段时更新阶段
3. 执行危险步骤时标记
4. 定期续约时记录
5. 释放锁时填写审计摘要

### 场景2: 续约失败后排查
1. 通过lock_key查询活跃审计记录
2. 查看续约历史了解失败情况
3. 查看执行阶段确认是否已执行危险步骤
4. 查看失败记录获取原始输入和错误详情

### 场景3: 人工介入处理
1. 查看审计详情，确认任务状态
2. 根据危险步骤标记决定是否重试
3. 如需修正，通过人工修正接口更新
4. 所有修正操作都会留痕

## 数据持久化

- 使用SQLite数据库（默认文件：`./lock_audit.db`）
- 服务重启后所有历史记录、导出字段、主记录保持一致
- 支持扩展至MySQL、PostgreSQL等生产级数据库（修改DATABASE_URL）

## 环境变量

- `DATABASE_URL`: 数据库连接URL
- `HOST`: 服务监听地址
- `PORT`: 服务端口
- `ENVIRONMENT`: 运行环境 (development/production)
