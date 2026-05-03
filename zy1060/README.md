# 报销材料包体检工具

一个本地使用的命令行工具，用于在提交报销前对报销材料包进行完整性和一致性检查。

## 功能特点

- 📁 **目录扫描**：递归扫描报销包目录中的所有附件文件
- 📊 **CSV 解析**：解析报销明细 CSV 文件，支持多种日期格式和编码
- 🔍 **智能识别**：从文件名和 sidecar JSON 元数据中提取发票号、报销单号
- ✅ **多维度校验**：
  - 检查附件是否缺失
  - 检测重复发票号
  - 验证费用类型是否合法
  - 检查单笔金额是否超限
  - 检测发票日期是否超期
  - 验证必需附件（合同、验收单等）是否齐全
  - 检查文件命名是否规范
- 📋 **报告生成**：支持导出 Markdown 和 JSON 两种格式的体检报告
- ⚙️ **灵活配置**：通过 YAML 配置文件自定义校验规则
- 🖥️ **友好界面**：使用 Rich 库提供美观的终端输出

## 安装

### 环境要求

- Python 3.9 或更高版本

### 安装步骤

1. 克隆或下载此项目到本地

2. 在项目根目录下执行安装：

```bash
pip install -e .
```

或者使用 pip 安装依赖后直接运行：

```bash
pip install click pyyaml rich
python -m expense_checker.cli --help
```

安装完成后，你可以使用 `expense-checker` 命令：

```bash
expense-checker --help
```

## 快速开始

### 1. 创建示例数据

首先，让我们创建一个包含示例数据的报销包目录，用于演示工具的功能：

```bash
expense-checker init-sample ./sample-expense-package
```

这将创建一个包含以下内容的目录：
- `expenses.csv` - 报销明细（包含一些故意设置的问题）
- 各种附件文件（PDF、图片等）
- `expense-checker.yaml` - 示例配置文件

### 2. 检查报销包

现在让我们检查这个示例报销包：

```bash
expense-checker check ./sample-expense-package
```

你会看到终端输出详细的检查结果，包括：
- 基本信息（检查时间、报销记录数、附件数、总金额等）
- 错误列表（必须修复的问题）
- 警告列表（建议检查的问题）

### 3. 导出检查报告

如果你想将检查结果保存为报告文件：

```bash
mkdir -p ./reports
expense-checker report ./sample-expense-package -o ./reports
```

这将在 `./reports` 目录下生成：
- `check-report.json` - JSON 格式的详细报告
- `check-report.md` - Markdown 格式的易读报告

## 命令详解

### init-sample - 创建示例数据

创建一个包含示例数据的报销包目录，用于演示和测试。

```bash
expense-checker init-sample <目标路径> [选项]
```

**参数：**
- `PATH` - 目标目录路径（必填）

**选项：**
- `--force, -f` - 如果目录已存在，强制覆盖

**示例：**
```bash
# 基础用法
expense-checker init-sample ./my-sample

# 强制覆盖已存在的目录
expense-checker init-sample ./my-sample --force
```

### check - 检查报销包

检查报销材料包的完整性和一致性，输出终端摘要。

```bash
expense-checker check <报销包路径> [选项]
```

**参数：**
- `PATH` - 报销包目录路径（必须存在）

**选项：**
- `--config, -c` - 配置文件路径（默认自动查找）
- `--output, -o` - 报告输出目录（如果指定，会生成报告文件）
- `--format, -f` - 报告格式，可选值：`json`、`markdown`、`both`（默认 `both`）
- `--quiet, -q` - 不输出终端摘要

**示例：**
```bash
# 基础检查，只输出终端摘要
expense-checker check ./expense-package

# 检查并导出报告
expense-checker check ./expense-package -o ./reports

# 只导出 JSON 格式报告
expense-checker check ./expense-package -o ./reports -f json

# 使用自定义配置文件
expense-checker check ./expense-package -c ./my-config.yaml

# 静默模式（只导出报告，不输出终端）
expense-checker check ./expense-package -o ./reports -q
```

