# 海草床调查数据清洗

解决港口工程师老何卡壳的采样瓶编号、时间对齐、云遮挡混进结果等问题。

## 快速开始

### 1. 运行清洗
```bash
python main.py
```

### 2. 查看结果
样例数据包含10条记录，覆盖所有典型问题场景。

### 3. 月底复核
调用 `ReviewManager.export_for_monthly_review()` 导出已确认/待补件/退回分类。

---

## ★ 坏材料来了看这里

| 问题类型 | 查看位置 | 说明 |
|---------|---------|------|
| 遥感云遮挡 | `result.cloud_cover_records` | 已单独拎出，不参与统计 |
| 采样瓶缺失 | `quality_flags` 含 `采样瓶缺失` | 状态自动设为 **待补件** |
| 时间不匹配 | `quality_flags` 含 `时间不匹配` | 阈值默认2小时，可调 `time_threshold` |
| 边界样本 | `result.boundary_analysis` | 逐条展示对最终均值的影响 |
| 状态分类 | `ReviewManager.get_summary()` | 已确认/待补件/退回一目了然 |

---

## 代码说明

- **样例**: `sample_data.py` - 10条典型记录 + 2条极端边界样例
- **重跑**: `clean_seagrass_data(records, time_threshold=3)` - 调整参数重跑清洗
- **接口返回**: `build_api_response(result)` - 统一 `scene_label` / `side_note` / `data` 结构

## 核心文件

- [models.py](file:///Users/maca/pro/solo/workspaces/zy73140/models.py) - 数据模型 + 统一标注字典
- [cleaner.py](file:///Users/maca/pro/solo/workspaces/zy73140/cleaner.py) - 清洗核心逻辑
- [review.py](file:///Users/maca/pro/solo/workspaces/zy73140/review.py) - 复核流程管理
