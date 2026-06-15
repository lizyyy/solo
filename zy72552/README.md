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

### 方式一：命令行完整流程（推荐先跑这个，每一步拆清楚）

下面每一步都把 `实验ID`、`记录ID`、`报告路径` 分开说明，照抄即可跑通。

---

#### 第一步：负样本列表第一次导入

**输入**：`samples/negative_samples.csv`（20 条负样本，包含 `sample_id, offline_score, online_score`）  
**输出**：`my_report.json`（实验对比报告，同时打印实验ID）

```bash
python3 -m threshold_drift.cli detect \
  --input     samples/negative_samples.csv \
  --output    my_report.json
```

**输出示例**：
```
✅ 检测完成，共 20 条记录
   差1桶: 9 条
   差多桶: 0 条
   报告已保存到: my_report.json
   实验ID: a1b2c3d4-1234-5678-90ab-cdef01234567   ← 记下这个实验ID
```

这一步跑完后，系统已经把"离线和线上分数差了一个桶"的 9 条记录标出来了。
想立刻看到是哪几条，可以从报告里快速提取：

```bash
cat my_report.json | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('=== 差1桶的记录（留给评测运营复核）===')
for r in d['details']:
    if r['bucket_diff'] == 'one_bucket':
        print(f\"  样本 {r['sample_id']}  |  离线分桶 {r['offline_bucket']} → 线上分桶 {r['online_bucket']}  |  记录ID = {r['record_id']}\")
        print(f\"    离线分数 {r['offline_score']:.3f}，线上分数 {r['online_score']:.3f}，差了刚好一个桶\")
"
```

**为什么这些记录要留给评测运营复核？**
> 因为它们的离线分桶和线上分桶刚好差 1 个桶位（比如离线是桶1、线上是桶2），
> 刚好卡在分桶边界上，不能简单当成"正常"忽略。系统会在 `why_kept` 字段自动写：
> _"离线和线上分数差了一个桶，需要评测运营复核，暂不归为正常"_，
> 并且 `next_owner` 直接指向 **评测运营**。

---

#### 第二步：算法工程师小乔补看召回候选表 → 实验对比自动更新

**输入**：
- 实验ID（上一步输出的 `a1b2c3d4-1234-5678-90ab-cdef01234567`）
- 报告路径：`my_report.json`
- 召回候选表：`samples/recall_candidates.csv`

```bash
python3 -m threshold_drift.cli supplement \
  --experiment a1b2c3d4-1234-5678-90ab-cdef01234567 \
  --candidates samples/recall_candidates.csv \
  --report     my_report.json
```

**输出示例**：
```
📥 加载了 20 条召回候选
✅ 已为 12 条记录补录召回候选
   实验对比已更新，报告已保存到: my_report.json
```

这一步跑完后，`my_report.json` 已经自动更新：
- 有召回候选的记录状态从 `pending_review` → `supplemented_by_algo`
- `missing_materials` 里去掉了"召回候选表待算法工程师小乔补录"
- `next_owner` 依然指向 **评测运营**（等运营复核）

---

#### 第三步：评测运营复核 —— 先别急着归正常

这一步需要 `记录ID`（不是样本ID！），可以从第一步的命令里查。
假设我们要复核样本 **S001**，先拿到它的 `记录ID`：

```bash
cat my_report.json | python3 -c "
import sys, json
d = json.load(sys.stdin)
for r in d['details']:
    if r['sample_id'] == 'S001':
        print(f\"样本 S001 的记录ID = {r['record_id']}\")
        print(f\"  离线分数 {r['offline_score']:.3f} / 线上分数 {r['online_score']:.3f}\")
        print(f\"  为什么留给运营复核：{r['why_kept']}\")
"
```

拿到记录ID（例如 `e5f6a7b8-1111-2222-3333-abcdef123456`）后，执行复核。
**注意：先别急着归为正常**，先标成"已复核（运营）"即可：

