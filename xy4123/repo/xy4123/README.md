# 危化品领用闸门

学校化学实验室危化品领用管理API系统 - 防止过期酸碱或未还空瓶流出的智能闸门

## 项目概述

本系统是专为学校化学实验室管理员设计的纯后端API服务，用于规范化危化品领用流程。通过规则引擎自动拦截各类违规操作，确保实验室安全。

### 核心功能

| 功能模块 | 描述 |
|---------|------|
| **试剂管理** | CAS号唯一校验、危险等级、储存分组 |
| **批次库存** | 有效期管理、数量追踪、储柜分类 |
| **课程领用** | 申领单提交、多级审批、自动校验 |
| **归还废弃** | 归还记录、废液去向追踪、容器状态 |
| **规则引擎** | 超量/过期/授权/互斥/废液去向校验 |
| **导入导出** | CSV库存导入、Markdown追溯报告 |
| **审计日志** | 全操作记录、合规审计追踪 |

## 技术栈

- **框架**: FastAPI (异步)
- **数据库**: SQLite + SQLAlchemy 2.0
- **数据验证**: Pydantic 2.x
- **测试**: pytest + httpx
- **Python版本**: >= 3.10

## 快速开始

### 1. 安装依赖

```bash
# 创建虚拟环境
python3 -m venv .venv
source .venv/bin/activate

# 安装项目依赖
pip install -e .

# 或使用开发模式安装
pip install -e ".[dev]"
```

### 2. 启动服务

```bash
# 使用uvicorn启动
uvicorn hazardous_gate.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. 访问API文档

服务启动后访问以下地址：

| 文档类型 | 地址 |
|---------|------|
| **Swagger UI** | http://localhost:8000/docs |
| **ReDoc** | http://localhost:8000/redoc |
| **OpenAPI JSON** | http://localhost:8000/openapi.json |

## 项目结构

```
src/hazardous_gate/
├── __init__.py
├── config.py              # 配置管理（危险等级、互斥规则等）
├── main.py                # FastAPI应用入口
├── models/
│   ├── __init__.py
│   ├── database.py        # SQLAlchemy ORM模型
│   └── schemas.py         # Pydantic API schema
├── routers/
│   ├── __init__.py
│   ├── reagents.py        # 试剂管理路由
│   ├── batches.py         # 批次库存路由
│   ├── usages.py          # 领用单路由（核心）
│   ├── import_export.py   # 导入导出路由
│   └── audit.py           # 审计日志路由
├── storage/
│   ├── __init__.py
│   ├── database.py        # 数据库连接、会话管理
│   └── crud.py            # CRUD操作封装
├── rules/
│   ├── __init__.py
│   └── engine.py          # 规则引擎（领用校验核心）
├── importers/
│   ├── __init__.py
│   └── csv_importer.py    # CSV导入 + 校验
├── exporters/
│   ├── __init__.py
│   ├── csv_exporter.py    # 风险清单CSV导出
│   └── markdown_exporter.py # 追溯报告Markdown导出
└── audit/
    ├── __init__.py
    └── service.py         # 审计日志服务

tests/
├── __init__.py
├── conftest.py            # 测试fixtures
└── test_rules.py          # 规则引擎测试
```

## 本地验证流程

### 第一步：健康检查

```bash
curl http://localhost:8000/health
```

预期响应：
```json
{
  "status": "healthy",
  "timestamp": "2026-05-02T10:00:00"
}
```

### 第二步：创建试剂

```bash
curl -X POST http://localhost:8000/api/v1/reagents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "盐酸",
    "cas_number": "7647-01-0",
    "hazard_level": "中危",
    "storage_group": "酸类",
    "cabinet_type": "酸柜",
    "min_authorization_level": 2
  }'
```

### 第三步：创建批次库存

```bash
curl -X POST http://localhost:8000/api/v1/batches \
  -H "Content-Type: application/json" \
  -d '{
    "reagent_id": 1,
    "batch_number": "HC-2026-001",
    "concentration": 37.5,
    "concentration_unit": "%",
    "initial_quantity": 500,
    "current_quantity": 500,
    "expiry_date": "2027-05-01"
  }'
