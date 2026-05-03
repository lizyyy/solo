# 商标案件期限复核工具 (Trademark Deadlines)

一个用于批量复核商标案件期限的Python CLI工具，帮助法务同事自动计算各种商标相关截止日期并检测风险。

## 功能特性

- **期限计算**：按国家/地区规则自动计算异议期、补正期、续展期、宽展期等截止日
- **节假日顺延**：自动识别法定节假日和周末，自动顺延截止日期
- **风险检测**：
  - 材料缺失检测
  - 跨时区提交风险
  - 同一商标多案件冲突
  - 即将到期预警
  - 已逾期警告
- **脏数据处理**：
  - 识别缺少申请日的案件
  - 检测已放弃案件仍有后续动作的异常
- **多格式输出**：
  - `deadlines.csv` - 期限详情表
  - `risk_report.md` - 风险分析报告
  - `calendar.ics` - 日历提醒文件（可导入Outlook/Google日历）

## 安装

### 环境要求
- Python 3.8+
- pip 包管理器

### 安装依赖
```bash
pip install -r requirements.txt
```

## 快速开始

### 使用示例数据运行 Demo
```bash
python -m trademark_deadlines demo
```

这将使用 `sample/` 目录下的示例数据运行完整流程，输出文件将生成在 `demo_output/` 目录。

### 使用自定义数据

```bash
python -m trademark_deadlines \
    --cases ./data/cases.csv \
    --actions ./data/actions.jsonl \
    --holidays ./data/holiday_rules.yaml \
    --rules ./data/jurisdiction_rules.yaml \
    --output ./output
```

### 命令行参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--cases` | 案件数据CSV文件路径 | 必填 |
| `--actions` | 动作数据JSONL文件路径 | 必填 |
| `--holidays` | 节假日规则YAML文件路径 | 必填 |
| `--rules` | 司法管辖区规则YAML文件路径 | 必填 |
| `--output` | 输出目录 | 当前目录 |
| `--reference-date` | 参考日期 (YYYY-MM-DD) | 今天 |
| `--imminent-threshold` | 即将到期阈值天数 | 7 |

## 数据格式说明

### 1. 案件数据 (cases.csv)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| case_id | string | 是 | 案件唯一标识 |
| trademark | string | 是 | 商标名称 |
| jurisdiction | string | 是 | 司法管辖区代码 (CN/US/EU等) |
| application_number | string | 否 | 申请号 |
| registration_number | string | 否 | 注册号 |
| application_date | date | 否 | 申请日 (YYYY-MM-DD) |
| registration_date | date | 否 | 注册日 (YYYY-MM-DD) |
| status | string | 是 | 案件状态 (active/abandoned/registered/expired) |
| classes | string | 否 | 商标类别，多个用逗号分隔 |
| applicant | string | 否 | 申请人 |
| filing_timezone | string | 否 | 提交时区 |

**示例：**
```csv
case_id,trademark,jurisdiction,application_number,registration_number,application_date,registration_date,status,classes,applicant
CASE-001,创新科技,CN,CN2023001,CN1234567,2023-01-15,2023-07-20,active,9,35,42,创新科技有限公司
```

### 2. 动作数据 (actions.jsonl)

每行一个JSON对象，字段说明：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| action_id | string | 是 | 动作唯一标识 |
| case_id | string | 是 | 关联案件ID |
| action_type | string | 是 | 动作类型 |
| action_date | date | 是 | 动作发生日期 |
| description | string | 否 | 动作描述 |
| deadline_days | int | 否 | 响应期限天数 |
| is_completed | bool | 否 | 是否已完成 |
| completed_date | date | 否 | 完成日期 |
| timezone | string | 否 | 提交时区 |
| submission_time | datetime | 否 | 实际提交时间 |

**动作类型 (action_type)：**
- `opposition_notice` - 异议通知
- `opposition_response` - 异议答辩
- `examination_report` - 审查报告
- `amendment` - 补正
- `use_evidence` - 使用证据
- `renewal` - 续展
- `widening` - 宽展
- `office_action` - 官方通知

**示例：**
```json
{"action_id": "ACT-001", "case_id": "CASE-001", "action_type": "opposition_notice", "action_date": "2024-04-15", "description": "收到第三方异议通知", "deadline_days": 30, "is_completed": false}
```

### 3. 司法管辖区规则 (jurisdiction_rules.yaml)

定义各司法管辖区的期限规则。

**期限类型 (deadline_type)：**
- `opposition` - 异议期
- `opposition_response` - 异议答辩期
- `examination_amendment` - 审查补正期
- `renewal` - 续展期
- `widening` - 宽展期
- `use_evidence` - 使用证据提交期
- `office_action_response` - OA答复期

**计算方法 (method)：**
- `calendar_days` - 日历日
- `business_days` - 工作日
- `months` - 月
- `years` - 年

**示例：**
```yaml
jurisdictions:
  CN:
    name: 中国
    default_timezone: Asia/Shanghai
    holiday_calendar_key: CN
    deadlines:
      opposition:
        method: months
        duration: 3
        description: 商标初审公告后3个月异议期
      renewal:
        method: years
        duration: 10
        description: 商标有效期10年
```

