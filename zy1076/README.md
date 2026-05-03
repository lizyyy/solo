# 简历岗位匹配小助手

**本地AI/ML应用 - 保护您的隐私**

一款完全在本地运行的简历与岗位JD匹配分析工具，帮助您在投递简历前快速评估匹配度，找出技能缺口和改进方向。

## 🌟 核心特性

- **🔒 隐私保护**: 所有计算均在本地完成，不涉及任何外部API或云端服务
- **📊 多维度匹配**: 基于技能词典 + TF-IDF相似度的双重匹配机制
- **🎯 智能分析**: 自动识别命中技能、缺失技能，并提供具体证据句
- **💡 深度洞察**: 生成优势、劣势、改进建议、过度包装警告等分析
- **📈 批量比较**: 支持多份简历 vs 多个岗位的矩阵式比较
- **📄 多格式支持**:
  - 简历: `.txt`, `.md`, `.csv`
  - 岗位JD: `.txt`, `.md`, `.csv`
  - 报告导出: `.json`, `.md`, `.html`
- **🔧 可训练**: 支持基于历史数据校准模型权重
- **🏷️ 技能别名**: 内置200+技能词典，支持别名归一化（如 JS → JavaScript, React.js → React）

## 📁 项目结构

```
resume-matcher/
├── resume_matcher/           # 核心模块
│   ├── __init__.py
│   ├── exceptions.py          # 自定义异常
│   ├── parser.py              # 文件解析器
│   ├── skills_dictionary.py   # 技能词典
│   ├── model.py               # 匹配模型
│   ├── report_generator.py    # 报告生成
│   └── cli.py                 # 命令行入口
├── data/
│   ├── resumes/               # 简历数据
│   │   ├── resume_ai_engineer.md
│   │   ├── resume_data_analyst.txt
│   │   ├── resume_fullstack_dev.md
│   │   └── resumes.csv
│   ├── jobs/                  # 岗位JD
│   │   ├── job_ai_engineer.md
│   │   ├── job_data_analyst.txt
│   │   ├── job_fullstack_dev.md
│   │   └── jobs.csv
│   ├── models/                # 模型保存
│   └── reports/               # 报告输出
├── tests/                     # 测试文件
│   ├── test_skills_dictionary.py
│   ├── test_parser.py
│   └── test_model.py
├── config.py                  # 全局配置
├── requirements.txt           # 依赖清单
├── pyproject.toml             # 项目配置
└── README.md
```

## 🚀 快速开始

### 1. 环境准备

```bash
# 克隆项目或进入项目目录
cd /path/to/resume-matcher

# 创建虚拟环境（推荐）
python -m venv venv
source venv/bin/activate  # Linux/macOS
# 或
venv\Scripts\activate     # Windows

# 安装依赖
pip install -r requirements.txt
```

### 2. 运行自检

```bash
# 运行自检确认环境正常
python -m resume_matcher.cli self-check
```

### 3. 使用示例数据

项目已包含示例数据，可直接运行：

```bash
# 匹配所有简历和岗位
python -m resume_matcher.cli match

# 指定输出格式
python -m resume_matcher.cli match -f json -f md -f html

# 查看生成的报告
ls data/reports/
```

### 4. 查看技能词典

```bash
# 查看所有技能
python -m resume_matcher.cli list-skills

# 按类别筛选
python -m resume_matcher.cli list-skills -c "AI/机器学习"

# 搜索技能
python -m resume_matcher.cli list-skills -s "Python"

# 导出技能词典
python -m resume_matcher.cli list-skills -e my_skills.json
```

## 📖 详细使用指南

### 一、数据准备

#### 1. 简历格式

支持三种格式，放在 `data/resumes/` 目录：

**Markdown格式 (推荐)**
```markdown
# 张三 - AI算法工程师

## 技能
- Python, TensorFlow, PyTorch
- 机器学习, 深度学习, NLP
- SQL, MySQL, Redis

## 工作经历
### AI算法工程师 | 某科技公司 | 2022-至今
- 使用PyTorch和HuggingFace开发文本分类模型
- 搭建LangChain + RAG方案，构建知识库问答系统
...
```

