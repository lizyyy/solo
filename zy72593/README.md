# 候选集截断影响评估工具

> 专门为实验平台负责人阿越打造的候选集截断影响评估工具，让评估不再怕临时补材料。

## ✨ 核心特性

- 🔍 **自动检测重复训练**: 智能识别同一批数据重复训练两次的问题
- 🛤️ **三步标准流程**: 负样本导入 → 阿越复核召回候选 → 特征版本表更新
- 📊 **丰富的可视化**: 支持 3D 散点图、饼图、柱状图等多种图表
- 🔗 **数据可追溯**: 点击图表数据点可追溯到原始负样本/召回候选表
- 📋 **清晰的责任人**: 特征版本表明确标注「为什么留下」「缺什么材料」「下一步找谁」
- ⚠️ **策略产品复核**: 检测到重复数据不急着归正常，留给策略产品人工复核

## 🚀 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 生成样例数据

```bash
python examples/generate_samples.py
```

这会在 `examples/` 目录下生成两个文件：
- `negative_samples.csv` - 负样本列表（含2组重复数据）
- `recall_candidates.csv` - 召回候选表（含2组重复数据，1组与负样本交叉）

### 3. 一键运行完整评估

```bash
python cli.py run-all examples/negative_samples.csv examples/recall_candidates.csv
```

### 4. 查看报告

运行完成后，打开 `output/index.html` 查看交互式评估报告。

---

## 📖 分步使用指南

### 步骤 1: 导入负样本列表

```bash
python cli.py step1 examples/negative_samples.csv
```

**功能**:
- 导入负样本 CSV/Excel 文件
- 自动检测同一批次+商品的重复训练数据
- 重复数据自动标记为「待策略产品复核」
- 输出: `output/negative_samples_processed.csv`

### 步骤 2: 阿越复核召回候选表

```bash
python cli.py step2 examples/recall_candidates.csv
```

**功能**:
- 导入召回候选表
- 检测表内重复训练数据
- 检测与负样本列表的交叉重复
- 自动关联对应的负样本 ID
- 输出: `output/recall_candidates_processed.csv`

### 步骤 3: 更新特征版本表

```bash
python cli.py step3
```

**功能**:
- 从负样本和召回候选表同步数据到特征版本表
- 每条记录自动标注：
  - ✅ 为什么被留下（来源+初检结论）
  - 📋 还缺什么材料（待补充清单）
  - 👤 下一步找谁（策略产品 / 阿越）
- 输出: `output/feature_versions_updated.csv`

### 生成完整报告

```bash
python cli.py report
```

生成以下输出：
- `output/index.html` - 交互式报告首页
- `output/evaluation_report.md` - 详细 Markdown 报告
- `output/evaluation_summary.json` - 完整 JSON 摘要
- `output/evaluation_summary.csv` - 指标汇总 CSV
- `output/charts/*.html` - 各类可视化图表

---

## 📊 可视化图表说明

| 图表名称 | 文件 | 说明 |
|---------|------|------|
| 负样本状态分布 | `negative_status_distribution.html` | 各状态数据占比饼图 |
| 召回候选状态分布 | `recall_status_distribution.html` | 各状态数据占比饼图 |
| 3D 数据分布 | `recall_3d_scatter.html` | 批次×商品×召回分数的 3D 散点图 |
| 批次质量对比 | `batch_comparison.html` | 各批次数据质量堆叠柱状图 |
| 重复训练分组 | `duplicate_bar_chart.html` | 重复训练数据分组统计 |
| 特征版本状态分布 | `feature_status_distribution.html` | 特征版本表状态分布 |

> 💡 **点击图表中的数据点**，可以查看详细信息并追溯到原始数据。

---

## 📋 特征版本表字段说明

