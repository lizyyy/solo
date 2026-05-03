# 实验动物中心管理系统

基于 FastAPI 的实验动物中心管理系统，用于管理实验动物、笼位、扫码记录和异常检测。

## 功能特性

- **数据导入**: 支持导入 animals.csv、cage_scans.jsonl、health_checks.csv 和 rules.yaml
- **换笼状态机**: 自动复原换笼状态，跟踪动物在笼位间的移动
- **异常检测**:
  - 同笼容量超限检测
  - 隔离期动物混笼检测
  - 死亡动物扫码检测
  - 转出动物扫码检测
  - 重复扫码检测
- **数据查询**: 动物查询、笼位查询、异常查询、扫码记录查询
- **异常复核**: 支持单个和批量异常复核
- **报告导出**: 支持 Markdown 和 CSV 格式导出

## 快速开始

### 环境准备

```bash
# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # macOS/Linux
# 或
venv\Scripts\activate  # Windows

# 安装依赖
pip install -r requirements.txt
```

### 启动服务

```bash
# 方式1: 使用 uvicorn
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 方式2: 直接运行
python -m app.main
```

服务启动后访问:
- API 文档: http://localhost:8000/docs
- OpenAPI 规范: http://localhost:8000/openapi.json

## API 使用示例 (curl)

### 1. 健康检查

```bash
curl http://localhost:8000/health
```

### 2. 数据导入

#### 导入动物数据

```bash
curl -X POST "http://localhost:8000/import/animals" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@sample_data/animals.csv;type=text/csv"
```

#### 导入健康检查数据

```bash
curl -X POST "http://localhost:8000/import/health-checks" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@sample_data/health_checks.csv;type=text/csv"
```

#### 导入规则配置

```bash
curl -X POST "http://localhost:8000/import/rules" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@sample_data/rules.yaml;type=application/x-yaml"
```

#### 导入扫码记录 (触发状态机和异常检测)

```bash
curl -X POST "http://localhost:8000/import/cage-scans" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@sample_data/cage_scans.jsonl;type=application/jsonl"
```

### 3. 数据查询

#### 查询所有动物

```bash
curl "http://localhost:8000/query/animals"
```

#### 查询特定动物详情

```bash
curl "http://localhost:8000/query/animals/A001"
```

#### 按状态查询动物

```bash
curl "http://localhost:8000/query/animals?status=active"
```

#### 查询所有笼位

```bash
curl "http://localhost:8000/query/cages"
```

#### 查询特定笼位详情

```bash
curl "http://localhost:8000/query/cages/C001"
```

#### 查询扫码记录

```bash
curl "http://localhost:8000/query/scans?limit=10"
```

### 4. 异常查询与复核

#### 查询所有异常

```bash
curl "http://localhost:8000/anomalies/"
```

#### 查询待处理异常

```bash
curl "http://localhost:8000/anomalies/pending"
```

#### 查询异常统计

```bash
curl "http://localhost:8000/anomalies/stats"
```

#### 复核单个异常

```bash
# 标记为已复核
curl -X PUT "http://localhost:8000/anomalies/1/review" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "reviewed",
    "review_notes": "已核实，确认为操作失误",
    "reviewed_by": "管理员"
  }'

# 标记为已解决
curl -X PUT "http://localhost:8000/anomalies/1/review" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "resolved",
    "review_notes": "已纠正，动物已移至正确笼位",
    "reviewed_by": "管理员"
  }'

# 标记为忽略
curl -X PUT "http://localhost:8000/anomalies/1/review" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "dismissed",
    "review_notes": "误报，设备测试扫码",
    "reviewed_by": "管理员"
  }'
```

#### 批量复核异常

```bash
curl -X PUT "http://localhost:8000/anomalies/batch-review" \
  -H "Content-Type: application/json" \
  -d '{
    "anomaly_ids": [1, 2, 3],
    "review_data": {
      "status": "reviewed",
      "review_notes": "批量复核",
      "reviewed_by": "管理员"
    }
  }'
```

### 5. 报告导出

#### 导出异常报告 (Markdown)

```bash
# 导出待处理和已复核的异常
curl -o anomaly_report.md "http://localhost:8000/export/anomalies/markdown"

# 导出所有异常（包含已解决和已忽略）
curl -o full_anomaly_report.md "http://localhost:8000/export/anomalies/markdown?include_resolved=true"
```

#### 导出异常报告 (CSV)

```bash
curl -o anomaly_report.csv "http://localhost:8000/export/anomalies/csv"
```

#### 导出笼位状态报告

```bash
curl -o cage_status_report.md "http://localhost:8000/export/cage-status/markdown"
```

#### 查看导出摘要

```bash
curl "http://localhost:8000/export/summary"
```

## 异常类型说明

| 异常类型 | 说明 |
|----------|------|
| `cage_capacity_exceeded` | 笼位容量超限 |
| `quarantine_animal_mixed` | 隔离期动物混笼 |
| `deceased_animal_scanned` | 死亡动物被扫码 |
| `transferred_animal_scanned` | 转出动物被扫码 |
| `duplicate_scan` | 重复扫码 |

## 数据文件格式

### animals.csv

```csv
animal_id,tag_id,species,strain,sex,date_of_birth,status,quarantine_end_date,notes
A001,TAG001,Mouse,C57BL/6,M,2023-01-15,active,,正常健康小鼠
```

状态值: `active`, `deceased`, `transferred`, `in_quarantine`

### cage_scans.jsonl

每行一个 JSON 对象:

```json
{"scan_id": "SCAN001", "tag_id": "TAG001", "cage_id": "C001", "scan_timestamp": "2024-01-15 08:00:00", "scan_type": "check", "operator": "Zhang", "notes": "备注"}
```

### health_checks.csv

```csv
check_id,animal_id,check_date,weight,temperature,heart_rate,respiratory_rate,condition,veterinarian,notes
HC001,A001,2024-01-10 09:00:00,22.5,37.2,420,180,good,Dr.Wang,体重稳定
```

### rules.yaml

```yaml
rules:
  - rule_name: "cage_capacity_check"
    rule_type: "capacity"
    description: "检查笼位容量是否超限"
    is_active: true
    priority: 1
```

## 运行测试

```bash
pytest tests/ -v
```

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI 主入口
│   ├── config.py            # 配置管理
│   ├── database.py          # 数据库连接
│   ├── models.py            # SQLAlchemy 模型
│   ├── schemas.py           # Pydantic 模型
│   ├── state_machine.py     # 换笼状态机核心逻辑
│   ├── import_service.py    # 数据导入服务
│   └── routers/
│       ├── __init__.py
│       ├── import_router.py   # 导入接口
│       ├── query_router.py    # 查询接口
│       ├── anomaly_router.py  # 异常复核接口
│       └── export_router.py   # 报告导出接口
├── sample_data/
│   ├── animals.csv
│   ├── cage_scans.jsonl
│   ├── health_checks.csv
│   └── rules.yaml
├── tests/
│   └── test_api.py
├── requirements.txt
└── README.md
```
