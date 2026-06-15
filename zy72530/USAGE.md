# 教学批改建议复核 - 演示系统

## 一、演示场景说明

本系统包含三种典型场景，用于给新人讲解"教学批改建议复核"完整流程：

| 场景 | 描述 | 关键结果 |
|------|------|----------|
| 场景1 | 顺利记录 | 模型输出→人工复核→评测报告，流程顺畅 |
| 场景2 | 人工改判被下一次批跑覆盖 | 第一次人工修正→第二次批跑覆盖→标记待安全审核 |
| 场景3 | 从人工改判表补录旧口径 | 旧批次模型输出→补录历史人工改判→更新评测报告 |

---

## 二、三步核心流程

### 第一步：模型输出片段第一次导入
```bash
# 导入批次数据（脚本自动完成）
```
- 读取模型输出JSON
- 记录批次ID、模型版本、生成时间
- 状态标记：`imported`

### 第二步：模型评测同事小孟补看人工改判表
```bash
# 应用人工改判（脚本自动完成）
```
- 小孟对照模型输出，填写人工改判表
- 包含：是否同意模型、人工评分、人工判罚、备注
- 状态变更：
  - 全部同意 → `confirmed`
  - 有修改 → `has_manual_modifications`

### 第三步：评测报告更新
```bash
# 生成评测报告（脚本自动完成）
```
- 对比模型输出与人工改判
- 统计：确认一致数、人工修正数、总分差
- 生成可复盘的报告文件

---

## 三、可重新跑的命令

### 运行全部场景
```bash
cd /Users/lzy/pro/solo/workspaces/zy72530
python3 scripts/run_scenarios.py
```

### 单独运行某个场景
```bash
# 场景1: 顺利记录
python3 scripts/run_scenarios.py 1

# 场景2: 人工改判被覆盖 → 走完三步后停在对齐检查点
python3 scripts/run_scenarios.py 2

# 场景3: 补录旧口径
python3 scripts/run_scenarios.py 3
```

### 🔍 核心检查：报告与历史是否对齐（重点！）
```bash
# 通用命令
python3 scripts/view_report.py align <报告文件名> <历史文件名>

# 例：检查场景2是否对齐（文件后缀用实际生成的时间戳替换）
python3 scripts/view_report.py align report_case_002_overwritten.json history_case_002_overwritten_20260615084524.json
```

**对齐检查内容**：
1. 三步流程是否都有记录：导入→补看人工改判→报告更新
2. 覆盖场景：覆盖检测是否一致、被覆盖改判痕迹是否在报告可见
3. 覆盖场景：状态是否=待安全审核（不归正常）
4. 补录场景：补录标记是否在报告可见

### 查看生成的评测报告
```bash
# 列出所有报告
python3 scripts/view_report.py list

# 查看某个报告（包含覆盖上下文、被覆盖改判痕迹、内嵌历史快照）
python3 scripts/view_report.py report report_case_001_normal.json
python3 scripts/view_report.py report report_case_002_overwritten.json
python3 scripts/view_report.py report report_case_003_supplement.json
```

**报告包含的关键留痕**（覆盖场景）：
- `summary.overwrites_original_batch`：被覆盖的原批次ID
- `summary.records_with_overwritten_manual_judgment`：带被覆盖人工改判的记录数
- `summary.needs_safety_review`：是否需安全审核
- `overwrite_context`：覆盖上下文（原状态、原人工判罚数、冲突数）
- `records[].has_overwritten_manual_judgment`：单条记录是否有被覆盖改判
- `records[].overwritten_manual_judgment`：被覆盖前的V1人工改判内容
- `history_snapshot`：报告内嵌的操作历史快照

### 查看操作历史记录（复盘用）
```bash
# 列出所有历史
python3 scripts/view_report.py history list

# 查看某个历史
python3 scripts/view_report.py history history_case_001_normal_xxx.json
```

---

## 四、场景2流程：停在对齐检查点看状态变化

### 执行命令
```bash
python3 scripts/run_scenarios.py 2
```

### 过程中可看到的状态变化
```
步骤1 导入模型输出 → 状态: (无) → imported
步骤2 小孟补看人工改判 → 状态: imported → has_manual_modifications
步骤2.5 第二次批跑覆盖 → 状态: imported → pending_safety_review
步骤3 评测报告更新 → 报告写入覆盖留痕字段
```

### 到达检查点后输出
- 报告中每个关键留痕字段的值（逐条展示）
- 报告内嵌 history_snapshot 的操作序列
- 独立历史文件的操作序列
- **提示手动运行 align 命令，不要自动点下一步**

---

## 五、关键细节：人工改判被覆盖时的处理

**场景2重点**：当检测到"有过人工修正的批次被新批跑覆盖"时，系统会：
1. 不自动将状态归为"正常"
2. 标记为 `pending_safety_review`（待安全审核）
3. 在报告中完整保留被覆盖前的人工改判内容（overwritten_manual_judgment）
4. 报告-历史对齐检查会验证"被覆盖痕迹是否在报告可见"
5. 留给安全审核同事复核确认

---

## 六、目录结构

```
zy72530/
├── data/
│   ├── config.json                    # 场景配置
│   ├── model_outputs/                 # 模型输出片段
│   │   ├── model_output_batch_001.json
│   │   ├── model_output_batch_002.json
│   │   ├── model_output_batch_002_v2.json
│   │   └── model_output_batch_003.json
│   ├── manual_judgments/              # 人工改判表
│   │   ├── manual_judgment_batch_001.json
│   │   └── manual_judgment_batch_002.json
│   └── supplements/                   # 补录材料
│       └── supplement_manual_judgment_003.json
├── scripts/
│   ├── engine.py                      # 核心处理引擎
│   ├── run_scenarios.py               # 场景运行入口
│   └── view_report.py                 # 报告/历史查看工具
├── reports/                           # 生成的评测报告
└── history/                           # 操作历史记录
```

---

## 六、复盘记录模板

### 复盘记录表

| 项目 | 内容 |
|------|------|
| 复盘日期 | 2026-06-07 |
| 演示人 | 小孟 |
| 参与人 | 新人 |
| 场景 | 场景1/场景2/场景3 |
| 关键步骤1 | 模型输出导入 |
| 关键步骤2 | 人工改判表填写 |
| 关键步骤3 | 评测报告生成 |
| 异常点（如有） |  |
| 安全审核介入点 | 场景2：人工改判被覆盖时 |
| 报告与历史是否一致 | 是/否 |

---

## 七、数据文件说明

### 模型输出字段
- `batch_id`: 批次ID
- `model_version`: 模型版本
- `records[].record_id`: 记录ID
- `records[].model_score`: 模型评分
- `records[].model_judgment`: 模型判罚

### 人工改判表字段
- `reviewed_by`: 审核人（小孟）
- `judgments[].agree_with_model`: 是否同意模型
- `judgments[].manual_score`: 人工评分
- `judgments[].status`: confirmed/modified

### 补录材料字段
- `is_supplement`: true（标记补录）
- `original_review_date`: 原审核日期
