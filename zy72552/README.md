# 异常检测阈值漂移分析系统

> 解决"离线和线上分数差了一个桶"时评测运营追问"为什么前后不一致"的问题。
> 不是冷冰冰的系统日志，而是有温度、有流程、有责任人的实验对比工具。

## 🌟 核心特性

1. **自动标出差1桶**：导入负样本列表后自动检测离线和线上分数差了一个桶的记录
2. **三步工作流**：
   - 第一步：负样本列表第一次导入 → 系统标出差异
   - 第二步：算法工程师小乔补看召回候选表 → 实验对比自动更新
   - 第三步：评测运营复核，**别急着归正常**，差1桶的留给运营确认
3. **为什么留下/缺什么/找谁**：每条记录都说明为什么被留下、还缺什么材料、下一步该找谁
4. **3D/图表展示**：支持点击数据点回到负样本列表或召回候选表，不是只有漂亮画面
5. **三种入口**：命令行(CLI)、Web API、小看板

## 🚀 快速开始（新人照这个跑就行）

### 0. 安装依赖

```bash
pip install -r requirements.txt
```

### 方式一：命令行完整流程（推荐先跑这个）

```bash
# 第一步：导入负样本列表，自动标出差1桶的记录
python -m threshold_drift.cli detect -i samples/negative_samples.csv -o my_report.json

# 输出示例：
# ✅ 检测完成，共 20 条记录
#    差1桶: 12 条
#    差多桶: 1 条
#    报告已保存到: my_report.json
#    实验ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# 第二步：算法工程师小乔补录召回候选表
# 把上面的实验ID替换到下面
python -m threshold_drift.cli supplement -e <实验ID> -c samples/recall_candidates.csv -r my_report.json

# 第三步：评测运营复核一条差1桶的记录（先别急着归正常！）
# 先看报告里的记录ID，选一条差1桶的
python -m threshold_drift.cli review -e <实验ID> -r <记录ID> -s reviewed_by_op -n "已复核，样本特征无异常" -w "评测运营A" -r my_report.json

# 生成3D可视化看板
python -m threshold_drift.cli dashboard -r my_report.json -o my_dashboard.html
# 用浏览器打开 my_dashboard.html 查看
```

### 方式二：Web小看板（可视化交互）

```bash
python -m threshold_drift.cli web
```

然后打开浏览器访问 `http://localhost:5000`

在网页上按三步操作：
1. 上传 `samples/negative_samples.csv` → 点"开始检测"
2. 选择实验ID，上传 `samples/recall_candidates.csv` → 点"补录召回候选"
3. 选择实验ID，输入记录ID，选择状态 → 点"提交复核"

可以点"查看完整报告"看实验对比，点"3D可视化看板"看图表展示。

### 方式三：Python API

```python
from threshold_drift.models import BucketConfig
from threshold_drift.detector import BucketDriftDetector
from threshold_drift.data_import import DataImporter
from threshold_drift.experiment import ExperimentManager

# 1. 初始化
bucket_config = BucketConfig(boundaries=[0.3, 0.5, 0.7, 0.9])
detector = BucketDriftDetector(bucket_config)
exp_manager = ExperimentManager()

# 2. 第一步：导入负样本
samples_data = DataImporter.load_negative_samples_from_csv("samples/negative_samples.csv")
samples, records = detector.batch_detect(samples_data)
exp = exp_manager.create_experiment("我的实验", records)

# 3. 第二步：补录召回候选
candidates = DataImporter.load_recall_candidates_from_csv("samples/recall_candidates.csv")
exp.drift_records = DataImporter.supplement_recall_candidates(exp.drift_records, candidates)

# 4. 看报告
report = exp_manager.generate_report(exp.experiment_id)
print(f"差1桶: {report['one_bucket_diff_count']} 条")
```

## 📋 数据格式说明

### 负样本列表 CSV

| 列名 | 必填 | 说明 |
|------|------|------|
| sample_id | 是 | 样本唯一ID |
| offline_score | 是 | 离线打分（0~1之间） |
| online_score | 是 | 线上打分（0~1之间） |
| source | 否 | 数据来源 |
| 其他列 | 否 | 会作为features保存 |

### 召回候选表 CSV

| 列名 | 必填 | 说明 |
|------|------|------|
| sample_id | 是 | 对应负样本的ID |
| candidate_id | 是 | 召回候选ID |
| rank | 是 | 召回排名 |
| score | 是 | 召回分数 |
| is_related | 否 | 是否相关 |
| reason | 否 | 补充说明 |
| supplemented_by | 否 | 补录人（默认小乔） |

## 🎯 核心设计理念

### 关于"差一个桶"

- **橙色高亮**：差1桶的记录在报告中用橙色背景标出，优先排序
- **别急着归正常**：系统默认不会自动把差1桶归为正常，必须由评测运营确认
- **说明为什么留下**：`why_kept` 字段会写清楚"离线和线上分数差了一个桶，需要评测运营复核，暂不归为正常"

### 关于"找谁"

每条记录都有 `next_owner` 字段，明确：
- `operation` → 找评测运营（复核）
- `algorithm` → 找算法工程师小乔（补数据、查问题）
- `both` → 两边都要找

### 关于图表不是空壳

- 点击3D图/散点图的数据点，会弹出记录ID
- 可对接实际的负样本列表或召回候选表页面
- 记录表格中样本ID可点击跳转

## 📁 项目结构

```
.
├── threshold_drift/
│   ├── __init__.py
│   ├── models.py          # 数据模型：负样本、召回候选、漂移记录等
│   ├── detector.py        # 核心检测：离线线上分桶差异检测
│   ├── data_import.py     # 数据导入：CSV/JSON导入、召回候选补录
│   ├── experiment.py      # 实验对比：生成报告、状态流转
│   ├── visualization.py   # 可视化：3D图、散点图、HTML看板
│   ├── web_app.py         # Web小看板
│   └── cli.py             # 命令行入口
├── samples/
│   ├── negative_samples.csv    # 样例负样本
│   └── recall_candidates.csv   # 样例召回候选
├── requirements.txt
└── README.md
```

## ✅ 检查清单

- [x] 导入后能标出离线和线上分数差了一个桶
- [x] 补录召回候选表后实验对比跟着变
- [x] 差1桶的记录不急着归正常，留给评测运营复核
- [x] 报告说明为什么被留下、还缺什么材料、下一步找谁
- [x] 3D/图表展示，点击能回溯到记录
- [x] 命令行、API、小看板三种入口
- [x] 新人照README能从样例跑到报告
