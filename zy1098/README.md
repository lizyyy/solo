# 作文错题与薄弱知识点归类助手

一个本地运行的作文分析工具，用于归类错题和识别薄弱知识点。无需外部大模型，完全基于规则、关键词和轻量文本相似度。

## 核心特性

- 📥 **多格式导入**：支持 CSV（作文数据）、Markdown（老师反馈）、JSON（错题记录）
- 🔍 **智能分类**：基于关键词规则自动识别问题类型（审题偏差、结构松散、证据不足等）
- 🧩 **相似聚类**：使用文本相似度算法将相似问题聚在一起
- 📊 **薄弱分析**：自动计算薄弱知识点优先级，综合频率、置信度、时间远近
- ✅ **任务生成**：自动生成个性化复习任务清单
- 📄 **多格式报告**：导出 Markdown、HTML、JSON 三种格式报告

## 支持的错因标签

内置 10 种常见作文问题标签：

| 标签ID | 显示名称 | 优先级 | 说明 |
|--------|----------|--------|------|
| `off_topic` | 审题偏差 | ⭐⭐⭐⭐⭐ | 跑题、偏题、中心不明确 |
| `structure_weak` | 结构松散 | ⭐⭐⭐⭐ | 段落不清、缺乏过渡 |
| `evidence_insufficient` | 证据不足 | ⭐⭐⭐⭐ | 论据弱、缺乏例证 |
| `logic_confusion` | 逻辑混乱 | ⭐⭐⭐⭐ | 推理不当、前后矛盾 |
| `expression_empty` | 表达空泛 | ⭐⭐⭐ | 语言平淡、缺乏文采 |
| `material_inappropriate` | 选材不当 | ⭐⭐⭐ | 例子老套、不典型 |
| `beginning_ending_weak` | 开头结尾薄弱 | ⭐⭐⭐ | 开头平淡、结尾仓促 |
| `grammar_error` | 语法错误 | ⭐⭐⭐ | 病句、句子不通 |
| `language_vocabulary_weak` | 词汇贫乏 | ⭐⭐ | 用词单一、词汇量少 |
| `typo` | 错别字 | ⭐⭐ | 形近字、同音字错误 |

## 快速开始

### 环境要求

- Python 3.7+
- 无需额外依赖（使用标准库）

### 安装

直接克隆或下载项目即可使用：

```bash
cd essay-error-analyzer
```

### 运行主流程

使用示例数据测试：

```bash
python3 main.py analyze --essays data/essays.csv --feedback data/feedback.md --mistakes data/mistakes.json
```

### 常用命令

#### 1. 完整分析流程

```bash
# 分析所有数据
python3 main.py analyze --essays essays.csv --feedback feedback.md --mistakes mistakes.json

# 按学生筛选
python3 main.py analyze --essays essays.csv --student "张三"

# 指定输出目录和格式
python3 main.py analyze --essays essays.csv --output-dir ./my-reports --formats md html json

# 调整聚类阈值（默认 0.7）
python3 main.py analyze --essays essays.csv --cluster-threshold 0.6

# 限制最低置信度
python3 main.py analyze --essays essays.csv --confidence-min 0.5

# 限制每个学生的任务数
python3 main.py analyze --essays essays.csv --max-tasks 3
```

#### 2. 查看数据统计

```bash
python3 main.py stats --essays essays.csv --feedback feedback.md --mistakes mistakes.json
```

#### 3. 列出支持的标签

```bash
python3 main.py list --labels
```

#### 4. 查看帮助

```bash
python3 main.py --help
python3 main.py analyze --help
```

## 数据格式说明

### 1. 作文数据 (CSV)

字段说明：

| 字段名 | 别名 | 必填 | 说明 |
|--------|------|------|------|
| `student_name` | 学生、姓名、学生姓名 | 是 | 学生姓名 |
| `title` | 题目、作文题目、标题 | 否 | 作文标题 |
| `essay_type` | 文体、类型、作文类型 | 否 | 作文类型（议论文、记叙文等） |
| `score` | 分数、得分、成绩 | 是 | 得分 |
| `max_score` | 满分、总分、最高分 | 是 | 满分 |
| `date` | 日期、时间、考试日期 | 否 | 日期（支持多种格式） |
| `content` | 内容、正文、作文内容 | 否 | 作文正文 |

