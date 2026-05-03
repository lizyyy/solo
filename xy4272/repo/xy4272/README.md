# 阅读包推荐质检员

县图书馆少儿阅读活动推荐系统，用于自动生成阅读包推荐并进行质量检查。

## 功能特性

- **init**: 生成样例数据文件
- **train**: 构建兴趣画像（基于借阅历史、活动记录、家长反馈）
- **recommend**: 生成个性化推荐，提供可解释的推荐理由
- **check**: 质量检查（年龄段、库存、重复借阅、禁推主题、冷启动风险）
- **review**: 保存人工调整记录
- **report**: 导出 Markdown/CSV/JSON 格式报告

## 项目结构

```
reading_recommender/
├── reading_recommender/
│   ├── __init__.py          # 包初始化
│   ├── cli.py               # CLI 入口模块
│   ├── parser_validator.py  # 解析校验模块
│   ├── rules_engine.py      # 规则引擎模块
│   ├── profile_recommender.py # 画像/推荐模块
│   ├── review_storage.py    # 复核存储模块
│   ├── exporter.py          # 导出模块
│   └── sample_data.py       # 示例数据模块
├── tests/
│   ├── __init__.py
│   ├── test_parser.py       # 解析模块测试
│   ├── test_rules.py        # 规则引擎测试
│   └── test_recommender.py  # 推荐模块测试
├── setup.py                 # 安装配置
├── requirements.txt         # 依赖列表
└── README.md
```

## 安装

```bash
# 安装依赖
pip install -r requirements.txt

# 安装项目（可选）
pip install -e .
```

## 快速开始

### 1. 初始化项目

生成样例数据文件：

```bash
reading_recommender init
```

这将在 `data/` 目录下生成以下文件：
- `books.csv` - 图书目录
- `borrow_records.csv` - 借阅记录
- `activity_registrations.jsonl` - 活动报名
- `feedbacks.csv` - 家长反馈
- `forbidden_themes.yaml` - 禁推主题

### 2. 构建兴趣画像

基于借阅历史、活动记录和家长反馈构建兴趣画像：

```bash
reading_recommender train
```

输出示例：
```
✓ 已为 6 个孩子构建兴趣画像
  其中 1 个孩子为冷启动用户（无历史数据）

┌──────────┬──────────┬──────┬──────────┬──────────┬──────────┬──────────────────────┐
│ 孩子ID   │ 姓名     │ 年龄 │ 年龄段   │ 借阅数   │ 冷启动   │ 主要兴趣             │
├──────────┼──────────┼──────┼──────────┼──────────┼──────────┼──────────────────────┤
│ C001     │ 小明     │ 5    │ 3-6岁    │ 2        │ 否       │ 动物,亲情,爱...      │
│ C002     │ 小红     │ 8    │ 6-9岁    │ 3        │ 否       │ 科学,探索...         │
└──────────┴──────────┴──────┴──────────┴──────────┴──────────┴──────────────────────┘
```

### 3. 生成推荐

为孩子推荐阅读包：

```bash
# 为所有孩子推荐
reading_recommender recommend

# 为指定孩子推荐
reading_recommender recommend --child-id C001

# 每个孩子推荐 3 本
reading_recommender recommend --count 3
```

输出示例：
```
✓ 推荐结果（5 本）：
┌──────┬──────────────────────────┬─────────────────┬──────────┬──────────┬────────┐
│ 排名 │ 书名                     │ 作者            │ 分类     │ 年龄段   │ 分数   │
├──────┼──────────────────────────┼─────────────────┼──────────┼──────────┼────────┤
│ 1    │ 猜猜我有多爱你           │ 山姆·麦克布雷尼  │ 绘本     │ 3-6岁    │ 0.850  │
│ 2    │ 汪汪队立大功：救援行动    │ 斯平尼夫        │ 动画     │ 3-6岁    │ 0.720  │
└──────┴──────────────────────────┴─────────────────┴──────────┴──────────┴────────┘

推荐理由：
  1. 猜猜我有多爱你
    - 主题匹配：喜欢'爱'
    - 分类匹配：偏好绘本类图书
    - 历史偏好：曾借阅2本绘本类图书
```

### 4. 质量检查

检查推荐结果中的问题：

```bash
# 检查所有推荐
reading_recommender check

# 检查指定孩子
reading_recommender check --child-id C001

# 从文件加载推荐结果进行检查
reading_recommender check --recommendations-file data/output/recommendations.json
```