**纯文本格式**
```
张三 - 数据分析师

技能：
- Python, Pandas, NumPy
- SQL, MySQL, PostgreSQL
- Tableau, Power BI
- 数据分析, 统计分析, A/B测试

工作经历：
数据分析师 | 某电商公司 | 2021-至今
- 负责用户行为数据分析，构建用户画像
- 使用SQL进行数据提取和清洗
...
```

**CSV格式 (批量导入)**
```csv
name,title,skills,experience,projects,education,summary
张三,AI算法工程师,"Python,TensorFlow,PyTorch","3年AI经验","智能客服项目","计算机硕士","专注NLP领域"
李四,数据分析师,"Python,SQL,Tableau","3年数据分析","用户留存分析","统计学学士","擅长商业智能"
```

#### 2. 岗位JD格式

同样支持三种格式，放在 `data/jobs/` 目录：

```markdown
# AI算法工程师

## 岗位职责
- 负责NLP相关算法的研究与实现
- 参与LLM应用开发，包括Prompt Engineering和Fine-tuning
- 搭建和优化RAG系统

## 任职要求
### 必需技能
- 精通Python编程语言
- 熟悉机器学习和深度学习相关算法
- 熟练使用PyTorch或TensorFlow
- 有NLP项目经验，熟悉HuggingFace Transformers
- 了解LangChain或类似LLM应用开发框架

### 优先考虑
- 有大模型Fine-tuning经验
- 熟悉MLOps相关经验
- 熟悉Docker、Kubernetes容器化部署
```

### 二、执行匹配

#### 基本匹配

```bash
# 使用默认目录
python -m resume_matcher.cli match

# 指定简历和岗位路径
python -m resume_matcher.cli match -r /path/to/my_resume.md -j /path/to/job.txt

# 递归搜索子目录
python -m resume_matcher.cli match -R
```

#### 输出格式

```bash
# 生成多种格式报告
python -m resume_matcher.cli match -f json -f md -f html

# 指定输出目录
python -m resume_matcher.cli match -o ./my_reports
```

#### 使用已训练模型

```bash
# 加载自定义模型
python -m resume_matcher.cli match -m ./data/models/my_trained_model
```

### 三、模型训练

#### 训练数据格式

创建 `training_data.json`：

```json
[
    {
        "resume_content": "张三，精通Python和TensorFlow，有3年NLP经验...",
        "job_content": "要求精通Python，熟悉TensorFlow，有NLP经验...",
        "label": "high_match"
    },
    {
        "resume_content": "李四，Java开发，熟悉Spring Boot...",
        "job_content": "要求精通Python，AI算法经验...",
        "label": "low_match"
    }
]
```

标签可选值：
- `high_match` - 高度匹配
- `medium_match` - 一般匹配  
- `low_match` - 低度匹配

#### 执行训练

```bash
# 训练模型
python -m resume_matcher.cli train -d training_data.json -m ./data/models/my_model

# 训练完成后使用该模型进行匹配
python -m resume_matcher.cli match -m ./data/models/my_model
```

### 四、报告解读

#### HTML报告（推荐）

打开生成的 `.html` 文件，包含：

1. **📊 匹配分数矩阵** - 可视化展示所有简历与岗位的匹配度
2. **🎯 各岗位推荐简历** - 每个岗位的Top 3简历
3. **📋 详细匹配结果**：
   - 综合分数（技能匹配 + 文本相似度）
   - ✅ 命中技能（含证据句）
   - ❌ 缺失技能
   - 💪 优势分析
   - ⚠️ 劣势分析
   - 💡 改进建议
   - 🚨 注意事项（过度包装警告等）

#### Markdown报告

适合在编辑器中查看或粘贴到文档：

```markdown
## 匹配分数矩阵

| 简历 \ 岗位 | AI算法工程师 | 数据分析师 |
|-------------|--------------|------------|
| 张三 - AI算法工程师 | **85.3%** ✅ | 45.2% ❌ |
| 李四 - 数据分析师 | 38.1% ❌ | **78.5%** ✅ |
```

