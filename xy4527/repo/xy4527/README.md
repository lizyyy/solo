# 盾构施工测量风险分析系统

地铁盾构施工测量员专用后端 API 服务，用于每日数据导入、风险自动判断、人工复核改判和交班单导出。

## 功能特性

- **数据导入**: 支持导入管片排版表、千斤顶行程、同步注浆量、测量点偏差 CSV 文件
- **风险分析**: 自动判断每一环是否存在以下风险：
  - 管片错台
  - 姿态超限（平面偏差、高程偏差、滚动角）
  - 注浆不足
  - 复测缺口
- **数据管理**: SQLite 持久化存储环号、风险结论、人工复核备注
- **REST API**: 提供查询、改判、重算接口
- **导出功能**: 
  - Markdown 格式交班单
  - JSON 格式审计明细

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python main.py
```

服务将在 `http://localhost:8000` 启动。

### 3. 访问 API 文档

启动后访问以下地址查看交互式 API 文档：

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 运行示例数据

项目提供了完整的示例数据和测试脚本，可以一键跑通所有功能。

### 步骤 1: 启动服务

```bash
python main.py
```

### 步骤 2: 运行测试脚本（新开一个终端）

```bash
# 安装 httpx 用于测试
pip install httpx

# 运行测试
python test_import.py
```

测试脚本将执行以下操作：
1. 导入 4 个测试环号（100-103）
2. 查询所有环号列表
3. 查询单个环号详情
4. 人工复核并改判风险等级
5. 导出 Markdown 交班单
6. 导出 JSON 审计明细
7. 获取风险统计摘要

### 生成的文件

运行测试后，会在当前目录生成：
- `handover_output.md` - Markdown 格式交班单
- `audit_output.json` - JSON 格式审计明细

## API 接口说明

### 数据导入

```http
POST /api/rings/import
```

**Form 参数**:
- `ring_number` (integer, required): 环号
- `segment_layout` (file): 管片排版表 CSV
- `jack_stroke` (file): 千斤顶行程 CSV
- `grouting` (file): 同步注浆量 CSV
- `measurement` (file): 测量点偏差 CSV

**示例**:
```bash
curl -X POST "http://localhost:8000/api/rings/import" \
  -F "ring_number=100" \
  -F "segment_layout=@examples/segment_layout_100.csv" \
  -F "jack_stroke=@examples/jack_stroke_100.csv" \
  -F "grouting=@examples/grouting_100_normal.csv" \
  -F "measurement=@examples/measurement_100_normal.csv"
```

### 查询所有环号

```http
GET /api/rings
```

**查询参数**:
- `risk_status`: 按风险状态筛选 (normal/warning/critical)
- `ring_number_from`: 起始环号
- `ring_number_to`: 结束环号

### 查询单个环号详情

```http
GET /api/rings/{ring_number}
```

### 人工复核/改判

```http
PUT /api/rings/{ring_number}/review
```

**Form 参数**:
- `manual_review_note`: 人工复核备注
- `manual_override`: 改判的风险状态 (normal/warning/critical)

### 重新计算风险

```http
POST /api/rings/{ring_number}/reanalyze
```

### 删除环号

```http
DELETE /api/rings/{ring_number}
```

### 导出 Markdown 交班单

```http
GET /api/export/handover
```

**查询参数**:
- `ring_number_from`: 起始环号
- `ring_number_to`: 结束环号
- `shift_date`: 班次日期 (YYYY-MM-DD)
- `shift_name`: 班次名称 (默认: 白班)
- `operator`: 操作员 (默认: 测量员)

### 导出 JSON 审计明细

```http
GET /api/export/audit
```

### 获取风险统计

```http
GET /api/stats/summary
```

## 示例数据说明

`examples/` 目录包含以下示例数据：

| 文件名 | 描述 | 预期风险 |
|--------|------|----------|
| `segment_layout_100.csv` | 正常管片排版 | 正常 |
| `segment_layout_101_risky.csv` | 存在错台的管片排版 | 警告/严重 |
| `jack_stroke_100.csv` | 千斤顶行程数据 | - |
| `grouting_100_normal.csv` | 正常注浆量 (5.2m³) | 正常 |
| `grouting_102_low.csv` | 注浆量不足 (3.2m³) | 严重 |
| `measurement_100_normal.csv` | 正常姿态数据 | 正常 |
| `measurement_103_risky.csv` | 姿态超限+复测缺口 | 严重 |

