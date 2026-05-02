# 招投标问答资料整理工具

一个本地离线运行的招投标问答资料整理工具，帮助售前同事高效整理历史Q&A、产品参数和客户问题。

## 功能特性

- **数据导入**：支持CSV、JSON、TXT多种格式的历史数据导入
- **文本清洗**：自动处理空答案、标准化文本、去除重复条目
- **相似检索**：基于TF-IDF和关键词规则的离线文本相似度匹配
- **同义词处理**：内置招投标领域常见同义词，支持同义问法识别
- **冲突检测**：自动检测历史答案冲突、参数版本不一致等问题
- **草稿生成**：为每个客户问题生成答复草稿和引用来源
- **报告导出**：生成详细的Markdown报告和CSV格式草稿列表
- **完全离线**：不调用任何外部API，所有处理本地完成

## 安装

### 环境要求

- Python 3.8+
- pip 包管理器

### 安装步骤

1. 克隆或下载项目代码
2. 安装依赖：

```bash
pip install -r requirements.txt
```

3. （可选）安装为可执行命令：

```bash
pip install -e .
```

## 快速开始

### 一条命令运行

使用示例数据运行完整流程：

```bash
python -m qa_tool.cli --qa data/qa_history.csv --params data/product_params.csv --questions data/customer_questions.txt
```

或安装后使用命令：

```bash
qa_tool --qa data/qa_history.csv --params data/product_params.csv --questions data/customer_questions.txt
```

### 输出文件

运行后会在 `out/` 目录生成以下文件：

- **qa_report.md**：完整的处理报告，包含统计信息、冲突检测、答复草稿等
- **drafts.csv**：简洁的草稿列表，方便快速查看和处理
- **processing_summary.md**：数据处理摘要

## 数据格式说明

### 历史Q&A文件 (CSV)

格式：
```csv
question,answer,source,id
系统支持多少并发用户？,系统支持最多1000个并发用户同时在线。,2024年度技术文档,QA001
系统支持哪些数据库？,系统支持MySQL、PostgreSQL、Oracle等主流数据库。,产品技术白皮书,QA002
```

字段说明：
- `question`：问题内容（必填）
- `answer`：答案内容（必填）
- `source`：来源标识（可选，用于追踪引用）
- `id`：唯一标识（可选）

### 产品参数文件 (CSV)

格式：
```csv
product_name,param_name,param_value,version,source
企业版ERP,最大并发用户数,1000,V3.0,产品参数表V3
企业版ERP,最大并发用户数,500,V2.0,产品参数表V2
```

字段说明：
- `product_name`：产品名称（可选）
- `param_name`：参数名称（必填）
- `param_value`：参数值（必填）
- `version`：版本标识（可选，用于版本冲突检测）
- `source`：来源标识（可选）

### 客户问题文件 (TXT)

格式：每行一个问题，空行分隔不同问题块

```
贵系统最多能够支持多少并发用户？

我们需要知道系统是否支持Oracle数据库？

请问系统是否具备数据备份功能？备份数据存储在哪里？
```

或使用CSV格式：
```csv
question,context,id
贵系统最多能够支持多少并发用户？,客户为大型企业,Q001
```

## 命令行参数

```bash
qa_tool [OPTIONS]

必需参数:
  --qa, -q           历史Q&A文件路径，可多次指定
  --params, -p       产品参数文件路径，可多次指定
  --questions, -c    客户问题文件路径

可选参数:
  --qa-format        Q&A文件格式: csv 或 json (默认: csv)
  --question-format  客户问题格式: txt 或 csv (默认: txt)
  --threshold, -t    相似度阈值 0.0-1.0 (默认: 0.6)
  --top-similar      每个问题返回的相似Q&A数量 (默认: 3)
  --top-params       每个问题返回的相关参数数量 (默认: 2)
  --output, -o       输出目录 (默认: out)
  --skip-clustering  跳过问题聚类步骤
  --verbose, -v      显示详细输出信息
  --version          显示版本信息
  --help             显示帮助信息
```

## 模块架构

