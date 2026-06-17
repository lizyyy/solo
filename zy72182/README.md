# 图像质检缺陷聚类工具

一个用于图像质检缺陷聚类的AI/ML小工具，实现样本、模型输出、人工复核、指标对比和报告的闭环流程。

## 功能特性

- **版本管理**: 模型版本变化时旧报告不被覆盖，新版本独立保存
- **数据清洗**: 自动处理空值、重复样本，数据质量有保障
- **历史合并**: 自动应用历史人工标签，冲突时提示确认
- **缺陷聚类**: 基于特征的DBSCAN聚类，同类缺陷自动聚合
- **复核闭环**: 人工记录持久化，新模型不会覆盖历史标签
- **指标对比**: 版本间样本变化和指标变化分开解释
- **判断留痕**: 每个样本的完整决策轨迹，可追溯
- **交接报告**: 一键生成标准化交接文档

## 快速开始

### 环境要求

- Python 3.8+
- pip

### 安装依赖

```bash
pip3 install -r requirements.txt
```

依赖包：pandas, numpy, scikit-learn, python-dateutil, openpyxl

### 运行完整演示

```bash
python3 demo_pipeline.py
```

演示包含三个场景：
1. **V1 版本完整闭环** - 从数据加载 → 清洗 → 历史合并 → 待确认 → 人工确认 → 生成报告
2. **V2 版本旧口径继承** - 验证人工标签不被新模型盖掉 + 版本对比
3. **一致性验证** - 清洗统计、报告、Excel 三方对账

### 操作路径：待确认 → 人工确认 → 已确认

```python
from src import DataManager, ClusterEngine, ReviewManager, ReportGenerator

# 初始化
dm = DataManager("./workspace")
ce = ClusterEngine()
rm = ReviewManager("./workspace/reviews")
rg = ReportGenerator("./workspace/reports")

# 1. 创建版本 + 加载数据 + 清洗
version_id = dm.create_version("1.0.0", "版本描述")
raw_df = dm.load_raw_data("data.csv", version_id)
clean_df, clean_stats = dm.clean_data(raw_df)

# 2. 合并历史记录（自动找出待确认样本）
merged_df, merge_stats = dm.merge_with_historical_reviews(clean_df, version_id)
# merge_stats['conflicting_labels'] → 待确认样本数
# merge_stats['applied_labels'] → 直接继承confirmed的样本数

# 3. 聚类分析
clustered_df, _ = ce.cluster_defects(merged_df)
labeled_df, _ = ce.assign_cluster_labels(clustered_df)
reviewed_df, _ = rm.apply_reviews_to_dataframe(labeled_df)

# 4. 查看待确认清单
pending = reviewed_df[reviewed_df['review_status'] == 'need_confirm']
for _, row in pending.iterrows():
    print(f"{row['sample_id']}: {row['review_note']}")

# 5. 人工确认（小乔操作）
for _, row in pending.iterrows():
    rm.submit_review(
        sample_id=row['sample_id'],
        human_label=row['human_label'],  # 或改成新的标签
        reviewer="小乔",
        note="人工确认说明",
        version_id=version_id
    )

# 6. 重新应用 → 状态更新为confirmed
final_df, _ = rm.apply_reviews_to_dataframe(reviewed_df)

# 7. 生成报告
version_info = dm.get_version_info(version_id)
metrics = ce.calculate_metrics(final_df)
summary = rm.get_review_summary(final_df)

rg.generate_full_report(final_df, version_info, metrics, ...)
rg.generate_handoff_report(final_df, version_info, summary)
rg.export_result_excel(final_df, version_id)
```

## 模块说明

### 1. DataManager ([data_manager.py](src/data_manager.py))

数据管理核心模块：
- `create_version()` - 创建新版本，旧数据不受影响
- `load_raw_data()` - 加载原始CSV/Excel数据
- `clean_data()` - 清洗数据（空值处理、去重）
- `merge_with_historical_reviews()` - 合并历史复核记录

### 2. ClusterEngine ([cluster_engine.py](src/cluster_engine.py))

聚类和指标计算：
- `cluster_defects()` - DBSCAN缺陷聚类
- `assign_cluster_labels()` - 分配聚类标签
- `compare_versions()` - 版本对比
- `calculate_metrics()` - 计算统计指标

### 3. ReviewManager ([review_manager.py](src/review_manager.py))

人工复核管理：
- `get_pending_reviews()` - 获取待复核清单
- `submit_review()` - 提交复核结果
- `get_sample_review_history()` - 查询样本历史记录
- `export_review_template()` - 导出复核模板

### 4. ReportGenerator ([report_generator.py](src/report_generator.py))

报告生成：
- `generate_full_report()` - 生成完整JSON报告（含决策轨迹）
- `generate_handoff_report()` - 生成交接报告（Markdown）
- `export_result_excel()` - 导出Excel结果
- `compare_version_metrics()` - 版本指标对比

## 目录结构

```
workspace/
├── raw/              # 原始数据
├── processed/        # 各版本处理结果（按版本分目录）
│   ├── v1_1_0_2/
│   └── v2_2_0_0/
├── reviews/          # 人工复核记录（持久化JSON）
├── reports/          # 生成的报告
│   ├── *.json        # 完整报告（含决策轨迹）
│   ├── *_handoff.md  # 交接报告
│   └── *.xlsx        # Excel结果
└── meta/             # 版本元数据
```

## 样例数据说明

- `v1_model_results.csv` - V1版本模型输出（含重复、空值测试）
- `v2_model_results.csv` - V2版本模型输出（标签变化、新增样本测试）
- `historical_reviews.json` - 历史复核记录（旧口径）

## 典型使用流程

```python
from src import DataManager, ClusterEngine, ReviewManager, ReportGenerator

# 1. 初始化
dm = DataManager("./workspace")
ce = ClusterEngine()
rm = ReviewManager("./workspace/reviews")
rg = ReportGenerator("./workspace/reports")

# 2. 创建版本
version_id = dm.create_version("1.0.3", "新版本描述")

# 3. 加载和清洗数据
raw_df = dm.load_raw_data("data.csv", version_id)
clean_df, clean_stats = dm.clean_data(raw_df)

# 4. 合并历史记录
merged_df, merge_stats = dm.merge_with_historical_reviews(clean_df, version_id)

# 5. 聚类分析
clustered_df, cluster_stats = ce.cluster_defects(merged_df)
labeled_df, _ = ce.assign_cluster_labels(clustered_df)

# 6. 应用复核记录
reviewed_df, _ = rm.apply_reviews_to_dataframe(labeled_df)

# 7. 生成报告
version_info = dm.get_version_info(version_id)
metrics = ce.calculate_metrics(reviewed_df)
review_summary = rm.get_review_summary(reviewed_df)

rg.generate_full_report(reviewed_df, version_info, metrics, cluster_stats, clean_stats, merge_stats)
rg.generate_handoff_report(reviewed_df, version_info, review_summary)
rg.export_result_excel(reviewed_df, version_id)
```