```

### 第四步：创建领用单（规则校验演示）

#### 场景1：正常领用

```bash
curl -X POST http://localhost:8000/api/v1/usages \
  -H "Content-Type: application/json" \
  -d '{
    "course_name": "普通化学实验",
    "teacher_name": "张老师",
    "teacher_id": "T2024001",
    "class_name": "化学2301班",
    "student_count": 30,
    "experiment_date": "2026-05-10",
    "items": [
      {
        "batch_id": 1,
        "requested_quantity": 100,
        "unit": "ml"
      }
    ]
  }'
```

#### 场景2：超量领用（应该被拦截）

```bash
curl -X POST http://localhost:8000/api/v1/usages \
  -H "Content-Type: application/json" \
  -d '{
    "course_name": "普通化学实验",
    "teacher_name": "张老师",
    "teacher_id": "T2024001",
    "experiment_date": "2026-05-10",
    "items": [
      {
        "batch_id": 1,
        "requested_quantity": 1000,
        "unit": "ml"
      }
    ]
  }'
```

预期返回：400错误，包含"超量领用"违规信息

#### 场景3：互斥试剂同车（应该被拦截）

先创建碱类试剂：
```bash
curl -X POST http://localhost:8000/api/v1/reagents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "氢氧化钠",
    "cas_number": "1310-73-2",
    "hazard_level": "中危",
    "storage_group": "碱类",
    "cabinet_type": "碱柜",
    "min_authorization_level": 2
  }'

curl -X POST http://localhost:8000/api/v1/batches \
  -H "Content-Type: application/json" \
  -d '{
    "reagent_id": 2,
    "batch_number": "NaOH-2026-001",
    "concentration": 50,
    "concentration_unit": "%",
    "initial_quantity": 500,
    "current_quantity": 500,
    "expiry_date": "2027-05-01"
  }'
```

尝试同时领用酸和碱：
```bash
curl -X POST http://localhost:8000/api/v1/usages \
  -H "Content-Type: application/json" \
  -d '{
    "course_name": "酸碱滴定实验",
    "teacher_name": "张老师",
    "teacher_id": "T2024001",
    "experiment_date": "2026-05-10",
    "items": [
      {"batch_id": 1, "requested_quantity": 50, "unit": "ml"},
      {"batch_id": 2, "requested_quantity": 50, "unit": "ml"}
    ]
  }'
```

预期返回：400错误，包含"互斥试剂同车"违规信息（酸类与碱类不可同车）

### 第五步：审批和发放

```bash
# 审批
curl -X POST http://localhost:8000/api/v1/usages/1/approve \
  -H "Content-Type: application/json" \
  -d '{
    "approved": true,
    "approved_by": "李库管"
  }'

# 发放
curl -X POST http://localhost:8000/api/v1/usages/1/issue
```

### 第六步：归还

```bash
curl -X POST http://localhost:8000/api/v1/usages/1/return \
  -H "Content-Type: application/json" \
  -d '{
    "course_usage_id": 1,
    "return_type": "归还",
    "handler": "李库管",
    "waste_destination": "酸性废液桶",
    "items": [
      {
        "usage_item_id": 1,
        "returned_quantity": 30,
        "waste_quantity": 20,
        "unit": "ml"
      }
    ]
  }'
