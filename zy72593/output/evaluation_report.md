# 候选集截断影响评估报告

**生成时间**: 2026-06-07 17:01:41

---

## 一、评估概览

| 指标 | 数值 |
|------|------|
| 负样本总数 | 20 |
| 召回候选总数 | 25 |
| 特征版本总数 | 32 |
| 🔴 重复训练组数 | 6 |
| 🔴 重复训练总条数 | 15 |

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
- **output_path**: output/recall_candidates_processed.csv

### ✅ 步骤3：特征版本表更新

- **total_versions**: 32
- **pending_review**: 6
- **needs_ayue_review**: 27
- **output_path**: output/feature_versions_updated.csv

---

## 三、重复训练检测详情

### 🔴 检测到的重复训练分组

| 批次ID | 商品ID | 重复次数 | 状态 |
|--------|--------|----------|------|
| B002 | ITEM0107 | 2 | 待策略产品复核 |
| B001 | ITEM0117 | 3 | 待策略产品复核 |
| B001 | ITEM0105 | 3 | 待策略产品复核 |
| B003 | ITEM0112 | 3 | 待策略产品复核 |
| B001 | ITEM0108 | 2 | 待策略产品复核 |
| B002 | ITEM0108 | 2 | 待策略产品复核 |

> ⚠️ **重要提示**: 以上数据检测到同一批数据重复训练两次，
> 已自动标记为「待策略产品复核」状态，
> **请勿自动归为正常**，请转交策略产品进行人工复核。

#### 数据追溯方式

点击图表中的数据点，可追溯到：
- 负样本列表原始记录
- 召回候选表原始记录
- 特征版本表对应条目

---

## 四、特征版本表说明

特征版本表中每条记录包含以下信息：

1. **为什么被留下**：说明数据来源（负样本/召回候选）及初检结论
2. **还缺什么材料**：列出待补充的材料清单
3. **下一步找谁**：
   - 待策略产品复核 → 找「策略产品」
   - 实验平台数据确认 → 找「实验平台负责人阿越」

### 待处理人员分布

- **实验平台负责人阿越**: 27 条待处理
- **策略产品**: 5 条待处理

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
