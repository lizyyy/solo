# 社区垃圾分类桶满溢预测器

## 一句话解决的问题

社区垃圾分类桶在节假日容易满溢，清运车路线安排总是滞后。这套工具帮你提前 3 天算出**哪些桶、什么时候、优先级多高**需要清运。

---

## 从空数据到最终报表：5 步走

### 第 1 步：安装依赖

```bash
pip install -r requirements.txt
```

只需要这 5 个库：pandas（表格）、numpy（计算）、matplotlib（画图）、seaborn（美化）、python-dateutil（日期处理）。

---

### 第 2 步：准备桶的基础信息

已预置 10 个垃圾桶，在 `config.py` 的 `BINS_META` 里。如果需要添加你的桶，按照这个格式填：

```python
{'bin_id': 'BIN-001', 'type': '可回收', 'model': 'A', 
 'community': '阳光花园', 'zone': '东一区', 'last_clean': '2026-04-28'}
```

- `model: A` = 240L，`B` = 120L，`C` = 60L
- `last_clean` = 上次清运日期
- `type` = 可回收 / 厨余 / 有害 / 其他

---

### 第 3 步：准备投放记录数据

两种方式：

**方式 A：直接用系统生成的样例数据**
```bash
python main.py --generate-sample --date 2026-05-01
```
这会自动生成 2026-04-20 到 2026-04-30 的历史记录（数据目录 `data/`）。

**方式 B：自己准备 CSV 文件**

文件必须有这些列，放在 `data/` 目录下：

| 列名 | 说明 | 示例 |
|------|------|------|
| record_id | 记录唯一编号 | REC-0001 |
| bin_id | 桶编号（对应 config.py） | BIN-001 |
| drop_time | 投放时间 | 2026-04-25 09:30:00 |
| volume_l | 投放量（升） | 15 |
| source | 来源 | app / manual / sensor |
| submitter | 提交人 | User1 |
| submit_time | 提交时间 | 2026-04-25 09:35:00 |
| status | 状态（初始填 valid 即可） | valid |

保存为 `data/my_records.csv`，然后运行：

```bash
python main.py --records data/my_records.csv --date 2026-05-01
```

---

### 第 4 步：运行预测

一键命令：

```bash
python main.py --date 2026-05-01
```

或者带自定义参数：

```bash
python main.py --records data/my_records.csv --date 2026-05-01 --output my_output
```

运行时你会看到 5 个阶段的进度：
1. 加载数据 → 2. 节假日特征 → 3. 异常检测 → 4. 满溢预测 → 5. 生成报表

**重点：预测基准日期 `--date` 决定你从哪一天开始看未来 3 天。**
- 选 `2026-05-01`（劳动节假期第一天），系统会发现未来 3 天投放量激增！

---

### 第 5 步：查看输出（报表和看板）

所有输出都在 `output/` 目录下，每次运行生成带时间戳的文件：

**核心输出 3 件事：**

1. **full_report_*.txt** — 文字总报告
   - 顶部是计算口径（所有规则写得明明白白）
   - 中间是清运优先级汇总 + Top 5 满溢桶
   - 底部是异常来源 + 行动建议

2. **priority_table_*.csv** — 可复核的详细表格
   - 每个桶：当前填充率、预计满溢日期、优先级得分、原因
   - 用 Excel 打开可筛选、排序、做你自己的看板

3. **priority_chart_*.png** — 4 张图的看板
   - 左上：优先级分布柱状图（红=紧急，绿=低）
   - 右上：满溢时间线（左边的桶越紧急）
   - 左下：填充率 vs 优先级（红色虚线=满溢阈值 85%）
   - 右下：各社区风险分布对比

**如果有异常**，还会额外输出：
- `anomaly_summary_*.csv` — 异常汇总
- `anomaly_duplicates_*.csv` — 重复提交明细
- `anomaly_conflicts_*.csv` — 状态冲突明细
- `anomaly_missing_*.csv` — 记录缺失明细

---

## 这条主线你必须验收时能看到

打开 `output/full_report_*.txt`，从上到下读：

1. **预测基准日期** — 你指定的那一天
2. **节假日特征** — 未来几天是否是节假日？乘数是多少？
3. **满溢预测** — 哪些桶会在未来 3 天超过 85%？
4. **清运优先级** — 紧急 / 高 / 中 / 低，带分数（0-100）
5. **异常来源** — 哪些数据有问题，要不要复核后重跑？

所有预测结果里都有 `days_until_overflow`（距离满溢还有几天），越小越紧急。

---

## 边界情况覆盖

系统自动处理这 3 类问题，异常记录不会污染预测结果：

| 类型 | 触发规则 | 处理方式 |
|------|----------|----------|
| 重复提交 | 同桶、同量、5 分钟内出现 | 标记为 duplicate，从计算中排除 |
| 状态冲突 | 累计投放量 > 桶容量 × 1.2 | 标记为 conflict，从计算中排除 |
| 记录缺失 | 某桶单日有效记录 < 3 条 | 报告为 missing，预测时按基线估算 |

你可以在 `output/anomaly_*` 文件里看到每一条异常的详情，人工复核后修改原始数据，再重跑一次预测即可。

---

## 常用参数速查

```bash
# 用样例数据跑（劳动节场景，验证节假日效果）
python main.py --generate-sample --date 2026-05-01

# 用自己的数据跑
python main.py --records data/my_data.csv --date 2026-05-10

# 指定输出目录
python main.py --date 2026-05-01 --output holiday_report
```

---

## 项目结构

```
xy10251/
├── config.py               # 配置：节假日、桶参数、阈值
├── data_model.py           # 数据模型：桶管理、投放记录
├── holiday_feature.py      # 节假日特征提取
├── anomaly_detector.py     # 异常检测（重复/冲突/缺失）
├── predictor.py            # 满溢预测 + 优先级评分
├── report_generator.py     # 报表生成（表格+图表+文字报告）
├── generate_sample_data.py # 样例数据生成器
├── main.py                 # 主入口（5 步流水线）
├── requirements.txt        # 依赖
├── README.md               # 本文件
├── data/                   # 输入数据（运行后生成）
└── output/                 # 输出报表（运行后生成）
```

---

## 下一步可以做什么

1. 把 `config.py` 里的节假日换成你们社区的实际假期
2. 根据你们的历史数据微调 `HOLIDAY_MULTIPLIER`（默认 2.5 倍）
3. 把预测结果接入你们的清运调度系统
