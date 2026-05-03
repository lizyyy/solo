# 合同版本差异和风险归类小助手

一个本地运行的合同版本差异检测和风险评估工具，专为接私活、做小项目的开发者设计。帮助你在客户来回修改合同报价时，不会漏掉付款节点、交付范围、版权归属、验收口径、违约金等关键细节的变化。

## 功能特性

- 📄 **多版本对比**: 支持导入两版或多版 txt/md 格式的合同文本
- 🔍 **智能条款分类**: 自动按付款、交付、版权、验收、违约、保密、售后等类别切开条款
- ⚠️ **差异检测**: 用轻量 NLP/相似度/关键词规则找出新增、删除、弱化、加重和表述模糊的变化
- 🎯 **风险评估**: 每条风险提供证据片段、变化类型、风险等级、建议追问句
- 💾 **本地持久化**: 保存历史记录，随时查看和导出
- 📊 **多格式导出**: 支持 Markdown/HTML/JSON 三种格式的复盘报告
- 🛡️ **异常处理**: 处理空文件、缺字段、格式乱、同一条款被拆成多段等异常输入

## 项目结构

```
contract-diff-helper/
├── src/
│   ├── __init__.py          # 包初始化
│   ├── cli.py               # CLI 命令行界面
│   ├── clause_classifier.py # 条款分类器
│   ├── diff_detector.py     # 差异检测器
│   ├── risk_engine.py       # 风险规则引擎
│   ├── storage.py           # 本地存储管理
│   └── exporter.py          # 报告导出器
├── examples/
│   ├── contract_v1.txt      # 示例合同版本 1
│   ├── contract_v2.txt      # 示例合同版本 2（含关键变化）
│   ├── risk-rules.json      # 自定义风险规则配置
│   └── risk-dictionary.json # 风险词典配置
├── requirements.txt         # Python 依赖
└── README.md               # 本说明文档
```

## 快速开始

### 1. 环境准备

确保你的电脑已安装 Python 3.8 或更高版本。

```bash
# 检查 Python 版本
python3 --version
```

### 2. 安装依赖

```bash
# 进入项目目录
cd /path/to/contract-diff-helper

# 安装依赖
pip3 install -r requirements.txt
```

**可选依赖（推荐安装）**:

```bash
# 安装更精确的文本相似度计算库
pip3 install fuzzywuzzy python-Levenshtein

# 安装更美观的 CLI 输出
pip3 install rich
```

### 3. 运行示例

项目提供了完整的示例数据，让你可以立即体验工具的功能。

```bash
# 使用示例合同进行分析
python3 -m src.cli analyze examples/contract_v1.txt examples/contract_v2.txt \
  -p "电商系统开发项目" \
  -r examples/risk-rules.json \
  -f markdown \
  -f html
```

**参数说明**:
- `examples/contract_v1.txt examples/contract_v2.txt`: 两个版本的合同文件（按版本顺序排列）
- `-p "电商系统开发项目"`: 项目名称（用于历史记录）
- `-r examples/risk-rules.json`: 自定义风险规则文件（可选）
- `-f markdown -f html`: 导出格式（支持 json/markdown/html）

### 4. 查看结果

分析完成后，你会看到类似这样的输出：

```
开始分析 2 个版本的合同...
版本文件: examples/contract_v1.txt, examples/contract_v2.txt

==================================================
分析完成！
==================================================

📊 分析摘要:
   - 总变化数: 15
   - 风险评估数: 22

⚠️  风险等级分布:
   - 严重: 2 项
   - 高: 5 项
   - 中: 8 项
   - 低: 7 项

📝 变化类型分布:
   - 修改: 8 处
   - 新增: 4 处
   - 删除: 2 处
   - 表述模糊: 1 处

📤 正在导出报告...

✅ 报告已导出:
   - MARKDOWN: /path/to/exports/电商系统开发项目_20260503_143022.md
   - HTML: /path/to/exports/电商系统开发项目_20260503_143022.html

💾 分析已保存到历史记录
   - 记录ID: analysis_20260503_143022
```

