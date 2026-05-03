# 船厂涂装安全管理系统

一个基于 FastAPI 的船厂涂装安全管理系统，用于管理舱室台账、涂装作业票、VOC 传感器数据，自动检测风险异常并生成安全报告。

## 功能特性

- **数据导入**: 支持舱室台账 (CSV)、涂装作业票 (JSONL)、VOC 传感器日志 (CSV)、排风联锁规则 (YAML) 四种数据格式导入
- **风险检测**:
  - VOC 浓度超限检测 (支持 ppm/mg/m³ 单位自动转换)
  - 排风不足检测 (换气次数低于要求)
  - 作业票时间重叠检测 (支持跨午夜作业判断)
  - 传感器数据缺采检测
- **异常管理**: 异常确认、复核、删除
- **报告导出**: 支持 Markdown/CSV/JSON 三种格式报告导出
- **SQLite 持久化**: 本地数据库存储

## 项目结构

```
zy8256/
├── app/
│   ├── __init__.py
│   ├── config.py              # 配置管理
│   ├── database.py            # 数据库模型
│   ├── schemas.py             # Pydantic 数据模型
│   ├── importers.py           # 数据导入模块
│   ├── risk_detection.py      # 风险检测模块
│   ├── report_exporter.py     # 报告导出模块
│   ├── main.py                 # FastAPI 主应用
│   └── routes/
│       ├── __init__.py
│       ├── import_routes.py    # 导入 API 路由
│       ├── risk_routes.py      # 风险检测 API 路由
│       └── report_routes.py    # 报告导出 API 路由
├── sample_data/                # 示例数据
│   ├── cabins.csv              # 舱室台账
│   ├── work_tickets.jsonl      # 涂装作业票
│   ├── sensor_logs.csv         # VOC 传感器日志
│   └── ventilation_rules.yaml  # 排风联锁规则
├── data/                        # 数据目录 (自动创建)
├── reports/                     # 报告目录 (自动创建)
├── pyproject.toml              # 项目配置
└── README.md
```

## 快速开始

### 环境要求

- Python 3.10+
- pip 或 poetry

### 安装依赖

```bash
# 使用 pip
pip install fastapi uvicorn sqlalchemy pydantic pydantic-settings python-multipart pyyaml pandas

# 或使用 poetry
poetry install
```

### 启动服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后访问：
- API 文档: http://localhost:8000/docs
- 健康检查: http://localhost:8000/health

## API 使用示例 (curl)

### 1. 导入数据

#### 导入舱室台账 (CSV)

```bash
curl -X POST "http://localhost:8000/api/import/cabins" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@sample_data/cabins.csv"
```

#### 导入涂装作业票 (JSONL)

```bash
curl -X POST "http://localhost:8000/api/import/work-tickets" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@sample_data/work_tickets.jsonl"
```

#### 导入 VOC 传感器日志 (CSV)

```bash
curl -X POST "http://localhost:8000/api/import/sensor-logs" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@sample_data/sensor_logs.csv"
```

#### 导入排风联锁规则 (YAML)

```bash
curl -X POST "http://localhost:8000/api/import/ventilation-rules" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@sample_data/ventilation_rules.yaml"
```

### 2. 执行风险检测

#### 运行全部风险检测

```bash
curl -X POST "http://localhost:8000/api/risk/check?clear_existing=true" \
  -H "accept: application/json"
```

#### 指定时间范围检测

```bash
curl -X POST "http://localhost:8000/api/risk/check?start_time=2024-05-20T00:00:00&end_time=2024-05-21T23:59:59" \
  -H "accept: application/json"
```

### 3. 查询异常列表

#### 获取所有未确认异常

```bash
curl -X GET "http://localhost:8000/api/risk/anomalies?is_confirmed=false" \
  -H "accept: application/json"
```

#### 按风险类型筛选

```bash
curl -X GET "http://localhost:8000/api/risk/anomalies?anomaly_type=voc_exceed&severity=high" \
  -H "accept: application/json"
```

#### 按舱室筛选

```bash
curl -X GET "http://localhost:8000/api/risk/anomalies?cabin_code=CAB-001" \
  -H "accept: application/json"
```

### 4. 异常确认

#### 确认异常

```bash
curl -X POST "http://localhost:8000/api/risk/anomalies/1/confirm" \
  -H "accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{
    "confirmed": true,
    "confirmed_by": "安全员-张三",
    "notes": "已确认，现场已采取通风措施"
  }'
```

### 5. 报告导出

#### 导出 Markdown 报告

```bash
curl -X GET "http://localhost:8000/api/report/export?format=markdown" \
  -H "accept: application/json"
```

#### 下载 CSV 报告

```bash
curl -X GET "http://localhost:8000/api/report/download?format=csv" \
  -H "accept: text/csv" \
  -o safety_report.csv
```

#### 下载 JSON 报告

```bash
curl -X GET "http://localhost:8000/api/report/download?format=json" \
  -H "accept: application/json" \
  -o safety_report.json
```

#### 保存报告到服务器文件

```bash
curl -X POST "http://localhost:8000/api/report/save?format=markdown" \
  -H "accept: application/json"
```

### 6. 系统管理

#### 健康检查

```bash
curl -X GET "http://localhost:8000/health" \
  -H "accept: application/json"
```

#### 获取系统统计

```bash
curl -X GET "http://localhost:8000/api/stats" \
  -H "accept: application/json"
```

## 风险类型说明

| 风险类型 | 英文代码 | 说明 |
|---------|---------|------|
| VOC 浓度超限 | voc_exceed | VOC 浓度超过设定阈值，支持 ppm 和 mg/m³ 单位自动转换比较 |
| 排风不足 | ventilation_insufficient | 换气次数低于排风联锁规则要求 |
| 作业票时间重叠 | work_ticket_overlap | 同一舱室的作业票时间存在重叠，支持跨午夜作业判断 |
| 传感器数据缺采 | sensor_missing | 传感器数据采集间隔超过阈值 (默认 15 分钟) |

## 配置说明

主要配置项 (可通过环境变量或 .env 文件设置):

```python
VOC_STANDARD_PPM = 500.0              # 默认 VOC 阈值 (ppm)
VOC_STANDARD_MG_M3 = 1500.0           # 默认 VOC 阈值 (mg/m³)
VENTILATION_REQUIRED_CHANGES_PER_HOUR = 30.0  # 默认换气次数要求
SENSOR_SAMPLE_INTERVAL_MINUTES = 5     # 传感器采样间隔
SENSOR_MISS_THRESHOLD_MINUTES = 15     # 缺采判定阈值
```

## 单位转换说明

系统支持 ppm 和 mg/m³ 两种 VOC 浓度单位的自动转换：

- **ppm → mg/m³**: `mg/m³ = (ppm × 摩尔质量 × 压力) / (8.314 × (273.15 + 温度))`
- **mg/m³ → ppm**: `ppm = (mg/m³ × 8.314 × (273.15 + 温度)) / (摩尔质量 × 压力)`

默认参数:
- 摩尔质量: 100 g/mol (典型有机溶剂)
- 压力: 101.325 kPa (标准大气压)
- 温度: 25°C (可从传感器数据获取)

## 跨午夜作业处理

作业票时间支持跨午夜场景:
- 例如: 22:00 开始，次日 06:00 结束
- 系统自动检测此类作业票与其他作业票的时间重叠

## 测试

运行 API 测试:

```bash
pip install pytest pytest-asyncio httpx
pytest tests/ -v
```

## 许可证

MIT License
