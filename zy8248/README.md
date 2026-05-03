# Pool Review - 泳池水质投药复盘工具

一个用于公共泳池运营主管闭馆后复盘当天水质投药的Python CLI工具。

## 功能特性

- **数据读取**: 支持读取泳池配置、传感器数据、投药日志和规则配置
- **输入验证**: 验证所有输入数据的完整性和格式正确性
- **规则检查**:
  - 余氯衰减分析
  - pH/ORP超窗检测
  - 客流后补测缺失检查
  - 投药冷却窗口冲突检测
  - 传感器断采检测
- **异常分级**: 将问题分为严重(CRITICAL)、警告(WARNING)、信息(INFO)三个级别
- **报告导出**: 生成 `issues.csv` 和 `pool_water_review.md` 两份报告
- **边界情况处理**:
  - 传感器断采检测
  - 跨午夜闭馆记录归属

## 项目结构

```
pool_review/
├── __init__.py
├── version.py
├── cli.py                    # CLI入口
├── models.py                 # 数据模型定义
├── parsers/                  # 数据解析模块
│   ├── __init__.py
│   ├── base.py              # 解析器基类
│   ├── pools_parser.py      # 泳池配置解析
│   ├── sensor_parser.py     # 传感器数据解析
│   ├── dosing_parser.py     # 投药日志解析
│   └── rules_parser.py      # 规则配置解析
├── rules/                    # 规则计算模块
│   ├── __init__.py
│   ├── base.py              # 规则基类
│   ├── decay_calculator.py  # 余氯衰减计算
│   ├── window_checker.py    # 超窗检测
│   ├── visitor_checker.py   # 客流后补测检查
│   ├── dosing_conflict.py   # 投药冲突检测
│   ├── sensor_gap.py        # 传感器断采检测
│   └── review_engine.py     # 复盘引擎
└── exporters/                # 报告导出模块
    ├── __init__.py
    ├── csv_exporter.py      # CSV导出
    └── md_exporter.py       # Markdown导出

sample/                       # 示例数据
├── pools.csv
├── sensor_minutes.csv
├── dosing_log.jsonl
└── rules.yaml
```

## 安装

```bash
# 克隆项目后，安装依赖
pip install -r requirements.txt

# 或安装为可执行命令
pip install -e .
```

## 输入数据格式

### 1. pools.csv - 泳池配置

| 字段名 | 类型 | 说明 |
|--------|------|------|
| pool_id | string | 泳池唯一标识 |
| pool_name | string | 泳池名称 |
| volume_cubic_meters | float | 池容(立方米) |
| target_free_chlorine_min/max | float | 余氯目标范围 |
| target_ph_min/max | float | pH目标范围 |
| target_orp_min/max | float | ORP目标范围(mV) |
| daily_open_time | time | 每日开门时间 |
| daily_close_time | time | 每日关门时间 |

**跨午夜处理**: 如果 `daily_close_time < daily_open_time`，则视为运营时间跨午夜。

### 2. sensor_minutes.csv - 传感器分钟数据

| 字段名 | 类型 | 说明 |
|--------|------|------|
| pool_id | string | 泳池标识 |
| timestamp | datetime | 记录时间 |
| free_chlorine | float | 余氯浓度(mg/L) |
| ph | float | pH值 |
| orp | float | ORP值(mV) |

**数据断采**: 连续记录时间间隔超过规则阈值即标记为断采。

### 3. dosing_log.jsonl - 投药日志

每行一个JSON对象：

```json
{
  "pool_id": "pool_001",
  "timestamp": "2024-05-20T07:30:00+08:00",
  "chemical_type": "chlorine",
  "amount_kg": 2.5,
  "operator": "张三",
  "notes": "早班常规投药"
}
```

**化学品类型**:
- `chlorine` - 氯制剂
- `ph_minus` - 降pH剂
- `ph_plus` - 升pH剂
- `flocculant` - 絮凝剂
- `algaecide` - 除藻剂

### 4. rules.yaml - 规则配置

```yaml
chlorine_decay:
  max_decay_rate_per_hour: 0.3      # 最大正常衰减率 mg/L/hour
  critical_decay_threshold: 0.5       # 临界衰减阈值
  decay_window_minutes: 60            # 分析窗口(分钟)

out_of_window:
  ph_min: 7.2
  ph_max: 7.6
  orp_min: 650
  orp_max: 850
  out_of_window_duration_minutes: 15   # 超窗警告阈值
  critical_outage_duration_minutes: 30 # 超窗严重阈值

post_visitor_check:
  check_delay_minutes: 30              # 客流后延迟检查
  check_window_minutes: 60             # 检查窗口时长
  required_readings: 3                  # 需要的读数数量

dosing_cooling:
  cooling_minutes: 30                   # 冷却窗口时长
  forbidden_chemicals:                  # 冷却期禁忌化学品
    - chlorine
    - ph_minus

sensor_monitoring:
  max_gap_minutes: 5                    # 最大允许间隔
  critical_gap_minutes: 30              # 临界断采时间
```

