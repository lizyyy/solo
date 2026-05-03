# 水产养殖投喂增氧复盘CLI工具

用于分析池塘投喂、溶氧数据，检测养殖风险并生成复盘报告。

## 功能特性

- **数据输入**: 支持 ponds.csv、feed_events.jsonl、oxygen_readings.csv、rules.yaml
- **时间线重建**: 按池塘重建投喂、溶氧和增氧机状态时间线
- **风险检测**:
  - 🔴 低氧仍投喂 - 溶氧低于阈值时进行投喂
  - 🔴 增氧漏开 - 低氧期间增氧机未开启
  - 🟡 重复投喂 - 两次投喂间隔过短
  - 🟡 传感器断采 - 溶氧读数间隔过大
  - 🟡 过度投喂 - 单日投喂次数超限
- **数据处理**: 支持跨午夜采样、缺失读数插值
- **报告输出**: 生成 issues.csv 和 pond_report.md

## 安装依赖

```bash
pip install -r requirements.txt
```

## 快速开始

### 使用示例数据运行

```bash
python aqua_audit.py \
    --ponds sample/ponds.csv \
    --feed sample/feed_events.jsonl \
    --oxygen sample/oxygen_readings.csv \
    --rules rules.yaml
```

### 指定输出文件路径

```bash
python aqua_audit.py \
    --ponds sample/ponds.csv \
    --feed sample/feed_events.jsonl \
    --oxygen sample/oxygen_readings.csv \
    --rules rules.yaml \
    --output-issues ./output/issues.csv \
    --output-report ./output/pond_report.md
```

### 指定分析日期

```bash
python aqua_audit.py \
    --ponds sample/ponds.csv \
    --feed sample/feed_events.jsonl \
    --oxygen sample/oxygen_readings.csv \
    --rules rules.yaml \
    --analysis-date "2026-05-03"
```

## 输入文件格式

### 1. ponds.csv - 池塘信息

| 字段名 | 类型 | 说明 |
|--------|------|------|
| pond_id | string | 池塘唯一标识 |
| pond_name | string | 池塘名称 |
| area_sqm | float | 面积(平方米) |
| aerator_count | int | 增氧机数量 |
| stock_density | int | 养殖密度(尾/亩) |
| species | string | 养殖品种 |

示例:
```csv
pond_id,pond_name,area_sqm,aerator_count,stock_density,species
P001,东塘1号,5000,4,1500,南美白对虾
P002,东塘2号,4500,3,1200,南美白对虾
```

### 2. feed_events.jsonl - 投喂事件

每行一个JSON对象，包含字段:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| pond_id | string | 池塘ID |
| timestamp | string | 投喂时间(ISO格式) |
| feed_type | string | 饲料类型 |
| amount_kg | float | 投喂量(kg) |
| operator | string | 操作人员 |

示例:
```json
{"pond_id": "P001", "timestamp": "2026-05-02T06:00:00", "feed_type": "颗粒料", "amount_kg": 45.0, "operator": "张师傅"}
{"pond_id": "P001", "timestamp": "2026-05-02T10:00:00", "feed_type": "颗粒料", "amount_kg": 45.0, "operator": "张师傅"}
```

### 3. oxygen_readings.csv - 溶氧读数

| 字段名 | 类型 | 说明 |
|--------|------|------|
| pond_id | string | 池塘ID |
| timestamp | string | 读数时间(ISO格式) |
| oxygen_mg_l | float | 溶氧值(mg/L) |
| temperature_c | float | 水温(℃) |
| aerator_status | int | 增氧机状态(1=开启, 0=关闭) |

示例:
```csv
pond_id,timestamp,oxygen_mg_l,temperature_c,aerator_status
P001,2026-05-02T00:00:00,6.2,24.5,1
P001,2026-05-02T00:30:00,6.0,24.3,1
P001,2026-05-02T01:00:00,5.8,24.2,1
```

### 4. rules.yaml - 检测规则配置

