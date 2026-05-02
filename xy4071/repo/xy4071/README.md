# 📻 频率排班守门员 (Frequency Guardian)

业余无线电应急演练频率管理工具，用于自动检测频道冲突、呼号格式错误、功率超限和记录缺失等问题。

## 功能特性

- **init**: 初始化项目配置
- **import**: 导入电台清单、频率分配、值守排班、通联日志 CSV 文件
- **plan**: 生成值守冲突和频道占用表
- **check**: 执行规则检查，标出违规和缺失证据
- **review**: 管理复核流程，保存人工确认
- **export**: 导出 Markdown 复盘、CSV 问题清单和 JSON 审计包

## 快速开始

### 安装

```bash
# 使用 pip 安装
pip install -e .
```

或者安装开发依赖：

```bash
pip install -e ".[dev]"
```

### 完整使用流程演示

#### 1. 创建临时测试目录

```bash
mkdir -p /tmp/fg_test/data
cd /tmp/fg_test
```

#### 2. 初始化项目

```bash
# 使用默认配置初始化
fg init

# 或自定义配置
fg init --project-name "2024春季应急演练" \
        --exercise-name "北京地区地震应急演练" \
        --max-power 25.0 \
        --min-freq 144.0 \
        --max-freq 148.0
```

#### 3. 准备测试数据 CSV 文件

创建以下 CSV 文件到 `data/` 目录：

**电台清单 (data/radio_inventory.csv)**:
```csv
呼号,设备型号,功率(W),频率(MHz),是否中继台
BH1ABC,宝锋UV-5R,25.0,145.500,否
BH1DEF,建伍TM-271,50.0,145.600,否
BH2GHI,YAESU FT-891,100.0,145.700,是
INVALID,宝锋UV-5R,25.0,145.800,否
```

**频率分配 (data/frequency_assignment.csv)**:
```csv
频道ID,接收频率(MHz),发射频率(MHz),用途,带宽(kHz),中继台呼号
CH001,145.500,145.500,应急指挥,12.5,
CH002,145.600,145.600,医疗救援,12.5,
CH003,147.975,144.000,区域中继,12.5,RPT01
CH004,149.000,149.000,超出频段,12.5,
```

**值守排班 (data/duty_schedule.csv)**:
```csv
日期,频道ID,主班呼号,备班呼号,开始时间,结束时间,日期类型
2024-05-20,CH001,BH1ABC,BH1DEF,08:00,12:00,工作日
2024-05-20,CH001,BH2GHI,BH1XYZ,10:00,14:00,工作日
2024-05-20,CH002,BH1ABC,BH2GHI,11:00,15:00,工作日
2024-05-20,CH002,BH1DEF,BH1XYZ,16:00,20:00,工作日
```

**通联日志 (data/contact_log.csv)**:
```csv
日期,时间,主叫呼号,被叫呼号,频道ID,信号报告,中继台切换,备注
2024-05-20,08:30,BH1ABC,BH1DEF,CH001,59,否,测试呼叫
2024-05-20,09:15,BH2GHI,BH1ABC,CH001,55,是,从中继切换
2024-05-20,10:30,INVALID,BH1DEF,CH002,58,,无效呼号
2024-05-20,11:00,BH1ABC,,CH001,59,,缺失被叫
```

#### 4. 导入数据文件

```bash
# 导入所有文件
fg import --all

# 或分别导入
fg import --radio data/radio_inventory.csv
fg import --frequency data/frequency_assignment.csv
fg import --schedule data/duty_schedule.csv
fg import --log data/contact_log.csv

# 详细模式
fg import --all --verbose
```

#### 5. 分析排班冲突

```bash
fg plan

# 详细模式
fg plan --verbose
```

这将显示：
- 频道冲突检测（同一时段同一频道被多个操作员占用）
- 操作员冲突检测（同一操作员同时值守多个频道）
- 频道占用情况统计
- 排班空档分析

#### 6. 执行规则检查

