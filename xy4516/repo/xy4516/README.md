# 后厨油烟巡检归档员

餐饮连锁后勤用的本地命令行工具，用于管理门店油烟巡检数据，包括清洗记录、传感器读数、照片归档和整改跟踪。

## 功能特性

- **ingest**: 导入多源文件并保留哈希值，确保数据完整性
- **check**: 自动检测风险并生成风险清单
- **review**: 保存人工复核记录，支持复核流程管理
- **export**: 导出 Markdown 巡检包和 JSON 审计明细

## 风险检测类型

| 风险类型 | 说明 | 风险等级 |
|----------|------|----------|
| missing_cleaning | 遗漏清洗记录 | 高 |
| overdue_cleaning | 清洗超期 | 高/中 |
| emission_exceeding | 排放超限 | 高/中 |
| photo_mismatch | 照片归属错误 | 中 |
| rectification_overdue | 整改超期 | 高/中 |
| missing_photos | 缺少照片 | 高/中 |

## 安装

### 环境要求

- Python 3.8+
- pip

### 安装步骤

```bash
# 进入项目目录
cd xy4516

# 安装依赖
pip install -e .
```

安装完成后，可以使用 `kitchen-inspector` 命令运行工具。

## 快速开始

按照以下步骤快速体验工具功能：

### 1. 初始化数据库

```bash
kitchen-inspector init
```

### 2. 导入示例数据

项目提供了示例数据在 `examples/` 目录下：

```bash
kitchen-inspector ingest files \
  -b "2024年Q1" \
  -m "2024-01" \
  -c examples/cleaning_records.csv \
  -s examples/sensor_readings.csv \
  -p examples/photos \
  -r examples/rectification_records.csv
```

### 3. 检查风险

```bash
kitchen-inspector check
```

### 4. 查看待复核风险

```bash
kitchen-inspector review list
```

### 5. 添加复核记录

```bash
# 确认风险属实
kitchen-inspector review add 1 -r "张三" -R confirmed -c "核实情况属实，需立即处理"

# 标记为误报
kitchen-inspector review add 2 -r "李四" -R false_alarm

# 标记为已解决
kitchen-inspector review add 3 -r "王五" -R resolved -c "已完成整改"
```

### 6. 导出报告

```bash
# 首先查看批次ID
kitchen-inspector info

# 导出 Markdown 巡检包
kitchen-inspector export markdown -b 1 -o ./reports/202401

# 导出 JSON 审计明细
kitchen-inspector export json -b 1 -o ./reports/audit_202401.json
```

## 命令详解

### init - 初始化数据库

```bash
kitchen-inspector init
```

创建 SQLite 数据库文件（默认为 `kitchen_inspector.db`）和所有必要的表。

**环境变量**:
- `KITCHEN_INSPECTOR_DB`: 自定义数据库路径

### ingest files - 导入文件

```bash
kitchen-inspector ingest files [OPTIONS]
```

**选项**:
- `--batch, -b` (必需): 巡检批次名称，如 "2024年Q1"
- `--month, -m` (必需): 巡检月份，如 "2024-01"
- `--cleaning, -c`: 清洗记录 CSV 文件路径
- `--sensor, -s`: 传感器读数 CSV 文件路径
- `--photos, -p`: 照片目录路径
- `--rectification, -r`: 整改预约表 CSV 文件路径

**导入文件格式说明**:

#### 清洗记录 CSV 格式
```csv
门店编号,门店名称,清洗日期,清洗公司, technician_name,下次清洗日期
S001,总店,2024-01-15,专业清洗公司A,张三,2024-02-15
```

#### 传感器读数 CSV 格式
```csv
门店编号,门店名称,读数日期,读数时间,PM2.5,PM10,油烟浓度,温度,湿度
S001,总店,2024-01-15,12:00,25.5,45.2,1.2,25.5,65
```

#### 整改预约表 CSV 格式
```csv
门店编号,门店名称,问题描述,预约日期,截止日期,状态,完成日期
S002,朝阳店,油烟浓度超标,2024-01-15,2024-01-25,pending,
```

#### 照片目录命名规则

照片文件或目录名应包含门店编号以便自动识别：

- 文件名格式: `S001_烟道入口_20240115.jpg`
- 目录格式: `photos/S001/烟道入口.jpg`

