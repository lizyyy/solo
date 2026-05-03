# 农机跨村作业结算复核服务

基于 FastAPI + SQLite 的农机跨村作业结算复核系统，支持 GPS 轨迹分析、面积核算、异常检测和数据导出。

## 功能特性

- **数据导入**：支持农机台账（JSON）、GPS 轨迹（JSONL）、地块合同（CSV）、计费规则（YAML）导入
- **作业时段重建**：根据 GPS 轨迹自动识别和重建作业时段
- **面积核算**：基于轨迹距离和作业宽度计算作业面积
- **夜间补贴**：自动识别夜间作业并计算补贴
- **空驶扣减**：识别空驶路段并进行相应扣减
- **重复报工检测**：检测相邻时段轨迹重叠，预警重复报工风险
- **边界处理**：
  - **跨午夜轨迹**：正确处理跨越午夜的作业轨迹
  - **地块边界缺失**：处理缺少边界数据的地块
- **数据导出**：支持 CSV 和 Markdown 格式导出

## 项目结构

```
.
├── app/
│   ├── routers/
│   │   ├── import_router.py      # 数据导入接口
│   │   ├── settlement_router.py  # 结算查询接口
│   │   ├── anomaly_router.py     # 异常明细接口
│   │   └── export_router.py      # 数据导出接口
│   ├── services/
│   │   ├── import_service.py     # 数据导入服务
│   │   ├── settlement_service.py # 结算计算服务
│   │   └── export_service.py     # 数据导出服务
│   ├── utils/
│   │   └── geo_utils.py          # 地理计算工具
│   ├── database.py               # 数据库配置
│   └── models.py                 # 数据模型
├── samples/
│   ├── machinery_ledger.json     # 农机台账样本
│   ├── gps_trajectory.jsonl      # GPS轨迹样本（含跨午夜数据）
│   ├── plot_contracts.csv        # 地块合同样本（含边界缺失数据）
│   └── pricing_rules.yaml        # 计费规则样本
├── main.py                        # FastAPI 主应用
├── requirements.txt               # Python 依赖
└── README.md
```

## 安装部署

### 环境要求

- Python 3.9+
- pip

### 安装步骤

1. **创建虚拟环境**

```bash
python3 -m venv venv
source venv/bin/activate
```

2. **安装依赖**

```bash
pip install -r requirements.txt
```

3. **启动服务**

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后，访问以下地址：
- API 文档：http://localhost:8000/docs
- ReDoc 文档：http://localhost:8000/redoc
- 健康检查：http://localhost:8000/health

## API 接口

### 数据导入

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/import/machinery` | POST | 导入农机台账（JSON） |
| `/api/v1/import/gps-trajectory` | POST | 导入 GPS 轨迹（JSONL） |
| `/api/v1/import/plot-contract` | POST | 导入地块合同（CSV） |
| `/api/v1/import/pricing-rules` | POST | 导入计费规则（YAML） |

### 结算查询

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/settlement/process` | POST | 执行结算处理（重建时段、计算金额、检测异常） |
| `/api/v1/settlement/summary` | GET | 获取结算汇总统计 |
| `/api/v1/settlement/list` | GET | 获取结算记录列表 |
| `/api/v1/settlement/{id}` | GET | 获取结算记录详情 |
| `/api/v1/settlement/{id}/review` | POST | 审核结算记录 |

### 异常明细

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/anomaly/list` | GET | 获取异常记录列表 |
| `/api/v1/anomaly/{id}` | GET | 获取异常记录详情 |
| `/api/v1/anomaly/{id}/resolve` | POST | 标记异常为已解决 |
| `/api/v1/anomaly/statistics/summary` | GET | 获取异常统计摘要 |

### 数据导出

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/export/settlements/csv` | GET | 导出结算记录为 CSV |
| `/api/v1/export/settlements/markdown` | GET | 导出结算记录为 Markdown |
| `/api/v1/export/anomalies/csv` | GET | 导出异常记录为 CSV |
| `/api/v1/export/anomalies/markdown` | GET | 导出异常记录为 Markdown |

## 边界情况处理

### 1. 跨午夜轨迹

**场景**：农机作业从 23:00 持续到次日 01:30，跨越午夜。

**处理方式**：
- 系统会自动检测日期变更点
- 将跨午夜的作业时段拆分为两个独立时段（按自然日分割）
- 标记 `is_cross_midnight = true`
- 夜间补贴会正确计算两个日期中的夜间时段

**示例数据**（samples/gps_trajectory.jsonl 中的 T002）：
```json
{"machine_id": "T002", "timestamp": "2024-05-20T23:45:00Z", ...}
{"machine_id": "T002", "timestamp": "2024-05-21T00:00:00Z", "cross_midnight": true, ...}
{"machine_id": "T002", "timestamp": "2024-05-21T00:15:00Z", "cross_midnight": true, ...}
```

### 2. 地块边界缺失

**场景**：某些新地块或临时地块没有提供边界 WKT 数据。

