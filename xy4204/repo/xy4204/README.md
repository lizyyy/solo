# 实验室值班预约检查工具

一个用于检查实验室仪器预约和故障记录的命令行工具，自动检测时间冲突、超时占用、故障期误预约和人员连续值守过长等问题。

## 功能特性

- **时间冲突检测**：检查同一仪器是否存在重复预约
- **超时占用检查**：检查单次预约是否超过最大允许时长
- **故障期误预约检测**：检查是否在仪器故障期间仍有预约
- **连续值守过长检查**：检查同一人员是否连续工作超过规定时长
- **可用时段分析**：自动计算并导出可调整的候选时段
- **多格式输出**：支持 Markdown 风险报告和 CSV 数据导出

## 环境要求

- Python 3.7+
- 无需额外依赖（仅使用标准库）

## 快速开始

### 1. 验证安装

```bash
# 查看帮助信息
python run.py --help

# 查看版本
python run.py --version
```

### 2. 使用示例数据测试

```bash
# 测试正常数据（无风险）
python run.py check --bookings examples/normal_bookings.json

# 测试包含问题的数据
python run.py check --bookings examples/problematic_bookings.json --faults examples/faults.json
```

### 3. 生成完整报告

```bash
# 生成Markdown报告并导出可用时段
python run.py check \
    --bookings examples/problematic_bookings.json \
    --faults examples/faults.json \
    --report output/risk_report.md \
    --slots output/available_slots.csv \
    --issues output/issues.csv
```

## 命令说明

### 主命令

| 命令 | 说明 |
|------|------|
| `check` | 执行完整检查，生成风险报告 |
| `validate` | 仅验证数据格式，不执行业务检查 |
| `slots` | 仅导出可用时段为CSV |
| `report` | 仅生成Markdown报告 |

### check 命令参数

| 参数 | 简写 | 说明 | 默认值 |
|------|------|------|--------|
| `--bookings` | `-b` | 预约数据JSON文件路径（必填） | - |
| `--faults` | `-f` | 故障记录JSON文件路径 | 空 |
| `--report` | `-r` | 输出Markdown报告路径 | - |
| `--slots` | `-s` | 输出可用时段CSV路径 | - |
| `--issues` | `-i` | 输出风险问题CSV路径 | - |
| `--quiet` | `-q` | 静默模式，不输出到控制台 | 关闭 |
| `--max-booking-hours` | - | 单次预约最大时长（小时） | 4.0 |
| `--max-consecutive-hours` | - | 连续值守最大时长（小时） | 8.0 |
| `--work-start` | - | 工作开始时间（HH:MM） | 08:00 |
| `--work-end` | - | 工作结束时间（HH:MM） | 22:00 |

## 数据格式说明

### 预约数据格式 (bookings.json)

```json
{
  "bookings": [
    {
      "id": "B001",
      "instrument_id": "INST001",
      "instrument_name": "高效液相色谱仪",
      "user_id": "U001",
      "user_name": "张三",
      "start_time": "2026-05-04 09:00:00",
      "end_time": "2026-05-04 12:00:00",
      "purpose": "样品分析",
      "notes": "药物代谢动力学研究"
    }
  ]
}
```

**字段说明**：

| 字段 | 必填 | 说明 |
|------|------|------|
| `id` | 否 | 预约ID，不提供则自动生成 |
| `instrument_id` | 是 | 仪器编号 |
| `instrument_name` | 否 | 仪器名称，默认使用instrument_id |
| `user_id` | 是 | 用户编号 |
| `user_name` | 否 | 用户姓名，默认使用user_id |
| `start_time` | 是 | 开始时间，支持多种格式 |
| `end_time` | 是 | 结束时间，支持多种格式 |
| `purpose` | 否 | 预约用途 |
| `notes` | 否 | 备注 |

**时间格式支持**：
- `YYYY-MM-DD HH:MM:SS`
- `YYYY-MM-DD HH:MM`
- `YYYY-MM-DDTHH:MM:SS` (ISO格式)
- `YYYY-MM-DDTHH:MM` (ISO格式)

### 故障记录格式 (faults.json)

```json
{
  "faults": [
    {
      "id": "F001",
      "instrument_id": "INST006",
      "instrument_name": "溶出度仪",
      "start_time": "2026-05-04 08:00:00",
      "end_time": "2026-05-04 18:00:00",
      "description": "搅拌桨故障，需要维修",
      "reported_by": "王五",
      "severity": "高"
    }
  ]
}
```

**字段说明**：

| 字段 | 必填 | 说明 |
|------|------|------|
| `id` | 否 | 故障ID，不提供则自动生成 |
| `instrument_id` | 是 | 仪器编号 |
| `instrument_name` | 否 | 仪器名称 |
| `start_time` | 是 | 故障开始时间 |
| `end_time` | 是 | 故障预计结束时间 |
| `description` | 是 | 故障描述 |
| `reported_by` | 否 | 报告人 |
| `severity` | 否 | 严重程度，默认"中" |

