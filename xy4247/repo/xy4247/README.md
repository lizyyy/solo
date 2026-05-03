# 庭审笔录证据编号校验员

一个给法院书记员使用的本地 CLI 工具，用于校验庭审笔录中的证据引用问题。

## 功能特性

- **证据编号漏引检测**：检测证据目录中存在但未在庭审转写、举证质证记录或裁判要点中引用的证据
- **重复/冲突引用检测**：检测同一证据被不同说法引用或描述存在矛盾的情况
- **日期矛盾检测**：检测同一事件的日期描述不一致的问题
- **未处理异议检测**：检测举证质证中的异议未在裁判要点中处理的问题

## 命令概览

| 命令 | 功能 | 说明 |
|------|------|------|
| `init` | 生成样例数据 | 创建四类样例文件用于测试 |
| `import` | 导入解析文件 | 解析庭审笔录、证据目录、举证质证记录、裁判要点 |
| `check` | 执行校验规则 | 运行四类校验规则，发现问题 |
| `report` | 导出校验报告 | 导出 Markdown 复核单、CSV 问题表、JSON 审计包 |

## 安装

### 环境要求

- Python 3.8+
- pip

### 安装步骤

```bash
# 克隆或下载项目
cd xy4247

# 安装依赖
pip install -r requirements.txt

# 安装项目（开发模式）
pip install -e .
```

### 验证安装

```bash
evidence-checker --help
evidence-checker --version
```

## 快速开始

### 方式一：使用样例数据（推荐）

```bash
# 1. 生成样例数据
evidence-checker init ./case-data

# 2. 查看生成的文件
ls ./case-data

# 3. 导入文件
evidence-checker import \
    --transcript ./case-data/庭审笔录.md \
    --evidence ./case-data/证据目录.csv \
    --cross-exam ./case-data/举证质证记录.json \
    --judgment ./case-data/裁判要点草稿.md

# 4. 执行校验
evidence-checker check

# 5. 导出报告
evidence-checker report --markdown --csv --json
```

### 方式二：使用真实数据

准备以下四类文件：

#### 1. 庭审笔录（Markdown 格式）

```markdown
# (2026)京民初字第123号 - 庭审笔录

## 二、法庭调查

### 2.1 原告诉称

原告代理人陈述：原被告于2025年3月15日签订《货物买卖合同》（证据1），原告已按约交付货物（证据2）。

**证据引用**:
- 第1号证据：货物买卖合同
- 第2号证据：送货单
```

#### 2. 证据目录（CSV 格式）

```csv
证据编号,证据名称,证据类型,提交人,提交日期,描述,状态,页数,别名
1,货物买卖合同,书证,原告,2025-03-15,原被告签订的货物买卖合同,已采信,5,合同,买卖合同
2,送货单,书证,原告,2025-03-18,证明原告已交付货物的送货单,已采信,2,收货单,交付凭证
3,质量检验报告,书证,被告,2025-03-25,检验报告,待确认,8,检验报告
```

#### 3. 举证质证记录（JSON 格式）

```json
{
  "case_number": "(2026)京民初字第123号",
  "case_name": "李四诉赵六买卖合同纠纷案",
  "hearing_date": "2026-04-15",
  "cross_examinations": [
    {
      "entry_id": "exam_001",
      "evidence_number": "1",
      "evidence_description": "货物买卖合同",
      "presenter": "原告代理人",
      "cross_examiner": "被告代理人",
      "timestamp": "2026-04-15T09:30:00",
      "presentation": "出示证据1：货物买卖合同",
      "cross_examination": "对关联性有异议",
      "objections": [
        {
          "objection_id": "obj_001",
          "type": "relevance",
          "raised_by": "被告代理人",
          "raised_at": "2026-04-15T09:35:00",
          "description": "对关联性提出异议",
          "status": "pending",
          "ruling": null
        }
      ]
    }
  ]
}
```

#### 4. 裁判要点草稿（Markdown 格式）

```markdown
# 民事判决书（草稿）

## 事实认定

原被告于2025年3月15日签订《货物买卖合同》（**证据1**）。
原告已按约交付货物（**证据2**）。

## 裁判要点

根据**证据1**和**证据2**，本院认定...
```

