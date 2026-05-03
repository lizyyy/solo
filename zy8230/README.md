# 实验课主观题阅卷一致性复核工具

一个本地 Python 数据分析与可视化小工具，帮助教务老师复核实验课主观题阅卷的一致性。

## 功能特性

- **分题差异分析**：对比学生最终得分与教师评分之间的差异，识别可能存在评分偏差的题目
- **教师严格度分析**：分析每位教师的评分风格，识别偏严/偏松的评卷老师
- **二评冲突分析**：检测两位教师评分差异超过阈值的记录，标记需要仲裁的冲突
- **疑似漏评检测**：找出只收到一位教师评分的学生答题
- **智能数据清洗**：自动处理同一学生重复评分、满分配置缺失等脏数据
- **交互式筛选**：支持按课程、题号、教师筛选数据，联动更新图表
- **报告导出**：支持导出 `issues.csv` 和 `review_report.md`

## 项目结构

```
.
├── app.py                 # Streamlit 主应用程序
├── requirements.txt       # Python 依赖包
├── README.md             # 本文档
├── src/                  # 核心模块
│   ├── __init__.py
│   ├── data_loader.py    # 数据加载与预处理
│   ├── analyzer.py       # 数据分析逻辑
│   └── exporter.py       # 报告导出功能
└── sample/               # 示例数据目录
    ├── student_scores.csv          # 学生答题得分
    ├── teacher_ratings.jsonl       # 双评老师评分
    ├── exam_config.yaml            # 题目满分和扣分规则
    └── exam_config_missing.yaml    # 测试用：缺少部分题目配置
```

## 快速开始

### 1. 环境准备

确保已安装 Python 3.8 或更高版本。

### 2. 安装依赖

```bash
pip install -r requirements.txt
```

### 3. 本地启动

```bash
streamlit run app.py
```

启动后，浏览器会自动打开 `http://localhost:8501`。

### 4. 首次使用

1. 在左侧侧边栏确认数据路径为 `sample`
2. 点击 **「加载并分析数据」** 按钮
3. 查看各分析结果标签页
4. 使用筛选器筛选课程、题目或教师
5. 点击导出按钮生成报告

## 数据格式说明

### 1. 学生成绩 CSV (student_scores.csv)

包含学生最终得分数据：

| 列名 | 类型 | 说明 |
|------|------|------|
| student_id | string | 学生唯一标识 |
| course | string | 课程名称 |
| question_num | integer | 题目编号 |
| score | float | 学生最终得分 |
| max_score | float | 该题目满分 |

示例：
```csv
student_id,course,question_num,score,max_score
S001,数据结构与算法,1,8,10
S001,数据结构与算法,2,7,10
```

### 2. 教师评分 JSONL (teacher_ratings.jsonl)

每行一个 JSON 对象，记录每位教师的评分：

| 字段 | 类型 | 说明 |
|------|------|------|
| student_id | string | 学生唯一标识 |
| course | string | 课程名称 |
| question_num | integer | 题目编号 |
| teacher | string | 教师姓名 |
| score | float | 教师给出的分数 |
| timestamp | string (可选) | 评分时间，用于处理重复评分 |

示例：
```jsonl
{"student_id": "S001", "course": "数据结构与算法", "question_num": 1, "teacher": "张老师", "score": 8, "timestamp": "2024-01-15T09:00:00"}
{"student_id": "S001", "course": "数据结构与算法", "question_num": 1, "teacher": "李老师", "score": 7, "timestamp": "2024-01-15T10:30:00"}
```

### 3. 考试配置 YAML (exam_config.yaml)

定义各课程题目的满分和扣分规则：

```yaml
courses:
  - name: 数据结构与算法
    questions:
      - num: 1
        max_score: 10
        deduction_rules:
          - condition: 代码逻辑错误
            points: 2
          - condition: 语法错误
            points: 1
      - num: 2
        max_score: 10
        deduction_rules:
          - condition: 思路不清
            points: 3

review_settings:
  conflict_threshold: 3           # 分差冲突阈值（绝对值）
  conflict_threshold_percent: 0.3 # 分差率冲突阈值（比例，0.3 表示 30%）
  strictness_window: 0.5          # 严格度判断窗口
```

## 脏数据处理

### 1. 同一学生重复评分

**问题场景**：同一学生、同一题目、同一教师多次评分（可能是修改评分）。

**处理策略**：
- 检测所有重复评分记录并在「数据问题预警」中显示
- 如果有 `timestamp` 字段，保留**最新**的评分
- 否则保留**最后出现**的评分

### 2. 满分配置缺失

**问题场景**：某些题目在 YAML 配置文件中未定义满分。

**处理策略**：
- 检测缺失配置的题目并在「数据问题预警」中显示
- 自动从 CSV 文件的 `max_score` 列推断满分
- 将推断的满分补充到配置中供后续分析使用

## 分析指标说明

### 教师严格度

严格度分数 = 教师平均给分 - 同题其他教师平均给分

| 严格度分数 | 标签 | 说明 |
|-----------|------|------|
| < -1 | 偏严 | 给分普遍低于其他教师 |
| -1 ~ 1 | 正常 | 给分与整体水平一致 |
| > 1 | 偏松 | 给分普遍高于其他教师 |

### 二评冲突判断

满足以下任一条件即判定为冲突：
1. 分差 > `conflict_threshold`（默认 3 分）
2. 分差率 > `conflict_threshold_percent`（默认 30%）

分差率 = |教师1得分 - 教师2得分| / 满分 × 100%

## 报告导出

### issues.csv

包含所有检测到的问题：
- 重复评分记录
- 满分配置缺失
- 二评评分冲突
- 疑似漏评记录

### review_report.md

完整的复核报告，包含：
1. 数据概览统计
2. 分题差异分析表
3. 教师严格度分析
4. 二评冲突详情
5. 疑似漏评列表
6. 数据问题预警
7. 建议措施

## 自定义数据

将你的数据文件放入自定义目录（如 `my_data/`），然后在应用中：

1. 修改「数据目录路径」为你的目录名
2. 如有需要，修改各文件名
3. 点击「加载并分析数据」

## 示例数据说明

`sample/` 目录下提供了可直接运行的示例数据：

- **数据结构与算法**：3 位学生，3 道题目
- **操作系统**：3 位学生，2 道题目  
- **计算机网络**：2 位学生，2 道题目

示例数据中故意包含：
- 学生 S001 的第 1 题由张老师重复评分（用于测试重复评分处理）
- 可使用 `exam_config_missing.yaml` 测试满分配置缺失的处理

## 技术栈

- **前端界面**：Streamlit
- **数据处理**：Pandas, NumPy
- **可视化**：Plotly Express
- **配置解析**：PyYAML

## License

MIT License
