# 预约刷卡对账台 - 高校共享仪器管理 REST API

一个面向高校共享仪器管理员的本地纯后端 REST API 服务，用于管理仪器预约、门禁刷卡、样品登记和费用对账。

## 功能特性

- **数据导入**: 支持 CSV/JSON 格式导入预约单、刷卡日志、样品登记和计费规则
- **智能校验**: 自动检测时段重叠、无预约刷卡、越权上机、样品超时、费用漏算
- **状态管理**: 基于状态机的账单和违规状态流转
- **复核流程**: 支持违规批准/驳回/申诉、账单减免/支付
- **审计日志**: 完整的操作记录跟踪
- **多格式导出**: 支持 Markdown/CSV/JSON 导出
- **规则引擎**: 可插拔的业务规则系统

## 项目结构

```
xy4173/
├── app/
│   ├── __init__.py
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py          # 配置管理
│   │   └── database.py        # 数据库连接
│   ├── models/
│   │   ├── __init__.py
│   │   ├── instrument.py      # 仪器模型
│   │   ├── user.py            # 用户模型
│   │   ├── research_group.py  # 课题组模型
│   │   ├── reservation.py     # 预约单模型
│   │   ├── swipe_log.py       # 刷卡日志模型
│   │   ├── sample_registration.py  # 样品登记模型
│   │   ├── billing_rule.py    # 计费规则模型
│   │   ├── bill.py            # 账单模型
│   │   ├── violation.py       # 违规记录模型
│   │   ├── review.py          # 复核记录模型
│   │   ├── audit_log.py       # 审计日志模型
│   │   └── import_batch.py    # 导入批次模型
│   ├── schemas/
│   │   ├── __init__.py
│   │   └── base.py            # Pydantic 模型
│   ├── parsers/
│   │   ├── __init__.py
│   │   ├── base.py            # 解析器基类
│   │   ├── csv_parser.py      # CSV 解析器
│   │   └── json_parser.py     # JSON 解析器
│   ├── engine/
│   │   ├── __init__.py
│   │   ├── rule_engine.py     # 规则引擎
│   │   ├── state_machine.py   # 状态机
│   │   └── billing_engine.py  # 计费引擎
│   ├── exports/
│   │   ├── __init__.py
│   │   ├── exporter.py        # 导出器基类
│   │   └── reconciliation_report.py  # 对账报告
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── health.py          # 健康检查路由
│   │   ├── imports.py         # 数据导入路由
│   │   ├── query.py           # 数据查询路由
│   │   ├── review.py          # 复核处理路由
│   │   ├── exports.py         # 数据导出路由
│   │   └── admin.py           # 系统管理路由
│   └── utils/
│       ├── __init__.py
│       ├── code_generator.py  # 编码生成器
│       ├── sample_data.py     # 示例数据生成器
│       └── self_check.py      # 自检功能
├── examples/                   # 示例数据文件
│   ├── reservations.csv
│   ├── swipe_logs.csv
│   ├── samples.csv
│   └── billing_rules.json
├── pyproject.toml
├── requirements.txt
└── main.py                     # 应用入口
```

## 快速开始

### 环境要求

- Python 3.10+
- SQLite (自动创建)

### 安装依赖

```bash
# 使用 pip
pip install -r requirements.txt

# 或使用 poetry
poetry install
```

### 启动服务

```bash
# 开发模式（带热重载）
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 或直接运行
python main.py
```

服务启动后访问:
- API 文档: http://localhost:8000/docs
- ReDoc 文档: http://localhost:8000/redoc

## 业务规则说明

| 规则类型 | 检查内容 | 触发条件 |
|---------|---------|---------|
| TIME_OVERLAP | 时段重叠 | 同一仪器的预约时间重叠 |
| NO_RESERVATION_SWIPE | 无预约刷卡 | 刷卡时间无对应预约 |
| CROSS_GROUP_USAGE | 跨课题组使用 | 用户课题组与预约课题组不符 |
| SAMPLE_OVERDUE | 样品逾期 | 样品超过存储期限未取回 |
| RESERVATION_NO_SHOW | 预约未到 | 预约开始时间后无刷卡记录 |

## API 使用指南

### 1. 健康检查

```bash
# 基础健康检查
curl http://localhost:8000/health

# 详细健康检查
curl http://localhost:8000/health/detailed

# 系统自检
curl http://localhost:8000/self-check

# 版本信息
curl http://localhost:8000/version
```

