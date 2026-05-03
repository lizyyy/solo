# RAG 检索回归预检 CLI

一个用于企业知识库 RAG 索引上线前的检索回归预检工具。

## 功能特性

- 📊 **多维度评估指标**
- **Top-K 召回率** - 衡量检索结果的相关性
- **MRR (Mean Reciprocal Rank)** - 衡量相关结果的排名质量
- **引用覆盖率** - 衡量期望引用的覆盖程度
- **过期文档命中检测** - 识别检索到已过期文档的情况
- **重复 Chunk 风险检测** - 发现高度相似的重复知识块

⚠️ **异常检测**
- 向量维度不一致检测
- 查询缺少期望引用检测
- 低分数查询识别

📁 **多格式报告输出**
- `issues.csv` - 结构化问题列表
- `rag_eval_report.md` - 详细评估报告
- `ranking_preview.html` - 交互式排名预览

## 快速开始

### 安装依赖

```bash
npm install
```

### 运行 Demo

使用 sample 数据快速体验：

```bash
npm run demo
```

这将：
1. 编译 TypeScript 代码
2. 使用 sample 目录下的测试数据运行评估
3. 在 `./reports` 目录生成报告文件

### 查看报告

运行完成后，打开 `./reports` 目录下会生成：

```
reports/
├── issues.csv           # 问题列表
├── rag_eval_report.md # Markdown 格式评估报告
└── ranking_preview.html # 交互式排名预览（浏览器打开查看
```

## 命令行使用

### 完整参数

```bash
npm run build && node dist/index.js \
  --chunks <knowledge_chunks.jsonl> \
  --queries <queries.csv> \
  --expected <expected_refs.yaml> \
  --rules <eval_rules.yaml> \
  --output <output_directory> \
  [--top-k <number>] \
  [-v, --verbose]
```

### 参数说明

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `--chunks` | string | ✅ | 知识块向量 JSONL 文件路径 |
| `--queries` | string | ✅ | 查询集 CSV 文件路径 |
| `--expected` | string | ✅ | 期望引用 YAML 文件路径 |
| `--rules` | string | ✅ | 评估规则 YAML 文件路径 |
| `--output` | string | ✅ | 输出目录路径 |
| `--top-k` | number | ❌ | 检索结果数量，默认 10 |
| `-v, --verbose` | flag | ❌ | 显示详细日志 |

### 示例

```bash
npm run build

node dist/index.js \
  --chunks ./sample/knowledge_chunks.jsonl \
  --queries ./sample/queries.csv \
  --expected ./sample/expected_refs.yaml \
  --rules ./sample/eval_rules.yaml \
  --output ./my-reports \
  --top-k 5 \
  --verbose
```

## 输入文件格式

### 1. 知识块向量 (JSONL)

每行一个 JSON 对象：

```json
{
  "id": "chunk-001",
  "document_id": "doc-api-v2",
  "content": "API v2 版本支持 OAuth2.0 认证方式...",
  "metadata": {"source": "api-docs", "version": "2.0"},
  "embedding": [0.1, 0.2, 0.3, 0.4, 0.5],
  "is_expired": false
}
```

### 2. 查询集 (CSV)

```csv
id,query,category,query_embedding
q-001,如何使用 OAuth2.0 认证？,api,"[0.1, 0.2, 0.3, 0.4, 0.5]"
q-002,用户接口路径是什么？,api,"[0.2, 0.3, 0.4, 0.5, 0.1]"
```

### 3. 期望引用 (YAML)

```yaml
expected_refs:
  - query_id: q-001
    expected_chunks:
      - chunk-001
    expected_documents:
      - doc-api-v2
    explanation: "OAuth2.0 认证相关内容"
```

### 4. 评估规则 (YAML)

```yaml
top_k_values:
  - 1
  - 3
  - 5
  - 10

expired_documents:
  - doc-api-v1

duplicate_threshold: 0.95

mrr_weight: 0.3
recall_weight: 0.4
coverage_weight: 0.3

minimum_acceptable_score: 0.6
```

## 项目结构

```
.
├── src/
│   ├── index.ts      # CLI 入口
│   ├── types.ts      # 类型定义
│   ├── readers.ts  # 文件读取器
│   ├── searcher.ts # 向量搜索器
│   ├── evaluator.ts # 评估计算器
│   └── reporter.ts # 报告生成器
├── sample/          # 示例数据
│   ├── knowledge_chunks.jsonl
│   ├── queries.csv
│   ├── expected_refs.yaml
│   └── eval_rules.yaml
├── package.json
├── tsconfig.json
└── README.md
```

## 评估指标说明

### Top-K 召回率 (Recall@K)

衡量在前 K 个检索结果中，命中期望引用的比例。

计算公式：
```
Recall@K = (命中的期望引用数) / (总期望引用数)
```

### MRR (Mean Reciprocal Rank)

衡量第一个相关结果的排名质量。

计算公式：
```
MRR = 1 / (第一个相关结果的排名)
```

### 引用覆盖率

衡量所有期望引用在检索结果中的覆盖程度。

### 综合得分

```
总体得分 = MRR * 0.3 + 平均召回率 * 0.4 + 引用覆盖率 * 0.3
```

## License

MIT