#### JSON报告

适合程序进一步处理：

```json
{
    "report_info": {
        "generated_at": "2024-01-15 10:30:00",
        "total_matches": 6
    },
    "match_results": [
        {
            "resume_id": "resume_ai_engineer",
            "job_id": "job_ai_engineer",
            "total_score": 0.853,
            "skill_score": 0.92,
            "tfidf_score": 0.78,
            "matched_skills": [...],
            "missing_skills": [...],
            "strengths": [...],
            "weaknesses": [...],
            "suggestions": [...],
            "warnings": [...]
        }
    ]
}
```

## 🎓 核心算法说明

### 1. 技能词典系统

内置200+技术技能，按12个类别分类：

| 类别 | 示例技能 |
|------|----------|
| 编程语言 | Python, Java, JavaScript, Go, Rust |
| 前端技术 | React, Vue.js, Angular, Next.js |
| 后端技术 | Django, Flask, Spring Boot, Express |
| 数据库 | MySQL, PostgreSQL, MongoDB, Redis |
| AI/机器学习 | 机器学习, 深度学习, NLP, PyTorch, TensorFlow |
| 数据分析 | 数据分析, SQL, Tableau, Power BI |
| 云服务 | AWS, Azure, GCP, Docker, Kubernetes |
| DevOps | CI/CD, Jenkins, GitLab CI, GitHub Actions |
| 项目管理 | 敏捷开发, Git, Jira |
| 软技能 | 团队协作, 沟通能力, 问题解决 |

**别名归一化示例**：
- `JS`, `js` → `JavaScript`
- `React.js`, `reactjs` → `React`
- `NLP` → `自然语言处理`
- `ML` → `机器学习`
- `BI` → `数据分析`
- `K8s` → `Kubernetes`

### 2. 匹配算法

综合分数 = 技能匹配分数 × 0.6 + TF-IDF相似度 × 0.4

#### 技能匹配分数
```
技能匹配分数 = Σ(匹配到的技能权重) / Σ(岗位要求技能权重)
```

- 每个技能有预设权重（核心技能权重更高）
- 权重可通过训练数据校准

#### TF-IDF相似度
```
使用TF-IDF向量化简历和岗位文本
计算余弦相似度
```

- 捕捉上下文语义
- 识别非关键词的描述匹配

### 3. 分析逻辑

**优势分析**：
- 高权重技能匹配
- 技能覆盖率 > 70%
- 文本相似度 > 50%
- 同类别技能丰富（≥3项）

**劣势分析**：
- 核心技能缺失
- 技能覆盖率 < 40%
- 文本相似度 < 20%
- 同类别技能缺口

**改进建议**：
- 缺失技能优先级排序
- 证据不足技能的描述建议
- 量化成果添加建议

**警告检测**：
- 技能列表缺乏项目描述（证据不足）
- 过度使用修饰词（精通、专家、资深...）
- 技能数量异常（>30项）

## 🧪 测试与验证

### 运行单元测试

```bash
# 运行所有测试
pytest tests/ -v

# 运行特定测试文件
pytest tests/test_skills_dictionary.py -v
pytest tests/test_parser.py -v
pytest tests/test_model.py -v

# 生成覆盖率报告
pytest tests/ --cov=resume_matcher
```

### 运行自检脚本

```bash
# 完整自检
python -m resume_matcher.cli self-check

# 详细输出
python -m resume_matcher.cli self-check -v
```

自检项目：
- ✅ 核心依赖检查
- ✅ 技能词典初始化
- ✅ 别名归一化
- ✅ 技能提取
- ✅ 模型匹配逻辑
- ✅ 异常处理
- ✅ 报告生成

## ⚠️ 异常处理

### 常见错误