## 使用示例

### 示例1：基本检查

```bash
python run.py check --bookings bookings.json --faults faults.json
```

输出示例：
```
============================================================
实验室值班预约检查结果
============================================================

预约记录: 8 条
故障记录: 2 条
风险问题: 4 个
  - 高风险: 2
  - 中风险: 2
  - 低风险: 0
可用时段: 12 个

------------------------------------------------------------
风险问题详情:
------------------------------------------------------------

🔴 [高风险] 时间冲突
   仪器 [高效液相色谱仪] 在 2026-05-04 11:00 - 12:00 存在时间冲突...

🟡 [中风险] 超时占用
   预约 [PB003] 由 王五 使用仪器 [气相色谱仪] 超时 2小时0分钟...

============================================================
🚨 存在高风险问题，请优先处理！
============================================================
```

### 示例2：自定义参数检查

```bash
# 使用更长的预约时长限制和工作时间
python run.py check \
    --bookings bookings.json \
    --max-booking-hours 6 \
    --max-consecutive-hours 10 \
    --work-start 07:30 \
    --work-end 23:00
```

### 示例3：验证数据格式

```bash
python run.py validate --bookings bookings.json --faults faults.json
```

输出：
```
✅ 数据格式验证通过！
   预约记录: 8 条
   故障记录: 2 条
```

### 示例4：仅导出可用时段

```bash
python run.py slots \
    --bookings bookings.json \
    --faults faults.json \
    --output available_slots.csv \
    --min-hours 0.5
```

## 输出文件格式

### Markdown 报告结构

1. **概览**：统计摘要和整体状态
2. **风险问题详情**：按类型分类的详细问题列表
3. **可用时段**：按日期整理的可预约时段
4. **预约详情**：完整的预约记录列表
5. **故障记录**：故障信息汇总

### CSV 可用时段格式

| 列名 | 说明 |
|------|------|
| 日期 | 时段日期 (YYYY-MM-DD) |
| 仪器ID | 仪器编号 |
| 仪器名称 | 仪器名称 |
| 开始时间 | 时段开始时间 (HH:MM) |
| 结束时间 | 时段结束时间 (HH:MM) |
| 时长(分钟) | 时段时长（分钟） |
| 时长(小时) | 时段时长（小时，保留2位小数） |

### CSV 风险问题格式

| 列名 | 说明 |
|------|------|
| 问题类型 | 时间冲突/超时占用/故障期误预约/连续值守过长 |
| 风险等级 | 高/中/低 |
| 描述 | 问题详细描述 |
| 涉及预约ID | 相关预约ID（逗号分隔） |
| 涉及故障ID | 相关故障ID（逗号分隔） |

## 风险等级说明

| 等级 | 图标 | 问题类型 | 说明 |
|------|------|----------|------|
| 高风险 | 🔴 | 时间冲突、故障期误预约 | 必须立即处理的严重问题 |
| 中风险 | 🟡 | 超时占用、连续值守过长 | 建议调整的潜在问题 |
| 低风险 | 🟢 | - | 目前未使用 |

## 目录结构

```
xy4204/
├── lab_scheduler/          # 主包
│   ├── __init__.py        # 版本信息
│   ├── __main__.py        # 入口
│   ├── models.py          # 数据模型
│   ├── parser.py          # 数据解析器
│   ├── validator.py       # 校验和分析器
│   ├── reporter.py        # 报告生成器
│   └── cli.py             # 命令行界面
├── examples/               # 示例数据
│   ├── normal_bookings.json      # 正常预约数据
│   ├── problematic_bookings.json # 包含问题的预约数据
│   └── faults.json               # 故障记录数据
├── output/                 # 输出目录（运行时生成）
├── run.py                  # 可执行入口
└── README.md               # 本文档
```

## 退出码

| 退出码 | 说明 |
|--------|------|
| 0 | 执行成功（无高风险问题） |
| 1 | 存在高风险问题或执行错误 |
| 2 | 参数错误 |

## 常见问题

### Q1: 如何处理数据格式错误？

工具会提供详细的错误信息，指出具体哪条记录的哪个字段有问题。例如：
```
❌ 数据错误: 预约数据第 2 条缺少必要字段: 'start_time'
```

### Q2: 可用时段是如何计算的？

可用时段基于以下规则计算：
1. 工作时间内（默认 08:00 - 22:00）
2. 排除已有预约时间
3. 排除故障期时间
4. 合并相邻的空闲时间
5. 只保留时长大于等于最小时段的时段

### Q3: 连续值守是如何判断的？

连续值守判断规则：
1. 同一用户的多个预约
2. 相邻预约间隔 <= 30分钟 视为连续
3. 累计时长超过限制时触发警告

## 许可证

本工具仅供内部使用。