## CSV 文件格式

### 管片排版表 (segment_layout.csv)

```csv
position,elevation,width,type
A1,0.0,1500,standard
A2,2.0,1500,standard
B1,1.0,1500,standard
K,0.0,1200,key
```

- `position`: 管片位置标识
- `elevation`: 管片高程 (mm)，用于计算错台
- `width`: 管片宽度 (mm)
- `type`: 管片类型 (standard/key)

### 千斤顶行程 (jack_stroke.csv)

```csv
position,stroke
左上,1850
左中,1845
左下,1848
右上,1852
```

- `position`: 千斤顶位置
- `stroke`: 行程值 (mm)

### 同步注浆量 (grouting.csv)

```csv
volume
5.2
```

- `volume`: 注浆量 (m³)

### 测量点偏差 (measurement.csv)

```csv
plane_deviation,elevation_deviation,roll,last_recheck_ring
15.5,8.2,2.5,85
```

- `plane_deviation`: 平面偏差 (mm)
- `elevation_deviation`: 高程偏差 (mm)
- `roll`: 滚动角 (mm/m)
- `last_recheck_ring`: 最近复测环号

## 风险阈值配置

风险阈值在 `risk_analyzer.py` 中配置，可根据实际需求调整：

### 管片错台
- 警告: ≥5.0mm
- 严重: ≥10.0mm

### 姿态超限
- 平面偏差警告: ≥30.0mm，严重: ≥50.0mm
- 高程偏差警告: ≥20.0mm，严重: ≥40.0mm
- 滚动角警告: ≥5.0mm/m，严重: ≥10.0mm/m

### 注浆不足
- 警告: <4.0m³
- 严重: <3.5m³

### 复测缺口
- 警告: 距最近复测环 ≥30 环
- 严重: 距最近复测环 ≥50 环

## 数据存储

所有数据存储在 SQLite 数据库 `shield_measurement.db` 中，包含以下字段：

| 字段 | 说明 |
|------|------|
| ring_number | 环号 (唯一) |
| segment_layout | 管片排版数据 (JSON) |
| jack_stroke | 千斤顶行程数据 (JSON) |
| grouting_volume | 注浆量 |
| measurement_deviation | 测量偏差数据 (JSON) |
| misalignment_risk | 错台风险等级 |
| attitude_risk | 姿态风险等级 |
| grouting_risk | 注浆风险等级 |
| recheck_gap_risk | 复测缺口风险等级 |
| overall_risk | 整体风险等级 |
| manual_review_note | 人工复核备注 |
| manual_override | 人工改判风险等级 |

## 项目结构

```
xy4527/
├── main.py                 # FastAPI 主应用
├── database.py             # 数据库模型和配置
├── risk_analyzer.py        # 风险分析算法
├── data_importer.py        # CSV 数据导入模块
├── exporter.py             # 导出功能 (Markdown/JSON)
├── test_import.py          # 测试脚本
├── requirements.txt        # Python 依赖
├── shield_measurement.db   # SQLite 数据库 (运行后生成)
├── handover_output.md      # 导出的交班单 (测试后生成)
├── audit_output.json       # 导出的审计明细 (测试后生成)
└── examples/               # 示例数据
    ├── segment_layout_100.csv
    ├── segment_layout_101_risky.csv
    ├── jack_stroke_100.csv
    ├── grouting_100_normal.csv
    ├── grouting_102_low.csv
    ├── measurement_100_normal.csv
    └── measurement_103_risky.csv
```

## 常见问题

### Q: 如何修改风险阈值？
A: 编辑 `risk_analyzer.py` 文件中的 `RiskAnalyzer` 类常量。

### Q: 数据库文件可以迁移吗？
A: SQLite 是单文件数据库，直接复制 `shield_measurement.db` 即可迁移。

### Q: 支持中文列名的 CSV 吗？
A: 支持！数据导入模块同时支持中英文列名，例如：
- `elevation` 或 `高程`
- `volume` 或 `注浆量`
- `plane_deviation` 或 `平面偏差`

### Q: 如何重置数据库？
A: 删除 `shield_measurement.db` 文件，重启服务会自动创建新数据库。

## License

MIT License
