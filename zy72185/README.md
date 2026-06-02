# 大模型提示词版本仓库

风控算法运营专用工具，解决版本发布记录与实际材料脱节问题。

## 核心设计原则

1. **不炫技，只解决实际问题**：不追求大模型能力，重点解决版本、阈值、证据、人工改判的可追溯性
2. **冲突不隐藏**：标签冲突、样本泄漏、版本冲突单独提示，不被平均指标掩盖
3. **来源必可追**：每条版本记录都能追到评测日志、标注表、阈值备注的具体行号
4. **决策不替拍板**：版本发布记录与导入数据冲突时，只展示两边证据和建议动作，不自动修改
5. **导出带原因**：导出文件必须包含导出原因和冲突详情，不能只在页面闪一下

## 目录结构

```
.
├── data/
│   ├── versions/           # 版本配置文件（JSON格式）
│   ├── eval_logs/          # 评测日志（JSON格式）
│   ├── annotations/        # 标注表（CSV格式）
│   └── threshold_notes/    # 阈值备注（Markdown格式）
├── src/
│   ├── data_loader.py      # 数据加载
│   ├── version_manager.py  # 版本管理
│   ├── conflict_detector.py # 冲突检测（核心）
│   ├── traceability.py     # 来源追溯
│   ├── exporter.py         # 导出功能（带原因）
│   └── cli.py              # 命令行接口
├── tests/
│   └── test_boundary_cases.py # 边界情况测试
├── exports/                # 导出文件存放目录
└── README.md
```

---

## 一、怎么放样本

### 1. 评测日志 (`data/eval_logs/`)

**文件格式**：JSON，命名 `eval_log_YYYYMMDD.json`

```json
{
  "eval_date": "2024-06-01",
  "model_version": "v1.2.0",
  "total_cases": 15,
  "metrics": {
    "precision": 0.87,
    "recall": 0.82,
    "f1_score": 0.84
  },
  "cases": [
    {
      "case_id": "CASE001",
      "text": "用户申请借款10万元，月收入5000元",
      "pred_label": "高风险",
      "pred_score": 0.92,
      "reviewer": "张工"
    }
  ]
}
```

### 2. 标注表 (`data/annotations/`)

**文件格式**：CSV，命名 `annotation_YYYYMMDD.csv`

**必填列**：
- `case_id`: 案例唯一标识
- `text`: 案例文本
- `true_label`: 人工标注标签（高风险/中风险/低风险）
- `annotator`: 标注人
- `annotation_date`: 标注日期
- `conflict_note`: 冲突备注（可选，用于标记特殊样本）

**示例**：
```csv
case_id,text,true_label,annotator,annotation_date,conflict_note
CASE001,用户申请借款10万元,高风险,张工,2024-05-28,
CASE002,用户近3个月逾期2次,低风险,王工,2024-05-28,标签冲突：模型判中风险
CASE016,用户白户无信贷记录,中风险,王工,2024-05-29,边界样本：白户
CASE017,,,张工,2024-05-29,空值测试
```

### 3. 阈值备注 (`data/threshold_notes/`)

**文件格式**：Markdown，命名 `threshold_vX.X.X.md`

内容包括：阈值配置、调整说明、关联证据、注意事项。

### 4. 版本配置 (`data/versions/`)

**文件格式**：JSON，命名 `vX.X.X.json`

这是核心文件，关联所有其他材料。核心字段：

```json
{
  "version_id": "v1.2.0",
  "release_date": "2024-06-01",
  "release_by": "老唐",
  "status": "released",
  "prompt_content": "提示词完整内容...",
  "thresholds": {
    "high_risk_min": 0.80,
    "medium_risk_min": 0.60,
    "low_risk_max": 0.60
  },
  "release_notes": "版本发布说明...",
  "metrics": {
    "claimed_precision": 0.92,
    "claimed_recall": 0.88,
    "actual_precision": 0.87,
    "actual_recall": 0.82,
    "actual_f1": 0.84
  },
  "sources": [
    {"type": "eval_log", "file": "eval_log_20240601.json", "description": "..."},
    {"type": "annotation", "file": "annotation_20240601.csv", "description": "..."},
    {"type": "threshold_note", "file": "threshold_v1.2.0.md", "description": "..."}
  ],
  "manual_reviews": [
    {
      "case_id": "CASE002",
      "original_label": "中风险",
      "pred_score": 0.71,
      "reviewed_label": "低风险",
      "review_reason": "用户仅逾期2次且已结清...",
      "reviewer": "老唐",
      "review_date": "2024-05-30",
      "source_evidence": "标注表第3行CASE002，标注人为王工"
    }
  ],
  "data_quality": {
    "empty_values": ["CASE017"],
    "duplicate_records": ["CASE001"],
    "boundary_cases": ["CASE016"],
    "note": "数据中存在空值、重复项和边界样本"
  }
}
```

