# CTV Monitor - Clinical Trial Visit Window Monitor

一个用于监测临床试验访视窗口合规性的 CLI 工具。

## 功能特性

- **读取多种数据源**: `subjects.csv`、`visits.csv`、`protocol_windows.yaml`、`amendments.json`
- **精确窗口计算**: 基于受试者入组日和适用方案版本计算每次访视的允许窗口
- **全面偏差检测**:
  - 漏访 (Missed Visits) - 显式标记或超过窗口未记录
  - 提前访视 (Early Visits) - 在允许窗口开始之前
  - 超窗访视 (Late Visits) - 在允许窗口结束之后
  - 重复录入 (Duplicate Visits) - 同一受试者同一访视同一天多条记录
  - 修订跨越 (Amendment Crossing) - 访视窗口跨越方案修订生效日
  - 同日多访 (Same Day Multiple Visits) - 同一天不同访视类型
- **多格式输出**:
  - `deviations.csv` - 所有偏差列表（支持按中心分组）
  - `report.md` - Markdown 格式汇总报告
  - `timeline_*.html` - 每个受试者的交互式时间线可视化
- **边界情况处理**:
  - 跨时区日期（所有日期自动转换为 UTC 进行比较）
  - 同一天多次访视（区分重复录入和正常多访视）

## 安装

```bash
# 使用 pip 安装（开发模式）
pip install -e .

# 安装开发依赖（用于测试）
pip install -e ".[dev]"
```

## 快速开始

### 1. 使用内置 Sample 数据

```bash
# 生成 sample 数据文件
ctv-monitor samples --output-dir ./my_data

# 验证数据文件
ctv-monitor validate --data-dir ./my_data

# 运行完整分析
ctv-monitor run --data-dir ./my_data --output-dir ./my_output
```

### 2. 使用示例命令

```bash
# 基础运行
ctv-monitor run -d ./data -o ./output

# 指定参考日期（用于漏访判断）
ctv-monitor run -d ./data -o ./output -r 2026-03-01

# 指定默认时区
ctv-monitor run -d ./data -o ./output -t "America/New_York"

# 详细日志模式
ctv-monitor run -d ./data -o ./output -v

# 不生成分中心 CSV
ctv-monitor run -d ./data -o ./output --no-by-site
```

## 输入文件格式

### subjects.csv

受试者信息表。

| 字段 | 必填 | 说明 |
|------|------|------|
| subject_id | 是 | 受试者唯一标识 |
| site_id | 是 | 中心编号 |
| enrollment_date | 是 | 入组日期 (YYYY-MM-DD) |
| enrollment_timezone | 否 | 入组日期时区，默认 UTC |
| protocol_version | 否 | 入组时方案版本，默认 1.0 |

**示例:**
```csv
subject_id,site_id,enrollment_date,enrollment_timezone,protocol_version
S001,Site-A,2026-01-15,America/New_York,1.0
S002,Site-A,2026-01-20,America/New_York,1.0
S003,Site-B,2026-01-25,Europe/London,2.0
```

### visits.csv

访视记录表。

| 字段 | 必填 | 说明 |
|------|------|------|
| subject_id | 是 | 受试者 ID |
| visit_name | 是 | 访视名称 (如 "Day 1", "Screening") |
| visit_date | 是 | 访视日期 |
| visit_timezone | 否 | 访视日期时区，默认 UTC |
| is_missed | 否 | 是否标记为漏访 (true/false)，默认 false |

**示例:**
```csv
subject_id,visit_name,visit_date,visit_timezone,is_missed
S001,Screening,2026-01-15,America/New_York,false
S001,Day 1,2026-01-15,America/New_York,false
S001,Day 7,2026-01-20,America/New_York,false
```

### protocol_windows.yaml

方案访视窗口定义，支持多版本。

```yaml
versions:
  - version: "1.0"
    windows:
      - visit_name: "Screening"
        target_days: 0           # 距入组的目标天数
        window_early_days: 7      # 允许提前天数
        window_late_days: 0       # 允许延后天数
        is_mandatory: true        # 是否为强制访视

      - visit_name: "Day 1"
        target_days: 0
        window_early_days: 0
        window_late_days: 0
        is_mandatory: true

      - visit_name: "Day 7"
        target_days: 7
        window_early_days: 1
        window_late_days: 1
        is_mandatory: true
```