```bash
fg check

# 详细模式
fg check --verbose
```

检查包括：
- 呼号格式验证
- 功率限制检查
- 频率频段验证
- 中继台切换记录检查

所有违规记录将被保存到 `quarantine.json`。

#### 7. 复核流程

```bash
# 列出待处理条目
fg review --list

# 确认某个条目违规（使用条目前8个字符即可）
fg review --confirm abc12345 --note "确认是呼号格式错误"

# 驳回某个条目（误判）
fg review --dismiss def67890 --note "这是合法的特殊呼号"

# 批量确认所有待处理条目
fg review --all-confirm

# 批量驳回所有待处理条目
fg review --all-dismiss
```

#### 8. 导出报告

```bash
# 导出所有三种格式
fg export

# 只导出 Markdown
fg export --markdown

# 只导出 CSV
fg export --csv

# 只导出 JSON
fg export --json

# 导出到指定目录
fg export --output /path/to/reports
```

导出的文件：
- `review_report.md` - Markdown 格式复盘报告
- `violations.csv` - CSV 格式问题清单
- `audit_package.json` - JSON 格式完整审计包

## 命令详解

### init - 初始化项目

```bash
fg init [选项]
```

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `--project-name, -n` | 项目名称 | 应急演练频率管理 |
| `--exercise-name, -e` | 演练名称 | 无 |
| `--max-power, -p` | 最大功率限制(瓦) | 25.0 |
| `--min-freq, -f` | 最小频率(MHz) | 144.0 |
| `--max-freq, -F` | 最大频率(MHz) | 148.0 |
| `--force` | 强制覆盖现有配置 | 否 |

### import - 导入数据

```bash
fg import [选项]
```

| 选项 | 说明 |
|------|------|
| `--radio, -r` | 电台清单 CSV 文件 |
| `--frequency, -f` | 频率分配 CSV 文件 |
| `--schedule, -s` | 值守排班 CSV 文件 |
| `--log, -l` | 通联日志 CSV 文件 |
| `--all, -a` | 从 data 目录自动检测所有文件 |
| `--verbose, -v` | 显示详细输出 |

### plan - 排班分析

```bash
fg plan [选项]
```

| 选项 | 说明 |
|------|------|
| `--verbose, -v` | 显示详细输出 |

### check - 规则检查

```bash
fg check [选项]
```

| 选项 | 说明 |
|------|------|
| `--verbose, -v` | 显示详细输出 |

### review - 复核管理

```bash
fg review [选项]
```

| 选项 | 说明 |
|------|------|
| `--list, -l` | 列出所有待处理条目 |
| `--confirm, -c` | 确认指定条目违规 (entry_id) |
| `--dismiss, -d` | 驳回指定条目误判 (entry_id) |
| `--all-confirm, -C` | 确认所有待处理条目 |
| `--all-dismiss, -D` | 驳回所有待处理条目 |
| `--note, -n` | 复核备注 |
| `--verbose, -v` | 显示详细输出 |

### export - 导出报告

```bash
fg export [选项]
```

| 选项 | 说明 |
|------|------|
| `--output, -o` | 输出目录路径 |
| `--markdown, -m` | 只生成 Markdown 报告 |
| `--csv, -c` | 只生成 CSV 问题清单 |
| `--json, -j` | 只生成 JSON 审计包 |
| `--verbose, -v` | 显示详细输出 |

## CSV 文件格式

### 电台清单 (Radio Inventory)

| 字段 | 说明 | 示例 |
|------|------|------|
| 呼号 | 电台呼号 | BH1ABC |
| 设备型号 | 设备型号 | 宝锋UV-5R |
| 功率(W) | 发射功率 | 25.0 |
| 频率(MHz) | 工作频率 | 145.500 |
| 是否中继台 | 是否为中继台 | 否/是 |

### 频率分配 (Frequency Assignment)

