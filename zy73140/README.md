# 海草床调查数据清洗

解决港口工程师老何卡壳的采样瓶编号、时间对齐、云遮挡混进结果等问题。

## 快速开始

### 1. 运行样例
```bash
python main.py
```

### 2. 按视角导出
```bash
python main.py engineer   # 工程师视角：原始质量问题排查
python main.py reviewer   # 复核视角：月底状态分类与优先级
python main.py api        # 接口视角：结构化 JSON 返回
```

### 3. 重跑清洗
```python
from cleaner import clean_seagrass_data
from sample_data import generate_sample_records

records = generate_sample_records()
result = clean_seagrass_data(records, time_threshold=3)  # 调整时间阈值重跑
```

---

## ★ 坏材料来了看哪里

| 问题类型 | 导出位置 | 你会看到什么 |
|---------|---------|-------------|
| 遥感云遮挡 | `export_by_view(view='engineer')['云遮挡详细清单']` | 采样瓶编号、采样时间、原始覆盖率、云遮挡率、**被剔除原因** |
| 边界样本影响 | `export_by_view(view='engineer')['边界影响分析']` | 排除云遮挡后的均值对比、**每条边界样本剔除后均值变化** |
| 退回记录及原因 | `export_by_view(view='reviewer')['退回记录']` | 每条退回的 bottle_id、quality_flags、notes（完整原因） |
| 三类完整记录 | `export_by_view(view='reviewer')` | 已确认 / 待补件 / 退回，三类都有完整记录，不再只有 ID |
| 月度复核报告 | `ReviewManager.export_for_monthly_review()` | 同上，带复核日期、状态汇总、云遮挡退回详情 |

> **口径说明**：边界分析、覆盖率均值、最终判断都**先排除遥感云遮挡**再计算，`boundary_analysis.calculation_note` 字段会明确标注。

---

## 核心文件

- [models.py](file:///Users/maca/pro/solo/workspaces/zy73140/models.py) - 数据模型 + 统一标注字典（SCENE_LABELS / SIDE_NOTES，三种视角共用）
- [cleaner.py](file:///Users/maca/pro/solo/workspaces/zy73140/cleaner.py) - 清洗逻辑 + 多视角导出 `export_by_view()`
- [review.py](file:///Users/maca/pro/solo/workspaces/zy73140/review.py) - 月底复核流程管理
