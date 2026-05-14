# 贷款展期审批服务

一个完整的贷款展期审批 API 服务，支持展期申请、还款计划重算、罚息快照、额度管理、审批历史追踪和对账导出。

## 功能特性

- **展期申请审批**：完整的申请 → 初审 → 终审 → 执行流程
- **规则可复查**：所有业务规则集中管理，执行时生成快照
- **还款计划重算**：等额本息计算，支持版本管理和历史追溯
- **罚息快照**：自动计算并记录展期时的罚息状态
- **额度管理**：自动计算额度占用，完整变更历史
- **后台任务**：支持异步执行、失败重试、状态追踪
- **对账导出**：Excel 导出和数据一致性自检
- **审计日志**：完整的操作历史记录

## 技术栈

- **Python 3.9+**
- **FastAPI**：高性能 Web 框架
- **SQLAlchemy**：ORM 框架
- **SQLite**：默认数据库（无需外部服务，适合本地开发）
- **PostgreSQL**：可选（生产环境使用）
- **Celery**：后台任务（可选）
- **Redis**：消息队列（可选）

## 快速开始（零配置，无需外部服务）

### 1. 进入项目目录

```bash
cd /Users/lzy/pro/solo/workspaces/zy70052
```

### 2. 创建虚拟环境并安装依赖

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 3. 验证模块导入（无需数据库）

```bash
python3 scripts/verify_imports.py
```

如果看到 `所有模块导入和基础功能测试成功! ✓`，说明一切正常。

### 4. 运行完整业务流程演示（无需外部服务）

```bash
python3 scripts/demo_workflow.py
```

这个脚本会使用内存 SQLite 数据库，完整演示：
1. 创建贷款账户
2. 提交展期申请
3. 初审通过
4. 终审通过
5. 执行展期
6. 查看申请详情
7. 检查数据一致性

### 5. 启动服务

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

服务将在 http://localhost:8000 启动，使用本地 SQLite 文件数据库。

### 6. 访问 API 文档

- Swagger UI：http://localhost:8000/docs
- ReDoc：http://localhost:8000/redoc

## 数据库配置说明

### 默认配置（无需外部服务）

项目默认使用 SQLite 数据库，无需安装任何外部服务：

```env
DATABASE_TYPE=sqlite
SQLITE_DB_PATH=./loan_extension.db
SQLITE_IN_MEMORY=false
```

### 生产环境配置（可选）

如需使用 PostgreSQL，请修改 `.env` 文件：

```env
DATABASE_TYPE=postgresql
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/loan_extension
```

创建 PostgreSQL 数据库：

```sql
CREATE DATABASE loan_extension;
```

### 内存数据库（用于快速测试）

```env
DATABASE_TYPE=sqlite
SQLITE_IN_MEMORY=true
```

## 验证模块导入

在启动服务之前，可以先验证模块导入是否正确：

```bash
python3 scripts/verify_imports.py
```

或者使用简单命令：

```bash
python3 -B -c "import app.main; print('✓ 模块导入成功')"
```

如果看到 `✓ 模块导入成功`，说明所有依赖和导入都正确。

## 快速验证流程

### 1. 启动服务后，先创建测试贷款账户

```bash
# 创建一个测试贷款账户
curl -X POST "http://localhost:8000/api/v1/loan-accounts" \
  -H "Content-Type: application/json" \
  -d '{
    "account_no": "ACC-20240501-001",
    "customer_id": "CUST001",
    "customer_name": "张三",
    "loan_amount": 100000.00,
    "remaining_principal": 50000.00,
    "total_interest": 10000.00,
    "paid_interest": 5000.00,
    "annual_interest_rate": 6.0,
    "loan_term": 12,
    "original_maturity_date": "2025-01-01T00:00:00",
    "current_maturity_date": "2025-01-01T00:00:00",
    "credit_limit_used": 50000.00
  }'
```

### 2. 提交展期申请

```bash
curl -X POST "http://localhost:8000/api/v1/extension/applications?account_no=ACC-20240501-001&extension_months=3&applicant_id=USER001&applicant_name=申请人"
```

记录返回的 `application_no`，例如 `EXT20240501123456123456`。

### 3. 初审通过

```bash
curl -X POST "http://localhost:8000/api/v1/extension/applications/EXT20240501123456123456/first-approve?approver_id=APPROVER01&approver_name=审核员A"
```

### 4. 终审通过

```bash
curl -X POST "http://localhost:8000/api/v1/extension/applications/EXT20240501123456123456/final-approve?approver_id=APPROVER02&approver_name=审核员B"
```

### 5. 执行展期

```bash
curl -X POST "http://localhost:8000/api/v1/extension/applications/EXT20240501123456123456/execute"
```

### 6. 查看申请详情

```bash
curl -X GET "http://localhost:8000/api/v1/extension/applications/EXT20240501123456123456"
```

### 7. 检查数据一致性

```bash
curl -X GET "http://localhost:8000/api/v1/consistency/EXT20240501123456123456"
```

## API 接口列表

### 贷款账户管理
- `POST /api/v1/loan-accounts` - 创建贷款账户
- `GET /api/v1/loan-accounts/{account_no}` - 查询账户详情