| 参数 | 说明 | 示例值 |
|------|------|--------|
| `--experiment` | 实验ID | `a1b2c3d4-1234-5678-90ab-cdef01234567` |
| `--record` | **记录ID**（不是样本ID！） | `e5f6a7b8-1111-2222-3333-abcdef123456` |
| `--status` | `reviewed_by_op`（已复核，不急着归正常） / `confirmed_normal` / `needs_investigation` | `reviewed_by_op` |
| `--notes` | 复核备注 | `"已复核，S001 离在线确实差1桶，特征无异常，待算法确认"` |
| `--reviewer` | 复核人 | `"评测运营A"` |
| `--report` | 报告路径 | `my_report.json` |

执行命令：

```bash
python3 -m threshold_drift.cli review \
  --experiment a1b2c3d4-1234-5678-90ab-cdef01234567 \
  --record     e5f6a7b8-1111-2222-3333-abcdef123456 \
  --status     reviewed_by_op \
  --notes      "已复核，S001 离在线确实差1桶，特征无异常，待算法确认" \
  --reviewer   "评测运营A" \
  --report     my_report.json
```

**输出示例**：
```
✅ 记录 e5f6a7b8-1111-2222-3333-abcdef123456 状态已更新为 reviewed_by_op
   备注: 已复核，S001 离在线确实差1桶，特征无异常，待算法确认
```

复核后看最终的实验对比摘要：

```bash
cat my_report.json | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('=== 实验对比摘要 ===')
print(f\"  总记录数：{d['total_records']}\")
print(f\"  差1桶：{d['one_bucket_diff_count']} 条（需评测运营复核，别急着归正常）\")
print(f\"  待复核：{d['pending_review']} 条\")
print(f\"  已运营复核：{d['reviewed_by_op']} 条\")
print(f\"  已补录召回：{d['supplemented_by_algo']} 条\")
"
```

---

#### 生成 3D 可视化看板（点击数据点可回到负样本列表/召回候选表）

```bash
python3 -m threshold_drift.cli dashboard \
  --report my_report.json \
  --output my_dashboard.html
```

用浏览器打开 `my_dashboard.html`：
- 点击 **散点图** 或 **3D图** 中的数据点 → 页面自动滚动到对应记录，并展开详情
- 点击表格中的 **样本ID** → 展开该条负样本的完整详情：真实离线/线上分数、为什么留下、缺什么材料、召回候选表（小乔补的）、下一步找谁
- 差 1 桶的记录行是 **橙色背景**，排在最前面，提醒评测运营重点看

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

- **HTML 静态看板**（`dashboard` 命令生成）：点击 3D 图/散点图的数据点 → 页面自动滚动到该记录，**展开完整详情**（真实离线分数、线上分数、分桶差、为什么被留下、缺什么材料、召回候选表、下一步找谁）
- **Web 小看板**（`web` 命令启动）：点击 3D 图/散点图的数据点 → **直接跳转到 `/record/<实验ID>/<记录ID>` 单条记录详情页**，完整展示负样本信息 + 召回候选表，面包屑可回到报告页
- 记录表格中的 **样本ID** 可点击跳转，不再只是展示漂亮画面

## 命令行参数速查

| 命令 | 关键参数（长选项） | 说明 |
|------|--------------------|------|
| `detect` | `--input`（负样本CSV）, `--output`（报告路径）, `--boundaries`（分桶边界） | 第一步：导入负样本，检测差桶 |
| `supplement` | `--experiment`（实验ID）, `--candidates`（召回候选CSV）, `--report`（报告路径） | 第二步：小乔补录召回候选，更新实验对比 |
| `review` | `--experiment`（实验ID）, `--record`（记录ID，不是样本ID）, `--status`, `--notes`, `--reviewer`, `--report` | 第三步：评测运营复核 |
| `dashboard` | `--report`（报告路径）, `--output`（HTML输出路径）, `--boundaries` | 生成3D可视化HTML看板 |
| `web` | `--port`（端口，默认5000） | 启动Web小看板服务 |

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
