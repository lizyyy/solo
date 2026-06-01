# 弦乐泛音频率拟合工具

可追溯、可解释的弦乐泛音频率拟合系统。每条拟合结果都能追溯到原始数据来源、权重设置、边界阈值和人工备注，别人接手时不用再问为什么这么判。

## 快速开始

```bash
# 1. 运行拟合（基于参数表）
python -m string_harmonic_fitting fit \
  --params examples/parameter_table.csv \
  --historical examples/historical_records.csv \
  --notes examples/manual_notes.csv \
  --out output

# 2. 检查参数表中的异常
python -m string_harmonic_fitting check \
  --params examples/parameter_table.csv \
  --out output

# 3. 补录人工备注并查看拟合差异
python -m string_harmonic_fitting note \
  --params examples/parameter_table.csv \
  --note-id note_003 \
  --instrument violin \
  --string 1 \
  --harmonic 4 \
  --text "第4泛音换弦后需降权" \
  --author 老叶 \
  --out output

# 4. 查看追踪日志
python -m string_harmonic_fitting trace \
  --trace-file output/trace_log.json
```

## 输入格式

所有输入为 CSV 文件，首行为字段名，UTF-8 编码。

### 参数表 (parameter_table.csv)

| 字段 | 说明 | 示例 |
|------|------|------|
| instrument | 乐器名称 | violin, viola, cello, double_bass |
| string_index | 弦序号（从1开始） | 1, 2, 3, 4 |
| harmonic_number | 泛音序号 | 1(基频), 2, 3, ... |
| observed_freq | 观测频率数值 | 293.66 |
| weight | 该泛音在拟合中的权重 | 0.25 |
| unit | 频率单位 | Hz, kHz, mHz |
| source | 数据来源标识 | parameter_table_row1 |
| timestamp | 数据记录时间 | 2026-05-20T10:00:00 |

### 历史记录 (historical_records.csv)

| 字段 | 说明 | 示例 |
|------|------|------|
| record_id | 记录ID | hist_001 |
| instrument | 乐器名称 | violin |
| string_index | 弦序号 | 1 |
| fitted_f1 | 拟合基频(Hz) | 293.66 |
| fitted_B | 拟合非谐性系数 | 0.00012 |
| weights_used | 权重设置(JSON) | {"1":0.25,"2":0.20} |
| notes | 备注 | 正常拟合 |
| source | 来源 | historical_record_row1 |
| timestamp | 时间 | 2026-05-15T14:30:00 |

### 人工备注 (manual_notes.csv)

| 字段 | 说明 | 示例 |
|------|------|------|
| note_id | 备注ID | note_001 |
| instrument | 乐器 | violin |
| string_index | 弦序号 | 1 |
| harmonic_number | 泛音序号 | 3 |
| note_text | 备注内容 | 温度偏低可能影响频率 |
| author | 作者 | 老叶 |
| source | 来源标识 | manual_note_by_老叶 |
| timestamp | 时间 | 2026-05-22T09:15:00 |

### 越界样本 (out_of_bounds_samples.csv)

| 字段 | 说明 | 示例 |
|------|------|------|
| sample_id | 样本ID | oob_001 |
| instrument | 乐器 | violin |
| string_index | 弦序号 | 1 |
| harmonic_number | 泛音序号 | 7 |
| observed_freq | 观测频率 | 2250.30 |
| expected_low | 预期下限 | 1372.0 |
| expected_high | 预期上限 | 2100.0 |
| deviation_pct | 偏差百分比 | 7.16 |
| unit | 单位 | Hz |
| source | 来源 | out_of_bounds_sample |
| timestamp | 时间 | 2026-05-25T11:00:00 |

## 输出说明

### 拟合结果 (fitting_results.txt)

每条结果包含:

- **拟合参数**: f1 (基频), B (非谐性系数)
- **拟合模型**: f_n = n × f1 × sqrt(1 + B × n²)
- **判断依据**: 编号列表，说明每个拟合判断的原因，可追溯到具体来源
- **各泛音残差**: 观测值 - 拟合值
- **权重**: 每个泛音使用的权重
- **边界阈值告警**: ✓/⚠ 标记，附具体阈值和来源
- **单位换算记录**: 如有非Hz单位，记录换算过程
- **原始来源**: 每个数据点的来源标识和时间戳
- **关联人工备注**: 关联的备注ID
- **处理时间**: 本次拟合的时间戳