**窗口计算说明:**
- 目标日期 = 入组日期 + target_days
- 允许开始日期 = 目标日期 - window_early_days
- 允许结束日期 = 目标日期 + window_late_days

### amendments.json (可选)

方案修订信息，用于确定受试者适用的方案版本。

```json
{
  "amendments": [
    {
      "amendment_id": "AM-001",
      "protocol_version": "2.0",
      "effective_date": "2026-01-23",
      "effective_timezone": "UTC",
      "description": "Extended visit windows",
      "visit_changes": [
        {"visit_name": "Day 7", "change": "Window extended from ±1 to ±2 days"}
      ]
    }
  ]
}
```

**版本确定规则:**
- 受试者入组日期 >= 修订生效日期 → 使用新版本
- 否则保持入组时的版本

## 输出文件说明

### deviations.csv / deviations_{site_id}.csv

所有检测到的偏差列表。

| 列名 | 说明 |
|------|------|
| deviation_id | 偏差唯一标识 |
| subject_id | 受试者 ID |
| site_id | 中心 ID |
| deviation_type | 偏差类型 |
| visit_name | 访视名称 |
| actual_date | 实际日期 |
| expected_start | 期望开始日期 |
| expected_end | 期望结束日期 |
| days_off_target | 距目标天数 |
| protocol_version | 适用方案版本 |
| amendment_id | 关联修订 ID |
| severity | 严重程度 (high/medium/low) |
| description | 详细描述 |

### report.md

Markdown 格式汇总报告，包含：
- 总体统计（受试者数、偏差数、按严重程度分布）
- 按偏差类型统计
- 按中心统计
- 详细偏差列表

### timeline_{subject_id}.html

每个受试者的交互式时间线 HTML 文件，展示：
- 受试者基本信息（ID、中心、入组日、方案版本）
- 每次访视的时间线（允许窗口用颜色标识）
- 实际访视日期
- 状态徽章（On Time / Early / Late / Missed / Duplicate）
- 检测到的偏差表格
- 图例说明

## 偏差类型说明

| 类型 | 严重程度 | 触发条件 |
|------|----------|----------|
| missed_visit | high | 1. is_missed=true；2. 强制访视未记录且超过窗口 |
| early_visit | medium | 访视日期 < 允许开始日期 |
| late_visit | medium | 访视日期 > 允许结束日期 |
| duplicate_visit | high | 同一受试者、同一访视名称、同一天多条记录 |
| amendment_crossing | high | 访视窗口跨越修订生效日 |
| same_day_multiple_visits | low | 同一天有不同名称的访视 |

## 时区处理

工具自动处理跨时区日期：

1. 所有日期在读取时根据记录的时区解析
2. 转换为 UTC 进行统一比较
3. 输出时保留原始日期信息

**支持的时区格式:**
- IANA 时区: `America/New_York`, `Europe/London`, `Asia/Tokyo`, `UTC`
- 缩写: `EST`, `PST`, `GMT` (不推荐，可能有歧义)

## 测试

```bash
# 运行所有测试
pytest

# 运行测试并显示覆盖率
pytest --cov=ctv_monitor

# 运行特定测试文件
pytest tests/test_engine.py -v
```

## 示例场景

Sample 数据包含以下测试场景：

| 受试者 | 场景 |
|--------|------|
| S001 | Day 7 提前 2 天，Day 14 超窗 6 天，Day 28 超窗 |
| S002 | Day 7 重复录入 2 条，Day 14 与 Day 7 同一天（S002 的 Day 7 是 1月27日，Day 14 是 2月3日，不是同一天 - 这里需要调整） |
| S003 | 使用 v2.0 方案（宽窗口），所有访视按时 |
| S004 | Day 1 显式标记为漏访 |
| S005 | 所有访视按时（无偏差） |

## 命令参考

```
ctv-monitor --help

Commands:
  run       Run full analysis and generate outputs
  validate  Validate input data files
  samples   Create sample data files
```

## 许可证

MIT License
