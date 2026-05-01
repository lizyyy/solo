# 课堂疑问聚类助手 (Classroom Question Cluster)

企业内训讲师用的本地 AI 小工具，自动聚类学员问题并关联课程章节。

## 功能特性

- 📥 **导入多种格式**：支持 SRT 字幕、CSV/TXT 聊天记录、YAML/MD/TXT 课程大纲
- 🔍 **智能问题提取**：自动从字幕和聊天记录中识别潜在问题
- 📊 **TF-IDF 聚类**：使用本地 TF-IDF + 层次聚类，无需外部 API
- 📍 **章节匹配**：基于时间戳和关键词自动关联课程章节
- ✅ **交互式复核**：支持确认、合并、拆分、标记已解决
- 📄 **多格式报告**：导出 Markdown 复盘、CSV 问题清单、JSON 审计记录

## 项目结构

```
classroom_cluster/
├── __init__.py          # 版本信息
├── cli.py               # 主 CLI 入口
├── config.py            # 项目配置管理
├── models.py            # 数据模型定义
├── clusterer.py         # TF-IDF 聚类器和章节匹配
├── review.py            # 复核状态管理
├── storage.py           # 数据存储
├── reporter.py          # 报告生成
└── parsers/
    ├── __init__.py
    ├── srt_parser.py    # SRT 字幕解析器
    ├── chat_parser.py   # 聊天记录解析器
    └── outline_parser.py # 课程大纲解析器

examples/                # 示例数据
├── subtitle.srt
├── chat.csv
└── outline.yaml

tests/                   # 测试文件
├── test_parsers.py
├── test_clusterer.py
├── test_review.py
└── test_reporter.py
```

## 安装

```bash
# 使用 pip 安装
pip install -e .

# 或者使用 hatch
hatch shell
```

依赖项：
- Python >= 3.9
- click
- scikit-learn
- jieba
- pandas
- numpy
- pyyaml

## 快速开始

### 1. 初始化项目

```bash
# 创建新目录并初始化
mkdir my_training && cd my_training
cqc init --name "Python 进阶培训"
```

### 2. 导入数据

```bash
# 导入字幕、聊天记录和大纲
cqc import \
  --subtitle ../examples/subtitle.srt \
  --chat ../examples/chat.csv \
  --outline ../examples/outline.yaml
```

支持的格式：
- **字幕**: `.srt` (Zoom/飞书字幕格式)
- **聊天记录**: `.csv` (含 timestamp, speaker, content 列) 或 `.txt`
- **大纲**: `.yaml`, `.yml`, `.md`, `.txt`

### 3. 聚类分析

```bash
# 使用默认参数聚类
cqc analyze

# 自定义相似度阈值和最小聚类大小
cqc analyze --threshold 0.5 --min-size 2
```

输出示例：
```
加载 18 个问题
加载 4 个章节

聚类参数:
  相似度阈值: 0.6
  最小聚类大小: 2

聚类完成!
  总聚类数: 3
  已聚类问题: 15
  未聚类问题: 3
  平均聚类大小: 5.0

聚类详情:
  1. [85.2%] API接口的参数怎么理解？...
     章节: 第一章：API接口基础 | 时间: 00:01:30 | 问题数: 4
  2. [78.5%] 认证流程具体是怎么执行的？...
     章节: 第二章：认证与授权 | 时间: 00:01:15 | 问题数: 5
  ...
```

### 4. 交互式复核

```bash
# 进入交互式复核模式
cqc review
```

可用操作：
- `c` / `confirm` - 确认此聚类
- `r` / `resolve` - 标记为已解决
- `d` / `discard` - 标记为废弃
- `m` / `merge` - 合并此聚类到其他聚类
- `n` / `note` - 添加备注
- `s` / `skip` - 跳过，处理下一个
- `l` / `list` - 列出所有待处理聚类
- `q` / `quit` - 保存并退出

命令行操作示例：
```bash
# 列出所有聚类
cqc review --list

# 确认指定聚类
cqc review --cluster-id abc123 --action confirm --note "聚类正确"

# 合并多个聚类
cqc review --merge "abc123,def456" --note "都是API相关问题"
```

### 5. 生成报告

