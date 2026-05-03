# 票据篡改线索筛查器 (Claim Risk Scanner)

一款为保险理赔质检员设计的本地 AI/ML 工具，用于检测发票篡改、商户异常和重复报销等风险。

## 功能特性

- **数据解析**: 支持导入拍照 OCR 出来的发票 JSON、理赔申请 CSV 和历史商户风险样本
- **风险检测**: 规则引擎 + 轻量可解释机器学习模型混合评分
- **检测维度**:
  - 同一票据被改金额
  - 商户异常（风险样本匹配、名称变体、税号不一致）
  - 多单重复报销
  - 金额凑整特征
  - OCR 置信度异常
  - 明细金额与合计不符
  - 税率比例异常

- **工作流**: 支持训练/评估/预测，保存复核结果
- **报告导出**:
  - Markdown 质检报告
  - CSV 风险清单
  - JSON 审计包

## 项目结构

```
claim-risk-scanner/
├── pyproject.toml           # 项目配置
├── README.md                # 本文档
├── src/
│   └── claim_risk_scanner/
│       ├── __init__.py
│       ├── cli/             # CLI 命令行接口
│       │   ├── __init__.py
│       │   └── main.py
│       ├── data_parser/     # 数据解析模块
│       │   ├── __init__.py
│       │   └── parser.py
│       ├── features/        # 特征工程模块
│       │   ├── __init__.py
│       │   └── extractor.py
│       ├── rules/           # 规则引擎模块
│       │   ├── __init__.py
│       │   └── engine.py
│       ├── model/           # 模型训练模块
│       │   ├── __init__.py
│       │   └── trainer.py
│       ├── storage/         # 存储模块 (SQLite)
│       │   ├── __init__.py
│       │   └── repository.py
│       ├── export/          # 导出模块
│       │   ├── __init__.py
│       │   └── exporter.py
│       └── examples/        # 示例数据生成
│           ├── __init__.py
│           └── generator.py
├── tests/                    # 测试用例
│   ├── __init__.py
│   └── test_data_parser.py
├── data/                     # 数据目录 (运行时生成)
├── models/                   # 模型目录 (训练后生成)
├── examples/                 # 示例数据目录 (生成后)
└── output/                   # 输出目录 (导出后)
```

## 安装

### 环境要求

- Python >= 3.9
- pip

### 安装步骤

```bash
# 进入项目目录
cd xy4280

# 安装依赖
pip install -e .

# 或者使用开发模式（包含测试依赖）
pip install -e ".[dev]"
```

## 快速开始

### 1. 生成示例数据

```bash
# 生成示例数据（发票、理赔单、风险样本）
crs examples

# 自定义数量
crs examples -i 30 -c 20 -r 15
```

### 2. 导入数据

```bash
# 导入发票 JSON
crs import examples/invoices.json --type invoice

# 导入理赔 CSV
crs import examples/claims.csv --type claim

# 导入风险样本
crs import examples/risk_samples.csv --type risk_sample
```

### 3. 执行风险扫描

```bash
# 执行风险扫描（规则引擎）
crs scan

# 使用自定义阈值
crs scan --threshold 0.6

# 同时使用已训练的模型（如果有）
crs scan --model-path ./models/model_20240101_000000
```

### 4. 查看扫描结果

```bash
# 查看所有复核记录
crs list

# 筛选高风险
crs list --risk-level high

# 筛选待复核
crs list --status pending

# 筛选最低分数
crs list --min-score 0.5
```

### 5. 更新复核状态

```bash
# 标记为已确认
crs review INV2024000001 --status confirmed --notes "经核实为正常票据" --reviewer "质检员A"

# 标记为已驳回
crs review INV2024000002 --status dismissed --notes "经查实为重复报销"

# 标记为升级处理
crs review INV2024000003 --status escalated
```

### 6. 导出报告

```bash
# 导出所有格式的报告
crs export -o ./output

# 自定义报告名称
crs export -o ./output --name 2024年1月质检报告

# 包含原始数据
crs export -o ./output --include-raw
```

### 7. 训练模型（可选）

```bash
# 使用默认配置训练
crs train

# 使用 LightGBM 模型
crs train --model-type lightgbm

# 自定义测试集比例和交叉验证折数
crs train --test-size 0.3 --cv-folds 5

# 指定输出目录
crs train -o ./my_models
```