**重要字段说明**：
- `metrics.claimed_*`：版本发布记录里宣称的指标
- `metrics.actual_*`：实际评测数据（系统会对比两者是否一致）
- `sources`：关联的三个来源文件，用于追溯
- `manual_reviews`：人工改判记录，每条必须带证据来源
- `data_quality`：已知的数据质量问题，先标记出来

---

## 二、怎么切模型版本

### 版本命名规范

采用语义化版本号：`v主版本.次版本.修订版本`

- `v1.0.0` → `v1.1.0` → `v1.2.0`（次版本号递增表示有阈值或提示词变更）
- `v1.2.0` → `v1.2.1`（修订版本号递增表示小调整或bug修复）

### 版本发布流程

1. **准备材料**：
   - 生成评测日志 `eval_log_YYYYMMDD.json`
   - 完成人工标注 `annotation_YYYYMMDD.csv`
   - 编写阈值备注 `threshold_vX.X.X.md`

2. **创建版本配置**：
   - 复制上一版本的JSON文件，修改版本号、日期、阈值、指标等
   - 更新 `sources` 关联新的材料文件
   - 记录 `manual_reviews` 人工改判记录
   - 标记 `data_quality` 已知问题

3. **前置检查**：
   ```bash
   # 检查所有冲突
   python3 -m src.cli check v1.2.0
   
   # 如果有版本冲突，系统会列出两边证据
   # 不要修改数据，先人工核实
   ```

4. **确认无误后发布**：
   - 将 `status` 设为 `"released"`
   - 将上一版本 `status` 设为 `"archived"`

5. **导出记录**：
   ```bash
   # 导出完整版本信息（带所有冲突原因）
   python3 -m src.cli export v1.2.0
   
   # 导出冲突清单（供人工决策）
   python3 -m src.cli export-conflicts v1.2.0
   ```

### 版本对比

```bash
# 对比两个版本的差异
python3 -m src.cli diff v1.1.0 v1.2.0
```

输出包括：阈值变更、指标变更、人工改判变更、提示词变更。

---

## 三、怎么看冲突清单

### 冲突类型说明

| 类型 | 严重程度 | 说明 |
|------|----------|------|
| 标签冲突 | High | 模型预测标签 vs 人工标注标签不一致 |
| 样本泄漏 | Critical | 训练集和测试集有重叠样本 |
| 版本冲突 | High/Medium | 发布记录宣称 vs 实际导入数据不一致（需要人工决策） |
| 空值 | Medium | 标注表中存在空字段 |
| 重复项 | Low | 同一case_id多条标注 |
| 边界记录 | Medium | 分数接近阈值、白户等特殊样本 |

### 查看冲突

```bash
# 查看所有冲突
python3 -m src.cli check v1.2.0

# 只看某类冲突
python3 -m src.cli check v1.2.0 --type label      # 标签冲突
python3 -m src.cli check v1.2.0 --type version    # 版本冲突
python3 -m src.cli check v1.2.0 --type boundary   # 边界记录
```

### 版本冲突的处理（重点）

当检测到**版本冲突**时，系统会展示：

```
⚠️  以下为两边证据对比，系统不自动判定，请人工核实：

[发布记录宣称] 来源: 版本发布记录 v1.2.0 -> 【发布记录宣称】
  精确率: 0.92

[实际数据] 来源: 评测日志实际计算结果
  精确率: 0.87
  差异: 精确率-0.05

建议动作:
  → 核实发布记录中精确率0.92的来源
  → 以实际评测数据0.87为准，修正发布记录
  → ...

❌ 系统不自动判定，请人工核实后决定采用哪个值
```

**处理原则**：
1. 系统**不会**自动修改任何数据
2. 所有版本冲突都会标记 `decision_required: True`
3. 人工核实后，手动修改版本配置文件
4. 修改后重新运行 `check` 命令确认冲突已解决

### 导出冲突清单

```bash
# 导出完整冲突清单（带原因）
python3 -m src.cli export-conflicts v1.2.0

# 导出特定类型冲突
python3 -m src.cli export-conflicts v1.2.0 --type version
```

导出的JSON文件包含：
- 导出原因（自动生成，说明导出时检测到的问题）
- 需要人工决策的所有项
- 每项的两边证据对比
- 建议动作

---

## 四、核心命令速查

