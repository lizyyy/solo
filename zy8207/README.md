# 简历岗位匹配偏差复核工具

本地 Python 工具，用于复核简历岗位匹配模型的偏差，检测模型推荐与实际面试结果之间的不匹配。

## 功能特性

- **多格式数据读取**：支持 YAML（岗位要求）、JSONL（脱敏简历）、CSV（模型打分、面试结果）
- **技能别名归一化**：自动识别不同写法的同一技能（如 "Python3" → "Python", "Py" → "Python", "RESTful API" → "REST API"）
- **年限边界检测**：识别候选人年限刚好卡在要求边界的情况
- **模型-面试偏差检测**：重点发现模型高分但面试淘汰、模型低分但面试通过的异常
- **三种输出格式**：
  - `mismatch_cases.csv`：详细不匹配案例表格
  - `bias_review.md`：Markdown 格式详细报告
  - `HTML 概览`：交互式可视化报告

## 重点检测的异常类型

1. **技能写法不同**：候选人技能名称与岗位要求写法不同但实际是同一技能
   - 例如：简历写 "Py"、"Python3"，要求写 "Python"
   - 例如：简历写 "RESTful API"，要求写 "REST API"

2. **年限刚好卡边界**：候选人工作年限在要求边界±0.5年范围内
   - 例如：要求 3-8 年，候选人 2.8、3.0、3.2、7.8、8.0、8.2 年

3. **模型高分但面试淘汰**：模型给出高分但实际面试被拒
   - 例如：模型评分 0.85（排名第3），但面试被淘汰

## 项目结构

```
zy8207/
├── main.py                    # 主程序入口
├── requirements.txt           # 依赖包
├── resume_matcher/            # 核心包
│   ├── __init__.py
│   ├── config/                # 配置模块
│   │   ├── __init__.py
│   │   └── skill_aliases.py   # 技能别名映射配置
│   ├── data_loader/           # 数据加载模块
│   │   ├── __init__.py
│   │   └── loaders.py         # YAML/JSONL/CSV 加载器
│   ├── normalizer/            # 归一化模块
│   │   ├── __init__.py
│   │   └── skill_normalizer.py # 技能别名归一化、年限验证
│   ├── matcher/               # 匹配复核模块
│   │   ├── __init__.py
│   │   └── bias_reviewer.py   # 核心偏差检测逻辑
│   └── reporter/              # 报告生成模块
│       ├── __init__.py
│       └── generators.py      # CSV/Markdown/HTML 报告生成
├── samples/                    # 示例数据
│   ├── job_requirement.yaml   # 岗位要求
│   ├── resumes.jsonl          # 脱敏简历
│   ├── model_scores.csv       # 模型打分
│   └── interview_results.csv  # 面试结果
├── tests/                      # 测试文件
└── output/                     # 输出目录（运行时生成）
```

## 安装

```bash
# 安装依赖
pip install -r requirements.txt
```

## 快速开始

### 使用示例数据运行演示

```bash
# 使用 --sample 参数运行演示
python main.py --sample

# 或者详细模式
python main.py --sample --verbose
```

这将使用 `samples/` 目录下的示例数据运行，并在 `output/` 目录生成报告。

### 使用自定义数据

```bash
# 基本用法
python main.py \
  --job your_job.yaml \
  --resumes your_resumes.jsonl \
  --model-scores your_scores.csv \
  --interview-results your_interviews.csv \
  --output ./output

# 使用短参数
python main.py \
  -j job.yaml \
  -r resumes.jsonl \
  -m scores.csv \
  -i results.csv \
  -o out/

# 自定义输出文件名前缀
python main.py -j ... -o ./output -n my_review
```

### 命令行参数说明

| 参数 | 短参数 | 说明 | 默认值 |
|------|--------|------|--------|
| `--sample` | `-s` | 使用示例数据运行演示 | - |
| `--job` | `-j` | 岗位要求 YAML 文件路径 | - |
| `--resumes` | `-r` | 脱敏简历 JSONL 文件路径 | - |
| `--model-scores` | `-m` | 模型打分 CSV 文件路径 | - |
| `--interview-results` | `-i` | 面试结果 CSV 文件路径 | - |
| `--output` | `-o` | 输出目录路径 | `./output` |
| `--base-name` | `-n` | 输出文件名前缀 | `review` |
| `--verbose` | `-v` | 显示详细输出 | - |

## 输入数据格式

### 1. 岗位要求 YAML

```yaml
job_id: JOB001
job_title: 高级 Python 后端开发工程师
required_skills:
  - Python
  - Django
  - PostgreSQL
  - Redis
  - Docker
  - REST API
  - Git
preferred_skills:
  - AWS
  - Kubernetes
experience_min: 3.0
experience_max: 8.0
education_level: 本科
location: 北京
remote_allowed: true
```

