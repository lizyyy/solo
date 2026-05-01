# 诉讼材料递交包预检器

法务助理本地自动化工具，用于开庭前检查诉讼材料包的完整性和规范性。

## 功能特性

- **init**: 初始化项目配置
- **scan**: 扫描材料目录并生成 manifest
- **check**: 校验证据目录 CSV 与文件编号、必备材料、签名页标记、重复哈希、页数范围和命名规则，问题写入 quarantine.json
- **pack**: 只复制通过项到递交目录并生成提交清单
- **report**: 导出 Markdown 和 CSV 预检报告

## 校验规则

| 规则类型 | 说明 | 严重程度 |
|---------|------|---------|
| 必备材料检查 | 检查起诉状、授权委托书、证据目录、证据材料、送达地址确认书是否齐全 | 错误 |
| 证据编号连续性 | 检查证据编号是否跳号 | 错误 |
| 证据编号重复 | 检查证据编号是否重复 | 错误 |
| 清单文件匹配 | 检查证据目录与实际文件是否匹配 | 错误 |
| 重复哈希检测 | 检测内容相同的重复文件 | 警告 |
| 页数范围检查 | 检查文件页数是否在合理范围内 | 警告 |
| 命名规则检查 | 检查文件名是否符合规范 | 警告 |
| 签名页标记 | 检查需要签名的文件是否已标记 | 警告 |

## 安装

```bash
# 克隆或下载项目后，进入项目目录
cd xy4063

# 以可编辑模式安装
pip install -e .

# 可选：安装 PDF 页数识别依赖
pip install PyPDF2
```

## 快速开始

### 1. 初始化项目

```bash
litcheck init "张三诉李四借款纠纷案" \
    --case-number "(2024)京民初字第123号" \
    --court "北京市朝阳区人民法院"
```

这会在当前目录生成 `litcheck_config.json` 配置文件。

### 2. 准备材料目录

创建材料目录结构如下：

```
案件材料/
├── 起诉状.pdf
├── 授权委托书.pdf
├── 送达地址确认书.pdf
├── 证据目录.csv
├── 证据01-借款合同.pdf
├── 证据02-转账凭证.pdf
├── 证据03-催款记录.pdf
└── 证据04-证人证言.pdf
```

**证据目录 CSV 格式示例：**

```csv
证据编号,证据名称,证据类型,页数,证据来源,证明内容,文件名
1,借款合同,书证,2,原告提供,证明原被告之间存在借款合同关系,证据01-借款合同.pdf
2,转账凭证,书证,1,银行提供,证明原告已向被告支付借款,证据02-转账凭证.pdf
3,催款记录,书证,3,原告提供,证明原告已向被告催讨借款,证据03-催款记录.pdf
4,证人证言,证人证言,2,证人提供,证明借款事实存在,证据04-证人证言.pdf
```

### 3. 扫描材料目录

```bash
litcheck scan 案件材料/
```

这会生成 `manifest.json` 文件清单。

### 4. 执行预检

```bash
litcheck check 案件材料/
```

这会：
- 解析证据目录 CSV
- 执行所有校验规则
- 生成 `quarantine.json` 问题报告

### 5. 查看预检报告

```bash
litcheck report 预检报告/
```

这会生成：
- `预检报告.md` - Markdown 格式报告
- `预检报告.csv` - CSV 格式报告

### 6. 打包递交材料

```bash
# 只有预检通过才能打包
litcheck pack 案件材料/

# 或强制打包（即使有错误）
litcheck pack 案件材料/ --force
```

这会：
- 创建 `递交包/` 目录
- 只复制通过预检的文件
- 生成 `提交清单.csv`

## 临时目录验证全流程

以下是一个完整的测试流程，您可以复制执行来验证工具功能：

### 步骤 1：创建临时测试目录

```bash
# 创建临时目录
mkdir -p /tmp/litcheck_test/案件材料
cd /tmp/litcheck_test
```

### 步骤 2：初始化项目

```bash
litcheck init "测试案件" --case-number "(2024)测试字第001号"
```

### 步骤 3：创建测试材料

创建一些模拟的测试文件：

