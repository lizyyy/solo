# 心理学反应时实验数据质检与统计报告工具

## 安装依赖

```bash
pip install pandas pyyaml matplotlib seaborn
```

## 快速开始

运行示例命令：

```bash
python -m rt_quality --subjects rt_quality/examples/subjects.csv --trials rt_quality/examples/trials.csv --design rt_quality/examples/design.yaml --output-dir output
```

### 预期输出

```
============================================================
反应时实验数据质检与统计报告工具
============================================================

[1/5] 读取数据文件...
⚠️  发现重复被试记录，保留首次出现: ['S001']
⚠️  发现可能的条件名拼写错误: {' congruent'}
✓ 已应用拼写纠正: {' congruent': 'congruent'}
✓ 读取完成: 8 名被试, 55 个 trial

[2/5] 数据清洗...
✓ 清洗完成: 保留 43 个 trial

[3/5] 统计计算...
✓ 统计计算完成

[4/5] 生成报告和图表...
✓ 报告和图表生成完成

[5/5] 保存结果...

============================================================
处理完成! 输出文件:
============================================================
  📄 质检报告: output/quality_report.md
  📊 条件对比图: output/condition_comparison.png
  📋 剔除 trial: output/excluded_trials.csv
  📈 条件统计: output/condition_stats.csv
  📉 被试统计: output/subject_stats.csv
  📊 条件汇总: output/condition_summary.csv
============================================================
```

## 文件格式说明

### 1. 被试信息 CSV (subjects.csv)

必需列：
- `subject_id`: 被试唯一标识符

可选列：
- `age`: 年龄
- `gender`: 性别
- `handedness`: 利手
- 其他自定义被试信息

### 2. Trial 级反应时 CSV (trials.csv)

必需列：
- `subject_id`: 被试ID
- `rt`: 反应时 (毫秒)
- `accuracy`: 准确率 (1=正确, 0=错误)
- `condition`: 实验条件
- `is_practice`: 是否练习试次 (True/False)

### 3. 实验设计 YAML (design.yaml)

```yaml
conditions:
  - congruent
  - incongruent

condition_typo_map:
  " congruent": congruent
  "incongrunt": incongruent

cleaning:
  min_rt: 100          # 最小反应时阈值
  max_rt: 2000         # 最大反应时阈值 (可选)
  sd_threshold: 3.0    # 标准差阈值 (默认3.0)
```

## 输出文件说明

- `quality_report.md`: Markdown 格式的质检报告
- `condition_comparison.png`: 条件对比图 (反应时 + 准确率)
- `excluded_trials.csv`: 被剔除的 trial 列表，含剔除原因
- `condition_stats.csv`: 被试×条件的详细统计
- `subject_stats.csv`: 每个被试的汇总统计
- `condition_summary.csv`: 各条件的总体汇总统计

## 项目结构

```
rt_quality/
├── __init__.py
├── __main__.py          # CLI 入口
├── data_loader.py       # 数据读取与校验
├── cleaning.py          # 数据清洗规则
├── stats.py             # 统计计算
├── reports.py           # 报告与图表生成
└── examples/            # 样例数据
    ├── subjects.csv
    ├── trials.csv
    └── design.yaml
```
