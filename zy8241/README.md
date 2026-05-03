# 冷链药品转运复核系统

区域药房冷链药品转运记录复核服务，用于验证冷链药品在转运过程中的温度合规性、交接完整性和路线归属。

## 功能特性

- **数据导入**: 支持车辆温度 JSONL、药品批次 CSV、交接扫描 CSV、温度规则 YAML
- **核心业务逻辑**:
  - 温度超窗持续时间计算
  - 交接断点检测
  - 同一批号重复装车检测
  - 跨午夜路线归属
- **查询接口**: 批次查询、详情查询
- **风险复核**: 综合风险分析
- **报告导出**: cold_chain_report.md 和 issues.csv

## 快速开始

### 环境准备

```bash
pip install -r requirements.txt
```

### 启动服务

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后访问:
- API 文档: http://localhost:8000/docs
- 健康检查: http://localhost:8000/

## API 使用示例 (curl)

### 1. 数据导入

#### 导入温度规则
```bash
curl -X POST "http://localhost:8000/api/import/rules" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@sample_data/temperature_rules.yaml"
```

#### 导入药品批次
```bash
curl -X POST "http://localhost:8000/api/import/batches" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@sample_data/drug_batches.csv"
```

#### 导入交接扫描记录
```bash
curl -X POST "http://localhost:8000/api/import/scans" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@sample_data/handover_scans.csv"
```

#### 导入车辆温度记录
```bash
curl -X POST "http://localhost:8000/api/import/temperatures" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@sample_data/vehicle_temperatures.jsonl"
```

### 2. 批次查询

#### 获取所有批次列表
```bash
curl "http://localhost:8000/api/batches?limit=100"
```

#### 查询特定批次
```bash
curl "http://localhost:8000/api/batches?batch_number=BATCH-2024-001"
```

#### 获取批次详情
```bash
curl "http://localhost:8000/api/batches/BATCH-2024-001"
```

### 3. 风险复核

#### 执行完整风险复核
```bash
curl "http://localhost:8000/api/review/risk"
```

#### 查询跨午夜路线归属
```bash
curl "http://localhost:8000/api/review/routes/midnight"
```

### 4. 报告导出

#### 导出复核报告 (Markdown)
```bash
curl -o cold_chain_report.md "http://localhost:8000/api/export/report"
```

#### 导出问题清单 (CSV)
```bash
curl -o issues.csv "http://localhost:8000/api/export/issues"
```

### 5. 数据管理

#### 清除所有数据
```bash
curl -X DELETE "http://localhost:8000/api/data/clear"
```

## 核心业务逻辑说明

### 1. 温度超窗持续时间计算

- 按时间顺序遍历温度记录
- 连续超温/低温记录合并为一个"超窗段"
- 计算每个超窗段的持续时间（分钟）
- 超窗类型:
  - `above_range`: 温度高于上限
  - `below_range`: 温度低于下限

### 2. 交接断点检测

检测以下异常情况:

| 异常类型 | 说明 |
|---------|------|
| `vehicle_switch_without_unload` | 车辆切换但未卸车 |
| `unload_without_load` | 卸车但无对应装车记录 |
| `unload_from_wrong_vehicle` | 从错误车辆卸车 |
| `missing_unload` | 装车后未执行卸车 |

### 3. 同一批号重复装车检测

检测以下异常情况:

| 异常类型 | 说明 | 严重程度 |
|---------|------|---------|
| `same_vehicle_duplicate_load` | 同一车辆重复装车 | Critical |
| `cross_vehicle_duplicate_load` | 跨车辆重复装车（未卸车） | Critical |

### 4. 跨午夜路线归属

规则:
- 正常路线按日期归属（如 R_V001_20240115）
- 跨午夜但凌晨6点前的数据归属前一天路线
- 凌晨6点及以后的数据归属新一天路线
- 标记 `crossed_midnight: true` 表示该路线跨午夜

## 示例数据说明

示例数据包含以下测试场景:

### 车辆温度数据 (sample_data/vehicle_temperatures.jsonl)

- **V001 车辆**:
  - 08:00-08:25: 正常温度 (5-6°C)
  - 08:30-08:40: **超温** (9.5-10.2°C, 持续10分钟)
  - 23:40 - 次日05:00: **跨午夜**路线数据
  - 07:00: 新一天路线开始

- **V002 车辆**:
  - 09:00-09:15: 正常温度
  - 09:30-10:00: **低温** (1.2-1.8°C, 持续30分钟)

### 交接扫描数据 (sample_data/handover_scans.csv)

包含以下异常:
- **BATCH-2024-003**: 在 V001 装车后，在 V002 装车但 V001 未卸车
- **BATCH-2024-004**: 同一车辆 (V001) 连续两次装车（重复装车）
- **BATCH-2024-005**: 装车后未卸车

## 数据格式说明

### 车辆温度 JSONL 格式

```json
{
  "vehicle_id": "V001",
  "timestamp": "2024-01-15T08:00:00",
  "temperature": 5.2,
  "route_id": "R_20240115_V001"
}
```

### 药品批次 CSV 格式

| 字段 | 说明 |
|-----|------|
| batch_number | 批号 |
| drug_name | 药品名称 |
| production_date | 生产日期 |
| expiry_date | 有效期 |
| min_temp | 最低储存温度 |
| max_temp | 最高储存温度 |

### 交接扫描 CSV 格式

| 字段 | 说明 |
|-----|------|
| scan_time | 扫描时间 |
| batch_number | 批号 |
| vehicle_id | 车辆ID |
| scan_type | 扫描类型: 装车/卸车/load/unload/in/out |
| operator | 操作人员 |
| location | 地点 |

### 温度规则 YAML 格式

```yaml
rules:
  - rule_name: "常规冷链药品"
    drug_category: "常规冷链"
    min_temp: 2.0
    max_temp: 8.0
    allowed_exceed_duration_minutes: 15
```

## 项目结构

```
.
├── main.py                 # FastAPI 主应用
├── models.py               # 数据库模型
├── database.py             # 数据库配置
├── import_service.py       # 数据导入服务
├── business_logic.py       # 核心业务逻辑
├── requirements.txt        # 依赖配置
├── README.md              # 本文件
└── sample_data/           # 示例数据
    ├── vehicle_temperatures.jsonl
    ├── drug_batches.csv
    ├── handover_scans.csv
    └── temperature_rules.yaml
```

## 错误处理

系统对坏数据返回可读错误:

```json
{
  "detail": {
    "error": "数据导入错误",
    "message": "温度格式错误: 'abc', 必须是有效的数字 (行 5) [字段: 温度]"
  }
}
```

导入结果包含成功/失败统计和前10个错误详情。
