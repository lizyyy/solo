# 化疗药批次追踪哨

医院静配中心化疗药批次追踪系统后端API服务。

## 项目简介

化疗药批次追踪哨是一个专为医院静配中心设计的本地后端API服务，用于追踪化疗药物的批次使用情况，防范调配风险。

### 核心功能

- **数据导入**：支持处方CSV、药品批号JSON、冰箱温度日志、废弃登记的导入
- **数据查询**：灵活的查询接口，支持多条件筛选
- **风险复核**：内置规则引擎，自动检测8类高风险场景
- **审计导出**：支持Markdown审计报告和JSON风险清单导出

### 风险检测规则

| 风险类型 | 代码 | 说明 |
|----------|------|------|
| 批号冲突 | BATCH_CONFLICT | 同一批号存在多条记录，信息可能不一致 |
| 温度断档 | TEMP_GAP | 冰箱温度记录存在长时间间隔，可能存在监控漏洞 |
| 剂量超限 | DOSE_OVER_LIMIT | 处方剂量超过药品批号可用量 |
| 未闭环废弃 | WASTE_NOT_CLOSED | 废弃记录超过24小时未闭环处理 |
| 超时调配 | PREPARE_TIMEOUT | 实际调配时间超过预计调配时间30分钟以上 |
| 冷链异常 | COLD_CHAIN_ABNORMAL | 冰箱温度超出2-8°C正常范围 |
| 同批号跨患者串用 | BATCH_CROSS_PATIENT | 同一批号被多个患者使用，存在用药风险 |
| 剩余量对不上 | REMAINING_MISMATCH | 批号剩余量与实际使用+废弃量计算不符 |

## 项目结构

```
xy4217/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI主入口
│   ├── config.py            # 配置管理
│   ├── db/
│   │   ├── __init__.py
│   │   └── database.py      # 数据库连接
│   ├── models/
│   │   ├── __init__.py
│   │   └── models.py        # SQLAlchemy ORM模型
│   ├── parsers/
│   │   ├── __init__.py
│   │   ├── prescription_parser.py    # 处方CSV解析
│   │   ├── drug_batch_parser.py      # 药品批号JSON解析
│   │   ├── temperature_parser.py     # 温度日志解析
│   │   └── waste_parser.py           # 废弃登记解析
│   ├── rules/
│   │   ├── __init__.py
│   │   └── rule_engine.py   # 规则引擎，风险检测
│   └── exporters/
│       ├── __init__.py
│       └── audit_exporter.py # 审计导出模块
├── alembic/
│   ├── __init__.py
│   ├── versions/
│   │   └── __init__.py
│   └── env.py               # Alembic迁移环境
├── examples/
│   ├── prescriptions.csv    # 处方示例数据
│   ├── drug_batches.json    # 药品批号示例数据
│   ├── temperature_logs.csv # 温度日志示例数据
│   └── waste_records.csv    # 废弃登记示例数据
├── alembic.ini              # Alembic配置
├── requirements.txt         # Python依赖
└── README.md
```

## 快速开始

### 环境要求

- Python 3.10+
- pip

### 安装依赖

```bash
pip install -r requirements.txt
```

### 启动服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后，访问以下地址：
- API文档: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 导入示例数据

使用 `/docs` 页面的Swagger UI或curl命令导入示例数据：

```bash
# 导入处方
curl -X POST "http://localhost:8000/api/v1/import/prescriptions" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@examples/prescriptions.csv"

# 导入药品批号
curl -X POST "http://localhost:8000/api/v1/import/drug-batches" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@examples/drug_batches.json"

# 导入温度日志
curl -X POST "http://localhost:8000/api/v1/import/temperature" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@examples/temperature_logs.csv"

# 导入废弃登记
curl -X POST "http://localhost:8000/api/v1/import/waste" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@examples/waste_records.csv"
```

### 执行风险检测

```bash
# 执行风险检测（不保存到数据库）
curl -X POST "http://localhost:8000/api/v1/risk/check"

# 执行风险检测并保存到数据库
curl -X POST "http://localhost:8000/api/v1/risk/check?save_to_db=true"
```

### 导出审计报告