### 追踪日志 (trace_log.txt)

按时间顺序记录所有操作:

```
[2026-05-20T10:00:00] fit [system]: 拟合完成: f1=293.6600Hz, B=0.00012000, 泛音数=6, 告警=2 | 来源=parameter_table_row1,...
[2026-05-22T09:15:00] add_note [老叶]: 补录备注: 第3泛音测量环境温度偏低可能影响频率 | 来源=manual_note_by_老叶 (note_id=note_001)
```

### 备注补录差异 (note_diffs.txt)

补录备注后，展示前后拟合的变化:

```
── 备注补录差异 [note_003] ──
  字段: fitted_f1
  变更前: 293.6600 Hz
  变更后: 293.5420 Hz
  原因: 备注[note_003]补录后重新拟合: 第4泛音换弦后需降权
  操作者: 老叶
  时间: 2026-05-22T10:30:00
```

### 异常清单 (anomalies.csv)

`check` 命令输出的越界参数，每条包含:

- 哪个乐器哪根弦哪个泛音越界
- 观测值 vs 预期范围
- 偏差百分比
- 原始来源和处理时间

## 怎么看异常清单

1. 运行 `check` 命令生成 `anomalies.csv`
2. 打开 CSV，按 `deviation_pct` 列排序（绝对值从大到小）
3. 偏差 > 5% 的优先处理
4. 每条异常的 `source` 和 `timestamp` 列可追溯原始数据
5. 处理后用 `note` 命令补录备注，差异会自动记录到 `note_diffs.txt`

## 判断溯源

每条拟合结果都自带 `reasoning` 字段（判断依据），包含:

1. **权重闭合检查**: 权重之和是否为1.0，容差±0.02
2. **权重变更历史**: 谁在什么时候改了权重，原因是什么
3. **人工备注关联**: 老叶补录的备注直接参与判断，备注ID和内容都记录
4. **拟合回归过程**: 加权最小二乘的截距a和斜率b，以及如何推导f1和B
5. **残差预警**: 哪些泛音的残差绝对值 > 2 Hz
6. **边界阈值告警**: f1和B是否在乐器参考范围内，附具体阈值来源
7. **历史记录对比**: 与最近一次历史记录的f1、B差值

换人处理时，看 `fitting_results.txt` 的"判断依据"部分即可理解上一次怎么判的。

## 物理模型

弦乐泛音频率公式:

```
f_n = n × f_1 × sqrt(1 + B × n²)
```

- `f_n`: 第n阶泛音频率
- `f_1`: 基频
- `B`: 非谐性系数（由弦的刚度引起，理想弦 B=0）
- `n`: 泛音序号（1=基频, 2=第一泛音, ...）

拟合方法: 对 y_n² = f_1² + f_1²·B·n² 做加权最小二乘线性回归，权重由参数表提供。

## 权重闭合说明

同一乐器同一弦上所有泛音权重之和应为 1.0（容差 ±0.02）。如果权重不闭合，系统会给出可读提醒:

```
⚠ 权重闭合检查: 当前权重之和 = 0.8500，偏离 1.0 超过容差 0.02，建议调整权重使其闭合
```

权重变更会自动记录到追踪日志，包含操作者、变更前后值和原因。

## 单位换算提醒

当参数表中使用非Hz单位时，系统会记录换算过程:

```
单位换算: 泛音n=1: 0.2937 kHz → 293.7000 Hz (换算系数=1000.0)
```

导出时也会带上换算记录，不会只在页面上闪一下。

## 内置乐器参考范围

| 乐器 | 弦1基频范围(Hz) | 弦2 | 弦3 | 弦4 | 弦5 | B范围 |
|------|-----------------|-----|-----|-----|-----|-------|
| violin | 196-300 | 293-450 | 440-600 | 659-900 | - | -0.001~0.05 |
| viola | 130-220 | 196-300 | 293-450 | 440-600 | - | -0.001~0.05 |
| cello | 65-130 | 98-196 | 130-262 | 196-350 | - | -0.0005~0.03 |
| double_bass | 31-73 | 41-98 | 55-130 | 73-165 | 98-196 | -0.0005~0.02 |