## 详细命令说明

### init 命令

生成样例数据文件。

```bash
evidence-checker init [OPTIONS] OUTPUT_DIR
```

**参数说明：**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `OUTPUT_DIR` | 路径 | 是 | 样例文件输出目录 |
| `--prefix, -p` | 字符串 | 否 | 文件名前缀 |
| `--force, -f` | 标志 | 否 | 强制覆盖已存在的文件 |

**使用示例：**

```bash
# 基本用法
evidence-checker init ./case-data

# 带前缀
evidence-checker init ./case-data --prefix "张三诉李四-"

# 强制覆盖
evidence-checker init ./case-data --force
```

### import 命令

导入和解析四类文件。

```bash
evidence-checker import [OPTIONS]
```

**参数说明：**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `--transcript, -t` | 文件路径 | 否 | 庭审笔录 Markdown 文件 |
| `--evidence, -e` | 文件路径 | 否 | 证据目录 CSV 文件 |
| `--cross-exam, -x` | 文件路径 | 否 | 举证质证记录 JSON 文件 |
| `--judgment, -j` | 文件路径 | 否 | 裁判要点草稿 Markdown 文件 |
| `--session-dir, -s` | 路径 | 否 | 会话存储目录（默认：./.evidence-checker） |
| `--session-name, -n` | 字符串 | 否 | 会话名称 |

**使用示例：**

```bash
# 导入所有文件
evidence-checker import \
    --transcript 庭审笔录.md \
    --evidence 证据目录.csv \
    --cross-exam 举证质证记录.json \
    --judgment 裁判要点草稿.md

# 只导入证据目录
evidence-checker import --evidence 证据目录.csv

# 自定义会话目录
evidence-checker import --evidence 证据目录.csv --session-dir ./my-sessions
```

### check 命令

执行证据引用校验。

```bash
evidence-checker check [OPTIONS]
```

**参数说明：**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `--session-dir, -s` | 路径 | 否 | 会话存储目录 |
| `--session-id, -i` | 字符串 | 否 | 会话 ID（不指定则使用最新会话） |
| `--rules, -r` | 字符串 | 否 | 指定要执行的规则（可多次指定） |
| `--all, -a` | 标志 | 否 | 执行所有规则（默认） |

**可用规则：**

| 规则名称 | 说明 | 严重程度 |
|----------|------|----------|
| `missing_reference` | 证据编号漏引 | 高危 |
| `duplicate_reference` | 重复引用（同一证据不同编号） | 中危 |
| `conflicting_reference` | 冲突引用（描述矛盾） | 高危 |
| `date_conflict` | 日期矛盾 | 中危 |
| `unhandled_objection` | 未处理异议 | 高危 |

**使用示例：**

```bash
# 执行所有规则
evidence-checker check

# 只执行漏引和日期检查
evidence-checker check --rules missing_reference --rules date_conflict

# 使用指定会话
evidence-checker check --session-id session_20260415_143000
```

### report 命令

导出校验报告。

```bash
evidence-checker report [OPTIONS]
```

**参数说明：**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `--output-dir, -o` | 路径 | 否 | 报告输出目录（默认：./reports） |
| `--session-dir, -s` | 路径 | 否 | 会话存储目录 |
| `--session-id, -i` | 字符串 | 否 | 会话 ID |
| `--markdown, -m` | 标志 | 否 | 导出 Markdown 复核单 |
| `--csv, -c` | 标志 | 否 | 导出 CSV 问题表 |
| `--json, -j` | 标志 | 否 | 导出 JSON 审计包 |
| `--all, -a` | 标志 | 否 | 导出所有格式（默认） |
| `--prefix, -p` | 字符串 | 否 | 输出文件名前缀 |

**使用示例：**

```bash
# 导出所有格式
evidence-checker report

# 只导出 Markdown 和 CSV
evidence-checker report --markdown --csv

# 自定义输出目录和前缀
evidence-checker report -o ./my-reports -p "张三诉李四-"
```

## 输出文件说明

### Markdown 复核单

文件名：`证据校验复核单.md`

