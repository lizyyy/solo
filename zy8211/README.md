# 污泥脱水药剂投加复核系统

基于 FastAPI 的污水厂运行班组污泥脱水药剂投加复核服务。

## 功能特性

- **数据导入**：支持脱水机运行记录 CSV、药剂批次 JSONL、实验室含水率 CSV、复核规则 YAML
- **重复导入幂等**：基于文件哈希和记录ID防止重复导入
- **智能批次匹配**：根据时间自动匹配运行记录与药剂批次
- **跨班次批次处理**：正确处理跨越多个班次的药剂批次
- **异常检测**：自动检测投加量不匹配、进泥量异常、含水率超标等问题
- **复核流程**：支持异常标记、复核、批量处理
- **报告导出**：支持 Markdown 和 CSV 格式报告

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── main.py              # 主应用入口
│   ├── models.py            # 数据库模型
│   ├── schemas.py           # Pydantic 数据模型
│   ├── utils.py             # 工具函数（导入、校验、异常检测）
│   └── routers/
│       ├── __init__.py
│       ├── import_router.py   # 导入接口
│       ├── query_router.py    # 查询接口
│       ├── review_router.py   # 复核接口
│       └── report_router.py   # 报告导出接口
├── samples/
│   ├── dehydrator_runs.csv    # 脱水机运行记录样本
│   ├── chemical_batches.jsonl # 药剂批次样本
│   ├── lab_moisture.csv       # 实验室含水率样本
│   └── review_rules.yaml      # 复核规则样本
├── requirements.txt
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后访问：
- 主页: http://localhost:8000/
- API 文档: http://localhost:8000/docs
- OpenAPI 规范: http://localhost:8000/openapi.json

## API 接口说明

### 导入接口 (Import)

| 接口 | 方法 | 描述 |
|------|------|------|
| `/import/dehydrator-runs` | POST | 导入脱水机运行记录 CSV |
| `/import/chemical-batches` | POST | 导入药剂批次 JSONL |
| `/import/lab-moisture` | POST | 导入实验室含水率 CSV |
| `/import/review-rules` | POST | 导入复核规则 YAML |

### 查询接口 (Query)

| 接口 | 方法 | 描述 |
|------|------|------|
| `/query/dehydrator-runs` | GET | 查询运行记录列表 |
| `/query/dehydrator-runs/{run_id}` | GET | 获取单条运行记录 |
| `/query/chemical-batches` | GET | 查询药剂批次列表 |
| `/query/chemical-batches/{batch_id}` | GET | 获取单条药剂批次 |
| `/query/lab-moisture` | GET | 查询实验室检测结果 |
| `/query/exceptions` | GET | 查询异常记录 |
| `/query/review-rules` | GET | 查询复核规则 |

### 复核接口 (Review)

| 接口 | 方法 | 描述 |
|------|------|------|
| `/review/exceptions/{review_id}/resolve` | PUT | 处理单个异常 |
| `/review/exceptions/batch-resolve` | POST | 批量处理异常 |
| `/review/exceptions/stats` | GET | 异常统计 |
| `/review/daily-summary` | GET | 每日汇总 |

### 报告接口 (Report)

| 接口 | 方法 | 描述 |
|------|------|------|
| `/report/markdown` | GET | 导出 Markdown 格式报告 |
| `/report/csv` | GET | 导出 CSV 格式报告 |
| `/report/exceptions/csv` | GET | 导出异常记录 CSV |

## 使用示例

### 1. 导入样本数据

```bash
# 导入复核规则
curl -X POST "http://localhost:8000/import/review-rules" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@samples/review_rules.yaml"

# 导入药剂批次
curl -X POST "http://localhost:8000/import/chemical-batches" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@samples/chemical_batches.jsonl"

# 导入脱水机运行记录
curl -X POST "http://localhost:8000/import/dehydrator-runs" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@samples/dehydrator_runs.csv"

# 导入实验室含水率
curl -X POST "http://localhost:8000/import/lab-moisture" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@samples/lab_moisture.csv"
```

### 2. 查询数据

```bash
# 查询所有运行记录
curl "http://localhost:8000/query/dehydrator-runs"

# 查询有异常的运行记录
curl "http://localhost:8000/query/dehydrator-runs?has_exception=true"

# 查询未处理的异常
curl "http://localhost:8000/query/exceptions?is_resolved=false"

# 查询异常统计
curl "http://localhost:8000/review/exceptions/stats"
```

### 3. 复核异常