输出示例：
```
孩子：C001

┌──────────────────────────┬──────────┬──────────┬──────────┬──────────┐
│ 书名                     │ 状态     │ 风险等级 │ 问题数   │ 警告数   │
├──────────────────────────┼──────────┼──────────┼──────────┼──────────┤
│ 小猪佩奇的一天            │ ❌ 有问题│ 高风险   │ 1        │ 0        │
│ 猜猜我有多爱你            │ ✅ 通过  │ 低风险   │ 0        │ 0        │
└──────────────────────────┴──────────┴──────────┴──────────┴──────────┘

详细问题：
  《小猪佩奇的一天》
    ✗ 问题：重复推荐：孩子已借阅过《小猪佩奇的一天》
```

检查项说明：
| 检查项 | 描述 | 风险等级 |
|--------|------|----------|
| 年龄段匹配 | 图书年龄段与孩子年龄是否匹配 | 高风险 |
| 库存检查 | 图书库存是否充足 | 高风险 |
| 重复借阅 | 是否已借阅过该图书 | 中风险 |
| 禁推主题 | 是否包含禁推主题 | 严重风险 |
| 冷启动风险 | 是否有历史数据 | 低风险 |
| 不喜欢主题 | 是否包含家长反馈不喜欢的主题 | 中风险 |

### 5. 复核存储

保存人工调整记录：

```bash
reading_recommender review \
  --child-id C001 \
  --original-file data/output/original.json \
  --final-file data/output/final.json \
  --reviewer "张老师" \
  --notes "根据活动反馈调整了推荐"
```

输出示例：
```
✓ 复核记录已保存

变更统计：
  - 原始推荐数：5
  - 调整后推荐数：5
  - 移除图书数：1
  - 添加图书数：1
  - 复核人：张老师

移除的图书：
  - B001

添加的图书：
  - B005
```

### 6. 导出报告

导出多种格式的报告：

```bash
# 导出所有格式（Markdown/CSV/JSON）
reading_recommender report

# 仅导出 Markdown
reading_recommender report --format markdown

# 仅导出 CSV
reading_recommender report --format csv

# 仅导出 JSON
reading_recommender report --format json

# 指定输出目录
reading_recommender report --output ./reports

# 导出指定孩子的报告
reading_recommender report --child-id C001
```

报告内容包括：
- 孩子基本信息（姓名、年龄、年龄段）
- 兴趣画像（主题偏好、借阅历史）
- 推荐图书列表（排名、书名、作者、分类）
- 推荐理由
- 质量检查结果（问题、警告）

## 数据文件格式

### 图书目录 (books.csv)

```csv
book_id,title,author,category,age_group,stock,themes
B001,小猪佩奇的一天,英国广播公司,绘本,3-6岁,5,动物,日常生活,友谊
B004,神奇校车：水的旅行,乔安娜·柯尔,科普,6-9岁,4,科学,自然,探索
```

字段说明：
- `book_id`: 图书唯一标识
- `title`: 书名
- `author`: 作者
- `category`: 分类（绘本、科普、童话、文学等）
- `age_group`: 年龄段（3-6岁、6-9岁、9-12岁、12-15岁）
- `stock`: 库存数量
- `themes`: 主题标签（逗号分隔）

### 借阅记录 (borrow_records.csv)

```csv
child_id,book_id,borrow_date,return_date
C001,B001,2024-01-01,2024-01-15
C001,B003,2024-01-20,
```

字段说明：
- `child_id`: 孩子唯一标识（匿名）
- `book_id`: 图书ID
- `borrow_date`: 借阅日期
- `return_date`: 归还日期（空表示未归还）

### 活动报名 (activity_registrations.jsonl)

```jsonl
{"child_id":"C001","child_name":"小明","age":5,"activity_name":"绘本故事会","activity_date":"2024-01-01","parent_phone":"13800138000","interests":["绘本","动物","故事"]}
{"child_id":"C002","child_name":"小红","age":8,"activity_name":"科普小课堂","activity_date":"2024-01-10","parent_phone":"13800138001","interests":["科学","自然","探索"]}
```

字段说明：
- `child_id`: 孩子ID
- `child_name`: 孩子姓名
- `age`: 年龄
- `activity_name`: 活动名称
- `activity_date`: 活动日期
- `parent_phone`: 家长电话
- `interests`: 兴趣标签列表

### 家长反馈 (feedbacks.csv)