### report - 生成检查报告

与 `check` 命令类似，但强制要求输出目录，专门用于生成报告文件。

```bash
expense-checker report <报销包路径> --output <输出目录> [选项]
```

**参数：**
- `PATH` - 报销包目录路径（必须存在）

**选项：**
- `--config, -c` - 配置文件路径
- `--output, -o` - 报告输出目录（**必填**）
- `--format, -f` - 报告格式（默认 `both`）
- `--quiet, -q` - 不输出终端摘要

**示例：**
```bash
# 生成报告
expense-checker report ./expense-package -o ./reports

# 只生成 Markdown 报告
expense-checker report ./expense-package -o ./reports -f markdown
```

### config-sample - 生成示例配置文件

输出或保存一个示例配置文件，帮助你了解如何自定义规则。

```bash
expense-checker config-sample [选项]
```

**选项：**
- `--output, -o` - 输出文件路径（不指定则打印到控制台）

**示例：**
```bash
# 打印到控制台
expense-checker config-sample

# 保存到文件
expense-checker config-sample -o ./my-config.yaml
```

## 目录结构

### 推荐的报销包目录结构

```
报销包目录/
├── expenses.csv              # 报销明细文件（必需）
├── 发票_INV202601010001.pdf # 附件文件（命名中包含发票号）
├── 发票_INV202601010001.png # 同一张发票的多个附件
├── 付款_INV202601010002.pdf # 付款凭证
├── 合同_HT2026001.pdf        # 合同文件
├── 验收单_YS2026001.pdf      # 验收单
├── 子目录/                   # 支持子目录（会递归扫描）
│   └── 发票_INV202601010003.pdf
├── .meta/                    # 可选的元数据目录
│   └── 特殊文件.pdf.json     # sidecar 元数据
└── expense-checker.yaml      # 可选的配置文件
```

### 项目代码结构

```
expense_checker/
├── __init__.py          # 包初始化
├── __version__.py       # 版本号
├── cli.py               # 命令行入口（Click 定义）
├── config.py            # 配置管理（YAML 加载、规则配置）
├── csv_parser.py        # CSV 文件解析
├── file_scanner.py      # 文件扫描和元数据提取
├── models.py            # 数据模型定义（数据类、枚举）
├── reporter.py          # 报告生成（JSON、Markdown）
└── validator.py         # 校验规则实现
```

## 配置文件说明

工具支持通过 YAML 配置文件自定义校验规则。配置文件会按以下顺序查找：

1. 命令行指定的 `--config` 参数
2. 当前目录下的 `expense-checker.yaml`
3. 当前目录下的 `expense-checker.yml`
4. 当前目录下的 `.expense-checker.yaml`
5. 用户配置目录：`~/.config/expense-checker/config.yaml`

### 完整配置示例

```yaml
# 允许的费用类型列表
allowed_expense_types:
  - 差旅费
  - 办公费
  - 招待费
  - 交通费
  - 通讯费
  - 设备采购
  - 服务费
  - 咨询费
  - 会议费
  - 培训费
  - 广告费
  - 租赁费
  - 物业费
  - 水电费
  - 其他

# 单笔金额上限（元），超过此金额会触发警告
max_single_amount: 10000.0

# 报销截止天数（从发票日期到报销日期的最大允许天数）
reimbursement_days: 90

# 报销明细CSV文件名
csv_filename: "expenses.csv"

# 不同费用类型所需的附件类型
required_attachment_types:
  设备采购: ["发票", "合同"]
  服务费: ["发票", "合同", "验收单"]
  咨询费: ["发票", "合同", "验收单"]
  会议费: ["发票", "会议纪要"]
  培训费: ["发票", "培训通知"]
  差旅费: ["发票", "出差审批单"]
  招待费: ["发票", "招待清单"]

# 文件名匹配规则（正则表达式）
filename_patterns:
  invoice: "^(发票|invoice|fp)_?\\d+"
  payment: "^(付款|payment|pay)_?\\d+"
  contract: "^(合同|contract|ht)_?\\d+"
  acceptance: "^(验收|acceptance|ys)_?\\d+"

# 校验规则开关和严重程度
# severity: error（错误，必须修复）| warning（警告，建议检查）| info（提示）
rules:
  # 缺少附件
  missing_attachment:
    enabled: true
    severity: error
  
  # 重复发票号
  duplicate_invoice:
    enabled: true
    severity: error
  
  # 金额合计不一致
  amount_mismatch:
    enabled: true
    severity: error
  
  # 日期超期
  date_expired:
    enabled: true
    severity: warning
  
  # 缺少合同
  missing_contract:
    enabled: true
    severity: error
  
  # 缺少验收单
  missing_acceptance:
    enabled: true
    severity: error
  
  # 文件名不规范
  invalid_filename:
    enabled: true
    severity: warning
  
  # 无效的费用类型
  invalid_expense_type:
    enabled: true
    severity: error
  
  # 单笔金额超限
  amount_exceed_limit:
    enabled: true
    severity: warning
```

