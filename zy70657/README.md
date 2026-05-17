# 直播排班人员冲突脚本缺失排查CLI

用于检查直播排班表中的主播时间冲突、场控和商品脚本缺失问题的命令行工具。

## 功能特性

- **时间段展开**: 自动解析并展开每日排班时间段
- **人员冲突检测**: 检测同一主播在同一时间段是否被排到多个账号
- **脚本缺失检查**: 检查是否缺少场控人员或商品脚本
- **坏行处理**: 保留原始文件位置，记录无效数据行
- **账号统计**: 统计每个账号的排班情况和缺失问题
- **报告导出**: 支持JSON和CSV格式导出，重复运行结果稳定

## 安装依赖

```bash
pip3 install pandas openpyxl python-dateutil click
```

## 使用方法

### 1. 生成示例文件

```bash
python3 main.py sample
```

会生成 `sample_schedule.csv` 示例文件供测试使用。

### 2. 检查排班表

```bash
# 显示详细报告
python3 main.py check sample_schedule.csv -v

# 导出JSON报告
python3 main.py check sample_schedule.csv -j report.json

# 导出CSV报告
python3 main.py check sample_schedule.csv -c report.csv

# 同时导出两种格式
python3 main.py check sample_schedule.csv -j report.json -c report.csv

# 检查多个文件
python3 main.py check file1.csv file2.xlsx -v
```

### 3. 命令选项

- `--verbose, -v`: 显示详细的控制台报告
- `--output-json, -j`: 指定JSON报告输出路径
- `--output-csv, -c`: 指定CSV报告输出路径
- `--stable/--no-stable`: 确保输出结果稳定（默认开启）

## 排班表格式

支持CSV和Excel格式，需要包含以下列（列名可灵活匹配）：

- 日期 / date / 排班日期
- 开始时间 / start_time / 时间
- 结束时间 / end_time
- 主播 / anchor / 主持人
- 账号 / account / 直播账号
- 场控 / field_control / 场控人员
- 商品脚本 / product_script / 脚本 / 商品

## 项目结构

```
.
├── schedule_checker/
│   ├── __init__.py      # 包初始化
│   ├── models.py        # 数据模型定义
│   ├── parser.py        # 文件解析模块
│   ├── rules.py         # 规则引擎（冲突检测、缺失检查）
│   ├── reporter.py      # 报告生成模块
│   └── cli.py           # CLI入口
├── main.py              # 主入口文件
├── requirements.txt     # 依赖列表
└── README.md            # 说明文档
```

## 模块说明

### models.py
定义核心数据类：
- `IssueType`: 问题类型枚举
- `SourceLocation`: 来源位置信息
- `ScheduleRow`: 排班行数据
- `TimeSlot`: 时间段
- `Issue`: 问题记录
- `CheckResult`: 检查结果

### parser.py
排班表解析模块：
- 支持CSV和Excel格式
- 自动检测列名
- 保留原始文件位置
- 记录解析错误

### rules.py
规则引擎：
- `expand_time_slots`: 时间段展开
- `check_person_conflicts`: 人员冲突检测
- `check_script_missing`: 脚本缺失检查
- `check_bad_rows`: 无效行检查
- `calculate_stats`: 统计计算

### reporter.py
报告生成器：
- 控制台报告输出
- JSON格式报告导出
- CSV格式报告导出
- 结果稳定性保证（排序）

## 示例输出

```
正在解析: sample_schedule.csv
  解析完成: 6 行

总计解析: 6 行
================================================================================
直播排班冲突排查报告
================================================================================

总计: 6 行, 有效: 5 行
发现问题: 4 个

按类型分布:
  bad_row: 1
  person_conflict: 1
  script_missing: 2

================================================================================
问题详情:
================================================================================

[HIGH] [person_conflict]
  主播 [小美] 在 2025-05-20 存在时间冲突
  位置: sample_schedule.csv:2
  位置: sample_schedule.csv:3

[MEDIUM] [script_missing]
  账号 [服饰旗舰店] 缺少: 商品脚本
  位置: sample_schedule.csv:3

[MEDIUM] [script_missing]
  账号 [数码专营店] 缺少: 场控
  位置: sample_schedule.csv:4

[LOW] [bad_row]
  数据行错误: 缺少日期, 缺少主播
  位置: sample_schedule.csv:7
```