### 展期申请管理
- `POST /api/v1/extension/applications` - 提交展期申请
- `GET /api/v1/extension/applications/{application_no}` - 查看申请详情
- `POST /api/v1/extension/applications/{no}/first-approve` - 初审
- `POST /api/v1/extension/applications/{no}/final-approve` - 终审
- `POST /api/v1/extension/applications/{no}/execute` - 执行展期
- `POST /api/v1/extension/applications/{no}/reject` - 驳回申请
- `POST /api/v1/extension/applications/{no}/cancel` - 撤销申请

### 后台任务
- `POST /api/v1/tasks/execute-extension` - 创建后台执行任务
- `GET /api/v1/tasks/{task_id}` - 查询任务状态
- `POST /api/v1/tasks/{task_id}/retry` - 重试失败任务

### 对账导出
- `GET /api/v1/reconciliation/extensions` - 展期申请对账查询
- `GET /api/v1/reconciliation/extensions/export` - 导出 Excel
- `GET /api/v1/reconciliation/loan-accounts` - 贷款账户对账查询
- `GET /api/v1/reconciliation/loan-accounts/export` - 导出 Excel
- `GET /api/v1/reconciliation/credit-limits` - 额度变更对账查询
- `GET /api/v1/reconciliation/audit-logs` - 审计日志查询

### 系统管理
- `GET /api/v1/health` - 健康检查
- `GET /api/v1/consistency/{application_no}` - 数据一致性检查

## 项目结构

```
.
├── app/
│   ├── main.py                 # FastAPI 应用入口
│   ├── config.py               # 配置管理
│   ├── database.py             # 数据库连接
│   ├── models/                 # 数据模型
│   │   ├── loan_account.py     # 贷款账户
│   │   ├── repayment_plan.py   # 还款计划
│   │   ├── extension_application.py  # 展期申请
│   │   ├── penalty_snapshot.py      # 罚息快照
│   │   ├── credit_limit.py          # 额度记录
│   │   ├── approval_history.py      # 审批历史
│   │   ├── audit_log.py             # 审计日志
│   │   └── task_record.py           # 任务记录
│   ├── services/               # 业务服务
│   │   ├── rule_engine.py      # 规则引擎
│   │   ├── audit_service.py    # 审计服务
│   │   ├── repayment_calculator.py  # 还款计划计算器
│   │   ├── extension_service.py     # 展期服务
│   │   ├── limit_service.py         # 额度服务
│   │   ├── task_service.py          # 任务服务
│   │   └── reconciliation_service.py  # 对账服务
│   └── utils/                  # 工具类
│       ├── enums.py            # 枚举定义
│       ├── id_generator.py     # ID 生成器
│       └── datetime_utils.py   # 日期时间工具
├── requirements.txt
├── .env.example
└── README.md
```

## 核心数据模型

### 贷款账户 (LoanAccount)
记录贷款的基本信息、剩余本金、展期次数等。

### 还款计划 (RepaymentPlan + RepaymentInstallment)
- 支持多版本管理
- 每期还款明细
- 完整变更历史

### 展期申请 (ExtensionApplication)
记录申请详情、审批状态、执行状态。

### 罚息快照 (PenaltySnapshot)
展期审批时自动生成，记录逾期和罚息计算结果。

### 规则检查快照 (RuleCheckSnapshot)
每次规则检查都生成快照，确保规则可复查。

## 业务规则

### 展期申请规则
1. 账户状态必须为 ACTIVE 或 OVERDUE
2. 展期次数未达上限（默认 2 次）
3. 展期月数不超过最大限制（默认 6 个月）
4. 没有待处理的其他展期申请
5. 账户有剩余本金

### 审批流程
```
提交申请 → 待初审 (PENDING)
    ↓
初审通过 → 待终审 (FIRST_APPROVED)
    ↓
终审通过 → 待执行 (FINAL_APPROVED)
    ↓
执行展期 → 已完成 (EXECUTED)
```

可在任意未执行阶段驳回或撤销。

## 后台任务机制

### 任务状态
- `PENDING` - 待执行
- `RUNNING` - 执行中
- `SUCCESS` - 成功
- `FAILED` - 失败
- `RETRYING` - 重试中
- `MAX_RETRY_EXCEEDED` - 达到最大重试次数
- `CANCELLED` - 已取消

### 重试策略
- 最大重试次数：3 次（可配置）
- 重试间隔：指数退避（60s, 120s, 180s...）
- 失败记录：完整错误信息和堆栈

## 常见问题

### 1. 模块导入失败
确保已激活虚拟环境并安装所有依赖：
```bash
source venv/bin/activate
pip install -r requirements.txt
```

### 2. 数据库连接失败
检查 `.env` 中的数据库配置，确保 PostgreSQL 服务正在运行。

### 3. 如何查看所有规则？
规则都集中在 `app/services/rule_engine.py` 中，每个规则都有明确的名称和描述。

## 验收标准

详细的验收点请参考 `ACCEPTANCE_CRITERIA.md` 文件，包含：
- 主流程验收（展期申请、还款计划重算、罚息快照）
- 异常场景验收
- 数据一致性验收
- 后台任务验收
- 边界情况验收
- 日志与可观测性验收

## 许可证

本项目仅供学习和参考使用。