```bash
# 导出Markdown格式审计报告
curl -o audit-report.md "http://localhost:8000/api/v1/export/audit-report"

# 导出JSON格式风险清单
curl "http://localhost:8000/api/v1/export/audit-report?format=json"

# 导出特定批号的追踪报告
curl -o batch-report.md "http://localhost:8000/api/v1/export/batch-tracking?batch_number=BATCH001"
```

## API接口说明

### 导入接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/import/prescriptions` | POST | 导入处方CSV文件 |
| `/api/v1/import/drug-batches` | POST | 导入药品批号JSON文件 |
| `/api/v1/import/temperature` | POST | 导入温度日志(CSV/JSON) |
| `/api/v1/import/waste` | POST | 导入废弃登记(CSV/JSON) |

### 查询接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/prescriptions` | GET | 查询处方列表（支持分页筛选） |
| `/api/v1/drug-batches` | GET | 查询药品批号列表 |
| `/api/v1/temperature-logs` | GET | 查询温度日志 |
| `/api/v1/waste-records` | GET | 查询废弃记录 |

### 风险复核接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/risk/check` | POST | 执行风险检测 |
| `/api/v1/risk/records` | GET | 查询风险记录历史 |

### 审计导出接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/export/audit-report` | GET | 导出审计报告（markdown/json） |
| `/api/v1/export/batch-tracking` | GET | 导出批号追踪报告 |

### 统计信息接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/stats/dashboard` | GET | 获取仪表盘统计数据 |

## 数据格式说明

### 处方CSV格式

```csv
处方编号,患者ID,患者姓名,药品名称,剂量,单位,开具时间,预计调配时间,实际调配时间,状态,批号,药品ID
PRESC001,P001,张三,紫杉醇,180,mg,2025-05-01 08:00:00,2025-05-01 08:30:00,2025-05-01 09:15:00,prepared,BATCH001,DRUG001
```

### 药品批号JSON格式

```json
[
    {
        "batch_number": "BATCH001",
        "drug_name": "紫杉醇",
        "drug_id": "DRUG001",
        "spec": "30mg/瓶",
        "total_amount": 300,
        "unit": "mg",
        "used_amount": 100,
        "remaining_amount": 100,
        "expire_date": "2026-12-31",
        "receive_time": "2025-04-15 09:00:00",
        "storage_location": "冷藏冰箱01-A层",
        "supplier": "某制药有限公司",
        "status": "active"
    }
]
```

### 温度日志CSV格式

```csv
冰箱ID,冰箱名称,温度,最低温度,最高温度,记录时间,状态,异常原因
FRIDGE001,冷藏冰箱01,5.2,4.8,5.5,2025-05-01 08:00:00,normal,
```

### 废弃登记CSV格式

```csv
废弃ID,处方编号,批号,药品名称,废弃数量,单位,废弃原因,废弃时间,操作人,废弃方式,是否闭环,闭环时间,闭环人,备注
WASTE001,PRESC001,BATCH001,紫杉醇,20,mg,调配失误,2025-05-01 09:00:00,护士A,医疗废物处理,1,2025-05-01 09:30:00,护士长,
```

## 数据库迁移

使用Alembic进行数据库迁移：

```bash
# 初始化迁移环境（首次使用）
alembic init alembic

# 创建迁移脚本
alembic revision --autogenerate -m "init"

# 执行迁移
alembic upgrade head

# 回滚迁移
alembic downgrade -1
```

## 配置说明

通过环境变量或 `.env` 文件配置：

```env
DATABASE_URL=sqlite:///./chemotherapy_tracker.db
API_PREFIX=/api/v1
DEBUG=true
```

## 规则配置

规则引擎的关键参数位于 `app/rules/rule_engine.py`：

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `max_gap_minutes` | 60 | 温度断档最大允许间隔（分钟） |
| `close_deadline_hours` | 24 | 废弃记录闭环期限（小时） |
| `allowed_delay_minutes` | 30 | 调配超时允许延迟（分钟） |
| `min_valid_temp` | 2.0 | 最低有效温度（℃） |
| `max_valid_temp` | 8.0 | 最高有效温度（℃） |

## 许可证

本项目仅供内部使用。