### 8. 查看统计信息

```bash
# 查看系统统计
crs stats
```

## 预置规则说明

系统内置了 15 条风险检测规则：

| 规则ID | 规则名称 | 风险等级 | 说明 |
|--------|----------|----------|------|
| R001 | 精确重复发票 | HIGH | 同一发票号码出现多次 |
| R002 | 发票金额不一致 | CRITICAL | 同一发票号码但金额不同 |
| R003 | 高风险商户匹配 | HIGH | 商户名称与历史风险样本匹配 |
| R004 | 金额异常 | MEDIUM | 金额偏离整体分布 |
| R005 | 金额凑整 | MEDIUM | 金额呈现明显凑整特征（如 1000、5000、888 等） |
| R006 | 明细金额与合计不符 | HIGH | 发票条目金额合计与总金额不一致 |
| R007 | OCR低置信度 | MEDIUM | OCR识别置信度过低，可能存在篡改 |
| R008 | 税率比例异常 | LOW | 税额比例不符合常见税率（6%、9%、13%等） |
| R009 | 日期异常 | MEDIUM | 发票日期为未来或过期太久（超过2年） |
| R010 | 商户频繁出现 | LOW | 同一商户短期内频繁出现（超过5次） |
| R011 | 商户名称变体 | MEDIUM | 同一商户存在多种名称变体 |
| R012 | 税号不一致 | HIGH | 同一商户使用不同税号 |
| R013 | 部分重复发票 | MEDIUM | 存在内容高度相似的其他发票 |
| R014 | 多理赔单关联 | HIGH | 同一发票关联多份理赔申请 |
| R015 | 日期不一致 | HIGH | 同一发票号码但日期不同 |

## 风险等级说明

| 等级 | 图标 | 分数范围 | 说明 |
|------|------|----------|------|
| 极高风险 | 🔴 | ≥ 90% | 存在明确的篡改证据或严重违规，需立即处理 |
| 高风险 | 🟠 | 70% - 89% | 存在多项风险特征，需重点复核 |
| 中风险 | 🟡 | 40% - 69% | 存在可疑特征，建议进一步检查 |
| 低风险 | 🟢 | < 40% | 无明显风险特征，可正常处理 |

## 复核状态说明

| 状态 | 图标 | 说明 |
|------|------|------|
| 待复核 | ⏳ | 初始状态，等待质检员处理 |
| 复核中 | 🔍 | 质检员正在核实中 |
| 已确认 | ✅ | 经核实为正常票据 |
| 已驳回 | ❌ | 经查实为异常票据，不予理赔 |
| 已升级 | ⚠️ | 需要更高级别审核或进一步调查 |

## 数据格式说明

### 发票 JSON 格式

```json
[
  {
    "invoice_number": "INV2024000001",
    "invoice_date": "2024-01-15",
    "vendor_name": "北京康泰医药有限公司",
    "vendor_tax_id": "91110106MA007Y7K8T",
    "total_amount": 1500.0,
    "tax_amount": 90.0,
    "ocr_confidence": 95.5,
    "buyer_name": "张三",
    "buyer_tax_id": "",
    "items": [
      {
        "item_name": "阿莫西林胶囊",
        "quantity": 3,
        "unit_price": 500.0,
        "amount": 1500.0
      }
    ]
  }
]
```

### 理赔申请 CSV 格式

```csv
claim_id,policy_number,claimant_name,claim_date,claim_amount,invoice_number,diagnosis,hospital_name
CLM2024001,POL123456,张三,2024-01-20,1500.0,INV2024000001,感冒发烧,北京协和医院
CLM2024002,POL789012,李四,2024-01-21,2800.0,INV2024000002,急性肠胃炎,上海瑞金医院
```

### 风险样本 CSV 格式

```csv
vendor_name,vendor_tax_id,risk_level,risk_type,risk_description,sample_count,last_occurrence
北京诚信医药经营部,91110105MA008X9Y1T,high,虚假发票,历史违规记录,5,2024-01-01
上海汇通商贸有限公司,91310114MA1G7H8Z2K,high,重复报销,多次被举报,3,2024-02-15
```