```bash
cd /tmp/litcheck_test/案件材料

# 创建必备材料文件（内容不重要，主要测试文件名识别）
echo "起诉状内容" > 起诉状.pdf
echo "授权委托书内容" > 授权委托书.pdf
echo "送达地址确认书内容" > 送达地址确认书.pdf

# 创建证据文件
echo "借款合同内容" > "证据01-借款合同.pdf"
echo "转账凭证内容" > "证据02-转账凭证.pdf"
echo "催款记录内容" > "证据03-催款记录.pdf"
echo "证人证言内容" > "证据04-证人证言.pdf"

# 创建证据目录 CSV
cat > 证据目录.csv << 'EOF'
证据编号,证据名称,证据类型,页数,证据来源,证明内容,文件名
1,借款合同,书证,2,原告提供,证明原被告之间存在借款合同关系,证据01-借款合同.pdf
2,转账凭证,书证,1,银行提供,证明原告已向被告支付借款,证据02-转账凭证.pdf
3,催款记录,书证,3,原告提供,证明原告已向被告催讨借款,证据03-催款记录.pdf
4,证人证言,证人证言,2,证人提供,证明借款事实存在,证据04-证人证言.pdf
EOF
```

### 步骤 4：扫描材料

```bash
cd /tmp/litcheck_test
litcheck scan 案件材料/
```

查看生成的 manifest：

```bash
cat manifest.json
```

### 步骤 5：执行预检

```bash
litcheck check 案件材料/
```

查看问题报告：

```bash
cat quarantine.json
```

### 步骤 6：生成预检报告

```bash
litcheck report 预检报告/
```

查看报告：

```bash
cat 预检报告/预检报告.md
```

### 步骤 7：打包递交材料

```bash
litcheck pack 案件材料/
```

查看打包结果：

```bash
ls -la 递交包/
cat 递交包/提交清单.csv
```

### 步骤 8：测试有问题的场景

现在让我们创建一些有问题的材料来测试校验功能：

```bash
cd /tmp
rm -rf litcheck_test_problem
mkdir -p litcheck_test_problem/案件材料
cd litcheck_test_problem/案件材料

# 缺少必备材料：不创建起诉状
# echo "起诉状内容" > 起诉状.pdf  <- 故意不创建

# 创建其他材料
echo "授权委托书内容" > 授权委托书.pdf
echo "送达地址确认书内容" > 送达地址确认书.pdf

# 证据编号跳号（缺少 2 号）
echo "借款合同内容" > "证据01-借款合同.pdf"
# echo "转账凭证内容" > "证据02-转账凭证.pdf"  <- 故意不创建
echo "催款记录内容" > "证据03-催款记录.pdf"
echo "证人证言内容" > "证据04-证人证言.pdf"

# 证据编号重复（两个 3 号）
echo "重复证据内容" > "证据03-重复.pdf"

# 创建有问题的证据目录 CSV
cat > 证据目录.csv << 'EOF'
证据编号,证据名称,证据类型,页数,证据来源,证明内容,文件名
1,借款合同,书证,2,原告提供,证明原被告之间存在借款合同关系,证据01-借款合同.pdf
2,转账凭证,书证,1,银行提供,证明原告已向被告支付借款,证据02-转账凭证.pdf
3,催款记录,书证,3,原告提供,证明原告已向被告催讨借款,证据03-催款记录.pdf
3,重复证据,书证,1,原告提供,测试重复编号,证据03-重复.pdf
4,证人证言,证人证言,2,证人提供,证明借款事实存在,证据04-证人证言.pdf
EOF

# 初始化
cd /tmp/litcheck_test_problem
litcheck init "有问题的测试案件"
```

执行预检，应该会发现问题：

```bash
litcheck scan 案件材料/
litcheck check 案件材料/
```

查看发现的问题：

```bash
cat quarantine.json
```

## 文件命名规范

### 必备材料命名

| 材料类型 | 命名规范 | 示例 |
|---------|---------|------|
| 起诉状 | `起诉状*.pdf` | `起诉状.pdf`, `起诉状_原告张三.pdf` |
| 授权委托书 | `授权委托书*.pdf` | `授权委托书.pdf`, `授权委托书_张三.pdf` |
| 证据目录 | `证据目录*.csv` 或 `证据目录*.xlsx` | `证据目录.csv` |
| 送达地址确认书 | `送达地址确认书*.pdf` | `送达地址确认书.pdf` |

