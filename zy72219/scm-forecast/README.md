# 供应链账期滚动预测系统

## 系统概述

本系统用于处理供应链账期滚动预测的清算批次数据，核心能力包括：
- 检测 T+1 到账被手工改为 T+2 的异常修改
- 验证节假日顺延说明的合法性
- 对账说明与历史记录一致性校验
- 冲突检测与交互式解决流程
- 四项基本自检（重复导入、T+1改T+2、补录后重算、导出一致）

## 核心原则

1. **不替业务同事自动拍板**：发现冲突时，列出证据让风控值班老秦选择确认或驳回
2. **别急着归正常**：T+1→T+2 修改即使确认有效，也留给基金经理最终复核
3. **三步工作流**：
   - 第一步：清算批次号第一次导入
   - 第二步：风控值班老秦补看节假日顺延说明
   - 第三步：对账说明更新

## 目录结构

```
scm-forecast/
├── config/
│   └── settings.py              # 配置（节假日、工作流步骤、自检项）
├── src/
│   ├── models/
│   │   └── datamodels.py        # 数据模型
│   ├── io/
│   │   └── handlers.py          # 导入导出、重复检测
│   ├── core/
│   │   ├── modification_detector.py  # T+1→T+2 检测与冲突处理
│   │   ├── holiday_validator.py      # 节假日校验
│   │   └── reconciliation_manager.py # 对账管理
│   ├── checks/
│   │   └── self_check.py        # 四项自检
│   └── workflow/
│       └── orchestrator.py      # 三步工作流编排
├── data/
│   ├── samples/                 # 样例数据
│   └── output/                  # 输出目录
├── tests/
│   └── test_system.py           # 9项系统测试
├── run_demo.py                  # 完整演示脚本
└── README.md
```

## 快速开始（新人指南）

### 1. 环境准备

Python 3.9+，无需额外依赖（仅使用标准库）

### 2. 查看样例数据

三份样例数据放在 `data/samples/` 目录：

| 文件名 | 说明 | 特点 |
|--------|------|------|
| `batch_20260530_normal.json` | 正常材料 | 5条记录，全部 T+1，已对账 |
| `batch_20260530_wrong_dimension.json` | 错口径材料 | 与正常材料同批次号，REC-003 被手工改为 T+2（儿童节借口，错误），REC-005 被手工改为 T+2（端午节借口，正确） |
| `batch_20260530_supplementary.json` | 补录材料 | 修正节假日说明，新增 REC-006 |

### 3. 运行演示脚本

```bash
cd scm-forecast
python3 run_demo.py
```

演示脚本会完整走一遍以下流程：
1. 导入三份材料（正常、错口径、补录）
2. 以错口径材料为主线运行三步工作流
3. 交互式处理冲突（模拟风控值班老秦的选择）
4. 运行四项基本自检
5. 三份材料对比分析
6. 导出最终报告
7. 标记待基金经理复核的记录

### 4. 查看输出

运行成功后，在 `data/output/` 目录会生成两份文件：
- `BATCH-2026-0530-001_wrong_dimension_YYYYMMDD_HHMMSS.json` - 完整数据导出
- `BATCH-2026-0530-001_report_YYYYMMDD_HHMMSS.txt` - 分析报告

### 5. 运行测试

```bash
python3 -m pytest tests/test_system.py -v
```

9项测试全部通过验证系统功能完整性。

## 核心 API 使用示例

### 导入数据

```python
from src.io.handlers import ForecastImporter
from src.models.datamodels import MaterialType

importer = ForecastImporter()
dataset = importer.import_from_json(
    "data/samples/batch_20260530_normal.json",
    MaterialType.NORMAL,
    "测试用户"
)
```

### 运行三步工作流

```python
from src.workflow.orchestrator import WorkflowOrchestrator

orchestrator = WorkflowOrchestrator()

# 第一步：导入清算批次
step1 = orchestrator.step_1_import_settlement_batch(dataset, "风控值班老秦")

# 如有冲突，交互式解决
for conflict_id, action, note in conflicts_to_resolve:
    orchestrator.resolve_conflict_interactive(
        dataset, conflict_id, action, "风控值班老秦", note
    )

# 第二步：查看节假日顺延
step2 = orchestrator.step_2_review_holiday_deferral(dataset, "风控值班老秦")

# 第三步：对账说明更新
step3 = orchestrator.step_3_update_reconciliation(dataset, "风控值班老秦")
```

### 运行自检

```python
from src.checks.self_check import SelfCheckEngine

check_engine = SelfCheckEngine()
report = check_engine.run_all_checks(dataset, supplementary_dataset)
summary = check_engine.get_check_summary(report)
print(f"总体结果: {'通过' if summary['overall_pass'] else '未通过'}")
```

## 节假日配置

在 `config/settings.py` 中维护节假日日历：

```python
HOLIDAY_CALENDAR = {
    date(2026, 5, 31): "周日",
    date(2026, 6, 1): "端午节",
    date(2026, 6, 2): "端午节调休",
    # 继续添加...
}
```

## 冲突处理流程

1. 系统检测到 T+1→T+2 手工修改
2. 校验节假日顺延说明是否合法
3. 如清算批次号与节假日说明矛盾，生成冲突证据
4. 风控值班老秦选择：
   - `confirm` - 确认修改有效，T+2 生效
   - `reject` - 驳回修改，恢复 T+1
5. 即使确认有效，仍标记为"待基金经理复核"，不自动发布

## 自检项说明

| 检查项 | 严重程度 | 说明 |
|--------|----------|------|
| duplicate_import | high | 检测重复导入的批次 |
| t1_to_t2_modification | critical | 检测 T+1 被手工改为 T+2 |
| supplement_recalculation | medium | 验证补录后重算逻辑 |
| export_consistency | high | 导出数据与内存数据一致性 |

## 常见问题

**Q: 为什么自检的 duplicate_import 检查失败了？**
A: 演示脚本故意导入了两次相同批次号的数据（正常材料和错口径材料），这是为了展示重复检测功能。实际使用时请确保批次号唯一。

**Q: 为什么 REC-005 确认了 T+2 还是不能发布？**
A: 根据核心原则，T+1→T+2 即使风控确认有效，也要留给基金经理最终复核，系统不会自动归为正常。

**Q: 如何添加新的节假日？**
A: 编辑 `config/settings.py` 中的 `HOLIDAY_CALENDAR`，添加日期和节日名称即可。

**Q: 如何处理工作流第三步被阻塞？**
A: 检查前序步骤是否还有待处理的冲突，先解决所有冲突后第三步才能继续。
