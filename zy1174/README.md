# 文本向量检索实验台

一个用于 RAG 前置实验的本地文本向量检索平台，支持 TF-IDF 和简化 Embedding 向量化，提供完整的检索、评估和标注功能。

## 功能特性

### 📁 语料库管理
- 支持导入 CSV、JSONL、TXT 格式的文档
- 单条文档的增删改查
- 语料库统计信息（文档数、总词数、平均长度、词汇表大小）
- 分页查看文档列表

### ⚙️ 向量化配置
- **分词器**: 结巴分词（中文）、空格分词（英文）、字符级分词
- **停用词**: 中文、英文、中英文混合，支持自定义停用词
- **向量化方法**:
  - TF-IDF: 基于词频-逆文档频率的传统向量化方法
  - 简化 Embedding: 随机初始化的词向量平均（用于实验对比）
- **向量归一化**: 支持 L2 归一化
- **版本管理**: 每次向量化生成版本记录

### 🔍 向量检索
- 余弦相似度 TopK 检索
- 实时查询和结果展示
- 检索结果自动保存到历史记录

### 📈 分析功能
- **相似度矩阵**: 文档间余弦相似度可视化（Chart.js）
- **维度贡献分析**:
  - TF-IDF: 高权重特征词展示
  - Embedding: 高相似度词展示
- **语料库维度统计**: 方差分析、稀疏度计算

### 📋 评估系统
- **相关性标注**: 4级标注（0-3）
- **评估指标**:
  - Precision@K
  - Recall@K
  - F1 Score
  - MAP (Mean Average Precision)
  - MRR (Mean Reciprocal Rank)
  - NDCG

### 📊 报告导出
- Markdown 格式报告
- JSON 格式报告
- 包含语料库统计、向量化配置、查询结果、评估指标

## 项目结构

```
zy1174/
├── app/
│   ├── __init__.py          # Flask 应用初始化
│   ├── models.py            # 数据库模型
│   ├── routes.py            # 主路由
│   ├── api.py               # API 接口
│   └── utils/
│       ├── __init__.py
│       ├── tokenizer.py     # 分词器、停用词处理
│       ├── vectorizer.py    # TF-IDF、Embedding 向量化
│       ├── similarity.py    # 相似度计算、检索、评估指标
│       └── data_io.py       # 数据导入导出、报告生成
├── static/
│   ├── css/
│   │   └── style.css        # 前端样式
│   └── js/
│       └── app.js           # 前端交互逻辑
├── templates/
│   └── index.html           # 主页面模板
├── tests/
│   ├── __init__.py
│   ├── test_core.py         # 核心模块测试
│   └── test_api.py          # API 接口测试
├── scripts/
│   ├── __init__.py
│   └── seed_data.py         # 种子数据脚本
├── examples/
│   ├── sample_docs.csv      # 示例 CSV 数据
│   └── sample_docs.jsonl    # 示例 JSONL 数据
├── config.py                # 配置文件
├── requirements.txt         # 依赖清单
├── run.py                   # 启动脚本
└── README.md
```

## 快速开始

### 环境要求
- Python 3.8+
- pip

### 安装步骤

1. 安装依赖:
```bash
pip install -r requirements.txt
```

2. 启动服务:
```bash
python run.py
```

3. 访问应用:
打开浏览器访问 `http://localhost:5000`

### 可选步骤

1. 加载种子数据（示例数据）:
```bash
python scripts/seed_data.py
```

2. 运行测试:
```bash
python -m pytest tests/ -v
```

## 使用指南

### 1. 准备数据

支持以下格式:

**CSV 格式**:
```csv
doc_id,content,category
doc_001,人工智能是计算机科学的一个分支...,AI
doc_002,机器学习是人工智能的重要分支...,AI
```

**JSONL 格式**:
```jsonl
{"doc_id": "jsonl_001", "content": "人工智能是计算机科学的一个分支", "category": "AI"}
{"doc_id": "jsonl_002", "content": "机器学习是人工智能的重要分支", "category": "AI"}
```

示例数据位于 `examples/` 目录。

### 2. 导入数据

1. 点击「语料库」标签页
2. 拖拽文件到上传区域，或点击上传按钮
3. 也可以手动添加单条文档

### 3. 配置向量化

1. 点击「向量化」标签页
2. 配置参数:
   - 分词器: 建议中文用「结巴分词」，英文用「空格分词」
   - 停用词语言: 根据文档语言选择
   - 向量化方法: TF-IDF 或 简化 Embedding
   - 自定义停用词: 每行一个词
3. 点击「开始向量化」

### 4. 执行检索

1. 点击「检索」标签页
2. 输入查询文本
3. 设置 TopK（返回结果数量）
4. 点击「检索」

