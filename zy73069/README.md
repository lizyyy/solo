# 风机叶片异常归因系统

> 解决早会反复提起的几个问题：边界样本说明卡点、备件到货晚于停机窗口、型号替换标记不丢、重跑材料版本区分、队列与页面判断两套话。
>
> v2 修复重点：版本历史持久化到本地文件、可从样例数据复现；异常队列带稳定的 SHA256 判定签名，`check` 复核不怕重启/时间戳/顺序。

---

## 🚀 快速开始（给项目助理小林的操作顺序）

### 【第 1 步】先跑 —— 一键归因并生成异常队列

```bash
# 安装依赖（只需跑一次）
pip install -r requirements.txt

# 核心入口：加载现场样例 → 归因判定 → 生成异常队列(带稳定签名)
python -m blade_attribution run
```

跑完后会输出：
- 各等级（正常/预警/严重/边界）条数
- 版本状态分布（读自持久化 `output/versions/history.json`）
- 待人工确认的边界样本及其 **卡点说明（公式/单位/阈值）**
- 一份 **判定签名（SHA256）**，下一步用它复核

> 首次运行会自动从样例数据播种版本历史（旧处理→后补备注→最新导出三阶段），写到 `output/versions/history.json`，之后每次启动都从该文件复现。
>
> 可选：`python -m blade_attribution run --with-rerun` 会真实追加一次现场复核（后补备注）到 history.json；`--reset-history` 可重置回样例播种状态。

---

### 【第 2 步】看版本链路 —— 旧处理 / 后补备注 / 最新导出

```bash
python -m blade_attribution version
```

读自持久化 `output/versions/history.json`，每份材料都能看到完整演进（不再"只像刚采集一次"）：

- 📜 **旧处理**：初次采集处理
- 📝 **后补备注**：现场复核追加的说明内容
- ⭐ **最新导出**：最新一次处理结果

每条还显示承接的上一版 run_id、时间、后补内容。

---

### 【第 3 步】看队列 —— 备件型号替换标记不丢

```bash
python -m blade_attribution show-queues
```

列出 `output/queues/` 下全部队列（CSV + JSON）和 `output/exports/` 下的 XLSX 总表。
**给别人看的队列就从这里挑最新那一份。** CSV/XLSX 里备件的 `型号替换标记` / `标记说明` 列不会丢。

---

### 【第 4 步】用已导出的队列复核一致性

```bash
# 把上一步 show-queues 里最新的 anomaly_queue_*.json 路径填进来
python -m blade_attribution check --queue-file output/queues/anomaly_queue_YYYYMMDD_HHMMSS.json
```

结果必须显示：

```
🔗 一致性复核 | 来源: 队列文件: anomaly_queue_....json
   结果: ✅ 一致
   整批签名匹配: 是
   逐条签名匹配: 是
   队列里的异常判断 == 工具重新复核的判断，不会两套话。
```

**为什么这次能稳定通过**：判定签名用 SHA256，只覆盖"异常判断"字段（等级/归因/结论/边界卡点/备件替换延迟），**显式排除**时间戳、运行ID、版本状态、临时对象顺序。所以重新启动进程、换个时间跑、记录顺序变了，签名都不变 → 复核一致。

---

## 📦 输出产物在哪

| 目录 | 内容 | 说明 |
|---|---|---|
| `output/versions/history.json` | **版本历史（持久化）** | 旧处理/后补备注/最新导出三阶段，可从样例数据复现 |
| `output/queues/anomaly_queue_*.csv` | 异常队列（扁平化） | 发给别人看的主文件，**备件型号替换标记列不丢** |
| `output/queues/anomaly_queue_*.json` | 异常队列（信封式） | 带 `_judgment_signature` 整批签名 + 逐条 `_judgment_hash`，用于 `check` 复核 |
| `output/exports/blade_attribution_*.xlsx` | 归因总表（4个Sheet） | 归因总表 / 备件清单(含替换标记) / 边界样本卡点明细 / 证据链明细 |

---

## 🔬 稳定性设计（核心修复）

### 版本历史不再只放进程内存
- 旧实现：`VersionManager._history` 是内存 dict，每次 CLI 启动都空，所以 `version` 只看到"刚采集一次"。
- 新实现：历史写入 `output/versions/history.json`；首次访问从 `sample_data.py` **确定性播种**三阶段演进；之后每次启动从文件复现。`attach_latest` 只读挂载、不改历史，所以 `run` 可重复执行且幂等。
- 验证：删掉 `output/` 后重跑 `run`，`version` 仍能重建出同样的旧处理/后补备注/最新导出。

### 判定签名稳定
- 旧实现：用 Python 内置 `hash()`（字符串哈希默认按进程随机化），重启即变，所以 `check --queue-file` 永远对不上。
- 新实现：`judgment_signature` 用 `hashlib.sha256`，按 `record_id` 排序后哈希，只覆盖判定依据字段。
- 复核口径：`check` 只比对"异常判断"（等级/归因/结论/边界卡点/备件替换延迟），**不比对**版本状态/时间戳/运行ID——这些是处理元数据，会随重跑演进，不影响"是不是两套话"。

---

## 🧰 其他常用命令

### 查看每条边界样本卡在哪（公式 / 单位 / 阈值）

```bash
python -m blade_attribution boundary
```

- **卡点类型**：公式 / 单位 / 阈值
- **详细说明**：例如"振动速度4.55mm/s在预警阈值4.5±0.1容差带内"
- **当前结论来源**：不会只显示"班组交接"，而是有完整判定步骤

提交人工结论（给边界样本一个最终说法，不靠班组交接凑结论）：

```bash
python -m blade_attribution boundary --submit BA-WT-0117-B2-... '人工确认-预警' '张工' '容差内按预警处理'
```

### 备件型号替换 & 到货晚于停机窗口

```bash
python -m blade_attribution spares
```

- 🔁 **型号替换**：夹在正常材料里也能识别（规则来自 `config/thresholds.yaml`）
- ⚠️ **到货延迟**：晚于停机窗口的天数量化显示

### 证据链追踪（确保不靠班组交接凑结论）

```bash
python -m blade_attribution trace [记录ID]
```

原始测量数据 → 每步判定公式与输入 → 中间结果 → 最终说法来源。证据链≥3步才算完整。

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
│   ├── version_manager.py       # 版本管理：持久化 history.json + 样例播种(旧处理/后补/最新导出)
│   ├── queue.py                 # 异常队列 + SHA256稳定签名 + 一致性校验 + 导出
│   └── sample_data.py           # 现场会收到的一包示例材料
├── config/
│   └── thresholds.yaml          # 阈值 + 备件替换规则配置
├── output/
│   ├── versions/history.json    # 版本历史（持久化、可复现）
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
| 同材料重跑区分旧处理/后补备注/最新导出 | `version_manager.py` | 持久化 history.json + 样例确定性播种，attach_latest 只读挂载 |
| 队列和当前页面判断不能两套话 | `queue.py` judgment_signature / check_consistency | SHA256 稳定签名，排除时间戳/运行ID/版本状态，重启复核一致 |
| README 说明先跑哪条、看哪份队列 | 本文档上方"快速开始" | 4 步命令，与实际行为一致 |
