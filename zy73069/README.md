# 风机叶片异常归因系统

> 解决早会反复提起的几个问题：边界样本说明卡点、备件到货晚于停机窗口、型号替换标记不丢、重跑材料版本区分、队列与页面判断两套话。

---

## 🚀 快速开始（给项目助理小林的操作顺序）

### 【第 1 步】先跑这条命令 —— 一键归因并生成异常队列

```bash
# 安装依赖（只需跑一次）
pip install -r requirements.txt

# 核心入口：一键跑完整流程，包含模拟同材料重跑
python -m blade_attribution run --with-rerun
```

跑完后会输出：
- 各等级（正常/预警/严重/边界）条数
- 版本状态分布（新采集/旧处理/后补备注/最新导出）
- 待人工确认的边界样本及其 **卡点说明（公式/单位/阈值）**

---

### 【第 2 步】再看哪份异常队列

```bash
python -m blade_attribution show-queues
```

会列出 `output/queues/` 目录下全部队列文件（CSV + JSON）和 `output/exports/` 下的 XLSX 总表。
**给别人看的队列文件就从这里挑最新的那一份发。**

---

## 📦 输出产物在哪

| 目录 | 内容 | 说明 |
|---|---|---|
| `output/queues/anomaly_queue_*.csv` | 异常队列（扁平化） | 发给别人看的主文件，**备件型号替换标记列在里面不丢** |
| `output/queues/anomaly_queue_*.json` | 异常队列（完整结构） | 程序二次处理用，保留证据链、备件子表等 |
| `output/exports/blade_attribution_*.xlsx` | 归因总表（4个Sheet） | 归因总表 / 备件清单(含替换标记) / 边界样本卡点明细 / 证据链明细 |

---

## 🧰 其他常用命令

### 查看每条边界样本卡在哪（公式 / 单位 / 阈值）

```bash
python -m blade_attribution boundary
```

输出每条边界样本的：
- **卡点类型**：公式 / 单位 / 阈值
- **详细说明**：例如"振动速度4.55mm/s在预警阈值4.5±0.1容差带内"
- **当前结论来源**：不会只显示"班组交接"，而是有完整判定步骤

提交人工结论（给边界样本一个最终说法，不靠班组交接凑结论）：

```bash
python -m blade_attribution boundary --submit BA-WT-0117-B2-... '人工确认-预警' '张工' '容差内按预警处理'
```

---

### 同一份材料重跑？看版本差异

```bash
python -m blade_attribution version
```

每条记录显示版本链：
- ⭐ **最新导出**：最新一次处理结果
- 📜 **旧处理**：之前的处理，已归档
- 📝 **后补备注**：现场复核后追加的说明内容

---

### 备件型号替换 & 到货晚于停机窗口

```bash
python -m blade_attribution spares
```

标记含义：
- 🔁 **型号替换**：夹在正常材料里也能识别（规则来自 `config/thresholds.yaml`）
- ⚠️ **到货延迟**：晚于停机窗口的天数量化显示

---

### 证据链追踪（确保不靠班组交接凑结论）

```bash
python -m blade_attribution trace [记录ID]
```

一条记录从头到尾：
1. 原始测量数据（SCADA / 点检仪 / 班组交接）
2. 每一步判定公式和输入数值
3. 中间结果是什么
4. 最终说法来源（自动判定 / 人工确认 / 待人工）

证据链≥3步才算完整，否则会标红提示"仅靠交接不完整"。

---

### 队列和当前页面判断会不会两套话？

```bash
python -m blade_attribution check --queue-file output/queues/anomaly_queue_xxx.json
```

- ✅ 一致：队列签名和当前判定签名相同
- ❌ 不一致：列出所有判断有变化的记录ID，杜绝拿给别人看的和当前页面说的两套话。

---

## 📐 阈值配置（调整公式/单位/阈值）

阈值全部在 `config/thresholds.yaml`：

```yaml
blade_anomaly:
  vibration:
    formula: "vibration_velocity > threshold"
    unit: "mm/s"
    warning: 4.5        # 预警阈值
    critical: 7.1       # 严重阈值
    tolerance: 0.1      # 容差带（落在±tolerance内判定为边界）
  temperature:
    formula: "temp - ambient > delta_threshold"
    unit: "°C"
    warning_delta: 25
    critical_delta: 40
    tolerance: 0.5
  pitch_angle:
    formula: "abs(pitch - pitch_reference) > offset"
    unit: "°"
    warning_offset: 2.0
    critical_offset: 5.0
    tolerance: 0.1

spare_parts:
  lead_time_days:
    default: 3
    blade_root_bolt: 7
  replacement_markers:                # 型号替换规则：原型号 -> 新型号
    - BOLT-M16-10.9 -> BOLT-M16-12.9
    - GREASE-LT-400G -> GREASE-HT-400G
```

---

## 🏗️ 项目结构

```
.
├── blade_attribution/
│   ├── __init__.py
│   ├── __main__.py              # CLI 入口（click）
│   ├── models.py                # 数据模型（Measurement/SparePart/BoundaryDetail/...）
│   ├── engine.py                # 归因引擎：公式/单位/阈值判定 + 备件到货窗口
│   ├── boundary_tracker.py      # 边界追踪：卡点说明 + 证据链（不靠班组交接）
│   ├── spare_marker.py          # 备件型号替换标记 + 导出保留
│   ├── version_manager.py       # 版本管理：旧处理/后补备注/最新导出
│   ├── queue.py                 # 异常队列 + 一致性校验 + 导出
│   └── sample_data.py           # 现场会收到的一包示例材料
├── config/
│   └── thresholds.yaml          # 阈值 + 备件替换规则配置
├── output/
│   ├── queues/                  # 异常队列（给别人看的）
│   └── exports/                 # 归因总表 XLSX
├── requirements.txt
└── README.md
```

---

## ✅ 需求对照

| 需求点 | 对应模块 | 说明 |
|---|---|---|
| 备件到货晚于停机窗口 | `engine.py` check_spare_parts_window | 按备件编码查标准交期，量化延迟天数 |
| 边界样本说明卡在公式/单位/阈值 | `boundary_tracker.py` classify_boundary | 返回 `stuck_at` 字段，三选一 |
| 不靠班组交接凑结论，边界样本追到最终说法 | `boundary_tracker.py` build_evidence_trace | 证据链≥3步判定完整，含输入/公式/中间结果 |
| 备件型号替换夹在正常材料里能看到，导出不丢 | `spare_marker.py` + `queue.py` to_export_rows | 导出列含 `replacement_marker` / `marker_text` |
| 同材料重跑区分旧处理/后补备注/最新导出 | `version_manager.py` | 按材料哈希分组，打 `RecordStatus` 标签 |
| 队列和当前页面判断不能两套话 | `queue.py` check_consistency | 记录级签名比对，不一致则列出差异 |
| README 说明先跑哪条、看哪份队列 | 本文档上方"快速开始" | 两条命令搞定 |