**处理方式**：
- 导入时自动检测 `boundary_wkt` 是否为空
- 标记 `boundary_missing = true`
- 轨迹与地块匹配时，优先匹配有边界的地块
- 无边界地块会被分配到第一个可用地块或使用默认地块
- 生成 `boundary_missing` 类型的异常记录，提示面积计算可能不准确

**示例数据**（samples/plot_contracts.csv 中的 P003）：
```csv
P003,西山村新地块,西山村,张大哥,45.0,,2024-05-15T00:00:00,2024-06-15T23:59:59,48.0
```
（注意 boundary_wkt 列为空）

## Curl 演示流程

确保服务已启动（`uvicorn main:app --reload`）。

### 步骤 1：检查服务健康状态

```bash
curl http://localhost:8000/health
```

### 步骤 2：导入农机台账

```bash
curl -X POST "http://localhost:8000/api/v1/import/machinery" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@samples/machinery_ledger.json"
```

**预期响应**：
```json
{
  "success": true,
  "imported_count": 3,
  "errors": [],
  "total": 3
}
```

### 步骤 3：导入地块合同（包含边界缺失的地块 P003）

```bash
curl -X POST "http://localhost:8000/api/v1/import/plot-contract" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@samples/plot_contracts.csv"
```

**预期响应**：
```json
{
  "success": true,
  "imported_count": 5,
  "errors": [],
  "total_rows": 0
}
```

### 步骤 4：导入计费规则

```bash
curl -X POST "http://localhost:8000/api/v1/import/pricing-rules" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@samples/pricing_rules.yaml"
```

**预期响应**：
```json
{
  "success": true,
  "imported_count": 3,
  "errors": [],
  "total_rules": 3
}
```

### 步骤 5：导入 GPS 轨迹（包含跨午夜轨迹 T002）

```bash
curl -X POST "http://localhost:8000/api/v1/import/gps-trajectory" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@samples/gps_trajectory.jsonl"
```

**预期响应**：
```json
{
  "success": true,
  "imported_count": 41,
  "errors": [],
  "total_lines": 41
}
```

### 步骤 6：执行结算处理

这一步会：
1. 重建作业时段
2. 计算作业面积和金额
3. 检测异常（包括跨午夜和边界缺失）

```bash
curl -X POST "http://localhost:8000/api/v1/settlement/process" \
  -H "accept: application/json"
```

**预期响应**：
```json
{
  "success": true,
  "message": "结算处理完成",
  "work_sessions_created": 4,
  "settlements_created": 4,
  "anomalies_detected": 2,
  "errors": []
}
```

**注意**：`anomalies_detected` 应该大于 0，因为样本数据包含：
- T002 的跨午夜轨迹 → `cross_midnight` 异常
- 可能的边界缺失 → `boundary_missing` 异常

### 步骤 7：查看结算汇总

```bash
curl "http://localhost:8000/api/v1/settlement/summary"
```

### 步骤 8：查看结算记录列表

```bash
curl "http://localhost:8000/api/v1/settlement/list?page=1&page_size=10"
```

### 步骤 9：查看异常记录

```bash
curl "http://localhost:8000/api/v1/anomaly/list?resolved=false"
```

**预期**：应该能看到 `cross_midnight`（跨午夜）和 `boundary_missing`（边界缺失）类型的异常。

### 步骤 10：查看异常统计

```bash
curl "http://localhost:8000/api/v1/anomaly/statistics/summary"
```

### 步骤 11：导出结算记录为 CSV

```bash
curl "http://localhost:8000/api/v1/export/settlements/csv" \
  -o settlements.csv
```

### 步骤 12：导出结算记录为 Markdown

```bash
curl "http://localhost:8000/api/v1/export/settlements/markdown" \
  -o settlement_report.md
```

### 步骤 13：导出异常记录为 CSV

```bash
curl "http://localhost:8000/api/v1/export/anomalies/csv" \
  -o anomalies.csv
```

### 步骤 14：审核结算记录

首先获取一个 settlement_id：

```bash
curl "http://localhost:8000/api/v1/settlement/list?page=1&page_size=1"
```

然后使用返回的 settlement_id 进行审核：

```bash
# 替换为实际的 settlement_id
SETTLEMENT_ID="ST_xxxxxx"

curl -X POST "http://localhost:8000/api/v1/settlement/${SETTLEMENT_ID}/review?status=approved&reviewer=管理员&review_notes=数据正常，同意结算"
```

### 步骤 15：标记异常为已解决

首先获取一个 anomaly_id：

```bash
curl "http://localhost:8000/api/v1/anomaly/list?resolved=false&page_size=1"
```

然后标记为已解决：

```bash
# 替换为实际的 anomaly_id
ANOMALY_ID="AN_xxxxxx"

curl -X POST "http://localhost:8000/api/v1/anomaly/${ANOMALY_ID}/resolve?resolution_notes=已确认是夜间作业，属于正常情况"
```

## 数据格式说明

### 农机台账 (JSON)

```json
[
  {
    "machine_id": "T001",
    "machine_type": "tractor",
    "machine_name": "东方红-904",
    "driver_name": "张三",
    "driver_phone": "13800138001",
    "working_width": 2.5
  }
]
```

### GPS 轨迹 (JSONL)

每行一个 JSON 对象：