### 配置项详解

#### 1. allowed_expense_types

定义允许使用的费用类型。如果报销明细中的费用类型不在此列表中，会触发 `invalid_expense_type` 错误。

**常见场景：**
- 公司只允许特定类型的费用报销
- 需要限制某些费用类型的使用

#### 2. max_single_amount

单笔报销金额的上限。超过此金额会触发 `amount_exceed_limit` 警告。

**注意：** 这是警告级别，不会阻止报销，但会提醒检查。

#### 3. reimbursement_days

报销的有效期限，以天为单位。从发票日期到检查日期的天数超过此值会触发 `date_expired` 警告。

**常见设置：**
- 90 天（季度内报销）
- 180 天（半年内报销）
- 365 天（一年内报销）

#### 4. csv_filename

报销明细 CSV 文件的名称。默认为 `expenses.csv`。

如果你的公司使用不同的文件名（如 `报销明细.csv`），可以修改此项。

#### 5. required_attachment_types

定义不同费用类型需要的附件类型。这是一个字典，键是费用类型，值是该类型需要的附件列表。

**内置检测的附件类型：**
- `"合同"` - 检测文件名中包含"合同"、"contract"、"ht_"
- `"验收单"` - 检测文件名中包含"验收"、"acceptance"、"ys_"

你可以自定义其他附件类型，但需要在 `validator.py` 中添加相应的检测逻辑。

#### 6. filename_patterns

定义用于识别文件类型的正则表达式模式。这些模式用于：
- 检查文件名是否规范
- 从文件名中提取信息

每个模式都是一个正则表达式，用于匹配特定类型的文件名。

#### 7. rules

控制各个校验规则的开关和严重程度。

**规则说明：**

| 规则名称 | 说明 | 建议严重程度 |
|---------|------|-------------|
| missing_attachment | 报销记录缺少对应的附件文件 | error |
| duplicate_invoice | 同一张发票号出现在多条报销记录中 | error |
| amount_mismatch | 金额合计不一致（预留，当前检测单条金额超限） | error |
| date_expired | 发票日期超过报销截止天数 | warning |
| missing_contract | 需要合同的费用类型缺少合同附件 | error |
| missing_acceptance | 需要验收单的费用类型缺少验收单 | error |
| invalid_filename | 附件文件名不符合规范 | warning |
| invalid_expense_type | 费用类型不在允许列表中 | error |
| amount_exceed_limit | 单笔金额超过上限 | warning |

**严重程度说明：**
- `error` - 错误，必须修复，检查失败
- `warning` - 警告，建议检查，检查可以通过但有提醒
- `info` - 提示，仅作信息展示

## 报销明细 CSV 格式

### 必需字段

| 字段名 | 说明 | 示例 |
|--------|------|------|
| expense_id | 报销记录唯一标识 | EXP001 |
| invoice_number | 发票号码 | INV202601010001 |
| amount | 金额（数字） | 500.00 或 1,500.00 |
| expense_type | 费用类型 | 差旅费 |

### 可选字段