```csv
child_id,feedback_date,content,rating,liked_themes,disliked_themes
C001,2024-01-15,孩子非常喜欢《小猪佩奇》系列，每次都看得很认真,5,动物,日常生活,
C002,2024-01-20,《神奇校车》很适合小学生，图文并茂,4,科学,探索,
```

字段说明：
- `child_id`: 孩子ID
- `feedback_date`: 反馈日期
- `content`: 反馈内容
- `rating`: 评分（1-5）
- `liked_themes`: 喜欢的主题（逗号分隔）
- `disliked_themes`: 不喜欢的主题（逗号分隔）

### 禁推主题 (forbidden_themes.yaml)

```yaml
forbidden_themes:
  - theme: "暴力"
    reason: "少儿不宜"
    effective_date: "2024-01-01"
    age_groups: []
  - theme: "恐怖"
    reason: "容易造成心理阴影"
    effective_date: "2024-01-01"
    age_groups: ["3-6岁", "6-9岁"]
  - theme: "爱情"
    reason: "超出年龄段理解"
    effective_date: "2024-01-01"
    age_groups: ["3-6岁", "6-9岁"]
```

字段说明：
- `theme`: 禁推主题名称
- `reason`: 禁推原因
- `effective_date`: 生效日期
- `age_groups`: 适用年龄段（空列表表示全局禁推）

## 测试

运行单元测试：

```bash
pytest tests/ -v
```

测试输出示例：
```
collected 15 items

tests/test_parser.py::TestDataValidator::test_validate_age_valid PASSED
tests/test_parser.py::TestDataValidator::test_validate_age_invalid PASSED
tests/test_parser.py::TestParser::test_parse_books_csv PASSED
tests/test_rules.py::TestRulesEngine::test_age_eligibility_match PASSED
tests/test_rules.py::TestRulesEngine::test_forbidden_themes_global PASSED
tests/test_recommender.py::TestProfileBuilder::test_build_profile PASSED
tests/test_recommender.py::TestSimpleRecommender::test_recommend_for_child PASSED

============= 15 passed in 0.50s =============
```

## 完整工作流程示例

### 步骤 1：准备数据

```bash
# 初始化样例数据
reading_recommender init

# 或者准备自己的数据文件
# 确保数据文件在 data/ 目录下
```

### 步骤 2：构建画像

```bash
# 查看数据统计
reading_recommender train
```

### 步骤 3：生成推荐

```bash
# 生成推荐并导出报告
reading_recommender recommend
```

### 步骤 4：质量检查

```bash
# 检查推荐质量
reading_recommender check
```

### 步骤 5：人工调整（可选）

```bash
# 如果需要调整，修改后保存
reading_recommender review -c C001 -o original.json -f final.json
```

### 步骤 6：导出最终报告

```bash
# 导出所有格式的报告
reading_recommender report
```

## 推荐算法说明

本系统采用简单可解释的规则评分算法，不使用复杂的机器学习模型，确保推荐结果透明可解释。

### 评分规则

| 规则 | 权重 | 说明 |
|------|------|------|
| 主题匹配（借阅历史） | 0.5 | 基于借阅过的图书主题计算 |
| 主题匹配（活动兴趣） | 0.4 | 基于活动报名时填写的兴趣 |
| 主题匹配（家长反馈） | 0.6 | 基于家长反馈喜欢的主题 |
| 分类匹配 | 0.3 | 基于借阅历史的分类偏好 |
| 历史借阅次数 | 0.1/次 | 借阅过越多该类图书，权重越高 |
| 库存充足 | +0.1 | 库存 > 3 时加分 |
| 不喜欢主题 | -0.5 | 包含家长反馈不喜欢的主题 |

### 冷启动处理

对于没有借阅记录、活动记录和反馈记录的孩子：
1. 基于年龄段筛选图书
2. 优先推荐库存充足的图书
3. 推荐热门图书（基于整体借阅统计）

### 规则引擎过滤

在推荐生成后，规则引擎会过滤掉：
- 年龄段不匹配的图书
- 库存为 0 的图书
- 已借阅过的图书
- 包含禁推主题的图书

## 依赖说明

| 库名 | 用途 |
|------|------|
| click | 命令行参数解析 |
| pandas | 数据处理（可选扩展） |
| pyyaml | YAML 文件解析 |
| rich | 命令行富文本输出 |
| pytest | 单元测试 |

## 版本历史

- v0.1.0: 初始版本，支持所有核心功能

## 许可证

MIT License