```yaml
oxygen_thresholds:
  critical: 3.0      # 临界低氧阈值
  warning: 4.0       # 警告低氧阈值
  normal: 6.0        # 正常溶氧阈值

aerator_rules:
  auto_on_below: 3.5           # 低于此值应开启增氧机
  minimum_runtime_minutes: 30   # 最小运行时间
  grace_period_minutes: 15      # 宽限期(分钟)

feeding_rules:
  minimum_oxygen_required: 4.0      # 投喂最小溶氧要求
  minimum_interval_minutes: 120     # 最小投喂间隔(分钟)
  maximum_feeds_per_day: 3          # 每日最大投喂次数
  feed_time_window:                  # 建议投喂时间窗口
    - "06:00"
    - "10:00"
    - "16:00"
    - "20:00"

sensor_rules:
  expected_interval_minutes: 30     # 预期读数间隔(分钟)
  max_gap_minutes: 90               # 最大允许间隔(分钟)
  max_missing_readings: 3            # 最大缺失读数数量

analysis_window:
  hours_before: 24    # 分析时间窗口(小时)
```

## 输出文件说明

### issues.csv - 问题列表

包含所有检测到的风险问题，字段:

| 字段名 | 说明 |
|--------|------|
| pond_id | 池塘ID |
| issue_type | 问题类型 |
| severity | 严重程度(high/medium/low) |
| description | 问题描述 |
| timestamp | 发生时间 |
| details_json | 详细信息(JSON格式) |

### pond_report.md - 池塘详细报告

Markdown格式报告，包含:

1. **摘要** - 分析概况、问题统计
2. **池塘详情** - 每个池塘的:
   - 基本信息
   - 溶氧统计
   - 投喂时间线
   - 发现的问题及详情
3. **风险类型说明** - 各类风险的定义和阈值

## 命令行参数

| 参数 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| --ponds | 是 | - | 池塘信息CSV文件路径 |
| --feed | 是 | - | 投喂事件JSONL文件路径 |
| --oxygen | 是 | - | 溶氧读数CSV文件路径 |
| --rules | 是 | - | 规则配置YAML文件路径 |
| --output-issues | 否 | issues.csv | 问题输出CSV路径 |
| --output-report | 否 | pond_report.md | 报告输出Markdown路径 |
| --analysis-date | 否 | 最新数据日期 | 分析日期 |

## 示例数据中的风险场景

sample/ 目录下的数据包含以下测试场景:

1. **P001 东塘1号**:
   - 🔴 低氧投喂: 6:00投喂时溶氧仅3.9mg/L(低于4.0阈值)
   - 🔴 增氧漏开: 凌晨2:30-4:30溶氧持续走低但增氧机关闭
   - 🔴 增氧漏开: 晚上19:00-21:30低氧期间增氧机未及时开启
   - 🟡 重复投喂: 10:00和10:15两次投喂间隔仅15分钟
   - 🟡 过度投喂: 单日投喂5次(超过3次限制)
   - 🟡 传感器断采: 7:00-9:30之间缺失读数

2. **P002 东塘2号**:
   - 🔴 增氧漏开: 凌晨持续低氧但增氧机一直关闭
   - 🔴 增氧漏开: 晚上低氧期间增氧机未开启
   - 🔴 低氧投喂: 23:45投喂时溶氧极低

3. **P003 西塘1号**:
   - ✅ 无风险问题

4. **P004 西塘2号**:
   - ✅ 无风险问题

## 项目结构

```
.
├── aqua_audit.py          # 主程序
├── requirements.txt       # Python依赖
├── rules.yaml             # 默认规则配置
├── README.md             # 本文档
├── sample/               # 示例数据
│   ├── ponds.csv
│   ├── feed_events.jsonl
│   └── oxygen_readings.csv
├── issues.csv            # 运行后生成的问题列表
└── pond_report.md        # 运行后生成的详细报告
```

## 常见问题

### Q: 如何处理跨午夜的数据？
A: 程序自动处理跨午夜的时间序列，时间线会按实际时间顺序排列。

### Q: 缺失的溶氧读数如何处理？
A: 程序会检测超过阈值的读数间隔，标记为"传感器断采"问题。分析时会对缺失数据进行线性插值以确保时间线连续。

### Q: 如何自定义检测规则？
A: 复制 rules.yaml 文件并修改其中的阈值参数，然后通过 --rules 参数指定自定义规则文件。

## 许可证

MIT License
