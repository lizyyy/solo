# 卷宗脱敏装订员

给律师助理用的本地证据材料脱敏归档工具。

## 功能特性

- **scan** - 扫描目录并生成文件清单，计算哈希值用于去重和溯源
- **redact** - 智能识别身份证号、手机号、地址、邮箱、银行卡号等敏感信息并脱敏，支持保留词排除
- **check** - 校验目录页码连续性、重复哈希、缺签名页和保留词误伤风险
- **review** - 保存人工复核确认记录，支持状态追踪
- **export** - 导出装订目录、Markdown风险报告和JSON审计包

## 项目结构

```
juanzong-redactor/
├── src/
│   └── juanzong_redactor/
│       ├── __init__.py
│       ├── cli/                    # 命令行接口
│       │   ├── __init__.py
│       │   └── main.py             # 主CLI入口
│       ├── file_parser/            # 文件解析模块
│       │   ├── __init__.py
│       │   ├── scanner.py          # 目录扫描、哈希计算
│       │   ├── pdf_parser.py       # PDF解析
│       │   ├── image_parser.py     # 图片解析
│       │   └── csv_parser.py       # CSV解析
│       ├── redaction_rules/        # 脱敏规则模块
│       │   ├── __init__.py
│       │   ├── rules.py            # 规则定义和掩码函数
│       │   └── redactor.py         # 核心脱敏处理器
│       ├── validation/             # 目录校验模块
│       │   ├── __init__.py
│       │   └── validator.py        # 校验器实现
│       ├── review_storage/         # 复核存储模块
│       │   ├── __init__.py
│       │   └── storage.py          # 存储实现
│       └── export/                 # 导出模块
│           ├── __init__.py
│           └── exporter.py         # 导出实现
├── examples/                        # 示例数据
│   ├── parties_info.csv            # 当事人信息表示例
│   ├── material_catalog.csv        # 材料目录示例
│   └── sensitive_text.txt          # 敏感信息测试文本
├── tests/                           # 测试文件
│   ├── __init__.py
│   ├── test_redaction_rules.py
│   ├── test_file_parser.py
│   └── test_validation.py
├── pyproject.toml                   # 项目配置
└── README.md
```

## 安装

### 依赖要求

- Python 3.8+
- 依赖包：click, pypdf, Pillow, python-dateutil, pandas, pytest

### 安装步骤

```bash
# 克隆或下载项目
cd xy4135

# 安装项目（开发模式）
pip install -e .

# 或安装依赖
pip install click pypdf Pillow python-dateutil pandas
```

## 使用方法

### 1. 扫描目录 (scan)

扫描目录生成文件清单，包括文件元数据和哈希值。

```bash
# 基本扫描
juanzong scan /path/to/evidence

# 递归扫描子目录
juanzong scan -r /path/to/evidence

# 只扫描特定类型文件
juanzong scan -i pdf -i jpg -i png /path/to/evidence

# 输出到指定目录
juanzong scan -o /output/dir /path/to/evidence

# 详细输出
juanzong scan -v /path/to/evidence
```

**输出文件：**
- `file_scan.json` - 完整的扫描结果

### 2. 脱敏处理 (redact)

识别并脱敏文件中的敏感信息。

```bash
# 基本脱敏处理
juanzong redact /path/to/file.txt

# 指定输出文件
juanzong redact -o /output/redacted.txt /path/to/file.txt

# 只使用特定脱敏规则
juanzong redact -r id_card -r phone /path/to/file.txt

# 指定保留词（不脱敏这些内容）
juanzong redact -p "案件编号" -p "法院" /path/to/file.txt

# 详细输出脱敏详情
juanzong redact -v /path/to/file.csv
```

**支持的脱敏规则：**
- `id_card` - 身份证号（18位和15位）
- `phone` - 手机号（中国大陆）
- `email` - 邮箱地址
- `bank_card` - 银行卡号
- `address` - 地址信息
- `name` - 中文姓名

**脱敏策略：**
- 身份证号：保留前6位和后4位（如：110101********1234）
- 手机号：保留前3位和后4位（如：138****5678）
- 邮箱：隐藏用户名中间部分（如：te****er@example.com）
- 银行卡号：保留前4位和后4位

**输出文件：**
- `redaction_audit.json` - 脱敏审计日志
- 脱敏后的文件（如：`redacted_original.txt`）

### 3. 校验检查 (check)

校验目录页码、重复哈希、缺签名页和保留词误伤。

```bash
# 基本校验
juanzong check file_scan.json

# 与材料目录比对
juanzong check -c material_catalog.csv file_scan.json

# 只执行特定检查
juanzong check -k page -k hash file_scan.json

# 详细输出问题列表
juanzong check -v file_scan.json
```

**检查项目：**
- `page` - 页码检查（连续性、重复性、目录比对）
- `hash` - 哈希重复检查（检测重复文件）
- `signature` - 签名页检查（检测合同类文件是否缺签名）
- `preserve` - 保留词误伤检查

**输出文件：**
- `validation_report.json` - 校验报告

### 4. 复核记录 (review)

保存人工复核确认记录。

```bash
# 保存复核通过
juanzong review item_001 -s approved -n "确认无误" -r "张三"

# 保存复核拒绝
juanzong review item_002 -s rejected -n "缺少第5页" -r "李四"

# 保存待复核
juanzong review item_003 -s pending
```

**状态选项：**
- `approved` - 已通过
- `rejected` - 已拒绝
- `pending` - 待复核

### 5. 导出归档 (export)

导出装订目录、Markdown风险报告和JSON审计包。