```bash
# 生成所有格式的报告
cqc report --all

# 单独生成
cqc report --markdown   # Markdown 复盘报告
cqc report --csv        # CSV 问题清单
cqc report --json       # JSON 审计记录
```

报告输出位置：`.cqc_data/reports/`

### 6. 查看项目状态

```bash
cqc status
```

## 临时目录验证全流程

使用项目提供的示例数据快速验证：

```bash
# 1. 创建临时目录
mkdir -p /tmp/cqc_demo && cd /tmp/cqc_demo

# 2. 初始化项目
cqc init --name "示例培训项目"

# 3. 导入示例数据（替换为实际路径）
cqc import \
  --subtitle /path/to/repo/examples/subtitle.srt \
  --chat /path/to/repo/examples/chat.csv \
  --outline /path/to/repo/examples/outline.yaml

# 4. 聚类分析
cqc analyze --threshold 0.3

# 5. 查看聚类结果
cqc review --list

# 6. 生成报告
cqc report --all

# 7. 查看生成的文件
ls -la .cqc_data/reports/

# 8. 查看 Markdown 报告
cat .cqc_data/reports/review_*.md
```

## 数据格式说明

### SRT 字幕格式

```srt
1
00:00:30,000 --> 00:00:35,000
学员A: 老师，这个API接口的参数怎么理解？

2
00:00:36,000 --> 00:00:40,000
讲师: 好问题，我们来看一下文档...
```

### 聊天记录 CSV 格式

```csv
timestamp,speaker,content
2024-01-15 14:00:30,学员A,老师，API接口的参数不太理解
2024-01-15 14:01:15,学员B,认证流程具体怎么执行的？
```

### 课程大纲 YAML 格式

```yaml
- title: 第一章：API接口基础
  description: 学习RESTful API的基本概念和调用方式
  time: "00:00:00"
  keywords:
    - API
    - RESTful
    - 参数

- title: 第二章：认证与授权
  description: 深入理解OAuth2.0认证流程和token管理
  time: "00:01:00"
  keywords:
    - OAuth2.0
    - 认证
    - token
```

## 配置说明

项目配置文件 `.cqc_config.yaml`：

```yaml
project_name: 培训项目
language: zh

clustering:
  method: tfidf
  similarity_threshold: 0.6
  min_cluster_size: 2
  max_features: 10000
  ngram_range:
    - 1
    - 2

chapter_matching:
  time_tolerance_seconds: 300

storage:
  raw_data_dir: raw
  processed_data_dir: processed
  clusters_dir: clusters
  reviews_dir: reviews
  reports_dir: reports
```

## 运行测试

```bash
# 安装开发依赖
pip install pytest pytest-cov

# 运行所有测试
pytest -v

# 运行特定测试
pytest tests/test_parsers.py -v

# 覆盖率报告
pytest --cov=classroom_cluster --cov-report=html
```

## 数据目录结构

```
.cqc_data/
├── raw/                    # 原始导入文件
│   ├── import_manifest.json
│   ├── subtitle_20240115_140000.srt
│   ├── chat_20240115_140001.csv
│   └── outline_20240115_140002.yaml
├── processed/              # 处理后的数据
│   ├── questions.json
│   └── chapters.json
├── clusters/               # 聚类结果
│   ├── clusters_latest.json
│   └── clusters_20240115_140500.json
├── reviews/                # 复核记录
│   ├── review_latest.json
│   └── review_20240115_141000.json
└── reports/                # 生成的报告
    ├── review_20240115_141500.md
    ├── questions_20240115_141500.csv
    └── audit_20240115_141500.json
```

## 问题提取规则

系统自动识别以下类型的问题：

1. **显式问题**：包含问号 `?` 或 `？`，或使用 "请问"、"我想问" 等前缀
2. **澄清请求**：包含 "不明白"、"不懂"、"不清楚"、"没理解" 等
3. **隐含问题**：包含 "什么"、"怎么"、"如何"、"为什么" 等疑问词

## 聚类算法说明

使用的是本地轻量级方案，无需外部 API：

1. **文本预处理**：jieba 中文分词 + 停用词过滤
2. **TF-IDF 向量化**：将文本转换为数值向量
3. **层次聚类**：使用 cosine 距离进行 Agglomerative Clustering
4. **置信度计算**：聚类内平均余弦相似度

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 PR！