```

## CSV库存导入

### 导入格式要求

必需字段：
| 字段名 | 说明 | 示例 |
|--------|------|------|
| 试剂名称 | 试剂中文名 | 盐酸 |
| CAS号 | 化学文摘号（会校验格式） | 7647-01-0 |
| 危险等级 | 低危/中危/高危/剧毒 | 中危 |
| 储存分组 | 酸类/碱类/氧化剂/还原剂/有机物/金属/氰化物/易燃物/其他 | 酸类 |
| 储柜分类 | 酸柜/碱柜/氧化剂柜/易燃品柜/毒品柜/通用柜/防爆柜/冷藏柜 | 酸柜 |
| 批号 | 唯一标识 | HC-2026-001 |
| 浓度值 | 数值 | 37.5 |
| 浓度单位 | %/mol/L/M/mM/g/L/mg/mL/μg/mL/ppm/ppb | % |
| 初始数量 | 库存数量 | 500 |
| 有效期 | YYYY-MM-DD | 2027-05-01 |

### 示例CSV文件

```csv
试剂名称,CAS号,危险等级,储存分组,储柜分类,批号,浓度值,浓度单位,初始数量,有效期
盐酸,7647-01-0,中危,酸类,酸柜,HC-2026-001,37.5,%,500,2027-05-01
氢氧化钠,1310-73-2,中危,碱类,碱柜,NaOH-2026-001,50,%,500,2027-05-01
```

### 导入API

```bash
curl -X POST http://localhost:8000/api/v1/import-export/inventory/csv \
  -F "file=@inventory.csv"
```

## 导出功能

### 导出风险清单CSV

```bash
curl -O "http://localhost:8000/api/v1/import-export/export/risk-csv"
```

包含风险类型：
- 过期试剂
- 即将过期（30天内）
- 高风险存量（高危/剧毒）
- 零库存

### 导出追溯报告Markdown

```bash
# 下载文件
curl -O "http://localhost:8000/api/v1/import-export/export/trace/1/markdown"

# 预览内容
curl http://localhost:8000/api/v1/import-export/export/trace/1/preview
```

报告包含：
1. 领用单基本信息
2. 领用试剂明细
3. 试剂安全信息
4. 归还/废弃记录
5. 追溯摘要

## 规则引擎详解

### 领用校验规则

| 规则名称 | 触发条件 | 严重程度 | 说明 |
|---------|---------|---------|------|
| 超量领用 | 申请数量 > 当前库存 | ERROR | 库存不足 |
| 过期试剂 | 有效期 < 今日 | ERROR | 禁止领用过期试剂 |
| 即将过期 | 有效期 <= 今日+30天 | WARNING | 提醒即将过期 |
| 授权不足 | 用户授权等级 < 试剂最低要求 | ERROR | 高风险试剂需要更高授权 |
| 互斥试剂同车 | 多试剂属于互斥储存组 | ERROR | 酸&碱、氧化剂&还原剂等不可同车 |
| 缺少废液去向 | 高危试剂领用未指定废液去向 | ERROR | 特殊试剂需要指定废液处理方式 |

### 互斥分组表

| 分组 | 不可同车的分组 |
|------|---------------|
| 酸类 | 碱类、氧化剂、金属 |
| 碱类 | 酸类、氧化剂、有机物 |
| 氧化剂 | 酸类、碱类、还原剂、有机物 |
| 还原剂 | 氧化剂、酸类 |
| 有机物 | 氧化剂、碱类、酸类 |
| 金属 | 酸类、氧化剂 |
| 氰化物 | 酸类、氧化剂 |
| 易燃物 | 氧化剂、酸类、碱类 |

### 授权等级

| 等级 | 名称 | 可领用危险等级 |
|------|------|---------------|
| 1 | 基础 | 低危 |
| 2 | 中级 | 低危、中危 |
| 3 | 高级 | 低危、中危、高危 |
| 4 | 特殊 | 全部（含剧毒） |
| 5 | 剧毒专用 | 全部 |

## 运行测试

```bash
# 运行所有测试
pytest -v

# 运行特定测试文件
pytest tests/test_rules.py -v

# 带覆盖率
pytest --cov=hazardous_gate tests/ -v
```

## 数据库表结构

主要数据表：
- `reagents` - 试剂表
- `batches` - 批次库存表
- `course_usages` - 课程领用单表
- `usage_items` - 领用明细表
- `return_records` - 归还记录表
- `return_items` - 归还明细
- `audit_logs` - 审计日志

## 配置选项

可通过环境变量或 `.env` 文件配置：

```env
DATABASE_URL=sqlite:///./hazardous_gate.db
DEBUG=false
ENVIRONMENT=development
```

## 许可证

内部使用 - 学校化学实验室专用

---

**提示**: 首次运行时系统会自动创建SQLite数据库文件。建议定期备份 `hazardous_gate.db` 文件。
