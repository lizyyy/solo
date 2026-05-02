# 电子回单归档核验员

小公司财务出纳自动化工具，用于月底核对网银回单 PDF、ERP 付款导出、发票清单和供应商台账。

## 功能特性

- **扫描目录**: 自动扫描目录中的所有文件，计算哈希值，检测重复文件
- **解析回单**: 支持工行、农行、建行、中行等多家银行的网银回单 PDF 解析
- **导入清单**: 支持 ERP 付款 CSV、发票清单 JSON/CSV、供应商台账 CSV/Excel
- **规则校验**:
  - 付款金额校验（ERP vs 回单 vs 发票）
  - 账号尾号校验（ERP vs 供应商台账）
  - 发票号校验（ERP vs 发票清单）
  - 日期窗口校验
  - 重复回单检测（基于文件哈希）
  - 缺失凭证检测
- **智能归档**: 按供应商和月份自动组织文件，生成归档清单
- **审计报告**: 导出 Markdown、CSV、JSON 三种格式的审计报告

## 安装

### 环境要求

- Python 3.8+
- pip 包管理器

### 安装步骤

```bash
# 创建虚拟环境
python3 -m venv .venv

# 激活虚拟环境
# macOS/Linux:
source .venv/bin/activate
# Windows:
# .venv\Scripts\activate

# 安装依赖
pip install click pypdf pandas python-dateutil tqdm pytest
```

## 快速开始

### 1. 创建示例数据目录

```bash
# 创建测试目录结构
python -m receipt_verifier.cli demo /tmp/my_finance_data
```

这将创建以下目录结构：

```
/tmp/my_finance_data/
├── 回单/              # 放入网银回单 PDF
├── 清单/
│   ├── erp_payments.csv      # ERP 付款记录示例
│   ├── invoices.json         # 发票清单示例
│   └── suppliers.csv         # 供应商台账示例
├── 归档/              # archive 命令输出目录
├── 报告/              # report 命令输出目录
└── README.txt
```

### 2. 准备真实数据

将你的真实数据放入对应目录：