### 4. 节假日规则 (holiday_rules.yaml)

定义各司法管辖区的法定节假日。

**示例：**
```yaml
calendars:
  CN:
    name: 中国节假日
    custom_holidays:
      - "2024-01-01"
      - "2024-02-10"
      - "2024-02-11"
    fixed_holidays:
      - name: 元旦
        month: 1
        day: 1
```

## 输出文件说明

### 1. deadlines.csv

| 字段 | 说明 |
|------|------|
| case_id | 案件ID |
| trademark | 商标名称 |
| jurisdiction | 司法管辖区 |
| deadline_type | 期限类型 |
| base_deadline | 基础截止日 |
| adjusted_deadline | 调整后截止日（含顺延） |
| was_adjusted | 是否已顺延 |
| adjustment_reason | 顺延原因 |
| days_until_deadline | 剩余天数 |
| is_overdue | 是否已逾期 |
| urgency_level | 紧急程度 |
| related_action_id | 关联动作ID |
| notes | 备注 |

### 2. risk_report.md

包含以下章节：
- 执行摘要
- 紧急事项（已逾期、3天内到期）
- 详细风险分析（按类别分类）
- 期限汇总表
- 数据质量报告

**风险类别：**
- 已逾期
- 即将到期
- 材料缺失
- 时区冲突
- 多案件冲突

**风险等级：**
- 🔴 CRITICAL (严重)
- 🟠 HIGH (高)
- 🟡 MEDIUM (中)
- 🟢 LOW (低)

### 3. calendar.ics

iCalendar格式文件，可导入：
- Microsoft Outlook
- Google 日历
- Apple 日历
- 其他支持iCal格式的日历应用

每个事件包含：
- 事件标题（含紧急程度标识）
- 详细描述（案件信息、期限类型等）
- 提前提醒（3天前或1天前）
- 优先级标记

## 脏数据处理

工具会自动检测并报告以下数据质量问题：

### 1. 缺少申请日 (MISSING_APPLICATION_DATE)
- 检测：案件记录中 `application_date` 为空
- 影响：基于申请日的期限计算无法进行
- 处理：在报告中标记为警告，跳过相关计算

### 2. 已放弃案件有后续动作 (ABANDONED_CASE_WITH_ACTIONS)
- 检测：案件状态为 `abandoned`，但存在未完成的动作
- 影响：可能是数据录入错误或需要特殊处理
- 处理：在数据质量报告中列出

### 3. 其他数据问题
- 无效日期格式
- 无效动作类型
- 无效案件状态
- 动作引用不存在的案件

## 项目结构

```
trademark_deadlines/
├── __init__.py
├── __main__.py          # CLI入口
├── cli.py               # 命令行接口
├── models/              # 数据模型
│   ├── __init__.py
│   ├── case.py          # 案件模型
│   ├── action.py        # 动作模型
│   ├── holiday.py       # 节假日模型
│   └── jurisdiction.py  # 司法管辖区规则模型
├── core/                # 核心逻辑
│   ├── __init__.py
│   ├── date_calculator.py    # 日期计算引擎
│   ├── risk_detector.py      # 风险检测
│   └── data_loader.py        # 数据加载器
├── output/              # 输出模块
│   ├── __init__.py
│   ├── csv_exporter.py      # CSV导出
│   ├── markdown_exporter.py # Markdown报告
│   └── ics_exporter.py      # 日历导出
└── sample/              # 示例数据
    ├── cases.csv
    ├── actions.jsonl
    ├── holiday_rules.yaml
    └── jurisdiction_rules.yaml
```

## 支持的司法管辖区

默认配置包含以下司法管辖区：

| 代码 | 名称 | 默认时区 |
|------|------|----------|
| CN | 中国 | Asia/Shanghai |
| US | 美国 | America/New_York |
| EU | 欧盟 | Europe/London |
| JP | 日本 | Asia/Tokyo |
| GB | 英国 | Europe/London |

如需添加新司法管辖区，请编辑 `jurisdiction_rules.yaml` 和 `holiday_rules.yaml`。

## 常见问题

### Q1: 如何添加新的司法管辖区？
编辑 `jurisdiction_rules.yaml` 添加新的司法管辖区定义，并在 `holiday_rules.yaml` 中添加对应的节假日规则。

### Q2: 截止日是如何计算的？
1. 根据司法管辖区规则计算基础截止日
2. 检查是否落在周末或节假日
3. 自动顺延至下一个工作日
4. 在输出中记录顺延原因

### Q3: 如何导入日历文件？
- **Outlook**: 文件 -> 打开和导出 -> 导入/导出 -> 导入iCalendar文件
- **Google日历**: 设置 -> 导入和导出 -> 选择文件
- **Apple日历**: 文件 -> 导入 -> 选择.ics文件

## 更新日志

### v1.0.0
- 初始版本发布
- 支持基本期限计算
- 支持节假日顺延
- 支持风险检测
- 支持多种输出格式
- 支持demo命令

## 许可证

MIT License