### 2. 脱敏简历 JSONL

每行一个 JSON 对象：

```json
{
  "candidate_id": "CAND001",
  "skills": ["Python", "Django", "PostgreSQL", "Redis", "Docker"],
  "total_experience_years": 5.0,
  "education_level": "本科",
  "current_location": "北京",
  "willing_to_relocate": true,
  "current_title": "Python 开发工程师",
  "salary_expectation": 25000
}
```

### 3. 模型打分 CSV

```csv
candidate_id,job_id,model_score,model_rank,skill_score,experience_score,education_score
CAND001,JOB001,0.92,1,0.95,0.90,0.85
CAND002,JOB001,0.78,2,0.70,0.85,0.85
```

### 4. 面试结果 CSV

```csv
candidate_id,job_id,interview_date,interviewer,overall_rating,technical_rating,behavioral_rating,final_outcome,rejection_reason,interview_notes
CAND001,JOB001,2024-01-15,张三,4.8,4.9,4.7,pass,,技术扎实
CAND003,JOB001,2024-01-16,王五,2.0,1.5,2.5,fail,Python基础薄弱,面试表现差
```

## 输出文件说明

运行后会在输出目录生成三个文件：

### 1. `review_mismatch_cases.csv`

包含所有检测到的不匹配案例，列包括：
- `candidate_id`: 候选人ID
- `job_id`: 岗位ID
- `mismatch_type`: 不匹配类型
- `severity`: 严重程度（high/medium/low）
- `description`: 描述
- `model_score`: 模型分数
- `model_rank`: 模型排名
- `interview_outcome`: 面试结果
- `technical_rating`: 技术评分
- `recommendation`: 建议
- `details_json`: 详细信息（JSON格式）

### 2. `review_bias_review.md`

详细的 Markdown 报告，包含：
- 概览统计
- 按类型分布的不匹配案例
- 按严重程度分类
- 高优先级案例详情
- 行动建议

### 3. `review_overview.html`

交互式可视化报告，可以直接在浏览器打开，包含：
- 统计卡片
- 柱状图（按类型分布）
- 饼图（按严重程度）
- 可筛选的不匹配案例列表
- 点击展开查看详情

## 示例数据说明

`samples/` 目录下的示例数据包含以下典型场景：

| 候选人 | 技能特点 | 年限 | 模型分数 | 面试结果 | 检测到的异常 |
|--------|----------|------|----------|----------|--------------|
| CAND001 | 标准匹配 | 5.0年 | 0.92 #1 | pass | - |
| CAND002 | 使用别名（Py、RESTful API、Github） | 4.5年 | 0.78 #2 | pass | 技能别名不匹配 |
| CAND003 | 使用别名（Python3、Django Framework、K8s） | 3.0年（边界） | 0.85 #3 | fail | 技能别名、年限边界、高分被拒 |
| CAND004 | 技能不匹配 | 2.8年（边界） | 0.65 | fail | 年限边界、技能差距 |
| CAND005 | 标准匹配 | 3.2年（边界） | 0.72 | pass | 年限边界 |
| CAND006 | 标准匹配 | 7.8年（边界） | 0.88 | pass | 年限边界 |
| CAND007 | 标准匹配 | 8.0年（边界） | 0.90 #7 | fail | 年限边界、高分被拒 |
| CAND008 | 标准匹配 | 8.2年（边界） | 0.75 | pass | 年限边界 |
| CAND009 | Java背景 | 4.0年 | 0.45 | fail | 技能差距 |
| CAND010 | 前端背景 | 3.5年 | 0.50 | fail | 技能差距 |

## 运行测试

```bash
# 运行所有测试
python -m pytest tests/ -v

# 运行特定测试
python -m pytest tests/test_skill_normalizer.py -v
python -m pytest tests/test_bias_reviewer.py -v
```

## 扩展技能别名

如需添加更多技能别名，编辑 `resume_matcher/config/skill_aliases.py`：

```python
SKILL_ALIAS_MAP = {
    "python": ["python3", "py", "python 3", "my_custom_alias"],
    # ... 更多映射
}
```

## 配置参数

可在 `resume_matcher/matcher/bias_reviewer.py` 中调整：

```python
HIGH_SCORE_THRESHOLD = 0.7   # 高分阈值
LOW_SCORE_THRESHOLD = 0.3    # 低分阈值
TOP_RANK_THRESHOLD = 5       # 高排名阈值
```

可在 `resume_matcher/normalizer/skill_normalizer.py` 中调整：

```python
BOUNDARY_TOLERANCE = 0.5  # 年限边界容差（年）
```

## License

MIT License
