# RAG 知识库切片回归评测工具

## 简介

这是一个用于 RAG 知识库切片策略回归评测的离线工具。知识库维护同学可以在修改 chunk 规则前，用此工具跑一遍评测，对比不同策略的效果。

## 功能特性

- **多策略并行切片**: 支持同时配置多个切片策略进行对比
- **轻量级 TF-IDF 检索**: 使用 jieba 分词 + sklearn TF-IDF 进行本地检索评测
- **质量检测**: 自动检测空切片、重复标题、超长段落、过短切片等问题
- **检索评测**: 计算命中率、引用覆盖度等指标
- **可视化对比**: 生成交互式 HTML 对比页面，直观对比不同策略

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 运行示例评测

项目已包含示例数据，直接运行：

```bash
python3 chunk_evaluator.py
```

或指定参数：

```bash
python3 chunk_evaluator.py \
  --docs docs/ \
  --qa qa_cases.jsonl \
  --policy chunk_policy.yaml \
  --output output \
  --top-k 5
```

### 3. 查看输出

运行完成后，在 `output/` 目录生成三个文件：

| 文件 | 说明 |
|------|------|
| `issues.csv` | 质量问题清单（CSV 格式） |
| `retrieval_report.md` | 检索评测报告（Markdown 格式） |
| `comparison.html` | 交互式对比页面（可直接用浏览器打开） |

## 输入文件格式

### 1. 文档目录 (`docs/`)

放置所有 Markdown 文档，支持子目录。示例包含：

- `installation.md` - 正常文档示例
- `empty_doc.md` - 空文档（边界测试）
- `duplicate_headings.md` - 包含重复标题的文档（边界测试）
- `very_long_doc.md` - 包含超长段落的文档（边界测试）

### 2. QA 测试用例 (`qa_cases.jsonl`)

每行一个 JSON 对象，格式如下：

```json
{
  "id": "qa_001",
  "question": "如何克隆仓库？",
  "expected_answers": ["git clone", "cd rag-project"],
  "expected_file_paths": ["docs/installation.md"]
}
```

字段说明：
- `id`: 测试用例唯一标识
- `question`: 用户问题
- `expected_answers`: 预期答案关键词列表（用于内容匹配）
- `expected_file_paths`: 预期应该被检索到的文件路径列表

### 3. 切片策略配置 (`chunk_policy.yaml`)

支持配置多个策略进行对比：

```yaml
policies:
  - name: "旧策略 (保守)"
    max_chunk_size: 2000
    min_chunk_size: 20
    split_on_headings: true
    heading_levels: [1, 2, 3]
    keep_section_context: true
    paragraph_separator: '\n\n'

  - name: "新策略 (激进)"
    max_chunk_size: 500
    min_chunk_size: 100
    split_on_headings: true
    heading_levels: [1, 2, 3]
    keep_section_context: true
    paragraph_separator: '\n\n'
```

策略参数说明：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `name` | string | 必填 | 策略名称，用于报告标识 |
| `max_chunk_size` | int | 800 | 切片最大字符数 |
| `min_chunk_size` | int | 50 | 切片最小字符数 |
| `split_on_headings` | bool | true | 是否按标题切分 |
| `heading_levels` | list[int] | [1,2,3] | 参与切分的标题级别 |
| `keep_section_context` | bool | true | 是否保留父级标题上下文 |
| `paragraph_separator` | string | '\n\n' | 段落分隔符 |

## 质量检测规则

工具会检测以下问题类型：

| 分类 | 严重程度 | 说明 |
|------|----------|------|
| 空切片 | high | 切片内容为空或仅包含空白字符 |
| 重复标题 | medium | 同一标题出现在多个切片中 |
| 超长段落 | medium | 切片长度超过 max_chunk_size * 1.5 |
| 过短切片 | low | 切片长度小于 min_chunk_size |

## 检索评测指标