```bash
# 处理单个异常（将 review_id 替换为实际的异常ID）
curl -X PUT "http://localhost:8000/review/exceptions/review_DH-20260503-005_moisture_xxx/resolve" \
  -H "Content-Type: application/json" \
  -d '{"resolution_note":"已核实，属于正常波动范围","resolved_by":"张工"}'
```

### 4. 导出报告

```bash
# 导出 Markdown 报告
curl "http://localhost:8000/report/markdown?start_date=2026-05-03&end_date=2026-05-04" \
  -o report.md

# 导出 CSV 报告
curl "http://localhost:8000/report/csv?start_date=2026-05-03&end_date=2026-05-04" \
  -o report.csv

# 导出异常记录
curl "http://localhost:8000/report/exceptions/csv?is_resolved=false" \
  -o exceptions.csv
```

## 数据格式说明

### 脱水机运行记录 (CSV)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| run_id | string | 是 | 运行记录唯一ID |
| machine_id | string | 是 | 脱水机编号 |
| start_time | datetime | 是 | 开始时间 |
| end_time | datetime | 否 | 结束时间 |
| feed_sludge_volume | float | 是 | 进泥量 (m³) |
| feed_sludge_concentration | float | 否 | 进泥浓度 (%) |
| dry_solids_input | float | 否 | 绝干泥量 (t) |
| batch_id | string | 否 | 关联药剂批次ID |

### 药剂批次 (JSONL)

每行一个 JSON 对象：

```json
{
  "batch_id": "PAM-20260503-01",
  "chemical_type": "PAM",
  "concentration": 0.1,
  "dosage_rate_target": 3.5,
  "dosage_rate_min": 3.0,
  "dosage_rate_max": 4.0,
  "start_time": "2026-05-03 08:00:00",
  "end_time": "2026-05-03 16:00:00",
  "total_chemical_used": 45.0,
  "supplier": "A化工"
}
```

### 实验室含水率 (CSV)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| result_id | string | 是 | 检测结果ID |
| sample_time | datetime | 是 | 取样时间 |
| moisture_content | float | 是 | 含水率 (%) |
| cake_solids | float | 否 | 泥饼含固率 (%) |
| run_id | string | 否 | 关联运行记录ID |
| batch_id | string | 否 | 关联药剂批次ID |
| tested_by | string | 否 | 检测人 |
| tested_at | datetime | 否 | 检测时间 |

### 复核规则 (YAML)

```yaml
rules:
  - rule_id: moisture_threshold
    name: 含水率阈值检查
    type: moisture_threshold
    threshold: 80.0
    priority: 1
    enabled: true
  
  - rule_id: dosage_rate
    name: 投加率偏差检查
    type: dosage_rate
    threshold: 10.0
    priority: 2
    enabled: true
```

## 异常类型说明

| 异常类型 | 说明 | 触发条件 |
|----------|------|----------|
| dosage_mismatch | 投加量不匹配 | 实际投加率超出目标范围 |
| feed_sludge_mismatch | 进泥量异常 | 进泥量超出设定范围 |
| moisture_exceed | 含水率超标 | 含水率超过阈值 |
| cross_shift_batch | 跨班次批次 | 药剂批次跨越多个班次 |
| missing_batch | 缺失批次 | 运行记录未关联药剂批次 |

## 班次定义

系统采用三班制：

- **早班 (morning)**: 08:00 - 16:00
- **中班 (afternoon)**: 16:00 - 24:00
- **夜班 (night)**: 00:00 - 08:00 (归属前一天)

跨班次处理：
- 药剂批次跨越多个班次时，会触发 `cross_shift_batch` 异常
- 系统会根据时间自动匹配运行记录与药剂批次

## 幂等性保证

系统通过以下机制保证重复导入安全：

1. **文件哈希检查**：每次导入时计算文件哈希，相同文件不会重复导入
2. **记录ID检查**：相同 `run_id`/`batch_id`/`result_id` 的记录会被跳过
3. **规则更新**：规则导入时采用更新模式，相同 `rule_id` 会更新而非重复插入

## 运行测试

```bash
python -m pytest tests/ -v
```

或使用 API 文档页面的 "Try it out" 功能进行测试。

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| DATABASE_URL | sqlite:///./sludge_dehydration.db | 数据库连接字符串 |

## 注意事项

1. 首次运行会自动创建 SQLite 数据库文件
2. 建议在生产环境使用 PostgreSQL 或 MySQL
3. 日期时间格式支持多种格式，推荐使用 ISO 格式
4. 样本数据中的日期为 2026-05-03 至 2026-05-04，查询时注意日期范围
