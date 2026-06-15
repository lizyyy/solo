# 候选集截断影响评估报告

**生成时间**: 2026-06-15 14:00:33

---

## 一、评估概览

| 指标 | 数值 |
|------|------|
| 负样本总数 | 20 |
| 召回候选总数 | 25 |
| 特征版本总数 | 32 |
| 🔴 重复训练组数 | 7 |
| 🔴 重复训练总条数 | 20 |

---

## 二、执行步骤详情

### ✅ 步骤1：负样本列表导入

- **total_imported**: 20
- **duplicate_groups**: 4
- **duplicate_items**: 10
- **output_path**: output/negative_samples_processed.csv

### ✅ 步骤2：召回候选表复核（阿越）

- **total_imported**: 25
- **duplicate_groups**: 3
- **duplicate_items**: 7
- **cross_duplicates**: 7
- **negative_output_path**: output/negative_samples_processed.csv
- **output_path**: output/recall_candidates_processed.csv

### ✅ 步骤3：特征版本表更新

- **total_versions**: 32
- **pending_review**: 7
- **needs_ayue_review**: 25
- **output_path**: output/feature_versions_updated.csv

---

## 三、重复训练检测详情

### 🔴 检测到的重复训练分组

#### 🔗 跨表交叉重复（负样本+召回候选组合起来同一批数据重复训练）

| 批次ID | 商品ID | 负样本次数 | 召回候选次数 | 总次数 | 负样本ID | 召回候选ID | 状态 |
|--------|--------|------------|--------------|--------|----------|------------|------|
| B002 | ITEM0107 | 2 | 0 | 2 | S0002, S0005 |  | 待策略产品复核 |
| B001 | ITEM0117 | 3 | 0 | 3 | S0003, S0006, S0014 |  | 待策略产品复核 |
| B001 | ITEM0105 | 2 | 3 | 5 | S0004, S0008 | C0003, C0004, C0010 | 待策略产品复核 |
| B003 | ITEM0112 | 3 | 0 | 3 | S0011, S0016, S0019 |  | 待策略产品复核 |
| B001 | ITEM0108 | 0 | 2 | 2 |  | C0001, C0025 | 待策略产品复核 |
| B002 | ITEM0108 | 1 | 2 | 3 | S0020 | C0013, C0021 | 待策略产品复核 |
| B001 | ITEM0100 | 1 | 1 | 2 | S0001 | C0024 | 待策略产品复核 |

> ⚠️ **重要提示**: 以上数据检测到同一批数据重复训练两次（含表内重复和跨表交叉重复），
> 已自动标记为「待策略产品复核」状态，
> **请勿自动归为正常**，请转交策略产品进行人工复核。

#### 数据追溯方式

通过以下字段可追溯原始记录：
- 负样本列表：通过 `sample_id` 查找 `negative_samples_processed.csv`
- 召回候选表：通过 `candidate_id` 查找 `recall_candidates_processed.csv`
- 特征版本表：通过 `linked_sample_id` / `linked_candidate_id` 双向关联

---

## 四、特征版本表说明

特征版本表中每条记录包含以下信息：

1. **为什么被留下**：说明数据来源（负样本/召回候选）及初检结论
2. **还缺什么材料**：列出待补充的材料清单
3. **下一步找谁**：
   - 待策略产品复核 → 找「策略产品」
   - 实验平台数据确认 → 找「实验平台负责人阿越」

### 待处理人员分布

- **实验平台负责人阿越**: 25 条待处理
- **策略产品**: 7 条待处理

---

## 五、输出文件清单

### 数据文件
- `negative_samples_processed.csv` - 处理后的负样本列表
- `recall_candidates_processed.csv` - 处理后的召回候选表
- `feature_versions_updated.csv` - 更新后的特征版本表

### 图表文件（charts/ 目录）
- 状态分布饼图
- 重复训练分组柱状图
- 3D 数据分布散点图
- 批次质量对比图

### 报告文件
- `evaluation_summary.json` - 完整评估摘要（JSON）
- `evaluation_summary.csv` - 评估指标汇总（CSV）
- `index.html` - 交互式报告首页
