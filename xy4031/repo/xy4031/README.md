# 电池包放行管家 - Battery Release Manager

一个为小型无人机测绘队设计的电池包生命周期管理后端API服务。

## 功能特性

- 📋 **电池包管理**: 新增、查询、更新、删除电池包信息
- 📊 **数据导入**: 支持导入充电器CSV、飞控日志CSV、单体电压读数CSV
- 🔍 **智能归并**: 自动按电池编号和时间归并记录，识别重复导入
- 🚨 **规则引擎**: 自动检测多种风险情况：
  - 低压告警后未复检
  - 存放超过指定天数
  - 循环次数跳变
  - 单体压差过大
  - 电池已封存
- 🛡️ **隔离区机制**: 坏行不会静默丢弃，进入隔离区可查询原因
- ✅ **放行检查**: 批量检查电池是否可放行，返回详细结论和证据
- 📄 **报告导出**: 支持按电池导出Markdown/CSV格式追溯报告
- ⚙️ **配置管理**: 规则阈值可配置，支持运行时调整

## 技术栈

- **后端框架**: FastAPI (Python)
- **数据库**: SQLite (本地文件存储)
- **ORM**: SQLAlchemy
- **数据验证**: Pydantic
- **API文档**: OpenAPI (自动生成)

## 安装

### 环境要求

- Python 3.9+
- pip (Python包管理器)

### 安装步骤

1. 安装依赖：

```bash
pip install -r requirements.txt
```

## 启动服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后，访问以下地址：

- **API文档 (Swagger UI)**: http://localhost:8000/docs
- **API文档 (ReDoc)**: http://localhost:8000/redoc
- **OpenAPI JSON**: http://localhost:8000/openapi.json
- **健康检查**: http://localhost:8000/health

## 快速开始 - 使用示例数据验证主流程

### 步骤1: 新增电池包

首先添加几块测试电池：

```bash
# 添加电池 BAT001
curl -X POST "http://localhost:8000/batteries/" \
  -H "Content-Type: application/json" \
  -d '{
    "battery_id": "BAT001",
    "name": "测绘队1号电池",
    "initial_cycles": 0,
    "cell_count": 6,
    "capacity_mah": 16000,
    "status": "active"
  }'

# 添加电池 BAT002
curl -X POST "http://localhost:8000/batteries/" \
  -H "Content-Type: application/json" \
  -d '{
    "battery_id": "BAT002",
    "name": "测绘队2号电池",
    "initial_cycles": 0,
    "cell_count": 6,
    "capacity_mah": 16000,
    "status": "active"
  }'

# 添加电池 BAT003
curl -X POST "http://localhost:8000/batteries/" \
  -H "Content-Type: application/json" \
  -d '{
    "battery_id": "BAT003",
    "name": "测绘队3号电池",
    "initial_cycles": 0,
    "cell_count": 6,
    "capacity_mah": 16000,
    "status": "active"
  }'

# 添加电池 BAT004 (这个电池有低压告警记录)
curl -X POST "http://localhost:8000/batteries/" \
  -H "Content-Type: application/json" \
  -d '{
    "battery_id": "BAT004",
    "name": "测绘队4号电池(待复检)",
    "initial_cycles": 0,
    "cell_count": 6,
    "capacity_mah": 16000,
    "status": "active"
  }'
```

### 步骤2: 导入充电记录CSV

```bash
curl -X POST "http://localhost:8000/import/charger" \
  -F "file=@examples/charger_records.csv" \
  -F "source_file_name=charger_records_20240115.csv"
```

### 步骤3: 导入飞控日志CSV

```bash
curl -X POST "http://localhost:8000/import/flight" \
  -F "file=@examples/flight_logs.csv" \
  -F "source_file_name=flight_logs_20240116.csv"
```

### 步骤4: 导入单体电压读数CSV

```bash
curl -X POST "http://localhost:8000/import/voltage" \
  -F "file=@examples/cell_voltage_readings.csv" \
  -F "source_file_name=voltage_readings_20240116.csv"
```