## 命令行工具详解

### analyze 命令（核心功能）

分析合同版本差异并评估风险。

```bash
# 基本用法
python3 -m src.cli analyze <version1> <version2> [version3...]

# 完整参数
python3 -m src.cli analyze v1.txt v2.txt v3.txt \
  -p "项目名称" \
  -r custom-rules.json \
  -f json \
  -f markdown \
  -f html \
  -o my_report \
  --no-history \
  -v
```

**参数说明**:

| 参数 | 简写 | 说明 | 示例 |
|------|------|------|------|
| `version_files` | 位置参数 | 合同版本文件路径（至少2个，按版本顺序） | `v1.txt v2.txt` |
| `--project` | `-p` | 项目名称（用于历史记录） | `-p "我的项目"` |
| `--rules` | `-r` | 自定义风险规则文件（JSON格式） | `-r my-rules.json` |
| `--format` | `-f` | 导出格式（可多次指定） | `-f markdown -f html` |
| `--output` | `-o` | 输出文件名（不含扩展名） | `-o report_2026` |
| `--no-history` | - | 不保存到历史记录 | `--no-history` |
| `--verbose` | `-v` | 显示详细错误信息 | `-v` |

### history 命令（历史记录管理）

查看和管理历史分析记录。

```bash
# 显示最近 10 条记录
python3 -m src.cli history

# 显示最近 20 条记录
python3 -m src.cli history -n 20

# 查看指定记录的详细信息
python3 -m src.cli history -d analysis_20260503_143022

# 删除指定记录
python3 -m src.cli history -D analysis_20260503_143022
```

### export 命令（从历史记录导出报告）

从历史记录导出报告。

```bash
# 导出所有格式
python3 -m src.cli export analysis_20260503_143022

# 只导出 Markdown 和 HTML
python3 -m src.cli export analysis_20260503_143022 -f markdown -f html

# 指定输出文件名
python3 -m src.cli export analysis_20260503_143022 -o my_report
```

### config 命令（配置管理）

查看和管理配置。

```bash
# 显示当前风险规则
python3 -m src.cli config --show-rules

# 显示当前分类关键词
python3 -m src.cli config --show-keywords

# 加载自定义规则文件
python3 -m src.cli config --load-rules my-rules.json
```

## 配置说明

### 风险规则配置 (risk-rules.json)

你可以通过自定义风险规则来调整工具的检测逻辑。规则文件是一个 JSON 数组，每个规则包含以下字段：

```json
{
  "id": "R001",
  "name": "付款节点变更",
  "category": "付款",
  "description": "检测付款节点、时间、金额的变化",
  "triggers": ["付款", "支付", "款项", "金额", "节点"],
  "exclude_triggers": [],
  "risk_level": "中",
  "change_type_mapping": {
    "弱化": "高",
    "删除": "高",
    "新增": "中"
  },
  "suggested_questions": [
    "付款节点变更的原因是什么？",
    "新的付款时间是否会影响我方现金流？"
  ]
}
```

**字段说明**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | 是 | 规则唯一标识 |
| `name` | string | 是 | 规则名称 |
| `category` | string | 是 | 规则类别（付款/交付/版权/验收/违约等） |
| `description` | string | 否 | 规则描述 |
| `triggers` | array | 否 | 触发关键词列表（空列表表示匹配所有） |
| `exclude_triggers` | array | 否 | 排除关键词列表 |
| `risk_level` | string | 是 | 默认风险等级（严重/高/中/低） |
| `change_type_mapping` | object | 否 | 按变化类型映射的风险等级 |
| `suggested_questions` | array | 否 | 建议的追问句列表 |