包含以下内容：
- 案件基本信息
- 校验摘要（问题统计）
- 问题详情列表（按严重程度排序）
- 证据引用统计
- 时间线分析
- 复核建议

### CSV 问题表

文件名：`证据校验问题表.csv`

包含以下列：
- `问题编号`：唯一标识符
- `严重程度`：高危/中危/低危
- `规则类型`：漏引/重复引用/冲突引用/日期矛盾/未处理异议
- `问题描述`：详细说明
- `涉及证据`：相关证据编号
- `处理建议`：修复建议
- `发现时间`：校验时间

### JSON 审计包

文件名：`证据校验审计包.json`

包含完整的审计信息：
- `session_id`：会话 ID
- `created_at`：会话创建时间
- `evidence_catalog`：完整证据目录
- `references`：所有证据引用
- `objections`：所有异议记录
- `check_result`：校验结果
- `statistics`：统计信息

## 校验规则详解

### 1. 证据编号漏引检测

**检测逻辑：**
- 遍历证据目录中的所有证据编号
- 检查每个证据编号是否在以下位置被引用：
  - 庭审笔录（Markdown）
  - 举证质证记录（JSON）
  - 裁判要点草稿（Markdown）
- 未被引用的证据标记为"漏引"

**触发条件：**
- 证据目录中存在某证据
- 该证据未在任何引用中出现

**严重程度：** 高危

**处理建议：**
1. 检查庭审笔录是否完整
2. 确认证据是否确实在庭审中出示
3. 检查裁判要点是否遗漏了重要证据

---

### 2. 重复引用检测

**检测逻辑：**
- 分析所有证据引用
- 检查是否存在以下情况：
  - 同一证据被不同编号引用（如"证据1"和"证01"）
  - 同一证据使用了非标准别名

**触发条件：**
- 不同的证据编号指向同一证据
- 证据编号格式不规范

**严重程度：** 中危

**处理建议：**
1. 统一证据编号格式
2. 在证据目录中规范别名定义
3. 检查庭审笔录中的表述一致性

---

### 3. 冲突引用检测

**检测逻辑：**
- 分析同一证据的所有引用
- 检查描述是否存在矛盾：
  - 证据名称不一致
  - 证明内容矛盾
  - 提交人不同

**触发条件：**
- 同一证据的描述存在实质性差异

**严重程度：** 高危

**处理建议：**
1. 核实证据的真实情况
2. 统一各文档中的证据描述
3. 检查是否存在笔误

---

### 4. 日期矛盾检测

**检测逻辑：**
- 从所有引用中提取日期信息
- 比对同一事件的日期描述：
  - 证据形成日期
  - 提交日期
  - 庭审中陈述的日期

**触发条件：**
- 同一事件的日期描述不一致
- 日期顺序存在逻辑问题

**严重程度：** 中危

**处理建议：**
1. 核实原始证据的日期
2. 检查庭审笔录的记录准确性
3. 修正裁判要点中的日期错误

---

### 5. 未处理异议检测

**检测逻辑：**
- 收集举证质证记录中的所有异议
- 检查每个异议的状态：
  - 是否已被合议庭裁定
  - 是否已在裁判要点中回应

**触发条件：**
- 异议状态为"pending"
- 裁判要点中未提及该异议

**严重程度：** 高危

**处理建议：**
1. 检查庭审笔录中是否有合议庭裁定
2. 确认裁判要点是否遗漏了异议处理
3. 补充或修正裁判要点

## 项目结构