示例：
```csv
student_name,title,essay_type,score,max_score,date,content
张三,谈诚信,议论文,75,100,2026-04-15,"本文论述了诚信的重要性..."
李四,我的理想,记叙文,82,100,2026-04-20,"每个人都有自己的理想..."
```

### 2. 老师反馈 (Markdown)

格式要求：
- 用 `#` 标题或 `---` 分割不同学生的反馈
- 每个反馈块包含：学生信息、老师批注、错因分析、学生订正

示例：
```markdown
## 张三 - 谈诚信

**学生**: 张三
**题目**: 谈诚信
**文体**: 议论文
**日期**: 2026-04-16
**得分**: 75/100

### 老师批注
这篇文章审题基本正确，但中心不够突出。文章结构松散，段落之间缺乏过渡。

### 错因分析
审题偏了，没有抓住核心。结构散，没有使用总分总结构。

### 学生订正
我重新写了开头，增加了过渡句。
```

### 3. 错题记录 (JSON)

支持数组格式或包含 `mistakes` 字段的对象：

示例：
```json
[
    {
        "student_name": "张三",
        "mistake_type": "审题问题",
        "description": "在《谈诚信》一文中，审题偏了...",
        "essay_title": "谈诚信",
        "essay_type": "议论文",
        "date": "2026-04-16",
        "severity": "高",
        "correction": "重新审题，明确每段要表达的中心"
    }
]
```

字段说明：

| 字段名 | 别名 | 必填 | 说明 |
|--------|------|------|------|
| `student_name` | 学生、姓名 | 是 | 学生姓名 |
| `mistake_type` | 类型、错误类型 | 否 | 错误类型 |
| `description` | desc、描述、错误描述 | 否 | 错误描述 |
| `essay_title` | title、题目、作文题目 | 否 | 作文标题 |
| `essay_type` | 文体、作文类型 | 否 | 作文类型 |
| `date` | 日期、时间 | 否 | 日期 |
| `severity` | 严重程度、级别、等级 | 否 | 严重程度（高/中/低 或 high/medium/low） |
| `correction` | 修改、订正、纠正、正确写法 | 否 | 订正内容 |

## 输出报告说明

生成的报告包含以下内容：

### 1. 统计概览
- 各类数据的数量统计
- 应用的筛选条件

### 2. 薄弱知识点优先级排序
按优先级从高到低展示每个薄弱点：
- 优先级（1-10星）
- 出现次数
- 平均置信度
- 影响分数
- 最近出现日期
- **复习建议**
- **问题证据片段**（带置信度）

### 3. 相似问题聚类
- 聚类大小（记录数）
- 平均相似度
- 聚类说明和代表性片段

### 4. 复习任务清单
每个学生的个性化任务：
- 优先级星级
- 预计时间
- 难度
- 任务描述（包含复习建议和证据）
- 建议完成日期

### 5. 附录：所有发现的问题
按学生分组展示所有识别出的问题，包含：
- 问题类型
- 置信度
- 归类说明（为什么被归为此类）

## 自定义配置

可以通过创建配置文件来自定义规则和词典。在项目根目录创建 `configs` 文件夹：

```
essay-error-analyzer/
├── configs/
│   ├── rules.json      # 自定义标签规则
│   └── dictionary.json # 自定义词典
├── main.py
└── ...
```

### 自定义标签规则 (rules.json)

示例：
```json
{
    "similarity_threshold": 0.6,
    "cluster_threshold": 0.7,
    "min_cluster_size": 2,
    "language": "zh",
    "labels": {
        "my_custom_label": {
            "display_name": "我的自定义标签",
            "keywords": ["关键词1", "关键词2"],
            "synonyms": ["同义词1", "同义词2"],
            "patterns": [],
            "exclude_keywords": [],
            "priority": 3,
            "description": "这是一个自定义标签的描述",
            "suggestion_template": "针对这个问题的复习建议...",
            "estimated_time": "30分钟",
            "difficulty": "medium"
        }
    }
}
```

