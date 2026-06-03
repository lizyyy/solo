# 卡方检验问卷清洗工具

## 这是什么

一个用于卡方检验问卷数据清洗的命令行工具。核心解决的问题是：当分母为 0 却被填成空字符串时，**不自动归正常**，而是标记为待复核、留下完整证据链，留给数据复核人判断。

## 快速开始（新人 10 分钟跑通）

### 环境要求

- Python 3.9+
- 无需安装第三方依赖（仅使用标准库）

### 第一步：跑测试

```bash
cd chi_square_questionnaire_cleaner
python3 -m pytest tests/test_all.py -v -p no:asyncio
```

看到 25 passed 即表示环境正常。

### 第二步：用样例数据跑完整三步工作流

```bash
python3 -c "
from src.workflow import Workflow

wf = Workflow()

# === 第一步：手算反例首次导入 ===
import_result = wf.step1_import('sample_data.csv', ['denominator'], ['count_a', 'count_b'])
print('=== 导入结果 ===')
for k, v in import_result.items():
    print(f'  {k}: {v}')

# === 第二步：实验助理小穆补看问卷原始行 ===
review = wf.step2_review_original_rows()
print()
print('=== 待复核记录 ===')
for rec in review['records']:
    print(f'  证据ID: {rec[\"evidence_id\"]}  原始行号: {rec[\"original_row\"]}  异常类型: {rec[\"anomaly_type\"]}')
    print(f'    原始行快照: {rec[\"row_snapshot\"]}')

# 补录第 3 行（A,Q3: count_a=0, count_b=0, denominator=''）
target_eid = next(r['evidence_id'] for r in review['records'] if r['original_row'] == 4)
supp = wf.step2_supplement(target_eid, {'count_a': '3', 'count_b': '4', 'denominator': '7'})
print(f'  补录结果: {supp}')

# === 第三步：课堂演示结果更新 ===
demo = wf.step3_update_demo()
print()
print('=== 卡方检验结果 ===')
chi = demo['chi_square_result']
if chi.get('chi_square') is not None:
    print(f'  χ² = {chi[\"chi_square\"]}  df = {chi[\"df\"]}  p = {chi[\"p_value\"]}')
else:
    print(f'  计算错误: {chi.get(\"error\")}')

print()
print('=== 自检结果 ===')
for check in demo['self_check']:
    print(f'  [{check[\"status\"]}] {check[\"check\"]}: {check[\"detail\"]}')
"
```

### 第三步：导出报告

```bash
python3 -c "
from src.workflow import Workflow
wf = Workflow()
wf.step1_import('sample_data.csv', ['denominator'], ['count_a', 'count_b'])
review = wf.step2_review_original_rows()
for rec in review['records']:
    wf.step2_supplement(rec['evidence_id'], {'count_a': '5', 'count_b': '5', 'denominator': '10'})
demo = wf.step3_update_demo()

wf.store.export_csv('output_cleaned.csv')
wf.store.export_anomaly_csv('output_anomaly.csv')
wf.store.export_json('output_result.json')
print('已导出: output_cleaned.csv, output_anomaly.csv, output_result.json')
"
```

## 三步工作流详解

| 步骤 | 角色 | 操作 | 关键约束 |
|------|------|------|----------|
| 第一步 | 系统自动 | 导入 CSV，检测异常 | 分母=0 且填空字符串 → 标记 PENDING_REVIEW，**不自动归正常** |
| 第二步 | 实验助理 | 补看原始行号、补录数据 | 补录后重算卡方，但分母=0 空字符串记录仍留证据链待复核人确认 |
| 第三步 | 课堂演示 | 更新结果并自检 | 展示/导出/接口返回读同一份 ResultStore |

## 四项自检

| 自检项 | 检查内容 |
|--------|----------|
| duplicate_import | 是否存在重复导入的行 |
| denominator_zero_empty_string | 分母=0 空字符串记录是否一致（展示/导出/接口三处同步） |
| supplement_rerun | 补录后是否重算了卡方 |
| export_consistency | get_display_data / get_api_response / get_export_data 是否一致 |

## 证据链

每条异常记录都会生成一条 EvidenceRecord，包含：

- `evidence_id`：唯一标识（EVD-0001）
- `original_row`：CSV 原始行号
- `field_name`：异常字段
- `original_value`：原始值
- `manual_change`：人工改动说明
- `current_status`：处理状态（auto_flagged → pending_review → supplemented / confirmed_anomaly / confirmed_normal）
- `anomaly_type`：异常类型
- `timestamp`：时间戳
- `detail`：详细描述

数据复核人追问时，通过 `evidence.get_by_row(original_row)` 或 `evidence.get_by_id(evidence_id)` 即可回溯证据。

## 核心设计：分母为 0 却被填成空字符串

这是本工具最核心的处理逻辑：

1. **检测**：当 denominator 字段为空字符串，且 count 字段之和也为 0 时，标记为 `denominator_zero_empty_string` 异常
2. **不自动修正**：与"分母为空但 count 之和 > 0"的情况不同（后者自动填充 count 之和），这种情况**不自动归正常**
3. **留待复核**：状态为 `PENDING_REVIEW`，在展示/导出/接口中均可见
4. **三处一致**：ResultStore 的 get_display_data / get_api_response / get_export_data 读同一份数据，分母=0 空字符串记录不会"一个地方显示异常、另一个地方消失"

## 项目结构

```
chi_square_questionnaire_cleaner/
├── README.md
├── sample_data.csv              # 样例数据
├── src/
│   ├── __init__.py
│   ├── evidence.py              # 证据链模块
│   ├── result_store.py          # 统一结果源（单例）
│   ├── chi_square_cleaner.py    # 核心清洗引擎
│   ├── self_check.py            # 自检 + 卡方计算
│   └── workflow.py              # 三步工作流
└── tests/
    ├── __init__.py
    └── test_all.py              # 25 项测试
```