| 字段名 | 说明 | 示例 |
|--------|------|------|
| date | 发票日期 | 2026-01-15 |
| project_code | 项目编号 | PRJ001 |
| description | 费用描述 | 北京出差交通费 |
| attachment_requirements | 附件要求（分号分隔） | 发票;付款凭证 |

### 示例 CSV 文件

```csv
expense_id,invoice_number,amount,date,expense_type,project_code,description,attachment_requirements
EXP001,INV202601010001,500.00,2026-01-15,差旅费,PRJ001,北京出差交通费,发票;付款凭证
EXP002,INV202601010002,3500.00,2026-02-20,办公费,PRJ001,采购办公设备,发票
EXP003,INV202601010003,15000.00,2025-11-01,服务费,PRJ002,技术咨询服务费,发票;合同;验收单
```

### 支持的日期格式

工具支持多种日期格式的自动解析：

- `YYYY-MM-DD` - 2026-01-15
- `YYYY/MM/DD` - 2026/01/15
- `YYYY.MM.DD` - 2026.01.15
- `DD-MM-YYYY` - 15-01-2026
- `DD/MM/YYYY` - 15/01/2026
- `YYYYMMDD` - 20260115

### 支持的编码格式

- UTF-8（推荐，带或不带 BOM）
- GBK（中文 Windows 常用编码）

## 附件文件命名规范

为了让工具能够正确识别附件与报销记录的对应关系，建议遵循以下命名规范：

### 推荐命名格式

```
[类型]_[发票号].[扩展名]
```

**示例：**
- `发票_INV202601010001.pdf`
- `付款_INV202601010001.png`
- `合同_HT2026001.pdf`
- `验收单_YS2026001.pdf`

### 支持的文件类型

工具会自动扫描以下类型的文件：

| 类别 | 扩展名 |
|------|--------|
| 文档 | `.pdf`, `.doc`, `.docx`, `.txt` |
| 图片 | `.jpg`, `.jpeg`, `.png`, `.gif`, `.bmp`, `.tiff` |
| 表格 | `.xls`, `.xlsx`, `.csv` |
| 演示 | `.ppt`, `.pptx` |
| 数据 | `.json` |

**注意：** 
- 隐藏文件（以 `.` 开头的文件）会被忽略
- 不支持的扩展名会被跳过

### Sidecar 元数据文件

对于无法通过命名规范识别的文件，你可以创建一个 sidecar JSON 元数据文件。

**命名方式：**
- 方式一：同目录同名，后缀 `.json`，如 `特殊文件.pdf.json`
- 方式二：放在 `.meta` 子目录中，如 `.meta/特殊文件.pdf.json`

**元数据格式：**
```json
{
  "invoice_number": "INV202601010001",
  "expense_id": "EXP001",
  "description": "这是一个特殊的发票文件"
}
```

工具会优先读取 sidecar 元数据中的信息。

## 校验规则详解

### 1. 缺少附件检测 (missing_attachment)

**检测逻辑：**
- 遍历 CSV 中的每条报销记录
- 根据发票号查找对应的附件文件
- 如果没有找到任何匹配的附件，触发此错误

**匹配方式：**
- 文件名中包含完整的发票号
- 或通过 sidecar 元数据指定发票号

**示例错误：**
```
❌ 缺少附件: 发票号 INV202601019999 未找到对应的附件文件
```

### 2. 重复发票号检测 (duplicate_invoice)

**检测逻辑：**
- 统计所有报销记录中的发票号出现次数
- 如果同一张发票号出现 2 次或以上，触发此错误

**为什么重要：**
- 防止同一张发票被重复报销
- 检测数据录入错误

**示例错误：**
```
❌ 发票号重复: INV202601010002，出现在 2 条记录中
```

### 3. 无效费用类型检测 (invalid_expense_type)

**检测逻辑：**
- 检查每条记录的 `expense_type` 字段
- 如果不在 `allowed_expense_types` 列表中，触发此错误

**为什么重要：**
- 确保费用类型符合公司规定
- 防止拼写错误（如"差旅飞"应为"差旅费"）