## 使用方法

### 基本命令

```bash
# 查看帮助
pool-review --help

# 执行复盘分析 (使用当前目录的数据文件)
pool-review review

# 验证输入数据
pool-review validate
```

### 完整示例

```bash
# 切换到示例数据目录
cd sample

# 1. 先验证数据
pool-review validate

# 2. 执行复盘，指定日期
pool-review review --date 2024-05-20

# 3. 指定数据文件路径
pool-review review \
  --pools ./pools.csv \
  --sensor ./sensor_minutes.csv \
  --dosing ./dosing_log.jsonl \
  --rules ./rules.yaml \
  --date 2024-05-20 \
  --output-dir ./output

# 4. 仅显示结果，不导出文件
pool-review review --no-export

# 5. 详细模式
pool-review review --verbose
```

### 输出文件

执行 `pool-review review` 后会在输出目录生成：

1. **issues.csv** - 问题列表
   - 按严重程度排序的所有问题
   - 包含问题类型、位置、时间、描述

2. **pool_water_review.md** - 完整复盘报告
   - 概览统计
   - 问题详情(按严重程度分组)
   - 各泳池详情

## Demo 运行指南

使用示例数据快速体验：

```bash
# 1. 进入项目目录
cd /path/to/pool-review

# 2. 安装依赖
pip install -e .

# 3. 进入示例数据目录
cd sample

# 4. 验证数据
pool-review validate

# 5. 执行复盘
pool-review review --date 2024-05-20

# 6. 查看生成的报告
# - issues.csv
# - pool_water_review.md
```

## 边界情况测试

示例数据包含以下边界场景：

### 1. 传感器断采
- `pool_001` 在 06:05-08:00 之间有数据断采
- 这会触发 `SENSOR_GAP` 问题

### 2. 跨午夜闭馆
- `pool_004` (夜间池) 运营时间为 22:00-06:00 (跨午夜)
- 复盘日期为 2024-05-20 时，会正确包含 2024-05-21 00:00-06:00 的数据

### 3. 余氯衰减异常
- `pool_001` 在 08:00-08:08 期间余氯快速下降
- 衰减率超过临界阈值，会标记为 CRITICAL

### 4. pH/ORP超窗
- `pool_001` 在 09:00-09:30 期间 pH=6.8 (低于7.2)，ORP=580-640 (低于650)
- 持续超过30分钟，标记为 CRITICAL

### 5. ORP高值超窗
- `pool_001` 在 14:00-14:20 期间 ORP=860-880 (高于850)

### 6. 投药冷却窗口冲突
- `pool_001` 在 07:30 投加 chlorine
- 07:45 (冷却期内) 再次投加 chlorine
- 这会触发 `DOSING_CONFLICT` 警告

## 命令参考

### pool-review review

执行复盘分析。

**参数**:
- `--pools, -p`: 泳池配置文件路径 (默认: pools.csv)
- `--sensor, -s`: 传感器数据文件路径 (默认: sensor_minutes.csv)
- `--dosing, -d`: 投药日志文件路径 (默认: dosing_log.jsonl)
- `--rules, -r`: 规则配置文件路径 (默认: rules.yaml)
- `--date`: 复盘日期 (格式: YYYY-MM-DD, 默认: 今天)
- `--output-dir, -o`: 输出目录 (默认: 当前目录)
- `--no-export`: 不导出文件，仅控制台输出
- `--verbose, -v`: 详细日志模式

**返回值**:
- `0`: 正常完成，无严重问题
- `1`: 执行错误
- `2`: 完成但存在严重问题

### pool-review validate

验证输入数据格式和完整性。

**参数**:
- `--pools, -p`: 泳池配置文件
- `--sensor, -s`: 传感器数据文件
- `--dosing, -d`: 投药日志文件
- `--rules, -r`: 规则配置文件

## 问题类型说明

| 问题类型 | 说明 | 严重级别触发条件 |
|----------|------|------------------|
| `chlorine_decay` | 余氯衰减异常 | >0.3mg/L/hour=WARNING, >0.5=CRITICAL |
| `ph_out_of_window` | pH超窗 | >15分钟=WARNING, >30分钟=CRITICAL |
| `orp_out_of_window` | ORP超窗 | >15分钟=WARNING, >30分钟=CRITICAL |
| `post_visitor_missing` | 客流后补测缺失 | 0个读数=CRITICAL, 不足=WARNING |
| `dosing_conflict` | 投药冷却窗口冲突 | 冷却期内投加禁忌化学品=WARNING |
| `sensor_gap` | 传感器断采 | >5分钟=WARNING, >30分钟=CRITICAL |

## 开发

```bash
# 安装开发依赖
pip install pytest

# 运行测试
pytest tests/

# 代码检查
flake8 pool_review/
```

## 版本历史

- v1.0.0: 初始版本
  - 支持所有核心功能
  - 包含示例数据和完整文档