## 完整验证流程

### 方式一：使用示例数据

```bash
# 1. 生成示例数据
crs examples -i 20 -c 15 -r 10

# 2. 导入数据
crs import examples/invoices.json --type invoice
crs import examples/claims.csv --type claim
crs import examples/risk_samples.csv --type risk_sample

# 3. 执行风险扫描
crs scan

# 4. 查看统计信息
crs stats

# 5. 查看高风险票据
crs list --risk-level high

# 6. 更新复核状态（示例）
crs review INV2024000001 --status confirmed --notes "正常票据" --reviewer "QA001"

# 7. 导出报告
crs export -o ./output --name 质检报告_202401
```

### 方式二：训练并使用模型

```bash
# 1. 生成并导入示例数据
crs examples
crs import examples/invoices.json --type invoice
crs import examples/claims.csv --type claim
crs import examples/risk_samples.csv --type risk_sample

# 2. 训练模型（使用规则生成伪标签）
crs train --model-type randomforest --cv-folds 5

# 3. 使用模型进行预测
crs scan --model-path ./models/[最新模型目录]

# 4. 导出报告
crs export -o ./output
```

## 运行测试

```bash
# 运行所有测试
pytest

# 运行测试并生成覆盖率报告
pytest --cov=claim_risk_scanner --cov-report=html

# 运行特定测试文件
pytest tests/test_data_parser.py
```

## 依赖说明

项目主要依赖：

- `pandas`, `numpy` - 数据处理
- `scikit-learn` - 机器学习基础工具
- `lightgbm` - 轻量梯度提升模型（可选）
- `click` - 命令行框架
- `sqlalchemy` - ORM 数据库操作
- `pydantic` - 数据验证
- `joblib` - 模型序列化
- `rich` - 命令行美化输出
- `fuzzywuzzy`, `python-Levenshtein` - 字符串模糊匹配

## 可解释性设计

本工具强调可解释性，确保质检员能够理解每个风险评分的由来：

1. **规则引擎优先**: 所有规则都是可解释的业务规则
2. **特征重要性**: ML 模型输出特征重要性，帮助理解风险驱动因素
3. **规则匹配证据**: 每条触发的规则都提供具体证据描述
4. **特征贡献度**: 预测时输出各特征对风险分数的贡献

## 技术亮点

1. **混合评分**: 规则引擎（60%）+ ML模型（40%）混合，兼顾准确性和可解释性
2. **伪标签学习**: 无需人工标注，利用规则生成伪标签训练模型
3. **轻量级模型**: 支持 LightGBM、RandomForest、Logistic Regression，均可解释
4. **本地化存储**: SQLite 本地数据库，无需服务器
5. **多格式导出**: Markdown 报告（人工阅读）、CSV 清单（数据分析）、JSON 审计包（系统对接）

## 常见问题

**Q: 为什么规则引擎和 ML 模型都需要？**

A: 规则引擎提供明确的业务规则和可解释性，ML 模型可以发现规则难以覆盖的复杂模式。两者混合使用可以：
- 高召回率：规则确保已知风险不会遗漏
- 高精确率：模型帮助减少误报
- 可解释性：规则证据让质检员理解风险来源

**Q: 什么是伪标签学习？**

A: 在没有人工标注数据的情况下，我们使用规则引擎的输出作为伪标签来训练 ML 模型。这样可以：
- 利用规则的业务知识初始化模型
- 让模型学习更复杂的特征组合
- 随着人工复核积累，可以替换为真实标签

**Q: 金额凑整检测是如何工作的？**

A: 系统检测多种异常金额模式：
- 整数金额：100, 200, 500, 1000, 2000, 5000, 10000...
- 特殊数字：88, 188, 288, 888, 168, 1688...（谐音数字）
- 尾数模式：99, 199, 299, 999...（定价心理）
- 重复数字：111, 222, 333, 555...
- 连续数字：123, 234, 1234, 2345...

**Q: 如何自定义规则？**

A: 可以通过修改 `src/claim_risk_scanner/rules/engine.py` 中的 `_register_default_rules` 方法添加新规则，或者在运行时调用 `RuleEngine.add_rule()` 动态添加。

## License

MIT License