**示例错误：**
```
❌ 费用类型不合法: '未知类型'，不在允许列表中
```

### 4. 单笔金额超限检测 (amount_exceed_limit)

**检测逻辑：**
- 检查每条记录的 `amount` 字段
- 如果超过 `max_single_amount` 配置值，触发此警告

**为什么重要：**
- 提醒检查大额支出
- 符合公司审批流程

**示例警告：**
```
⚠️ 单笔金额超限: 15000.0 元，超过上限 10000.0 元
```

### 5. 日期超期检测 (date_expired)

**检测逻辑：**
- 计算发票日期到当前日期的天数
- 如果超过 `reimbursement_days` 配置值，触发此警告

**为什么重要：**
- 确保报销及时性
- 符合财务做账周期

**示例警告：**
```
⚠️ 发票日期超期: 2025-11-01，距今天 183 天，超过允许的 90 天
```

### 6. 必需附件检测 (missing_contract / missing_acceptance)

**检测逻辑：**
- 根据 `expense_type` 确定需要哪些附件
- 检查是否存在对应的附件文件

**当前支持的必需附件检测：**
- 合同：文件名包含"合同"、"contract"、"ht_"
- 验收单：文件名包含"验收"、"acceptance"、"ys_"

**配置示例：**
```yaml
required_attachment_types:
  服务费: ["发票", "合同", "验收单"]  # 服务费需要这三样
  差旅费: ["发票", "出差审批单"]      # 差旅费需要发票和审批单
```

**示例错误：**
```
❌ 缺少合同: 费用类型 '服务费' 需要合同附件
❌ 缺少验收单: 费用类型 '服务费' 需要验收单附件
```

### 7. 文件名不规范检测 (invalid_filename)

**检测逻辑：**
- 检查附件文件名是否匹配 `filename_patterns` 中的任一模式
- 同时检查是否能提取出发票号
- 如果都不满足，触发此警告

**为什么重要：**
- 保持文件命名一致性
- 便于后续查找和归档

**示例警告：**
```
⚠️ 文件名不规范: 'random_file.jpg' 未识别出发票号或报销单号
```

## 报告格式说明

### JSON 报告格式

JSON 报告包含完整的结构化数据，适合程序处理。

**结构概览：**
```json
{
  "summary": {
    "checked_at": "2026-05-03T15:30:00",
    "package_path": "/path/to/expense-package",
    "total_expenses": 5,
    "total_attachments": 8,
    "total_amount": 21800.0,
    "error_count": 3,
    "warning_count": 2,
    "has_errors": true
  },
  "errors": [...],
  "warnings": [...],
  "issues": [...],
  "expenses": [...],
  "attachments": [...]
}
```

**Issue 对象结构：**
```json
{
  "issue_type": "missing_attachment",
  "severity": "error",
  "message": "缺少附件: 发票号 INV202601019999 未找到对应的附件文件",
  "reference": "EXP005",
  "details": {
    "expense_id": "EXP005",
    "invoice_number": "INV202601019999",
    "amount": 800.0,
    "line_number": 6
  }
}
```

### Markdown 报告格式

Markdown 报告是人类可读的格式，适合直接查看或分享。

报告包含以下章节：
1. **检查结果概览** - 状态图标和基本信息
2. **错误列表** - 表格形式的错误汇总
3. **警告列表** - 表格形式的警告汇总
4. **报销明细** - 所有报销记录的表格
5. **附件列表** - 所有附件文件的表格
6. **详细问题说明** - 每个问题的详细信息，包括 JSON 格式的详情

## 扩展开发指南

### 如何添加新的校验规则

1. **在 `models.py` 中添加新的问题类型**

```python
class IssueType(Enum):
    # 现有类型...
    MY_NEW_RULE = "my_new_rule"  # 添加新类型
```

2. **在 `config.py` 中添加规则配置**

```python
@staticmethod
def _get_default_rules() -> dict[str, RuleConfig]:
    return {
        # 现有规则...
        "my_new_rule": RuleConfig(enabled=True, severity=Severity.WARNING),
    }
```

