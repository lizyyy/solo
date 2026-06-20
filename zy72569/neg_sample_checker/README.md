# 序列推荐负采样检查工具

## 项目简介

这是一个用于序列推荐负采样数据质量检查的工具。它不是给演示会看的空壳，而是能真正跑起来的实用工具。即使是一位新人，照着这份 README 也能从样例跑到报告。

## 核心自检项

工具覆盖了最容易出错的四个检查点，**全部在工作流和报告中实际执行**：

1. **重复导入检查** — 区分本次导入和跨历史批次，防止同一份数据被重复导入
2. **少数类样本被总指标盖住检查** — 当少数类（占比<5%）的指标与总指标差异较大时会警告，**不要直接归为正常，留给算法工程师复核**
3. **补录后重算** — 补录数据后自动重新运行所有相关检查，状态/明细/历史同步
4. **导出一致** — 实际导出CSV后再读回，逐行对比 user_id/item_id/label/_trace_id/_batch_id，防止数据漂移

## 三步标准工作流 + 第四步导出核验

```
步骤1: 负样本列表第一次导入
    ↓
步骤2: 数据科学家林姐补看召回候选表 → 冲突需逐条确认/驳回 + 填理由
    ↓
步骤3: 阈值回放更新 (林姐重点看：阈值对比 + 历史记录反查同一条样例)
    ↓
步骤4: 导出 + 导出一致性核验  (导出一致自检实际执行位置，结果写入报告)
```

**重要原则：**
- 碰到少数类样本被总指标盖住时，**别急着归正常**，留给算法工程师复核
- 负样本列表和召回候选表互相矛盾时，**先列出冲突证据**，让林姐选确认或驳回，**不要替业务同事自动拍板**
- 每条冲突的确认/驳回都要填写**理由**，会出现在最终报告里
- 每条记录有唯一的 `_trace_id`，可在：**列表/详情/历史记录/导出CSV/报告反查框** 之间交叉验证同一条样例

## 目录结构

```
neg_sample_checker/
├── main.py                  # 主程序入口（交互模式7步 + 批量模式一键跑）
├── requirements.txt         # 依赖包
├── README.md               # 本文档
├── config/
│   └── settings.yaml        # 配置文件
├── src/
│   ├── __init__.py
│   ├── data_models.py       # 数据模型（含批次/trace/冲突理由/导出记录）
│   ├── checks.py            # 核心检查逻辑（导出一致、重复、少数类、冲突）
│   ├── workflow.py          # 工作流引擎（4步 + 批次 + 快照保存 + 刷新 + 追溯）
│   └── reporter.py          # 报告生成（HTML/JSON，含离线trace反查框）
├── data/                    # 样例数据
│   ├── normal/              # 正常材料
│   ├── wrong_caliber/       # 错口径材料（含问题）
│   └── supplement/          # 补录材料
├── exports/                 # 导出目录（含追溯列 + checksum）
└── reports/                 # 报告输出目录
```

## 快速开始

### 0. 环境准备

```bash
cd neg_sample_checker
pip3 install -r requirements.txt
```

---

## 方式一：一键批量跑（新人推荐，能看到所有检查项）

### 场景一：正常材料 —— 一切通过

```bash
python3 main.py --mode batch --scenario normal
```

**预期结果（报告中可见）：**
- 重复导入检查：通过（无本批次或跨批次重复）
- 少数类检查：通过（分布均衡）
- 负样本与召回候选表一致性：通过
- 阈值回放：通过
- **导出一致性核验：✅ 通过**（报告概览卡片 + 独立章节显示）

---

### 场景二：错口径材料 —— 能看到全部 4 类检查 + 冲突理由

```bash
python3 main.py --mode batch --scenario wrong_caliber
```

**预期结果（报告中可见）：**
- 重复导入检查：通过
- 少数类检查：**⚠️ 警告** — 检测到 label=2 的少数类（占比约 3%<5%），click_rate 与总指标差异较大
  - 报告 `🪤少数类样本清单表` 列出所有被盖住的样例及其完整 trace_id
- 负样本与召回候选表一致性：**⚠️ 警告** — 检测到 5 条标签冲突
  - 前 2 条被批量演示自动**确认/驳回**，并写入了**理由**（报告冲突证据区可看到）
  - 每条冲突显示 `trace_id`（可点击复制到反查框）
- 阈值回放：通过，历史表中少数样例 `trace_id` 可点击复制
- **导出一致性核验：✅ 通过**（报告概览卡片 + 独立章节显示 checksum / 导出历史）

---

### 场景三：补录材料 —— 自动应用补录后重算 + 区分批次

```bash
python3 main.py --mode batch --scenario supplement
```

**预期结果（报告中可见）：**
- 初始导入 10 条 → 生成 `initial_import` 批次
- 自动补录 10 条 → 生成 `supplement` 批次（蓝底高亮，含父批次链接）
- 补录后自动重算步骤1/2/3，历史、明细同步更新
- **导出一致性核验：✅ 通过**

---