```
qa_tool/
├── __init__.py           # 包初始化
├── cli.py                # 命令行入口
└── modules/              # 功能模块
    ├── __init__.py
    ├── data_import.py    # 数据导入模块
    ├── text_cleaner.py   # 文本清洗模块
    ├── similarity_search.py  # 相似检索模块
    ├── conflict_detector.py  # 冲突检测模块
    ├── draft_generator.py    # 草稿生成模块
    └── report_exporter.py    # 报告导出模块
```

### 模块说明

1. **data_import.py**：负责读取CSV、JSON、TXT格式的数据文件
2. **text_cleaner.py**：处理空答案、标准化文本、去重
3. **similarity_search.py**：实现TF-IDF相似度计算、关键词匹配、同义词处理、聚类
4. **conflict_detector.py**：检测数值冲突、是/否冲突、版本冲突
5. **draft_generator.py**：合成答复草稿、计算置信度、标记状态
6. **report_exporter.py**：导出Markdown报告和CSV文件

## 冲突检测

工具会自动检测以下类型的冲突：

### Q&A冲突

- **数值冲突**：相似问题但答案中的数值不一致（如并发用户数1000 vs 500）
- **是/否冲突**：相似问题但答案存在"支持"与"不支持"的矛盾
- **语义冲突**：相似问题但答案描述完全不同

### 参数冲突

- **版本差异**：同一参数在不同版本中有不同值（正常版本差异，低优先级）
- **数值冲突**：同一版本内参数值不一致（高优先级）
- **值冲突**：参数描述不一致（中优先级）

## 同义词配置

工具内置了招投标领域常见同义词，包括：

- 支持、兼容、能够、可以、允许
- 功能、特性、能力、模块
- 价格、费用、成本、报价
- 并发、同时、并行
- 存储、保存、容量、空间
- 以及更多...

如需添加自定义同义词，可修改 `qa_tool/modules/similarity_search.py` 中的 `SynonymHandler.DEFAULT_SYNONYMS`。

## 测试

运行单元测试：

```bash
pytest tests/ -v
```

或运行指定测试文件：

```bash
pytest tests/test_data_import.py -v
pytest tests/test_similarity_search.py -v
```

## 使用示例

### 示例1：基本使用

```bash
qa_tool --qa data/qa_history.csv --params data/product_params.csv --questions data/customer_questions.txt
```

### 示例2：使用多个Q&A文件

```bash
qa_tool --qa data/qa_2023.csv --qa data/qa_2024.csv --params data/params.csv --questions data/questions.txt
```

### 示例3：调整相似度阈值

```bash
qa_tool --qa data/qa.csv --params data/params.csv --questions data/questions.txt --threshold 0.7
```

### 示例4：详细输出模式

```bash
qa_tool --qa data/qa.csv --params data/params.csv --questions data/questions.txt --verbose
```

## 输出报告解读

### qa_report.md 结构

1. **处理摘要**：统计信息、置信度分布、状态分布、冲突统计
2. **数据清洗问题**：空答案、重复项的详细列表
3. **冲突检测结果**：Q&A冲突、参数冲突的详细信息
4. **相似问题聚类**：相似问题的分组情况
5. **答复草稿**：每个问题的草稿内容、置信度、来源引用、冲突警告

### drafts.csv 字段

- 序号：问题序号
- 问题：客户问题内容
- 状态：草稿状态（已就绪/草稿/存在冲突/需要审核）
- 置信度：0%-100%
- 草稿内容：生成的答复草稿
- 参考来源：匹配的历史Q&A及其相似度
- 关联参数：匹配的产品参数
- 冲突警告：检测到的冲突信息
- 备注：其他重要提示

## 注意事项

1. **数据质量**：输入数据的质量直接影响输出结果，建议先清理原始数据
2. **相似度阈值**：默认阈值0.6可覆盖大多数场景，可根据实际情况调整
3. **冲突处理**：工具只检测冲突，不自动解决，需要人工核实
4. **完全离线**：所有处理在本地完成，不会上传任何数据
5. **中文支持**：使用jieba进行中文分词，确保中文文本处理准确

## License

MIT License

## 贡献

欢迎提交Issue和Pull Request。