### 步骤5: 测试隔离区功能 (导入包含坏行的CSV)

```bash
curl -X POST "http://localhost:8000/import/charger" \
  -F "file=@examples/test_bad_rows.csv" \
  -F "source_file_name=test_bad_rows.csv"
```

然后查询隔离区：

```bash
# 查询所有隔离记录
curl "http://localhost:8000/quarantine/"

# 查询隔离记录数量
curl "http://localhost:8000/quarantine/count"
```

### 步骤6: 执行放行检查

假设明天（2024-01-17）有测绘任务，检查这4块电池是否可以放行：

```bash
curl -X POST "http://localhost:8000/release-check/" \
  -H "Content-Type: application/json" \
  -d '{
    "mission_date": "2024-01-17T08:00:00",
    "min_temperature": 5.0,
    "expected_flights": 3,
    "battery_ids": ["BAT001", "BAT002", "BAT003", "BAT004"]
  }'
```

**预期结果**:
- **BAT001**: 可放行 - 记录正常，无告警
- **BAT002**: 需复检 - 单体压差略大 (BAT002的电芯6电压为3.80V，其他为3.84-3.85V)
- **BAT003**: 可放行 - 记录正常
- **BAT004**: 禁止使用 - 低压告警后未复检，且单体电压过低

### 步骤7: 查询电池历史记录

```bash
# 查询 BAT001 的完整历史
curl "http://localhost:8000/history/BAT001"

# 只查询飞行记录
curl "http://localhost:8000/history/BAT001?record_type=flight"
```

### 步骤8: 导出追溯报告

```bash
# 导出 Markdown 格式报告
curl -O "http://localhost:8000/export/BAT001/markdown"

# 导出 CSV 格式报告
curl -O "http://localhost:8000/export/BAT001/csv"
```

### 步骤9: 添加维修/备注记录

```bash
# 为 BAT004 添加备注，说明低压告警情况
curl -X POST "http://localhost:8000/maintenance" \
  -H "Content-Type: application/json" \
  -d '{
    "battery_id": "BAT004",
    "note_date": "2024-01-16T18:00:00",
    "note_type": "incident",
    "title": "飞行中低压告警",
    "content": "2024-01-15 应急任务中，电池电压骤降至19.5V触发低压告警，已紧急降落。电池疑似某电芯故障，待进一步检测。",
    "author": "张工",
    "is_sealed": false
  }'
```

### 步骤10: 查看和修改系统配置

```bash
# 查看所有配置
curl "http://localhost:8000/config/"

# 查看特定配置
curl "http://localhost:8000/config/max_storage_days"

# 修改存放超时天数为15天
curl -X PUT "http://localhost:8000/config/max_storage_days?config_value=15"

# 修改最大允许单体压差为0.03V
curl -X PUT "http://localhost:8000/config/max_cell_voltage_diff?config_value=0.03"
```

## 运行测试

### 运行所有测试

```bash
pytest -v
```

### 运行特定测试文件

```bash
# 运行核心功能测试
pytest tests/test_core.py -v

# 运行API测试
pytest tests/test_api.py -v
```

### 运行健康检查

```bash
curl "http://localhost:8000/health"
```

## API 接口概览

### 电池包管理 (`/batteries`)

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /batteries/ | 新增电池包 |
| GET | /batteries/ | 列出所有电池包 |
| GET | /batteries/{battery_id} | 获取单个电池包信息 |
| PUT | /batteries/{battery_id} | 更新电池包信息 |
| DELETE | /batteries/{battery_id} | 删除电池包 |

### 数据导入 (`/import`)

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /import/charger | 导入充电器CSV |
| POST | /import/flight | 导入飞控日志CSV |
| POST | /import/voltage | 导入单体电压CSV |

### 放行检查 (`/release-check`)

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /release-check/ | 批量检查电池放行状态 |
| GET | /release-check/single/{battery_id} | 检查单个电池放行状态 |

