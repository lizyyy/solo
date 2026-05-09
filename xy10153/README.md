# voucher-fixer

账套凭证断号修复 CLI。

解决场景：会计导出凭证后发现**编号断档**、**重复**和**冲销关系混在一起**。

重点能力：

| 能力 | 说明 |
|------|------|
| 凭证解析 | 支持多文件、多日期格式、幂等导入（防重复）、借贷平衡校验 |
| 断号检测 | 按凭证字分组检测缺失编号，显示前后凭证上下文和来源行号 |
| 重复检测 | 按凭证字+编号识别重复，列出所有来源位置 |
| 冲销配对 | 基于摘要关键词、金额符号、科目完全匹配自动配对，显示置信度和日期差 |
| 修复建议 | 为每类问题生成带风险等级的修复动作，区分可自动/需人工 |
| dry-run | 默认 dry-run 只分析不修改，--apply 留作后续扩展 |
| 审计日志 | 记录每步操作、源文件哈希、来源行号，导出 CSV/JSON |
| 报告 | HTML 交互式报告（可展开详情）+ JSON 机器可读报告 |

## 安装

```bash
cd /Users/mac/pro/solo/workspaces/xy10153
pip install -e .
```

## 验收命令

### 1. 安装依赖并验证包

```bash
pip install -r requirements.txt
pip install -e .
voucher-fixer --help
voucher-fixer analyze --help
voucher-fixer validate --help
```

### 2. 验证「干净数据」文件（应无错误）

```bash
voucher-fixer validate examples/clean_vouchers.csv
```

预期输出：凭证数 5，借贷平衡 5/5，解析警告 0。

### 3. 分析「问题数据」文件（dry-run，重点验收）

```bash
rm -rf audit_logs reports
mkdir -p reports

voucher-fixer analyze \
  examples/problematic_vouchers.csv \
  --html reports/problem_report.html \
  --json reports/problem_report.json \
  --dry-run \
  --verbose
```

**预期检测到的问题（你应该在输出和报告中看到）：**

| 问题类型 | 凭证字 | 详情 |
|----------|--------|------|
| 断号 | 付 | 付字 1-2 之后跳到 4，缺失 **3** |
| 断号 | 转 | 转字 5 之后跳到 7，缺失 **6** |
| 重复 | 转 | 转字 **2** 出现 2 次（同一文件内重复录入） |
| 冲销配对 | 转 | 转字 3（暂估入库） ↔ 转字 4（冲销暂估入库） |
| 未配对冲销 | 转 | 转字 5（销售退回）—— 原凭证在付字 2，因凭证字不同未自动配对 |

### 4. 验证导入幂等性（同文件跑两次应无新数据）

```bash
voucher-fixer analyze examples/problematic_vouchers.csv
# 再次运行同一命令，应在 parse_warnings 中看到"已导入过，跳过"
voucher-fixer analyze examples/problematic_vouchers.csv
```

### 5. 强制重新导入（用于测试）

```bash
voucher-fixer analyze examples/problematic_vouchers.csv --allow-reimport
```

### 6. 查看 HTML 报告

```bash
open reports/problem_report.html
```

报告中应包含：
- 数据概览（凭证数、源文件）
- 断号详情（含前后凭证来源行号）
- 重复详情（含所有来源行号）
- 冲销配对详情（置信度、匹配方式、日期差）
- 修复建议（风险等级、可自动/需人工）
- 审计日志（时间戳、操作、状态、文件哈希）

### 7. 多文件合并分析

```bash
voucher-fixer analyze \
  examples/clean_vouchers.csv \
  examples/problematic_vouchers.csv \
  --html reports/combined.html
```

## 项目结构

```
voucher-fixer/
├── pyproject.toml           # 项目配置与 CLI 入口
├── requirements.txt
├── README.md
├── examples/
│   ├── clean_vouchers.csv        # 干净数据（验收用）
│   └── problematic_vouchers.csv  # 含断号/重复/冲销（验收用）
└── src/voucher_fixer/
    ├── __init__.py
    ├── cli.py                     # CLI 主入口：analyze / validate
    ├── models/
    │   └── voucher.py             # Voucher / VoucherBatch 数据模型
    ├── parser/
    │   └── csv_parser.py          # CSV 解析 + 幂等 + 借贷平衡
    ├── analyzer/
    │   ├── gap_detector.py        # 断号检测
    │   ├── duplicate_detector.py  # 重复检测
    │   └── reverse_matcher.py     # 冲销配对
    ├── fixer/
    │   ├── repair.py              # 修复建议生成
    │   └── audit_log.py           # 审计日志
    └── reporter/
        └── html_reporter.py       # HTML 报告生成
```

## 数据格式要求

CSV 需包含以下列（中文/英文均可）：

| 必需列 | 别名示例 | 说明 |
|--------|----------|------|
| 日期 | date, voucher_date | 支持 2024-01-01 / 2024/01/01 / 2024年1月1日 等 |
| 凭证字 | voucher_type | 收/付/转/记 |
| 凭证号 | voucher_no, voucher_number | 如 "1"、"001" |
| 摘要 | description, summary | 用于冲销关键词匹配 |
| 科目编码 | account_code | |
| 科目名称 | account_name | |
| 借方 | debit | 正数；红冲用负数 |
| 贷方 | credit | 正数；红冲用负数 |

一个凭证可由多行分录组成，只有第一行需填日期/凭证字/凭证号。

## 设计说明

### 导入可重复
`VoucherCSVParser` 内部维护 `imported_hashes`，基于 `文件路径:行号:排序后的行内容` 生成 MD5。同一 CLI 实例内重复解析同一文件会跳过并产生警告。

### 校验要说清原因
所有 `ParseError` / 分析问题都包含：
- `source_file` + `line_number`：可定位到源文件行
- `field`：出错字段
- `message`：人类可读的原因

### 报告要能反查来源
HTML / JSON 报告中的每个问题都附带 `source_reference`，格式为 `文件:行号 | 文件:行号`，可直接溯源。

### dry-run
`analyze` 命令默认 `--dry-run`。当前版本只做分析和报告，不修改原始文件。`--apply` 会进入「修复模式」（当前提示暂不支持自动修改），便于后续扩展。

## 退出码

| 命令 | 退出码 0 | 退出码 1 |
|------|----------|----------|
| `validate` | 至少有一个文件解析成功 | 所有文件解析失败 |
| `analyze` | 分析完成（即使有问题） | 解析阶段即失败 |

## 测试场景对应

| 场景 | 对应数据行 |
|------|------------|
| 断号（付字缺 3） | 付字 2 之后是付字 4 |
| 断号（转字缺 6） | 转字 5 之后是转字 7 |
| 重复（转字 2） | 转字 2 出现两次（计提折旧分录重复） |
| 已配对冲销（置信度 100%） | 转字 3（暂估入库）↔ 转字 4（冲销，负金额，科目完全一致） |
| 未配对冲销 | 转字 5（销售退回）原凭证在付字 2，凭证字不同，无法自动配对 |

运行第 3 步验收命令后，打开 `reports/problem_report.html` 逐项核对即可。