### 5. 标注相关性

1. 在检索结果中，找到相关文档
2. 点击相应的标注按钮:
   - 3 - 高度相关
   - 2 - 相关
   - 1 - 部分相关
   - 0 - 不相关

### 6. 评估效果

1. 点击「评估」标签页
2. 设置 TopK
3. 点击「计算评估指标」
4. 查看各项评估指标

### 7. 导出报告

1. 在「评估」标签页点击「导出报告」
2. 选择格式（Markdown 或 JSON）
3. 报告自动下载

## API 接口

### 语料库管理

- `GET /api/corpus` - 获取文档列表（分页）
- `GET /api/corpus/<id>` - 获取单条文档
- `POST /api/corpus` - 添加文档
- `PUT /api/corpus/<id>` - 更新文档
- `DELETE /api/corpus/<id>` - 删除文档
- `POST /api/corpus/upload` - 上传文件导入
- `GET /api/corpus/stats` - 获取语料库统计

### 向量化

- `POST /api/vectorize` - 执行向量化
- `GET /api/vector-versions` - 获取历史版本

### 检索

- `POST /api/search` - 执行检索
- `GET /api/similarity-matrix` - 获取相似度矩阵
- `POST /api/dimension-analysis` - 维度分析

### 评估

- `POST /api/annotations` - 添加/更新标注
- `GET /api/annotations/<query_id>` - 获取标注
- `POST /api/evaluate` - 计算评估指标
- `POST /api/export/report` - 导出报告

### 历史记录

- `GET /api/query-history` - 获取查询历史
- `GET /api/health` - 健康检查

## 核心模块说明

### 分词器 (`app/utils/tokenizer.py`)

- `Tokenizer`: 支持结巴分词、空格分词、字符级分词
- `StopWordFilter`: 内置中英文停用词表，支持自定义
- `TextProcessor`: 文本预处理管道

### 向量化 (`app/utils/vectorizer.py`)

- `TFIDFVectorizer`: 基于 sklearn 的 TF-IDF 实现
- `SimpleEmbeddingVectorizer`: 简化词向量模型（随机初始化 + 平均池化）
- `VectorizerFactory`: 工厂模式创建向量化器

### 相似度与检索 (`app/utils/similarity.py`)

- `SimilarityCalculator`: 余弦相似度、点积、欧氏距离
- `VectorRetriever`: 向量检索引擎
- `EvaluationMetrics`: Precision, Recall, F1, MAP, MRR, NDCG
- `VectorDimensionAnalyzer`: 向量维度分析

### 数据处理 (`app/utils/data_io.py`)

- `DataImporter`: CSV/JSONL/TXT 格式导入
- `DataExporter`: 数据导出
- `ReportExporter`: 生成 Markdown/JSON 报告

## 数据库模型

| 模型 | 说明 |
|------|------|
| `Corpus` | 语料库文档 |
| `VectorVersion` | 向量化版本记录 |
| `QueryRecord` | 查询记录 |
| `SimilarityResult` | 相似度结果 |
| `Annotation` | 人工标注 |

## 配置参数

编辑 `config.py` 可修改配置:

```python
SECRET_KEY = 'your-secret-key'
SQLALCHEMY_DATABASE_URI = 'sqlite:///app.db'
UPLOAD_FOLDER = 'uploads'
MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50MB
DEFAULT_TOKENIZER = 'jieba'
DEFAULT_STOPWORD_LANG = 'chinese'
DEFAULT_VECTORIZATION = 'tfidf'
DEFAULT_TOP_K = 5
```

## 与真实 RAG 系统的对比

| 功能 | 本实验台 | 真实 RAG 系统 |
|------|----------|--------------|
| 向量化 | TF-IDF / 简化 Embedding | BGE, text-embedding-ada 等 |
| 向量数据库 | 内存 + SQLite | Pinecone, Chroma, Milvus 等 |
| 检索 | 余弦相似度全量计算 | ANN (近似最近邻) |
| 重排序 | 无 | CrossEncoder, Cohere Rerank 等 |
| 生成模型 | 无 | GPT, Claude 等 |

**本实验台的价值**:
1. 快速验证小语料上的检索效果
2. 对比不同向量化方法的优劣
3. 积累人工标注数据
4. 为上线 RAG 系统提供基线

## 扩展建议

1. **集成真实 Embedding**: 接入 OpenAI API、HuggingFace 模型
2. **添加向量数据库**: 集成 Chroma 或 FAISS
3. **实现重排序**: 添加 CrossEncoder 重排序
4. **多语言支持**: 扩展分词器支持更多语言
5. **批量检索**: 支持批量查询和评估

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request。