### 2. 系统初始化

```bash
# 初始化数据库
curl -X POST http://localhost:8000/admin/init-db

# 或者创建基础数据
# 创建课题组
curl -X POST http://localhost:8000/admin/research-groups \
  -H "Content-Type: application/json" \
  -d '{
    "group_code": "GROUP-A",
    "name": "纳米材料研究组",
    "leader_name": "张教授",
    "contact_email": "zhang@university.edu.cn"
  }'

# 创建仪器
curl -X POST http://localhost:8000/admin/instruments \
  -H "Content-Type: application/json" \
  -d '{
    "instrument_code": "TEM-001",
    "name": "高分辨透射电镜",
    "base_hourly_rate": 200.0,
    "type": "TEM",
    "location": "A栋201室"
  }'

# 创建用户
curl -X POST http://localhost:8000/admin/users \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "U2023001",
    "name": "李小明",
    "role": "student",
    "card_number": "CARD001",
    "research_group_id": 1
  }'
```

### 3. 数据导入

```bash
# 导入预约单 CSV
curl -X POST http://localhost:8000/import/reservations \
  -F "file=@examples/reservations.csv"

# 导入刷卡日志 CSV
curl -X POST http://localhost:8000/import/swipe-logs \
  -F "file=@examples/swipe_logs.csv"

# 导入样品登记 CSV
curl -X POST http://localhost:8000/import/samples \
  -F "file=@examples/samples.csv"

# 导入计费规则 JSON
curl -X POST http://localhost:8000/import/billing-rules \
  -F "file=@examples/billing_rules.json"

# 一键生成示例数据（推荐用于测试）
curl -X POST http://localhost:8000/import/sample-data
```

### 4. 运行规则检查

```bash
# 运行所有规则
curl -X POST http://localhost:8000/admin/run-rules

# 运行指定规则
# 可选规则: time_overlap, no_reservation_swipe, cross_group_usage, sample_overdue, reservation_no_show
curl -X POST http://localhost:8000/admin/run-rule/no_reservation_swipe
curl -X POST http://localhost:8000/admin/run-rule/time_overlap
curl -X POST http://localhost:8000/admin/run-rule/sample_overdue
```

### 5. 数据查询

```bash
# 查询预约单
curl "http://localhost:8000/query/reservations?page=1&page_size=10"

# 查询刷卡日志
curl "http://localhost:8000/query/swipe-logs?match_status=unmatched"

# 查询违规记录
curl "http://localhost:8000/query/violations?status=pending"

# 查询样品登记
curl "http://localhost:8000/query/samples?is_overdue=true"

# 查询账单
curl "http://localhost:8000/query/bills?status=pending"

# 查询审计日志
curl "http://localhost:8000/query/audit-logs"

# 获取系统统计
curl http://localhost:8000/admin/stats
```

### 6. 复核处理

```bash
# 批准违规
curl -X POST "http://localhost:8000/review/violations/1/approve" \
  -H "Content-Type: application/json" \
  -d '{
    "comment": "确认违规事实",
    "operator_id": "ADMIN001"
  }'

# 驳回违规
curl -X POST "http://localhost:8000/review/violations/1/dismiss" \
  -H "Content-Type: application/json" \
  -d '{
    "comment": "经核实为误报，用户确有预约",
    "operator_id": "ADMIN001"
  }'

# 申诉违规
curl -X POST "http://localhost:8000/review/violations/1/appeal" \
  -H "Content-Type: application/json" \
  -d '{
    "appeal_reason": "当时有特殊情况，已提前报备管理员",
    "appellant_id": "U2023001"
  }'

# 提交账单复核
curl -X POST "http://localhost:8000/review/bills/1/submit-review" \
  -H "Content-Type: application/json" \
  -d '{
    "operator_id": "ADMIN001"
  }'

# 批准账单
curl -X POST "http://localhost:8000/review/bills/1/approve" \
  -H "Content-Type: application/json" \
  -d '{
    "comment": "费用计算正确",
    "operator_id": "ADMIN001"
  }'

# 驳回账单
curl -X POST "http://localhost:8000/review/bills/1/reject" \
  -H "Content-Type: application/json" \
  -d '{
    "comment": "计费时长有误，请重新核算",
    "operator_id": "ADMIN001"
  }'

# 减免账单
curl -X POST "http://localhost:8000/review/bills/1/waive" \
  -H "Content-Type: application/json" \
  -d '{
    "waive_amount": 100.0,
    "waive_reason": "首次使用减免",
    "operator_id": "ADMIN001"
  }'

# 记录支付
curl -X POST "http://localhost:8000/review/bills/1/pay" \
  -H "Content-Type: application/json" \
  -d '{
    "pay_amount": 500.0,
    "payment_method": "internal_transfer",
    "operator_id": "ADMIN001"
  }'
```