## 方式二：交互模式（完整 7 步链路，适合实际工作）

```bash
python3 main.py --mode interactive
```

**全程链路（新人照着回车即可）：**

| # | 步骤 | 你要做的事 | 终端里能看到什么 |
|---|------|-----------|-----------------|
| 1 | 负样本列表第一次导入 | 回车用默认 `data/wrong_caliber/neg_samples.csv`，可填批次备注如「0614晚批次」 | 批次信息表（最新批次蓝底） |
| 2 | 林姐补看召回候选表 | 回车用默认路径 | 冲突清单（如 5 条待处理） |
|   | 冲突处理 | 输入 `Y` 进入 → 对每条选 `c`确认 / `r`驳回 / `s`跳过 → **必须填写理由** | 理由写入后刷新步骤2结果 |
| 3 | 阈值回放更新 | 回车用默认阈值，或输入 `0.6` 等 | 历史记录表（含 run_id / 阈值 / P / R / 备注） |
| 4 | 补录 / 修正 | 输入 `y` 补录 → 回车用默认 `data/supplement/supplement.csv` → 填备注 | 显示 +10 条，自动重算步骤1/3；输入 `s` 可随时看批次/历史/导出 |
| 5 | 保存快照 + 刷新 | 可填备注如「林姐处理完5条冲突后」 → 回车刷新 | 状态快照已保存；结果重算后刷新 |
| 6 | **导出 + 导出一致性核验** | 回车默认自动命名；是否含追溯列选 `Y` | 输出：导出一致检查结果 ✅/❌ + checksum + 导出历史表 |
| 7 | 生成报告 | 回车默认 | 输出 HTML / JSON / CSV 三个路径 |

**完成后验证：**
```bash
# 打开报告
open reports/report_*.html
```

在报告中：
- **顶部概览卡片**：看「导出一致」是否 ✅
- **顶部 Trace 反查框**：复制导出CSV里的任意一条 `_trace_id` 粘贴进去 → 弹出完整记录+批次信息
- **📦批次管理**：蓝底=最新补录批次，含父批次追溯
- **📜阈值回放与历史记录**：点少数样例的 trace_id 复制 → 去反查框粘贴 → 验证同一条记录
- **⚔️冲突证据**：每条都有「确认/驳回理由」框显示

---

## 启动与复跑方式速查

```bash
# ===== 启动：新人第一次跑推荐 =====
# 一键看到所有检查项+问题+导出一致
python3 main.py --mode batch --scenario wrong_caliber

# ===== 复跑：同样的场景再跑一遍 =====
python3 main.py --mode batch --scenario wrong_caliber

# ===== 复跑：不同阈值 =====
python3 main.py --mode batch --scenario wrong_caliber --threshold 0.6

# ===== 实际工作用：交互模式完整链路 =====
python3 main.py --mode interactive

# ===== 跑正常场景确认基线 =====
python3 main.py --mode batch --scenario normal

# ===== 跑补录场景确认批次/追溯 =====
python3 main.py --mode batch --scenario supplement
```

**查看产物：**
```bash
# 报告
ls -lt reports/

# 导出CSV（含 _trace_id / _batch_id 追溯列）
ls -lt exports/

# 看导出CSV里的追溯字段
head -3 exports/export_wrong_caliber.csv
```

---

## 报告里各板块该显示什么（新人核对清单）

打开 HTML 报告后，按下面的清单逐一确认：

### 📊 概览卡片
- [ ] 4 个步骤状态正确显示（✅/🟡/❌）
- [ ] **「导出一致」状态实际显示**（不是空的）

### 🔍 顶部 Trace 反查框
- [ ] 输入导出CSV里任意一条的 `_trace_id` → 点🔍 → 弹出完整记录
- [ ] 弹窗里能看到 user_id / item_id / label / 所属批次

### 📦 批次管理
- [ ] 多个批次时最新批次**蓝底高亮**
- [ ] supplement 类型批次能看到 parent_batch_id（父批次追溯链）
- [ ] 重复导入检查说明是「跨批次联合检查」

### ⚔️ 冲突证据（林姐翻这个）
- [ ] 每条冲突显示 trace_id（可点击复制）
- [ ] 负样本 vs 召回候选的标签对比完整
- [ ] **每条已处理的冲突都有「理由」字段**（不是空的）
- [ ] 显示处理人（林姐/批量模式演示）和处理时间

### 🪤 少数类样本清单（被总指标盖住的）
- [ ] 少数类样例全部列出
- [ ] 每条都有完整 trace_id
- [ ] 显示各指标与总指标的差异

### 📜 阈值回放与历史记录（林姐重点看这个）
- [ ] 每条历史：run_id / 时间 / 阈值 / Precision / Recall / 条数 / 备注
- [ ] 少数样例 trace_id 可点击复制
- [ ] 同一条 trace_id 能和：少数类清单、导出CSV、反查框 → 指向同一条记录