| 字段 | 说明 |
|------|------|
| `version_id` | 特征版本唯一 ID |
| `feature_name` | 特征名称 |
| `batch_id` | 批次 ID |
| `item_id` | 商品 ID |
| `reason_kept` | **为什么被留下**：数据来源+初检结论 |
| `missing_materials` | **还缺什么材料**：待补充的材料列表 |
| `next_owner` | **下一步找谁**：策略产品 / 实验平台负责人阿越 |
| `status` | 状态：待复核/正常/待策略产品复核/已确认 |
| `linked_sample_id` | 关联的负样本 ID |
| `linked_candidate_id` | 关联的召回候选 ID |
| `remarks` | 备注 |

---

## 🎯 核心设计原则

### 1. 重复数据不急着归正常
- 检测到「同一批数据重复训练两次」时，自动标记为 `待策略产品复核`
- 不会自动归为 `正常`，必须由策略产品人工确认

### 2. 数据可追溯
- 所有图表都支持 hover 查看详情
- 特征版本表通过 `linked_sample_id` 和 `linked_candidate_id` 关联原始数据
- 报告中提供完整的追溯路径说明

### 3. 清晰的责任分工
- 重复数据复核 → 策略产品
- 实验平台数据确认 → 阿越
- 特征版本表自动根据状态分配下一步处理人

### 4. 新人友好
- 完整的 README 文档
- 内置样例数据和一键运行脚本
- 标准的三步流程，照做就行

---

## 🔧 API 调用示例

除了命令行，也可以在 Python 代码中直接使用：

```python
from cutoff_eval import EvaluationWorkflow, ReportGenerator

# 初始化工作流
workflow = EvaluationWorkflow(output_dir="./output")

# 步骤1: 导入负样本
step1_result = workflow.step1_import_negative_samples("examples/negative_samples.csv")

# 步骤2: 导入召回候选
step2_result = workflow.step2_import_and_review_recall_candidates("examples/recall_candidates.csv")

# 步骤3: 更新特征版本
step3_result = workflow.step3_update_feature_versions()

# 生成报告
summary = workflow.get_workflow_summary()
dataframes = workflow.get_dataframes()

report_gen = ReportGenerator(output_dir="./output")
outputs = report_gen.generate_summary_report(
    summary,
    {"step1": step1_result, "step2": step2_result, "step3": step3_result},
    dataframes
)

print(f"报告已生成: {outputs['index_html']}")
```

---

## 📁 项目结构

```
.
├── cutoff_eval/              # 核心包
│   ├── __init__.py
│   ├── models.py             # 数据模型（负样本/召回候选/特征版本）
│   ├── detector.py           # 重复训练检测器
│   ├── workflow.py           # 评估工作流和数据加载器
│   ├── visualization.py      # 可视化图表生成
│   └── report.py             # 报告生成器
├── examples/
│   ├── generate_samples.py   # 样例数据生成脚本
│   ├── negative_samples.csv  # 负样本样例（运行后生成）
│   └── recall_candidates.csv # 召回候选样例（运行后生成）
├── output/                   # 输出目录（运行后生成）
├── cli.py                    # 命令行入口
├── requirements.txt          # 依赖列表
└── README.md                 # 本文档
```

---

## ❓ 常见问题

### Q: 支持哪些文件格式？
A: 支持 CSV 和 Excel（.xlsx/.xls）格式。

### Q: 怎么定义「同一批数据重复训练两次」？
A: 以 `batch_id + item_id` 作为唯一键，出现次数 > 1 即判定为重复训练。

### Q: 检测到重复数据后会自动删除吗？
A: 不会。只会标记为「待策略产品复核」，保留完整数据供人工判断。

### Q: 特征版本表可以增量更新吗？
A: 可以。使用 `step3 --existing-file path/to/existing.csv` 即可基于已有版本表更新。

### Q: 可以只导入数据不生成图表吗？
A: 可以。使用 `report --no-charts` 或 `run-all --no-charts` 参数。

---

## 📝 版本历史

### v1.0.0
- ✅ 实现核心数据模型
- ✅ 实现重复训练检测逻辑
- ✅ 实现三步标准评估流程
- ✅ 实现多种可视化图表（含 3D 散点图）
- ✅ 实现交互式 HTML 报告
- ✅ 提供命令行和 API 两种调用方式
- ✅ 内置样例数据和完整文档