```json
{"machine_id": "T001", "timestamp": "2024-05-20T08:00:00Z", "latitude": 39.9042, "longitude": 116.4074, "speed": 5.2, "direction": 90, "working_status": "working"}
{"machine_id": "T002", "timestamp": "2024-05-21T00:00:00Z", "latitude": 39.9108, "longitude": 116.4116, "speed": 5.4, "direction": 91, "working_status": "working", "cross_midnight": true}
```

**字段说明**：
- `cross_midnight`：可选，标记该轨迹点属于跨午夜作业
- `working_status`：`working`（作业中）或 `idle`（空闲/空驶）
- `speed`：单位 km/h，用于判断作业/空驶

### 地块合同 (CSV)

```csv
plot_id,plot_name,village,farmer_name,plot_area,boundary_wkt,contract_start_date,contract_end_date,price_per_mu
P001,东河地块1号,东河村,王大爷,50.0,POLYGON((116.4070 39.9040,116.4095 39.9040,116.4095 39.9060,116.4070 39.9060,116.4070 39.9040)),2024-05-01T00:00:00,2024-06-30T23:59:59,50.0
P003,西山村新地块,西山村,张大哥,45.0,,2024-05-15T00:00:00,2024-06-15T23:59:59,48.0
```

**注意**：
- `boundary_wkt` 为空时，系统会标记为 `boundary_missing = true`
- 边界格式为 WKT (Well-Known Text) 格式的 POLYGON

### 计费规则 (YAML)

```yaml
rules:
  - rule_name: "default_rule"
    machine_type: null
    base_price_per_mu: 50.0
    night_surcharge_rate: 0.3
    night_start_hour: 22
    night_end_hour: 6
    empty_driving_deduction_rate: 0.5
    empty_driving_speed_threshold: 15.0
    minimum_working_speed: 2.0
    maximum_working_speed: 12.0
    work_session_gap_minutes: 30
    overlap_detection_distance: 5.0
    is_active: true
```

**参数说明**：

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `base_price_per_mu` | 基础单价（元/亩） | - |
| `night_surcharge_rate` | 夜间补贴费率 | 0.3 (30%) |
| `night_start_hour` | 夜间开始时间（小时） | 22 |
| `night_end_hour` | 夜间结束时间（小时） | 6 |
| `empty_driving_deduction_rate` | 空驶扣减费率 | 0.5 (50%) |
| `empty_driving_speed_threshold` | 空驶速度阈值（km/h） | 15.0 |
| `minimum_working_speed` | 最低作业速度（km/h） | 2.0 |
| `maximum_working_speed` | 最高作业速度（km/h） | 12.0 |
| `work_session_gap_minutes` | 作业时段间隔（分钟） | 30 |
| `overlap_detection_distance` | 重叠检测距离（米） | 5.0 |

**作业速度判定逻辑**：
- 速度在 `[minimum_working_speed, maximum_working_speed]` 范围内 → 作业中
- 速度 > `empty_driving_speed_threshold` → 空驶
- 其他情况 → 待判定

**夜间时间示例**：
- `night_start_hour=22`, `night_end_hour=6`
- 夜间时段：22:00 - 次日 06:00
- 白天时段：06:00 - 22:00

## 异常类型说明

系统会检测以下异常类型：

| 异常类型 | 严重程度 | 说明 |
|----------|----------|------|
| `boundary_missing` | high | 地块边界缺失，面积计算可能不准确 |
| `cross_midnight` | medium | 作业时段跨越午夜，需确认作业日期 |
| `high_empty_driving` | medium | 空驶比例过高（>30%） |
| `duplicate_reporting_risk` | high | 相邻时段轨迹重叠度高，可能存在重复报工 |

## 数据库说明

服务使用 SQLite 数据库，默认存储在 `agricultural_settlement.db` 文件中。

**主要数据表**：

| 表名 | 说明 |
|------|------|
| `machinery` | 农机台账 |
| `gps_trajectory` | GPS 轨迹点 |
| `plot_contract` | 地块合同 |
| `pricing_rule` | 计费规则 |
| `work_session` | 作业时段 |
| `settlement_record` | 结算记录 |
| `anomaly_record` | 异常记录 |

## 注意事项

1. **坐标系统**：系统使用 WGS84 坐标系（GPS 原生坐标），经纬度单位为度。

2. **面积计算**：
   - 面积 = 轨迹距离 × 作业宽度
   - 单位换算：1 平方公里 = 1500 亩
   - 边界缺失时，面积计算可能不准确，系统会生成异常提醒

3. **时间处理**：
   - 建议使用 ISO 8601 格式的时间字符串（带时区）
   - 系统默认使用 Asia/Shanghai 时区判断夜间
   - 跨午夜轨迹会按自然日分割，但会标记 `is_cross_midnight`

4. **性能考虑**：
   - 大量轨迹数据建议分批导入
   - 结算处理可能需要较长时间，建议异步执行

## 开发调试

### 查看 API 文档

启动服务后访问：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 重置数据库

```bash
rm agricultural_settlement.db
```

重启服务后会自动创建新的数据库。

## 许可证

MIT License