### 📤 导出与一致性核验（核心修复点！）
- [ ] step4_export 的检查结果完整显示
- [ ] 导出一致性核验：通过/不通过 + 对比的字段列表
- [ ] 校验和 checksum 显示
- [ ] 导出历史表：时间 / 条数 / checksum / 文件名 / 关联批次

---

## 数据格式要求

### 输入 CSV 必须包含的字段

| 字段名 | 类型 | 说明 |
|--------|------|------|
| user_id | int | 用户ID |
| item_id | int | 物品ID |
| timestamp | int | 时间戳 |
| label | int | 标签（0/1/2...） |
| score | float | 模型预测分数 |
| click_rate | float | 点击率指标 |
| conversion_rate | float | 转化率指标 |

**导出 CSV 额外包含（用于追溯）：**
| 字段名 | 说明 |
|--------|------|
| _trace_id | 每条记录的唯一追溯ID（跨内存/报告/导出一致） |
| _batch_id | 所属批次ID |
| _row_idx | 批次内行号 |

### 样例数据说明
- **normal/** — 标准的正负样本分布，无冲突
- **wrong_caliber/** — 包含 label=2 的少数类，召回候选表有 5 条标签冲突
- **supplement/** — 初始 10 条 + 补录 10 条（两批次）

## 配置说明

编辑 `config/settings.yaml` 可调整参数：

```yaml
checks:
  duplicate_detection:
    key_fields: ["user_id", "item_id", "timestamp"]
  
  minority_class_detection:
    minority_threshold: 0.05      # 少数类判定阈值（占比<5%）
    metric_fields: ["click_rate", "conversion_rate"]

  export_consistency:
    check_fields: ["user_id", "item_id", "label", "_trace_id", "_batch_id"]

threshold:
  default: 0.5
  require_manual_review: true     # 少数类需要人工复核

report:
  format: [html, json]
  output_dir: reports
```

## 典型使用场景

### 场景：算法工程师晚上催结果

1. `python3 main.py --mode interactive`
2. 导入负样本列表 → 工具生成 `initial_import` 批次
3. 对比召回候选表 → 发现 5 条冲突 → 林姐逐条确认/驳回 + 填理由
4. 阈值回放 → 发现 label=2 的少数类（占比 3%）click_rate 只有 0.02，总指标 0.25 → **⚠️警告：不要直接归正常，留给算法工程师复核**
5. 发现漏了 10 条 → 补录 supplement.csv → 自动生成 `supplement` 批次，蓝底高亮，父批次链正确
6. 保存快照 → 刷新结果
7. 导出 CSV → 自动执行「导出一致自检」：导出后读回，逐行对比 trace_id/label 等字段
8. 生成 HTML 报告 → 发给林姐：
   - 林姐翻 **🪤少数类清单** → 点 trace_id → 顶部反查框验证
   - 林姐重点看 **📜阈值回放与历史记录** → trace_id 反查同一条样例
   - 林姐在 **⚔️冲突证据** 里核对每条的**确认/驳回理由**
   - 看 **📤导出一致**：✅ 通过，校验和正确

## 常见问题

**Q: 导出一致自检实际在哪里跑的？不是空架子吧？**
A: 不是。在 `workflow.py` 的 `run_step4_export()` 里：先写 CSV → 立刻重新读回来 → 调用 `checks.check_export_consistency()` 逐字段对比 → 结果写入 step4 并出现在报告的「📤导出与一致性核验」章节和概览卡片。

**Q: 为什么不自动解决冲突？**
A: 标签定义涉及业务逻辑，工具只负责发现问题，决策权在数据科学家林姐和算法工程师手中。每条决策必须填写**理由**，留痕在报告里。

**Q: 少数类占比超过 5% 还会检查吗？**
A: 会的，只要少数类的指标与总指标差异超过 20%，就会发出警告。

**Q: 补录数据后需要重新跑一遍吗？**
A: 不用，`apply_supplement()` 会自动重算步骤1（重复/少数类）、步骤3（阈值回放），批次/明细/历史全部同步更新。

**Q: 怎么验证同一条记录在各处一致？**
A: 打开导出 CSV → 复制任意一行的 `_trace_id` → 打开 HTML 报告 → 粘贴到顶部 Trace 反查框 → 点🔍 → 查看 user_id/item_id/批次是否与导出CSV一致。

## 开发说明

核心模块：

- [data_models.py](src/data_models.py) — 数据类定义（BatchInfo / ConflictEvidence + 理由 / ExportRecord / RunHistory / NegSampleDataset + trace 追踪）
- [checks.py](src/checks.py) — 四个核心检查函数（`check_duplicates` / `check_minority_class_masking` / `check_export_consistency` / `check_conflict_between_neg_and_recall`）
- [workflow.py](src/workflow.py) — 四步工作流引擎，批次管理，快照保存/刷新，冲突处理+理由，导出一致，trace 反查
- [reporter.py](src/reporter.py) — HTML/JSON 报告，离线 Trace 反查框（`window._allRecords` + JS），导出一致性章节，批次追溯
- [main.py](main.py) — 交互模式 7 步完整链路 + 批量模式一键跑三个场景