```bash
# 导出全部格式
juanzong export -s file_scan.json

# 导出特定格式
juanzong export -s file_scan.json -f catalog -f report

# 包含校验报告导出
juanzong export -s file_scan.json -v validation_report.json

# 包含脱敏日志导出
juanzong export -s file_scan.json -r redaction_audit.json

# 包含复核记录导出
juanzong export -s file_scan.json -l review_log.json

# 完整导出
juanzong export \
  -s file_scan.json \
  -v validation_report.json \
  -r redaction_audit.json \
  -l review_log.json
```

**导出格式：**
- `catalog` - 装订目录（Markdown格式）
- `report` - 风险报告（Markdown格式）
- `audit` - 审计包（JSON格式）

**输出文件：**
- `binding_catalog.md` - 装订目录
- `risk_report.md` - 风险评估报告
- `audit_package.json` - 完整审计数据包

## 临时目录验证流程

### 1. 准备测试数据

```bash
# 创建临时测试目录
mkdir -p /tmp/test_evidence

# 复制示例文件
cp examples/sensitive_text.txt /tmp/test_evidence/
cp examples/parties_info.csv /tmp/test_evidence/

# 创建一些测试文件
echo "这是第1页，原告：张三，身份证号：110101199001011234" > /tmp/test_evidence/page_01.txt
echo "这是第2页，被告：李四，电话：13987654321" > /tmp/test_evidence/page_02.txt
echo "这是第3页，证据清单" > /tmp/test_evidence/page_03.txt
# 故意跳过第4页，测试页码检查
echo "这是第5页，借款合同" > /tmp/test_evidence/page_05.txt
# 创建重复文件
cp /tmp/test_evidence/page_01.txt /tmp/test_evidence/page_01_copy.txt
```

### 2. 执行完整流程

```bash
# 步骤1：扫描目录
cd /tmp
juanzong scan test_evidence -v

# 查看扫描结果
cat file_scan.json

# 步骤2：脱敏处理
juanzong redact test_evidence/sensitive_text.txt -v
juanzong redact test_evidence/parties_info.csv -v

# 查看脱敏审计日志
cat redaction_audit.json

# 步骤3：执行校验
juanzong check file_scan.json -v

# 查看校验报告（应该发现页码缺失和重复文件）
cat validation_report.json

# 步骤4：记录复核
juanzong review "page_01.txt" -s approved -n "脱敏正确" -r "测试人员"
juanzong review "page_05.txt" -s pending -n "待检查页码" -r "测试人员"

# 步骤5：导出归档
juanzong export \
  -s file_scan.json \
  -v validation_report.json \
  -r redaction_audit.json \
  -v

# 查看导出结果
ls -la *.md *.json
cat risk_report.md
```

### 3. 预期结果

**扫描阶段：**
- 发现 7 个文件
- 生成包含文件名、大小、哈希值的完整清单

**脱敏阶段：**
- `sensitive_text.txt`：发现身份证号、手机号、邮箱、银行卡号等敏感信息
- `parties_info.csv`：身份证号列和手机列被脱敏
- 生成 `redaction_audit.json` 审计日志

**校验阶段：**
- 发现页码缺失（第4页缺失）
- 发现重复文件（`page_01.txt` 和 `page_01_copy.txt` 哈希相同）
- 可能发现借款合同文件缺签名页警告

**导出阶段：**
- `binding_catalog.md`：完整的文件装订目录
- `risk_report.md`：包含问题列表和处理建议的风险报告
- `audit_package.json`：完整的审计数据包

## 完整工作流示例

```bash
#!/bin/bash

# 卷宗脱敏装订员 - 完整工作流示例

# 设置工作目录
WORK_DIR="/tmp/case_2024_001"
mkdir -p $WORK_DIR/evidence

# 1. 准备证据材料
# ... 将证据文件放入 $WORK_DIR/evidence

# 2. 扫描目录
cd $WORK_DIR
juanzong scan -r -v evidence

# 3. 批量脱敏（示例：处理CSV文件）
for csv_file in evidence/*.csv; do
    juanzong redact -p "案件编号" -p "法院" "$csv_file"
done

# 4. 执行校验
juanzong check -c material_catalog.csv file_scan.json -v

# 5. 人工复核（根据校验报告）
juanzong review "证据_第001页.pdf" -s approved -n "确认无误"
juanzong review "证据_第005页.pdf" -s rejected -n "发现未脱敏身份证号"

# 6. 导出归档
juanzong export \
  -s file_scan.json \
  -v validation_report.json \
  -r redaction_audit.json \
  -l review_log.json

# 7. 生成最终归档包
tar -czf case_2024_001_archive.tar.gz \
  binding_catalog.md \
  risk_report.md \
  audit_package.json \
  redacted_*.txt \
  redacted_*.csv

echo "归档完成：case_2024_001_archive.tar.gz"
```

## 测试

运行测试套件：

```bash
# 安装测试依赖
pip install pytest pytest-cov

# 运行所有测试
pytest tests/ -v

# 运行特定测试
pytest tests/test_redaction_rules.py -v

# 覆盖率测试
pytest tests/ --cov=juanzong_redactor -v
```

## 注意事项

1. **PDF处理**：当前版本支持提取PDF文本并分析，脱敏后输出为文本文件。完整的PDF视觉脱敏需要额外的库支持。

2. **图片处理**：图片敏感信息识别依赖OCR技术，当前版本主要检查文件名和简单的视觉特征。

3. **数据安全**：所有处理均在本地执行，不会上传任何数据到外部服务器。

4. **保留词功能**：使用保留词时需谨慎，避免将真正需要脱敏的信息误加入保留词列表。

5. **审计日志**：所有操作均记录审计日志，请定期备份这些重要文件。

## 许可证

本项目仅供学习和内部使用。

## 贡献

欢迎提交问题和改进建议。