支持的照片类型关键词（会自动识别）：
- 烟道入口、入口、inlet
- 烟道出口、出口、outlet
- 净化器前、净化器前端
- 净化器后、净化器后端
- 净化器整体
- 清洗中、清洗后

### check - 风险检测

```bash
kitchen-inspector check [OPTIONS]
```

**选项**:
- `--batch, -b`: 指定巡检批次 ID（可选，默认检查所有批次）
- `--list, -l`: 只列出风险不保存到数据库

**检测的阈值配置**（可在代码中调整）:

| 指标 | 阈值 | 说明 |
|------|------|------|
| PM2.5 | 35.0 μg/m³ | 超过即触发告警 |
| PM10 | 70.0 μg/m³ | 超过即触发告警 |
| 油烟浓度 | 2.0 mg/m³ | 超过即触发告警 |
| 清洗周期 | 1个月 | 超过即告警 |

### review - 复核管理

#### review list - 列出待复核风险

```bash
kitchen-inspector review list [OPTIONS]
```

**选项**:
- `--batch, -b`: 指定巡检批次 ID
- `--level, -l`: 按风险等级筛选 (high/medium/low)
- `--store, -s`: 按门店编号筛选

#### review add - 添加复核记录

```bash
kitchen-inspector review add RISK_ID [OPTIONS]
```

**参数**:
- `RISK_ID`: 风险记录 ID

**选项**:
- `--reviewer, -r` (必需): 复核人姓名
- `--result, -R` (必需): 复核结果
  - `confirmed`: 确认属实
  - `false_alarm`: 误报
  - `resolved`: 已解决
- `--comments, -c`: 复核备注

#### review stats - 查看复核统计

```bash
kitchen-inspector review stats [OPTIONS]
```

**选项**:
- `--batch, -b`: 指定巡检批次 ID

### export - 导出数据

#### export markdown - 导出 Markdown 巡检包

```bash
kitchen-inspector export markdown [OPTIONS]
```

**选项**:
- `--batch, -b` (必需): 巡检批次 ID
- `--output, -o` (必需): 输出目录路径

**生成的文件**:
- `巡检报告.md`: 主报告，包含概览统计
- `风险清单.md`: 详细风险列表，按等级分组
- `门店详情.md`: 各门店完整数据
- `复核记录.md`: 复核记录汇总

#### export json - 导出 JSON 审计明细

```bash
kitchen-inspector export json [OPTIONS]
```

**选项**:
- `--batch, -b` (必需): 巡检批次 ID
- `--output, -o` (必需): 输出 JSON 文件路径

**导出的数据结构**:
```json
{
  "export_time": "2024-01-15T10:30:00",
  "batch_info": {...},
  "summary": {...},
  "stores": [...],
  "cleaning_records": [...],
  "sensor_readings": [...],
  "photo_records": [...],
  "rectifications": [...],
  "risks": [...],
  "reviews": [...],
  "file_records": [...]
}
```

### info - 系统信息

```bash
kitchen-inspector info
```

显示数据库路径和已有的巡检批次信息。

## 示例验证流程

以下是完整的验证示例，使用项目提供的示例数据：

### 步骤 1: 安装并初始化

```bash
# 安装
pip install -e .

# 初始化数据库
kitchen-inspector init
```

预期输出:
```
数据库初始化完成: /path/to/kitchen_inspector.db
数据库已初始化: /path/to/kitchen_inspector.db
```

### 步骤 2: 导入示例数据

```bash
kitchen-inspector ingest files \
  -b "2024年Q1" \
  -m "2024-01" \
  -c examples/cleaning_records.csv \
  -s examples/sensor_readings.csv \
  -p examples/photos \
  -r examples/rectification_records.csv
```

预期输出:
```
正在导入清洗记录: examples/cleaning_records.csv
已导入清洗记录文件: cleaning_records.csv
正在导入传感器读数: examples/sensor_readings.csv
已导入传感器读数文件: sensor_readings.csv
正在导入照片目录: examples/photos
正在导入整改预约表: examples/rectification_records.csv
已导入整改预约表文件: rectification_records.csv

==================================================
导入统计:
  - 处理文件数: X
  - 新文件: X
  - 已存在文件: 0
  - 清洗记录: 4 条
  - 传感器读数: 8 条
  - 照片记录: X 条
  - 整改记录: 4 条
==================================================
```