```bash
# 列出所有版本
python3 -m src.cli list

# 查看版本详情
python3 -m src.cli show v1.2.0
python3 -m src.cli show v1.2.0 --full  # 显示提示词和发布说明

# 检测冲突
python3 -m src.cli check v1.2.0
python3 -m src.cli check v1.2.0 --type label

# 追溯案例来源
python3 -m src.cli trace v1.2.0 CASE002

# 查看人工改判记录
python3 -m src.cli reviews v1.2.0

# 版本对比
python3 -m src.cli diff v1.1.0 v1.2.0

# 导出（全部带原因）
python3 -m src.cli export v1.2.0              # JSON格式
python3 -m src.cli export v1.2.0 --format csv  # CSV格式
python3 -m src.cli export-conflicts v1.2.0     # 冲突清单
python3 -m src.cli export-reviews v1.2.0       # 人工改判记录
python3 -m src.cli export-trace v1.2.0 CASE002 # 单案例追溯
```

---

## 五、边界情况测试

工具已内置9个边界测试，覆盖空值、重复项、边界记录等场景：

```bash
# 运行所有边界测试
python3 -m tests.test_boundary_cases
```

测试内容：
1. ✅ 空值检测（CASE017：text和true_label为空）
2. ✅ 重复项检测（CASE001：两条标注）
3. ✅ 边界记录检测（分数接近阈值、白户样本）
4. ✅ 标签冲突检测（4个案例）
5. ✅ 样本泄漏检测（CASE001同时在训练集和测试集）
6. ✅ 版本冲突检测（指标不一致、改判记录不一致）
7. ✅ 来源追溯（从版本→评测日志→标注表完整链路）
8. ✅ 导出带原因（导出文件包含导出原因和冲突详情）
9. ✅ 整体检测摘要（问题分类、严重程度、需决策项统计）

---

## 六、换人处理指南

如果后续有新同事接手，可以按以下步骤快速了解历史决策：

### 1. 查看版本历史

```bash
python3 -m src.cli list
```

了解有哪些版本、谁发布的、什么时候发布的。

### 2. 查看人工改判记录

```bash
python3 -m src.cli reviews v1.2.0
```

每条改判都有：原标签、改判后标签、改判人、改判日期、改判理由、证据来源。

### 3. 追溯关键案例

```bash
python3 -m src.cli trace v1.2.0 CASE002
```

查看该案例的完整证据链：评测日志预测结果、标注表人工标注、人工改判历史、阈值上下文。

### 4. 查看历史冲突处理

```bash
ls exports/  # 查看历史导出文件
```

每次发布前的冲突检测结果都应该导出归档，可以看到当时发现了什么问题、怎么决策的。

### 5. 对比版本演进

```bash
python3 -m src.cli diff v1.1.0 v1.2.0
```

了解每次版本调整了什么（阈值、提示词、改判记录）。

---

## 七、常见问题

### Q: 为什么平均指标看起来不错，但工具还提示有问题？

A: 平均指标会掩盖个别严重问题。工具会单独列出标签冲突、样本泄漏等高风险问题，即使整体指标正常，这些问题也必须处理。

### Q: 导出文件为什么这么大？

A: 导出文件包含完整的证据链（评测日志、标注表、改判记录、冲突检测结果），目的是让后续任何人拿到导出文件就能完整了解当时的情况，不需要再去翻原始材料。

### Q: 检测到版本冲突时，为什么系统不自动修正？

A: 版本冲突通常涉及发布记录的笔误或数据理解差异，系统不能替用户做决策。必须由人工核实两边证据后手动修改，避免引入新的错误。

### Q: 怎么添加新的人工改判记录？

A: 直接编辑版本JSON文件的 `manual_reviews` 数组，或通过代码调用 `VersionManager.add_manual_review()`。每条记录必须填写 `source_evidence` 说明证据来源。

---

## 文件引用

- 核心模块：[cli.py](file:///Users/lzy/pro/solo/workspaces/zy72185/src/cli.py)、[conflict_detector.py](file:///Users/lzy/pro/solo/workspaces/zy72185/src/conflict_detector.py)、[exporter.py](file:///Users/lzy/pro/solo/workspaces/zy72185/src/exporter.py)
- 样本数据：[v1.2.0.json](file:///Users/lzy/pro/solo/workspaces/zy72185/data/versions/v1.2.0.json)、[eval_log_20240601.json](file:///Users/lzy/pro/solo/workspaces/zy72185/data/eval_logs/eval_log_20240601.json)、[annotation_20240601.csv](file:///Users/lzy/pro/solo/workspaces/zy72185/data/annotations/annotation_20240601.csv)
- 测试用例：[test_boundary_cases.py](file:///Users/lzy/pro/solo/workspaces/zy72185/tests/test_boundary_cases.py)