- **命中率 (Hit Rate)**: 在 Top-K 结果中检索到预期内容的 QA 用例占比
- **引用覆盖度 (Coverage)**: 检索到的文件覆盖预期文件的比例

命中判定逻辑：
1. 检索到的文件包含任一 `expected_file_paths` 中的文件，**或**
2. 检索到的内容包含任一 `expected_answers` 中的关键词

## 边界情况覆盖

示例数据已包含以下边界情况测试：

| 边界情况 | 测试文件 | 预期行为 |
|----------|----------|----------|
| 空文档 | `empty_doc.md` | 跳过处理，不报错 |
| 重复标题 | `duplicate_headings.md` | 检测到"配置选项"重复，生成 medium 级问题 |
| 超长段落 | `very_long_doc.md` | 检测到超过阈值的段落 |
| 标题单独成段 | 各文档 | 可能产生过短切片警告 |

## 命令行参数

```
usage: chunk_evaluator.py [-h] [--docs DOCS] [--qa QA] [--policy POLICY] 
                           [--output OUTPUT] [--top-k TOP_K]

RAG 知识库切片回归评测工具

optional arguments:
  -h, --help       show this help message and exit
  --docs DOCS      文档目录 (默认: docs)
  --qa QA          QA 测试用例文件 (默认: qa_cases.jsonl)
  --policy POLICY  切片策略配置 (默认: chunk_policy.yaml)
  --output OUTPUT  输出目录 (默认: output)
  --top-k TOP_K    检索 Top-K (默认: 5)
```

## 示例输出预览

### issues.csv 示例

```csv
分类,严重程度,策略名称,文件路径,切片ID,消息,上下文
重复标题,medium,旧策略 (保守),docs/duplicate_headings.md,...,"标题 ""配置选项"" 在 3 个切片中重复出现",...
过短切片,low,新策略 (激进),docs/installation.md,...,切片长度 6 小于最小阈值 100,# 安装指南
```

### retrieval_report.md 示例

```markdown
## 策略对比摘要

| 策略名称 | 总问题数 | 命中数 | 命中率 | 平均覆盖度 |
|----------|----------|--------|--------|------------|
| 旧策略 (保守) | 6 | 6 | 100.00% | 100.00% |
| 新策略 (激进) | 6 | 6 | 100.00% | 100.00% |
| 纯文本切片 (不按标题) | 6 | 6 | 100.00% | 100.00% |
```

### HTML 对比页面

浏览器打开 `output/comparison.html`，可查看：
- 各策略切片数量对比
- 切片内容预览（前 50 个）
- 质量问题列表（按严重程度着色）
- 检索性能指标摘要

## 工作流程

```
1. 加载策略配置 (chunk_policy.yaml)
         ↓
2. 遍历每个策略:
   ├── 对所有 Markdown 文档执行切片
   ├── 质量检测（空切片/重复标题/超长段落）
   ├── 构建 TF-IDF 索引
   └── 使用 QA 用例进行检索评测
         ↓
3. 生成报告:
   ├── issues.csv - 所有策略的质量问题汇总
   ├── retrieval_report.md - 检索评测详细报告
   └── comparison.html - 交互式对比页面
```

## 实际使用建议

1. **添加更多 QA 用例**: 覆盖真实用户问题场景
2. **维护 golden 数据集**: 建立基线策略作为对比标准
3. **关注质量问题趋势**: 长期监控问题类型变化
4. **结合人工审核**: 工具发现的问题建议人工复核

## 项目结构

```
.
├── chunk_evaluator.py    # 主程序
├── requirements.txt      # 依赖
├── chunk_policy.yaml     # 切片策略配置
├── qa_cases.jsonl        # QA 测试用例
├── docs/                 # 文档目录
│   ├── installation.md
│   ├── empty_doc.md          # 边界：空文档
│   ├── duplicate_headings.md # 边界：重复标题
│   └── very_long_doc.md      # 边界：超长段落
└── output/               # 输出目录
    ├── issues.csv
    ├── retrieval_report.md
    └── comparison.html
```

## License

MIT