**变化类型 (change_type)**:
- `新增`: 新增的条款或内容
- `删除`: 删除的条款或内容
- `修改`: 修改的条款或内容
- `弱化`: 对我方不利的修改（如减少付款、降低违约金）
- `加重`: 对我方有利的修改（如增加付款、提高违约金）
- `表述模糊`: 表述不清晰，可能存在歧义

### 风险词典配置 (risk-dictionary.json)

风险词典用于检测文本中的风险相关词汇。你可以根据自己的行业特点添加或修改词汇。

```json
{
  "付款风险": [
    "逾期", "延迟", "拖延", "拒付", "扣除", "减免",
    "协商确定", "另行约定", "根据实际情况"
  ],
  "模糊表述": [
    "等", "等等", "相关", "相应", "适当", "合理",
    "包括但不限于", "视情况而定", "另行约定"
  ]
}
```

## 示例数据详解

### contract_v1.txt vs contract_v2.txt

示例合同包含了多个真实场景中的关键变化，让你可以体验工具的检测能力：

**版本 1 → 版本 2 的关键变化**:

| 类别 | 变化内容 | 风险等级 |
|------|----------|----------|
| **付款** | 预付款从 30% 降至 20%，时间从 3 天延长至 5 天 | 高 |
| **付款** | 删除 50% 里程碑付款节点，合并到验收后 | 高 |
| **付款** | 尾款付款时间从 7 天延长至 30 天 | 中 |
| **交付** | 交付时间从 90 天缩短为 75 天 | 中 |
| **版权** | 从"共同所有"改为"甲方所有" | **严重** |
| **版权** | 使用范围从"项目范围内"扩大到"任何范围" | 高 |
| **验收** | 并发用户从 1000 增加到 2000 | 中 |
| **验收** | 验收期限从"15 个工作日"改为"根据实际情况" | **严重** |
| **违约** | 乙方违约金从 0.1%/天提高到 0.2%/天 | 高 |
| **违约** | 甲方违约金从 0.05%/天降至 0.03%/天 | 中 |
| **保密** | 保密期限从 2 年延长至 5 年 | 中 |
| **售后** | 维护期从 6 个月缩短为 3 个月 | 中 |
| **售后** | 删除"小功能调整和技术支持"服务 | 高 |
| **争议解决** | 从"合同签订地"改为"甲方所在地" | 中 |

## 异常处理

工具会自动处理以下异常情况：

### 1. 空文件或空白文件

```
错误: 文件内容为空或全是空白字符: empty_contract.txt
```

### 2. 文件不存在

```
错误: 文件不存在: non_existent.txt
```

### 3. 编码问题

工具会自动尝试多种编码（utf-8、gbk、gb2312、utf-8-sig）读取文件。

### 4. 规则文件格式错误

```
错误: 规则文件格式错误，不是有效的 JSON: Expecting value: line 1 column 1 (char 0)
```

### 5. 规则文件缺字段

```
错误: 规则 1 缺少必填字段: id
```

### 6. 同一条款被拆成多段

工具的 `ClauseClassifier` 会智能合并被空行分隔的相关段落，避免将同一条款拆成多段。

## 输出文件说明

### Markdown 报告

Markdown 报告包含以下内容：
- 分析摘要（总变化数、风险评估数）
- 变化类型分布
- 风险等级分布
- 详细风险分析（按风险等级分组）
  - 变化类型和类别
  - 证据片段（新旧版本对比）
  - 风险评估和匹配关键词
  - 建议追问句

### HTML 报告

HTML 报告提供更美观的可视化效果：
- 响应式设计，支持手机浏览
- 彩色风险标签（🔴严重、🟠高、🟡中、🟢低）
- 代码块展示证据片段
- 统计卡片展示摘要信息

### JSON 报告

JSON 报告包含完整的结构化数据，适合程序处理：