### 自定义词典 (dictionary.json)

示例：
```json
{
    "stopwords": ["的", "了", "是"],
    "custom_words": ["中考作文", "高考作文"],
    "essay_types": ["记叙文", "议论文", "说明文", "散文"],
    "severity_levels": {
        "high": 1.5,
        "medium": 1.0,
        "low": 0.5
    }
}
```

## 项目结构

```
essay-error-analyzer/
├── main.py                 # CLI 入口
├── core/
│   ├── __init__.py
│   ├── models.py           # 数据模型定义
│   ├── parser.py           # 文件解析器（CSV/MD/JSON）
│   ├── validator.py        # 字段校验器
│   ├── classifier.py       # 标签分类器（规则引擎）
│   ├── similarity.py       # 相似度计算和聚类
│   ├── filter.py           # 筛选和排序
│   ├── task_generator.py   # 任务生成器
│   └── exporter.py         # 报告导出器
├── config/
│   ├── __init__.py
│   └── loader.py           # 配置加载器（内置默认规则）
├── configs/                # 可选：自定义配置目录
│   ├── rules.json
│   └── dictionary.json
├── data/                   # 示例数据
│   ├── essays.csv
│   ├── feedback.md
│   └── mistakes.json
├── reports/                # 输出报告目录
└── README.md
```

## 算法说明

### 1. 关键词匹配

- 支持三种模式：精确关键词、同义词、正则表达式
- 支持排除关键词（用于避免误判）
- 置信度计算：基于关键词类型（关键词>同义词>正则）、优先级、长度

### 2. 文本相似度

使用混合相似度算法：
- **Jaccard 相似度**：基于词集的重叠度
- **余弦相似度**：基于 TF-IDF 向量
- **编辑距离**：用于短文本比较
- **标签相似度**：基于已识别的标签一致性

混合权重：标签相似度 35% + Jaccard 25% + 余弦相似度 40%

### 3. 聚类算法

使用基于密度的聚类：
1. 先按标签分组
2. 同标签内按文本相似度聚类
3. 可配置相似度阈值（默认 0.7）

### 4. 优先级计算

综合考虑以下因素：
- 标签基础优先级（1-5）
- 出现频率（>=5 次 +2，>=3 次 +1）
- 置信度（>=80% +1，<60% -1）
- 时间远近（7天内 +1，14天前 -1）

最终优先级范围：1-10

## 示例输出

运行示例数据后，你会在 `reports` 目录看到：

```
reports/
├── report_20260504_013002.md    # Markdown 报告
├── report_20260504_013002.html  # HTML 报告（带样式）
└── report_20260504_013002.json  # JSON 格式（便于程序处理）
```

## 常见问题

### Q1: 数据导入失败？
- 检查文件编码：请使用 UTF-8 编码
- 检查 CSV 格式：确保表头正确
- 检查 JSON 格式：可以先使用 `python3 -m json.tool mistakes.json` 验证

### Q2: 为什么没有识别到问题？
- 检查文本内容是否包含关键词
- 可以降低 `--confidence-min` 参数
- 或添加自定义关键词到配置文件

### Q3: 为什么聚类为空？
- 默认聚类阈值 0.7 可能太高
- 尝试使用 `--cluster-threshold 0.6` 降低阈值

### Q4: 如何添加新的问题类型？
- 创建 `configs/rules.json` 配置文件
- 添加新的标签定义，包含关键词、同义词等

## 更新日志

### v1.0.0 (2026-05-04)
- 初始版本发布
- 支持 CSV/MD/JSON 三种格式导入
- 内置 10 种常见作文问题标签
- 支持文本相似度计算和聚类
- 支持薄弱知识点优先级排序
- 支持自动生成复习任务
- 支持导出 Markdown/HTML/JSON 报告
- 支持自定义配置文件

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 PR！