```
court_evidence_checker/
├── __init__.py              # 包初始化
├── cli.py                   # CLI 主程序
├── models/                  # 数据模型
│   ├── __init__.py
│   ├── base.py              # 基础模型
│   ├── evidence.py          # 证据模型
│   ├── reference.py         # 引用模型
│   ├── objection.py         # 异议模型
│   ├── timeline.py          # 时间线模型
│   └── rule_result.py       # 规则结果模型
├── parsers/                 # 解析器
│   ├── __init__.py
│   ├── base.py              # 解析器基类
│   ├── csv_parser.py        # 证据目录 CSV 解析
│   ├── markdown_parser.py   # 庭审笔录 Markdown 解析
│   ├── json_parser.py       # 举证质证 JSON 解析
│   └── judgment_parser.py   # 裁判要点解析
├── rules/                   # 规则引擎
│   ├── __init__.py
│   ├── base.py              # 规则基类
│   ├── missing_reference.py # 漏引检测规则
│   ├── conflicting_reference.py # 冲突引用规则
│   ├── date_conflict.py     # 日期矛盾规则
│   └── unhandled_objection.py # 未处理异议规则
├── timeline/                # 时间线分析
│   ├── __init__.py
│   └── analyzer.py          # 时间线分析器
├── storage/                 # 存储管理
│   ├── __init__.py
│   └── session.py           # 会话管理
├── exporters/               # 报告导出
│   ├── __init__.py
│   ├── markdown_exporter.py # Markdown 导出
│   ├── csv_exporter.py      # CSV 导出
│   └── json_exporter.py     # JSON 导出
├── sample_data/             # 样例数据
│   ├── __init__.py
│   └── generator.py         # 样例数据生成器
└── tests/                   # 测试用例
    ├── conftest.py          # pytest fixtures
    ├── test_parsers.py      # 解析器测试
    ├── test_rules.py        # 规则测试
    └── test_exporters.py    # 导出器测试
```

## 运行测试

```bash
# 运行所有测试
pytest -v

# 运行特定测试文件
pytest tests/test_parsers.py -v

# 运行带覆盖率的测试
pytest --cov=court_evidence_checker --cov-report=html
```

## 验证流程

### 完整验证流程

```bash
# 步骤 1：安装项目
pip install -e .

# 步骤 2：验证安装
evidence-checker --version
evidence-checker --help

# 步骤 3：生成样例数据
evidence-checker init ./test-case

# 步骤 4：导入文件
evidence-checker import \
    --transcript ./test-case/庭审笔录.md \
    --evidence ./test-case/证据目录.csv \
    --cross-exam ./test-case/举证质证记录.json \
    --judgment ./test-case/裁判要点草稿.md

# 步骤 5：执行校验
evidence-checker check

# 步骤 6：导出报告
evidence-checker report -o ./test-reports

# 步骤 7：查看报告
ls ./test-reports
cat ./test-reports/证据校验复核单.md

# 步骤 8：运行单元测试
pytest -v
```

### 预期结果

1. **init 命令**：生成 4 个样例文件
2. **import 命令**：解析成功，显示解析统计
3. **check 命令**：执行 5 条规则，可能发现问题
4. **report 命令**：生成 3 个报告文件
5. **pytest**：所有测试通过

## 常见问题

### Q: 如何处理证据编号格式不统一的问题？

**A:** 证据目录中支持"别名"字段，可以将不同的编号格式映射到同一证据。例如：

```csv
证据编号,证据名称,...,别名
1,货物买卖合同,...,合同,买卖合同,证1
```

### Q: 日期解析支持哪些格式？

**A:** 支持以下日期格式：
- `2025年3月15日`
- `2025-03-15`
- `2025/03/15`
- `2025.03.15`

### Q: 如何添加自定义校验规则？

**A:** 可以继承 `BaseRule` 类实现自定义规则：

```python
from court_evidence_checker.rules import BaseRule, RuleContext
from court_evidence_checker.models import RuleResult, RuleType, Severity

class MyCustomRule(BaseRule):
    rule_type = RuleType.OTHER
    name = "自定义规则"
    description = "我的自定义校验规则"
    
    def check(self, context: RuleContext) -> List[RuleResult]:
        results = []
        # 实现自定义校验逻辑
        return results
```

## 技术栈

- **Python 3.8+**：核心开发语言
- **Click**：CLI 框架
- **Rich**：终端美化输出
- **python-dateutil**：日期解析
- **pytest**：测试框架
- **pytest-cov**：覆盖率测试

## 更新日志

### v0.1.0 (2026-04-15)

- 初始版本发布
- 实现四类文件解析
- 实现五类校验规则
- 实现三种报告导出格式
- 提供完整的测试用例

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 联系方式

如有问题或建议，请通过以下方式联系：
- 提交 GitHub Issue
- 发送邮件至项目维护者

---

**注意：** 本工具仅供辅助校验使用，最终法律文书的准确性仍需人工审核确认。