| 错误 | 原因 | 解决方案 |
|------|------|----------|
| EmptyContentError | 文件内容为空 | 检查文件是否有有效内容 |
| MissingFieldError | CSV缺少必要字段 | 确保resumes.csv有`name`列，jobs.csv有`title`列 |
| InvalidFormatError | 不支持的文件格式 | 使用.txt/.md/.csv格式 |
| FileParseError | 编码或解析错误 | 尝试将文件另存为UTF-8编码 |
| ModelError | 训练样本不足 | 确保训练样本≥10个 |

### 警告信息

| 警告 | 含义 |
|------|------|
| 技能「X」缺乏具体项目描述 | 简历中只有技能名称，没有项目证据 |
| 使用了N个高级别修饰词 | 过多使用"精通"、"专家"等词，建议增加成果支撑 |
| 匹配到N项技能，建议聚焦 | 技能列表过长，建议突出核心技能 |

## 📋 可复现示例流程

### 步骤1：安装依赖
```bash
pip install -r requirements.txt
```

### 步骤2：运行自检
```bash
python -m resume_matcher.cli self-check
```

### 步骤3：匹配示例数据
```bash
python -m resume_matcher.cli match -f json -f md -f html
```

### 步骤4：查看报告
```bash
# macOS
open data/reports/*.html

# Linux
xdg-open data/reports/*.html

# 或直接用浏览器打开HTML文件
```

### 步骤5：运行测试
```bash
pytest tests/ -v
```

## 🎯 进阶用法

### 1. 自定义技能词典

```python
from resume_matcher.skills_dictionary import SkillsDictionary, Skill

# 加载现有词典
skills_dict = SkillsDictionary()

# 添加自定义技能
custom_skill = Skill(
    name="MyCustomSkill",
    aliases=["MCS", "my-skill"],
    category="自定义类别",
    weight=1.5,
    description="我的自定义技能",
)
skills_dict.add_skill(custom_skill)

# 保存
skills_dict.save("data/skills_dictionary.json")
```

### 2. 程序化使用

```python
from resume_matcher.parser import DocumentLoader
from resume_matcher.model import ResumeMatcherModel
from resume_matcher.report_generator import ReportGenerator

# 加载文档
loader = DocumentLoader()
resumes = loader.load_file("my_resume.md", "resumes")
jobs = loader.load_file("job_desc.txt", "jobs")

# 执行匹配
model = ResumeMatcherModel()
all_results, results_by_job = model.match_all(resumes, jobs)

# 生成报告
report_gen = ReportGenerator()
report_gen.save_report(
    output_path="report.html",
    format="html",
    all_results=all_results,
    comparison_matrix=model.generate_comparison_matrix(all_results, resumes, jobs),
)
```

## 🆕 版本历史

### v0.1.0
- 初始版本发布
- 支持txt/md/csv格式解析
- 技能词典系统（200+技能，别名归一化）
- TF-IDF + 技能权重双重匹配
- 多格式报告导出（JSON/Markdown/HTML）
- 模型训练与校准
- 完整的单元测试
- 示例数据与文档

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## ❓ 常见问题

**Q: 为什么不使用外部大模型？**

A: 本项目的核心理念是隐私保护。简历和岗位JD通常包含敏感信息，本工具确保所有计算都在本地完成，无需上传任何数据到外部服务。

**Q: 匹配准确率如何？**

A: 本工具使用的是规则+统计的方法，适合快速筛选和方向性指导。如果有历史匹配数据，可以通过训练功能校准权重，提升准确率。对于最终决策，仍建议人工审核。

**Q: 支持中文技能吗？**

A: 是的！内置技能词典同时支持中英文技能名称，并且支持别名归一化。例如：
- "自然语言处理" 和 "NLP" 会被识别为同一技能
- "数据分析" 和 "BI" 会被识别为同一技能

**Q: 如何添加更多技能？**

A: 两种方式：
1. 程序化方式：使用 `Skill` 类创建新技能并添加到词典
2. 配置文件方式：编辑 `data/skills_dictionary.json`（运行一次后会生成）

---

**⭐ 如果这个工具有帮助，欢迎给个Star！**

有任何问题或建议，请提交 Issue 或 Pull Request。