3. **在 `validator.py` 中实现校验逻辑**

```python
class Validator:
    def validate(self, ...):
        # 现有规则检查...
        if self.config.is_rule_enabled("my_new_rule"):
            issues.extend(self._check_my_new_rule(expenses, attachments))
        # ...
    
    def _check_my_new_rule(self, expenses, attachments):
        issues = []
        # 实现你的校验逻辑
        for expense in expenses:
            if 某种条件:
                severity = self.config.get_rule_severity("my_new_rule")
                issues.append(Issue(
                    issue_type=IssueType.MY_NEW_RULE,
                    severity=severity,
                    message="你的错误消息",
                    reference=expense.expense_id,
                    details={"key": "value"},
                ))
        return issues
```

4. **（可选）在配置文件示例中添加说明**

更新 `config.py` 中的 `generate_sample_config()` 函数，添加新规则的配置示例。

### 如何修改现有规则的严重程度

有两种方式：

**方式一：通过配置文件（推荐）**

在 `expense-checker.yaml` 中：
```yaml
rules:
  # 将日期超期从警告改为错误
  date_expired:
    enabled: true
    severity: error
```

**方式二：修改代码默认值**

在 `config.py` 的 `_get_default_rules()` 方法中修改。

### 如何添加新的附件类型检测

在 `validator.py` 的 `_check_required_attachments` 方法中扩展：

```python
if required_type == "合同":
    # 现有逻辑...
elif required_type == "验收单":
    # 现有逻辑...
elif required_type == "你的新类型":
    # 添加新的检测逻辑
    if "新类型关键词" in att.filename:
        has_required = True
```

然后在配置文件中使用：
```yaml
required_attachment_types:
  新费用类型: ["发票", "你的新类型"]
```

## 常见问题

### Q1: CSV 文件解析失败怎么办？

**可能原因：**
1. 文件编码问题
2. 缺少必需字段
3. 金额格式错误

**解决方法：**
1. 确保 CSV 保存为 UTF-8 编码（推荐带 BOM 或不带都可以）
2. 检查是否包含所有必需字段：`expense_id`, `invoice_number`, `amount`, `expense_type`
3. 确保金额是纯数字，可以包含逗号作为千位分隔符

### Q2: 附件文件为什么没被识别？

**可能原因：**
1. 文件名中没有包含发票号
2. 文件扩展名不支持
3. 文件是隐藏文件

**解决方法：**
1. 按照命名规范重命名文件：`发票_<发票号>.pdf`
2. 检查文件扩展名是否在支持列表中
3. 确保文件名不是以 `.` 开头
4. 或者创建 sidecar 元数据文件

### Q3: 如何忽略某些规则？

在配置文件中禁用特定规则：

```yaml
rules:
  # 禁用文件名规范检查
  invalid_filename:
    enabled: false
```

### Q4: 工具支持网络路径吗？

当前版本是本地工具，只支持本地文件系统路径。如果需要检查网络共享，建议先将文件复制到本地。

### Q5: 检查退出码是什么意思？

- `0` - 检查通过（没有错误，可能有警告）
- `1` - 检查失败（存在错误）
- `2` - 命令行参数错误

在脚本中使用时，可以通过退出码判断检查结果：

```bash
if expense-checker check ./my-package; then
    echo "检查通过，可以提交"
else
    echo "检查失败，请修复问题"
fi
```

## 版本历史

### 0.1.0 (2026-05-03)

- 初始版本发布
- 实现基础的 CSV 解析和文件扫描
- 实现 9 项校验规则
- 支持 JSON 和 Markdown 报告导出
- 支持 YAML 配置文件
- 提供示例数据生成功能

## 许可证

本工具仅供内部使用。

## 贡献

欢迎提交 Issue 和 Pull Request 来改进这个工具。

---

**提示：** 如果你在使用过程中遇到问题，请先：
1. 检查 CSV 格式是否正确
2. 确认附件命名是否规范
3. 查看详细的错误信息
4. 参考本文档的"常见问题"部分