- **回单/**: 放入从网银下载的回单 PDF 文件
- **清单/erp_payments.csv**: 从 ERP 系统导出的付款记录 CSV
- **清单/invoices.json** 或 **invoices.csv**: 发票清单
- **清单/suppliers.csv**: 供应商台账

### 3. 执行完整流程

```bash
cd /Users/mac/pro/solocoder/pro/xy4176/repo/xy4176
source .venv/bin/activate

# 步骤 1: 扫描回单目录（可选，用于查看文件统计）
python -m receipt_verifier.cli scan /tmp/my_finance_data/回单 --show-stats

# 步骤 2: 执行校验
python -m receipt_verifier.cli check \
    --receipts-dir /tmp/my_finance_data/回单 \
    --erp /tmp/my_finance_data/清单/erp_payments.csv \
    --invoice /tmp/my_finance_data/清单/invoices.json \
    --supplier /tmp/my_finance_data/清单/suppliers.csv \
    --show-details \
    -o /tmp/my_finance_data/报告/verification.json

# 步骤 3: 归档合格文件（校验通过的文件）
python -m receipt_verifier.cli archive \
    /tmp/my_finance_data/回单 \
    /tmp/my_finance_data/归档 \
    --erp /tmp/my_finance_data/清单/erp_payments.csv \
    --invoice /tmp/my_finance_data/清单/invoices.json \
    --supplier /tmp/my_finance_data/清单/suppliers.csv

# 步骤 4: 生成审计报告
python -m receipt_verifier.cli report \
    --erp /tmp/my_finance_data/清单/erp_payments.csv \
    --receipts-dir /tmp/my_finance_data/回单 \
    --invoice /tmp/my_finance_data/清单/invoices.json \
    --supplier /tmp/my_finance_data/清单/suppliers.csv \
    -o /tmp/my_finance_data/报告
```

## 命令详解

### scan - 扫描目录

扫描指定目录，计算文件哈希值，检测重复文件。

```bash
# 基本扫描
python -m receipt_verifier.cli scan /path/to/directory

# 显示统计信息
python -m receipt_verifier.cli scan /path/to/directory --show-stats

# 保存结果到 JSON
python -m receipt_verifier.cli scan /path/to/directory -o scan_result.json

# 指定哈希算法
python -m receipt_verifier.cli scan /path/to/directory --hash-algo md5

# 不递归扫描子目录
python -m receipt_verifier.cli scan /path/to/directory --no-recursive
```

### import-list - 导入清单

导入三类清单数据并解析。

```bash
# 导入 ERP 付款记录
python -m receipt_verifier.cli import-list --erp erp_payments.csv

# 导入发票清单
python -m receipt_verifier.cli import-list --invoice invoices.json

# 导入供应商台账
python -m receipt_verifier.cli import-list --supplier suppliers.csv

# 同时导入多个清单并保存结果
python -m receipt_verifier.cli import-list \
    --erp erp_payments.csv \
    --invoice invoices.json \
    --supplier suppliers.csv \
    -o output_directory/
```

### check - 执行校验

执行所有校验规则，检查数据一致性。

```bash
# 完整校验
python -m receipt_verifier.cli check \
    --receipts-dir 回单/ \
    --erp 清单/erp_payments.csv \
    --invoice 清单/invoices.json \
    --supplier 清单/suppliers.csv

# 显示详细校验结果
python -m receipt_verifier.cli check ... --show-details

# 指定账期范围
python -m receipt_verifier.cli check ... \
    --period-start 2024-01-01 \
    --period-end 2024-01-31

# 保存校验结果
python -m receipt_verifier.cli check ... -o results.json
```

### archive - 归档文件

按供应商和月份组织合格文件，生成归档清单。

```bash
# 基本归档（仅校验通过的文件）
python -m receipt_verifier.cli archive 回单/ 归档/ --erp erp_payments.csv

# 归档所有文件（包括校验失败的）
python -m receipt_verifier.cli archive 回单/ 归档/ --erp erp_payments.csv --all

# 仅生成清单，不实际复制文件
python -m receipt_verifier.cli archive 回单/ 归档/ --erp erp_payments.csv --no-copy

# 完整归档
python -m receipt_verifier.cli archive 回单/ 归档/ \
    --erp erp_payments.csv \
    --invoice invoices.json \
    --supplier suppliers.csv
```

### report - 生成报告

导出 Markdown、CSV、JSON 三种格式的审计报告。

```bash
# 生成报告
python -m receipt_verifier.cli report \
    --erp erp_payments.csv \
    --receipts-dir 回单/ \
    --invoice invoices.json \
    --supplier suppliers.csv \
    -o 报告/

# 指定报告文件名前缀
python -m receipt_verifier.cli report ... \
    --base-name 2024年1月审计报告

# 指定账期
python -m receipt_verifier.cli report ... \
    --period-start 2024-01-01 \
    --period-end 2024-01-31
```

### demo - 创建示例数据

创建示例数据目录结构，用于测试和演示。

```bash
# 创建示例数据目录
python -m receipt_verifier.cli demo /tmp/test_data

# 强制覆盖已存在的目录
python -m receipt_verifier.cli demo /tmp/test_data --force
```

## 数据格式说明

### ERP 付款记录 CSV

```csv
付款单号,收款单位,收款账号,金额,付款日期,发票号,供应商编码,备注
PAY001,北京科技有限公司,6222021234567890123,50000.00,2024-01-15,INV202401001,SUP001,办公用品采购
PAY002,上海贸易公司,6222021234567890456,30000.00,2024-01-18,INV202401002,SUP002,原材料采购
```

字段说明：
- `付款单号`: 唯一标识
- `收款单位`: 供应商名称
- `收款账号`: 银行账号（用于尾号校验）
- `金额`: 付款金额
- `付款日期`: 付款日期
- `发票号`: 关联的发票号
- `供应商编码`: 供应商编码（关联台账）
- `备注`: 备注信息

### 发票清单 JSON

```json
[
    {
        "发票号": "INV202401001",
        "开票日期": "2024-01-10",
        "金额": 47169.81,
        "税额": 2830.19,
        "价税合计": 50000.00,
        "供应商": "北京科技有限公司",
        "货物名称": "办公用品"
    }
]
```

也支持 CSV 格式。

### 供应商台账 CSV

```csv
供应商编码,供应商名称,银行账号,开户银行,税号,联系人,联系电话,地址
SUP001,北京科技有限公司,6222021234567890123,中国工商银行北京分行,91110000MA001ABC12,张三,13800138001,北京市朝阳区xxx
```

也支持 Excel 格式（.xlsx, .xls）。

## 支持的银行回单

### 已支持银行

- **中国工商银行 (ICBC)**
- **中国农业银行 (ABC)**
- **中国建设银行 (CCB)**
- **中国银行 (BOC)**

### 通用解析器

对于其他银行的回单，使用通用解析器尝试解析。支持以下关键字：

- 付款人/付款方/转出方/汇出方
- 收款人/收款方/转入方/汇入方
- 金额/付款金额/转账金额
- 交易日期/付款日期/转账日期
- 交易流水号/流水号/凭证号
- 摘要/备注/用途/附言

## 校验规则说明

### 1. 金额校验 (AmountVerificationRule)

- 校验 ERP 付款金额与回单金额是否一致
- 校验 ERP 付款金额与发票金额是否一致
- 默认容差：0.01 元

### 2. 账号尾号校验 (AccountTailVerificationRule)

- 校验 ERP 中的收款账号尾号与供应商台账中的账号尾号是否一致
- 默认尾号长度：4 位

### 3. 发票号校验 (InvoiceNumberVerificationRule)

- 校验 ERP 中的发票号是否在发票清单中存在
- 校验发票清单中的发票号是否都在 ERP 中存在

### 4. 日期窗口校验 (DateWindowVerificationRule)

- 校验回单日期和付款日期是否在指定的账期范围内
- 自动检测数据中的最小和最大日期

### 5. 重复回单校验 (DuplicateReceiptVerificationRule)

- 基于文件哈希值检测重复回单
- 防止同一笔付款被重复归档

### 6. 缺失凭证校验 (MissingDocumentVerificationRule)

- 检测 ERP 付款记录是否缺少对应的银行回单
- 检测 ERP 付款记录是否缺少对应的发票

## 归档目录结构

归档后的目录结构示例：

```
归档/
├── MANIFEST_ARCHIVE_20260502123456_abc123.json    # 归档清单
├── 北京科技有限公司/
│   └── 2024年01月/
│       └── 回单文件_50000.00.pdf
├── 上海贸易公司/
│   └── 2024年01月/
│       └── 回单文件_30000.00.pdf
└── 未知供应商/
    └── 未知日期/
        └── 无法识别的回单.pdf
```

### 归档清单 (MANIFEST_*.json)

包含以下信息：
- 归档 ID 和时间
- 源目录和目标目录
- 文件统计（总数、有效数、无效数）
- 校验摘要
- 每个文件的详细信息（源路径、目标路径、哈希、金额、供应商等）

## 报告格式

### Markdown 报告

包含以下章节：
1. 统计概览表格
2. 重复回单警告（如存在）
3. 缺失凭证列表
4. 金额不匹配列表
5. 详细校验结果（每条付款记录）

### CSV 报告

每行对应一条付款记录，包含：
- 付款单号、收款单位、ERP 金额、回单金额
- 发票号、供应商
- 整体状态
- 所有校验规则的结果

### JSON 报告

完整的结构化数据，包含：
- 报告元数据（ID、生成时间、账期）
- 统计信息（总记录数、通过数、失败数、警告数）
- 重复回单详情
- 缺失凭证详情
- 金额不匹配详情
- 每条付款记录的完整校验信息

## 常见问题

### Q1: 回单解析不准确怎么办？

A: 不同银行的回单格式差异较大。如果解析不准确，可以：
1. 检查回单 PDF 是否包含可提取的文本（有些扫描版 PDF 无法提取文本）
2. 手动验证关键字段（金额、账号、名称）
3. 如需支持新银行，可以提交 Issue 或 PR

### Q2: 如何处理扫描版 PDF 回单？

A: 当前版本仅支持文本型 PDF。扫描版 PDF 需要 OCR 识别才能提取文本。建议：
1. 从网银重新下载文本版 PDF
2. 或使用 OCR 工具预处理后再使用

### Q3: 文件被改名后如何追踪？

A: 系统使用文件哈希值作为唯一标识：
1. 扫描时计算每个文件的 SHA256 哈希
2. 重复回单检测基于哈希值
3. 归档清单中记录源文件和目标文件的哈希
4. 即使文件名改变，只要内容相同，哈希值不变

### Q4: 支持哪些字符编码？

A: CSV 文件解析时会自动尝试以下编码：
- UTF-8
- GBK / GB2312 / GB18030
- UTF-8-SIG (带 BOM)
- Latin-1

### Q5: 如何添加自定义校验规则？

A: 可以继承 `BaseVerificationRule` 类实现自定义规则：

```python
from receipt_verifier.validator import BaseVerificationRule, VerificationContext, VerificationResult, VerificationStatus

class MyCustomRule(BaseVerificationRule):
    rule_name = "my_custom_rule"
    severity = "warning"
    
    def verify(self, context: VerificationContext) -> List[VerificationResult]:
        results = []
        # 实现自定义校验逻辑
        return results
```

## 开发指南

### 运行测试

```bash
# 运行所有测试
python -m pytest tests/ -v

# 运行覆盖率测试
python -m pytest tests/ -v --cov=receipt_verifier
```

### 项目结构

```
xy4176/
├── receipt_verifier/          # 主包
│   ├── __init__.py
│   ├── models.py              # 数据模型定义
│   ├── utils.py               # 工具函数
│   ├── scanner.py             # 文件扫描模块
│   ├── pdf_parser.py          # PDF 回单解析
│   ├── list_parser.py         # 清单解析
│   ├── validator.py           # 规则校验
│   ├── archiver.py            # 归档事务
│   ├── reporter.py            # 报告生成
│   └── cli.py                 # 命令行入口
├── tests/                     # 测试目录
│   ├── __init__.py
│   └── test_utils.py
├── pyproject.toml             # 项目配置
├── .gitignore
└── README.md
```

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 PR！

## 更新日志

### v0.1.0 (2026-05-02)

- 初始版本发布
- 实现文件扫描和哈希计算
- 实现四大行回单解析（工行、农行、建行、中行）
- 实现清单解析（ERP付款、发票清单、供应商台账）
- 实现6项校验规则
- 实现智能归档（按供应商和月份）
- 实现报告导出（Markdown、CSV、JSON）
- 实现完整 CLI 命令行工具