### 证据文件命名

**推荐格式：** `证据{编号}{可选分隔符}{描述}.{扩展名}`

- `证据01-借款合同.pdf`
- `证据2_转账凭证.jpg`
- `证据123_证人证言.pdf`

**支持的扩展名：** `.pdf`, `.jpg`, `.jpeg`, `.png`

### 签名页标记

需要签名的文件建议在文件名中添加标记：

- `起诉状_签名.pdf`
- `授权委托书_已签名.pdf`

## 配置文件说明

`litcheck_config.json` 包含以下配置项：

### material_types（材料类型定义）

每种材料类型可配置：
- `name`: 显示名称
- `code`: 类型代码
- `required`: 是否必备
- `naming_pattern`: 文件名匹配正则
- `min_pages`/`max_pages`: 页数范围
- `requires_signature`: 是否需要签名

### check_rules（校验规则开关）

```json
{
  "check_duplicate_hash": true,
  "check_page_range": true,
  "check_evidence_sequence": true,
  "check_naming_convention": true,
  "check_signature_pages": true,
  "check_required_materials": true,
  "check_csv_file_match": true,
  "max_pages_per_file": 100
}
```

### evidence_csv_columns（CSV 列名映射）

如果您的证据目录 CSV 使用不同的列名，可以修改此配置：

```json
{
  "evidence_number": "证据编号",
  "evidence_name": "证据名称",
  "evidence_type": "证据类型",
  "page_count": "页数",
  "source": "证据来源",
  "proof_content": "证明内容",
  "file_name": "文件名"
}
```

## 输出文件说明

| 文件名 | 说明 |
|-------|------|
| `manifest.json` | 扫描生成的文件清单，包含所有文件的哈希、页数、类型等信息 |
| `quarantine.json` | 预检问题报告，包含所有发现的问题、通过/未通过文件列表 |
| `预检报告.md` | Markdown 格式的预检报告，便于阅读 |
| `预检报告.csv` | CSV 格式的预检报告，便于导入表格处理 |
| `递交包/` | 打包后的材料目录 |
| `递交包/提交清单.csv` | 提交清单，包含所有打包文件的列表 |

## 运行测试

```bash
# 安装测试依赖
pip install pytest

# 运行所有测试
pytest litigation_precheck/tests/ -v

# 运行特定模块测试
pytest litigation_precheck/tests/test_config.py -v
pytest litigation_precheck/tests/test_scanner.py -v
pytest litigation_precheck/tests/test_csv_validator.py -v
pytest litigation_precheck/tests/test_rules.py -v
```

## 项目结构

```
xy4063/
├── pyproject.toml              # 项目配置
├── litigation_precheck/
│   ├── __init__.py
│   ├── cli.py                  # CLI 入口
│   ├── config.py               # 配置模型
│   ├── scanner.py              # 文件扫描模块
│   ├── csv_validator.py        # CSV 校验模块
│   ├── rules.py                # 规则引擎
│   ├── packer.py               # 打包模块
│   ├── reporter.py             # 报告生成模块
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── test_config.py
│   │   ├── test_scanner.py
│   │   ├── test_csv_validator.py
│   │   └── test_rules.py
│   └── examples/
│       ├── __init__.py
│       ├── 证据目录.csv
│       └── 证据目录_有问题.csv
└── README.md
```

## 常见问题

### Q: 为什么 PDF 页数显示为 null？

A: 需要安装 PyPDF2 库才能识别 PDF 页数：

```bash
pip install PyPDF2
```

### Q: 如何忽略某些文件？

A: 修改配置文件中的 `scan_config.ignore_patterns`，支持：
- 精确匹配：如 `.DS_Store`
- 前缀匹配：如 `~$*`（以 ~$ 开头的文件）
- 后缀匹配：如 `*.tmp`（以 .tmp 结尾的文件）

### Q: 强制打包会复制所有文件吗？

A: 不会。`--force` 选项只会忽略**错误级别**的问题，仍然只会复制通过**警告级别**检查的文件。

### Q: 证据目录 CSV 支持什么编码？

A: 支持 UTF-8（带 BOM 或不带）和 GBK 编码，程序会自动检测。

## License

MIT License