### 隔离区管理 (`/quarantine`)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /quarantine/ | 列出隔离区记录 |
| GET | /quarantine/count | 统计隔离区记录数 |
| GET | /quarantine/{record_id} | 获取单个隔离记录详情 |
| POST | /quarantine/{record_id}/resolve | 标记隔离记录为已解决 |

### 历史查询与报告导出

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /history/{battery_id} | 查询电池历史记录 |
| GET | /export/{battery_id}/markdown | 导出Markdown格式报告 |
| GET | /export/{battery_id}/csv | 导出CSV格式报告 |
| POST | /maintenance | 新增维修/备注记录 |

### 系统配置 (`/config`)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /config/ | 列出所有配置项 |
| GET | /config/{config_key} | 获取单个配置项 |
| POST | /config/ | 新增配置项 |
| PUT | /config/{config_key} | 更新配置项 |
| DELETE | /config/{config_key} | 删除配置项 |

## 配置项说明

系统预置以下配置项：

| 配置键 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| max_storage_days | int | 30 | 电池存放最大天数，超过需复检 |
| max_cell_voltage_diff | float | 0.05 | 最大允许单体电压差(V) |
| low_voltage_threshold | float | 3.2 | 低压告警阈值(V) |
| max_cycle_jump | int | 5 | 最大允许循环次数跳变值 |
| min_temperature_threshold | float | -10.0 | 最低推荐环境温度(°C) |
| max_recommended_cycles | int | 200 | 最大推荐循环次数 |

## 放行规则说明

### 规则优先级

1. **Critical (禁止使用)**:
   - 电池已封存
   - 低压告警后未复检

2. **Warning (需复检)**:
   - 存放超时
   - 单体压差过大
   - 温度过低
   - 循环次数过高

3. **Info (信息提示)**:
   - 常规状态提示

### 低压告警复检规则

如果一块电池在飞行中发生低压告警，系统要求：
1. 告警后必须有新的充电记录
2. 充电结束电压必须达到 3.8V/电芯 以上
3. 充电时间必须晚于告警时间

否则该电池会被标记为"禁止使用"。

## 项目结构

```
xy4031/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI入口
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py           # 配置管理
│   │   └── database.py         # 数据库连接
│   ├── models/
│   │   ├── __init__.py
│   │   └── models.py           # SQLAlchemy数据模型
│   ├── schemas/
│   │   ├── __init__.py
│   │   └── schemas.py          # Pydantic数据模型
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── batteries.py        # 电池包管理路由
│   │   ├── imports.py          # 数据导入路由
│   │   ├── release_check.py    # 放行检查路由
│   │   ├── quarantine.py       # 隔离区路由
│   │   ├── history.py          # 历史查询与报告路由
│   │   └── config.py           # 配置管理路由
│   └── services/
│       ├── __init__.py
│       ├── csv_parser.py       # CSV解析器
│       ├── record_merger.py    # 记录归并与隔离区服务
│       ├── rules_engine.py     # 放行规则引擎
│       └── report_exporter.py  # 报告导出服务
├── tests/
│   ├── __init__.py
│   ├── test_core.py            # 核心功能测试
│   └── test_api.py             # API接口测试
├── examples/
│   ├── __init__.py
│   ├── charger_records.csv         # 充电记录示例
│   ├── flight_logs.csv              # 飞控日志示例
│   ├── cell_voltage_readings.csv    # 单体电压示例
│   └── test_bad_rows.csv            # 坏行测试示例
├── data/                           # SQLite数据库文件目录
├── requirements.txt
└── README.md
```

## 注意事项

1. **数据库位置**: SQLite数据库文件默认存储在 `data/battery_manager.db`
2. **编码支持**: CSV导入支持 UTF-8 和 GBK 编码
3. **幂等性**: 同一文件重复导入会自动识别重复记录，不会重复插入
4. **电池编号**: 电池编号不区分大小写，系统会自动转换为大写
5. **时间格式**: 支持多种时间格式解析，包括 `YYYY-MM-DD HH:MM:SS`、`YYYY/MM/DD` 等

## 许可证

MIT License