### 步骤 3: 检查风险

```bash
kitchen-inspector check
```

预期输出（示例）:
```
批次 [2024年Q1 - 2024-01] 风险统计:
  🔴 高风险: X
  🟡 中风险: X
  🟢 低风险: 0
    🔴 [1] 门店 S003: 门店 S003 清洗已超期...
    🔴 [2] 门店 S002: 门店 S002 排放超限 - ...
    🔴 [3] 门店 S004: 门店 S004 有清洗记录但未提交烟道照片
    🔴 [4] 门店 S003: 门店 S003 整改已超期...
    ...

==================================================
总风险统计:
  🔴 高风险: X
  🟡 中风险: X
  🟢 低风险: 0
  总计: X
==================================================
```

### 步骤 4: 复核风险

```bash
# 列出待复核风险
kitchen-inspector review list

# 添加复核记录
kitchen-inspector review add 1 -r "张三" -R confirmed -c "核实S003确实超期，已通知门店"
kitchen-inspector review add 2 -r "李四" -R confirmed -c "S002排放超标，需要检查净化器"

# 查看复核统计
kitchen-inspector review stats
```

### 步骤 5: 导出报告

```bash
# 查看批次ID
kitchen-inspector info

# 导出 Markdown 报告
kitchen-inspector export markdown -b 1 -o ./test_report

# 导出 JSON 明细
kitchen-inspector export json -b 1 -o ./test_audit.json

# 查看生成的文件
ls -la ./test_report/
```

预期输出:
```
Markdown 巡检包已导出到: /path/to/test_report
  包含文件:
    - 巡检报告.md
    - 风险清单.md
    - 门店详情.md
    - 复核记录.md

JSON 审计明细已导出到: /path/to/test_audit.json
```

## 数据库结构

工具使用 SQLite 数据库，包含以下核心表:

| 表名 | 说明 |
|------|------|
| stores | 门店信息 |
| inspection_batches | 巡检批次 |
| file_records | 文件记录（含哈希） |
| cleaning_records | 清洗记录 |
| sensor_readings | 传感器读数 |
| photo_records | 照片记录 |
| rectifications | 整改记录 |
| risks | 风险记录 |
| reviews | 复核记录 |

## 数据完整性保障

工具通过以下方式保障数据完整性:

1. **文件哈希记录**: 所有导入的文件都会计算 SHA256 哈希并存储
2. **重复检测**: 相同哈希的文件不会重复导入
3. **审计追踪**: 所有操作都有时间戳记录
4. **关联关系**: 数据记录与源文件关联，可追溯

## 项目结构

```
xy4516/
├── kitchen_exhaust_inspector/
│   ├── __init__.py
│   ├── cli.py              # 命令行入口
│   ├── db.py               # 数据库连接和初始化
│   ├── models.py           # 数据模型类
│   ├── ingest.py           # 文件导入模块
│   ├── check.py            # 风险检测模块
│   ├── review.py           # 复核管理模块
│   └── export.py           # 数据导出模块
├── examples/               # 示例数据
│   ├── cleaning_records.csv
│   ├── sensor_readings.csv
│   ├── rectification_records.csv
│   └── photos/
├── pyproject.toml          # 项目配置
└── README.md               # 本文档
```

## 常见问题

### Q: 如何修改检测阈值？

A: 编辑 `kitchen_exhaust_inspector/check.py` 文件中的 `EMISSION_THRESHOLDS` 字典。

### Q: 数据库文件在哪里？

A: 默认在当前目录下的 `kitchen_inspector.db`。可通过设置 `KITCHEN_INSPECTOR_DB` 环境变量自定义路径。

### Q: 照片文件如何识别门店？

A: 工具通过文件名或目录名中的门店编号自动识别。支持的格式如:
- `S001_xxx.jpg`
- `001_xxx.jpg`
- 目录名 `S001/`

### Q: 可以导入多个批次吗？

A: 可以。使用不同的 `--batch` 和 `--month` 参数即可区分不同批次。

## 许可证

本项目仅供内部使用。