```json
{
  "project_name": "电商系统开发项目",
  "generated_at": "2026-05-03T14:30:22.123456",
  "versions": ["v1_contract_v1", "v2_contract_v2"],
  "summary": {
    "total_changes": 15,
    "total_assessments": 22,
    "change_types": {
      "修改": 8,
      "新增": 4,
      "删除": 2,
      "表述模糊": 1
    },
    "risk_levels": {
      "严重": 2,
      "高": 5,
      "中": 8,
      "低": 7
    }
  },
  "changes": [...],
  "assessments": {...}
}
```

## 工作目录结构

运行工具后，会自动创建以下目录：

```
your-working-directory/
├── history/           # 历史记录
│   ├── index.json     # 历史索引
│   └── analysis_20260503_143022/  # 单次分析记录
│       ├── summary.json
│       ├── changes.json
│       └── assessments.json
├── exports/           # 导出的报告
│   ├── 电商系统开发项目_20260503_143022.md
│   ├── 电商系统开发项目_20260503_143022.html
│   └── 电商系统开发项目_20260503_143022.json
├── config/            # 配置文件（可选）
└── temp/              # 临时文件
```

## 使用技巧

### 1. 多版本对比

你可以一次对比多个版本的合同：

```bash
# 对比 3 个版本
python3 -m src.cli analyze v1.txt v2.txt v3.txt -p "我的项目"
```

工具会按顺序对比相邻版本（v1→v2, v2→v3），并汇总所有变化。

### 2. 使用自定义规则

为不同类型的项目创建专门的规则文件：

```bash
# 软件开发项目
python3 -m src.cli analyze v1.txt v2.txt -r rules/software-dev.json

# 设计服务项目
python3 -m src.cli analyze v1.txt v2.txt -r rules/design-service.json
```

### 3. 查看历史记录

定期查看历史记录，回顾之前的风险点：

```bash
# 查看最近的分析
python3 -m src.cli history

# 查看详细内容
python3 -m src.cli history -d analysis_20260503_143022
```

### 4. 导出报告分享

导出 HTML 报告，方便与同事或客户分享：

```bash
# 只导出 HTML
python3 -m src.cli analyze v1.txt v2.txt -f html

# 或从历史记录导出
python3 -m src.cli export analysis_20260503_143022 -f html
```

## 常见问题

### Q1: 工具支持哪些文件格式？

目前支持 `.txt` 和 `.md` 格式的纯文本文件。建议使用 UTF-8 编码以获得最佳兼容性。

### Q2: 如何处理 PDF 或 Word 文档？

你需要先将 PDF 或 Word 文档转换为纯文本格式。可以使用以下工具：
- **Word 文档**: 另存为 .txt 文件
- **PDF 文档**: 使用在线转换工具或 `pdftotext` 命令行工具

### Q3: 工具需要联网吗？

不需要。这是一个纯本地工具，所有分析都在你的电脑上完成，不会上传任何数据到云端。

### Q4: 如何添加新的风险规则？

1. 复制 `examples/risk-rules.json` 作为模板
2. 添加或修改规则
3. 使用 `-r` 参数指定你的规则文件

```bash
python3 -m src.cli analyze v1.txt v2.txt -r my-rules.json
```

### Q5: 工具的检测准确率如何？

工具使用基于关键词和规则的轻量 NLP 方法，适合检测合同中明确的数值变化和关键词变化。对于非常复杂的语义理解，建议结合人工审查。

## 更新日志

### v1.0.0 (2026-05-03)

- 初始版本发布
- 实现条款分类器（支持 10+ 类别）
- 实现差异检测器（支持新增、删除、修改、弱化、加重、表述模糊）
- 实现风险规则引擎（支持自定义规则）
- 实现本地存储（历史记录管理）
- 实现多格式导出（JSON/Markdown/HTML）
- 提供完整的 CLI 命令行界面
- 包含示例数据和详细文档

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

---

**提示**: 这是一个为接私活、做小项目的开发者设计的工具。它不能替代专业的法律顾问，但可以帮助你在签合同前快速发现可能被忽略的风险点。