| 字段 | 说明 | 示例 |
|------|------|------|
| 频道ID | 频道标识符 | CH001 |
| 接收频率(MHz) | 接收频率 | 145.500 |
| 发射频率(MHz) | 发射频率 | 145.500 |
| 用途 | 频道用途 | 应急指挥 |
| 带宽(kHz) | 信道带宽 | 12.5 |
| 中继台呼号 | 关联中继台 | RPT01 |

### 值守排班 (Duty Schedule)

| 字段 | 说明 | 示例 |
|------|------|------|
| 日期 | 值守日期 | 2024-05-20 |
| 频道ID | 值守频道 | CH001 |
| 主班呼号 | 主班操作员 | BH1ABC |
| 备班呼号 | 备班操作员 | BH1DEF |
| 开始时间 | 开始时间 | 08:00 |
| 结束时间 | 结束时间 | 12:00 |
| 日期类型 | 工作日/周末 | 工作日 |

### 通联日志 (Contact Log)

| 字段 | 说明 | 示例 |
|------|------|------|
| 日期 | 通联日期 | 2024-05-20 |
| 时间 | 通联时间 | 08:30 |
| 主叫呼号 | 发起呼叫方 | BH1ABC |
| 被叫呼号 | 接收呼叫方 | BH1DEF |
| 频道ID | 使用频道 | CH001 |
| 信号报告 | 信号报告 | 59 |
| 中继台切换 | 是否跨中继 | 是/否 |
| 备注 | 备注信息 | 测试呼叫 |

## 项目结构

```
frequency_guardian/
├── __init__.py          # 包初始化
├── cli.py               # 命令行入口
├── models/              # 数据模型
│   ├── __init__.py
│   ├── config.py        # 配置模型
│   ├── radio.py         # 电台设备模型
│   ├── frequency.py     # 频率频道模型
│   ├── schedule.py      # 值守排班模型
│   ├── log.py           # 通联日志模型
│   ├── violation.py     # 违规记录模型
│   └── quarantine.py    # 隔离存储模型
├── parsers/             # CSV 解析器
│   ├── __init__.py
│   ├── base.py          # 基础解析器
│   ├── factory.py       # 解析器工厂
│   ├── radio_parser.py  # 电台清单解析器
│   ├── frequency_parser.py  # 频率分配解析器
│   ├── schedule_parser.py   # 值守排班解析器
│   └── log_parser.py    # 通联日志解析器
├── rules/               # 规则引擎
│   ├── __init__.py
│   ├── base.py          # 规则基类
│   ├── engine.py        # 规则引擎
│   ├── call_sign_rule.py    # 呼号格式规则
│   ├── power_rule.py        # 功率限制规则
│   ├── frequency_rule.py    # 频率频段规则
│   ├── channel_conflict_rule.py  # 频道冲突规则
│   ├── operator_conflict_rule.py # 操作员冲突规则
│   ├── repeater_switch_rule.py  # 中继切换规则
│   └── time_overlap_rule.py     # 时间重叠规则
├── scheduler/           # 排班算法
│   ├── __init__.py
│   ├── analyzer.py      # 排班分析器
│   └── planner.py       # 排班规划器
├── storage/             # 存储管理
│   ├── __init__.py
│   ├── manager.py       # 存储管理器
│   └── serializer.py    # JSON 序列化器
└── reports/             # 报告生成
    ├── __init__.py
    ├── base.py          # 报告基类
    ├── markdown_report.py  # Markdown 报告
    ├── csv_report.py       # CSV 报告
    └── json_report.py      # JSON 审计包

tests/                   # 测试用例
├── __init__.py
├── test_config.py       # 配置测试
└── test_rules.py        # 规则测试
```

## 运行测试

```bash
# 运行所有测试
pytest

# 运行测试并显示覆盖率
pytest --cov=frequency_guardian

# 运行特定测试文件
pytest tests/test_config.py
```

## 许可证

MIT License

## 支持

如有问题或建议，请提交 Issue 或 Pull Request。