### 7. 数据导出

```bash
# 导出预约单
curl -o reservations.csv http://localhost:8000/export/reservations/csv
curl -o reservations.json http://localhost:8000/export/reservations/json
curl -o reservations.md http://localhost:8000/export/reservations/md

# 导出刷卡日志
curl -o swipe_logs.csv http://localhost:8000/export/swipe-logs/csv

# 导出违规记录
curl -o violations.csv http://localhost:8000/export/violations/csv

# 导出账单
curl -o bills.csv http://localhost:8000/export/bills/csv

# 预览对账报告
curl http://localhost:8000/export/reconciliation-report/preview

# 导出对账报告
curl -o report.md http://localhost:8000/export/reconciliation-report/md
curl -o report.csv http://localhost:8000/export/reconciliation-report/csv
curl -o report.json http://localhost:8000/export/reconciliation-report/json
```

## 完整验证流程

```bash
#!/bin/bash

# 1. 启动服务（新终端执行）
# uvicorn main:app --reload --port 8000

echo "=== 步骤 1: 健康检查 ==="
curl -s http://localhost:8000/health | python -m json.tool

echo -e "\n=== 步骤 2: 生成示例数据 ==="
curl -s -X POST http://localhost:8000/import/sample-data | python -m json.tool

echo -e "\n=== 步骤 3: 运行规则检查 ==="
curl -s -X POST http://localhost:8000/admin/run-rules | python -m json.tool

echo -e "\n=== 步骤 4: 查看系统统计 ==="
curl -s http://localhost:8000/admin/stats | python -m json.tool

echo -e "\n=== 步骤 5: 查询违规记录 ==="
curl -s "http://localhost:8000/query/violations?page_size=5" | python -m json.tool

echo -e "\n=== 步骤 6: 预览对账报告 ==="
curl -s http://localhost:8000/export/reconciliation-report/preview | python -m json.tool

echo -e "\n=== 步骤 7: 导出对账报告（Markdown） ==="
curl -s http://localhost:8000/export/reconciliation-report/md

echo -e "\n=== 验证完成 ==="
```

## 状态机说明

### 账单状态流转

```
pending ──submit──► pending_review
   │                   │
   │              ┌────┴────┐
   │              ▼         ▼
   │           approved   rejected ──► 需要重新核算
   │              │
   │         ┌────┴────┐
   │         ▼         ▼
   │       paid      waived
   │
   └──► (可被 submit 前编辑)
```

### 违规状态流转

```
pending ──approve──► confirmed
   │                  │
   │             ┌────┴────┐
   │             ▼         ▼
   │          resolved  (等待处理)
   │
   ├──dismiss──► dismissed (误报)
   │
   └──appeal──► under_appeal (申诉中)
```

## 配置说明

通过环境变量或 `.env` 文件配置：

```env
# 应用配置
APP_NAME=预约刷卡对账台
APP_VERSION=0.1.0
DEBUG=true

# 数据库配置
DATABASE_URL=sqlite:///./reconciliation.db

# API 配置
API_PREFIX=/api
TIMEZONE=Asia/Shanghai

# 上传配置
UPLOAD_DIR=./uploads
```

## 数据库模型

### 核心数据表

| 表名 | 说明 |
|-----|------|
| instruments | 共享仪器信息 |
| users | 用户（管理员/老师/学生） |
| research_groups | 课题组 |
| reservations | 预约单 |
| swipe_logs | 门禁刷卡日志 |
| sample_registrations | 样品登记 |
| billing_rules | 计费规则 |
| bills | 账单 |
| violations | 违规记录 |
| reviews | 复核记录 |
| audit_logs | 审计日志 |
| import_batches | 导入批次 |

## 许可证

MIT License
