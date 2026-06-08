# 卡方检验问卷清洗工具

## 这是什么

一个用于卡方检验问卷数据清洗的 **Web 交互计算器**，同时支持 Python 代码调用。核心解决的问题是：当分母为 0 却被填成空字符串时，**不自动归正常**，而是标记为待复核、留下完整证据链，留给数据复核人判断。

- **同一套数据**：页面展示、接口返回、导出明细、生成报告、复核历史 都读同一份 `ResultStore` + `EvidenceChain`
- **一条记录全链路追溯**：原始说法 → 改后值 → 处理原因 → 下一步找谁 → 是否移入正常结果，一条记录串到底
- **Web 交互闭环**：触发问题输入 → 实验助理补录/修正 → 复核人确认 → 保存后状态变化 → 最终展示结果/导出

## 快速开始（新人 10 分钟跑通）

### 环境要求

- Python 3.9+
- Flask 3.x（如未装，运行 `pip3 install flask`）

### 0. 启动 Web 交互计算器

```bash
cd chi_square_questionnaire_cleaner

# （如未安装 Flask）
pip3 install flask

# 启动
python3 app.py
# 默认监听 http://127.0.0.1:5001/
```

浏览器打开 `http://127.0.0.1:5001/`，即可体验完整闭环：

1. **① 输入**：点左侧「导入样例 CSV」按钮（或上传 CSV / 手填 JSON）
2. 看摘要区：9 行原始数据，3 条分母=0 空字符串异常，1 条重复导入
3. **② 补录**：在「异常列表」Tab 里点一条（如 原始行号=4 的 A,Q3），在详情区底部补录表单填：
   - count_a = 3、count_b = 4、denominator = 7、补录人 = 实验助理小穆
   - 点「保存补录（不自动归正常）」
   - 此时列表里该行状态变"已补录·待复核"，正常结果仍为 5 条（**不提前归正常**）
4. **③ 复核**：同一个详情页再填复核备注，点「✓ 确认正常，移入卡方」
   - 复核人 = 数据复核人老K，备注 = 对照原始问卷第3页
   - 此时：正常数从 5 → 6，卡方从 χ²=2.414 → 2.605，异常数减 1
5. **④ 导出**：点左侧「正常明细 CSV」「异常明细 CSV」「完整结果 JSON」「生成复核报告」

页面里 7 个 Tab（异常列表、正常结果、证据清单、历史记录、自检结果、记录详情）全部自动刷新。

### 1. 跑单测（代码模块回归）

```bash
cd chi_square_questionnaire_cleaner
python3 -m pytest tests/test_all.py -v -p no:asyncio
```

看到 25 passed 即表示模块正常。

### 2. 跑端到端 API 测试（需先启动 app.py）

```bash
# 另开一个终端，先启动 app.py
# 在本终端：
cd chi_square_questionnaire_cleaner
python3 tests/test_e2e_api.py
```

这个脚本会真实调 `/api/import/sample` → `/api/supplement` → `/api/review` → `/api/state` → `/api/export/*` 等接口，校验 **display=api=export 四路一致**。

### 3. 命令行代码调用示例

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

# 补录第 4 行（A,Q3: count_a=0, count_b=0, denominator=''）
target_eid = next(r['evidence_id'] for r in review['records'] if r['original_row'] == 4)
supp = wf.step2_supplement(target_eid, {'count_a': '3', 'count_b': '4', 'denominator': '7'}, '实验助理小穆')
print(f'  补录结果: {supp}')

# === 第三步：复核人确认，然后课堂演示结果更新 ===
wf.reviewer_confirm(target_eid, True, '对照原始问卷第3页，A组Q3共7人', '数据复核人老K')

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

### 4. 命令行导出报告

```bash
python3 -c "
from src.workflow import Workflow
wf = Workflow()
wf.step1_import('sample_data.csv', ['denominator'], ['count_a', 'count_b'])
review = wf.step2_review_original_rows()
for rec in review['records']:
    wf.step2_supplement(rec['evidence_id'], {'count_a': '5', 'count_b': '5', 'denominator': '10'}, '实验助理')
    wf.reviewer_confirm(rec['evidence_id'], True, '确认无误', '复核人')
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

每条异常记录都会生成一条 EvidenceRecord，数据复核人追问时能直接回到证据：

| 字段 | 说明 |
|------|------|
| `evidence_id` | 唯一标识（EVD-0001） |
| `original_row` | CSV 原始行号 |
| `field_name` | 异常字段 |
| `original_value` | 原始值（原始说法保留） |
| `original_statement` | 原始说法，人类可读描述（含原始行快照） |
| `supplemented_by` / `supplemented_values` | 谁补录的、改后值 |
| `reviewer` / `review_reason` / `corrected_value` | 复核人、处理原因、修正后进入正常结果的值 |
| `next_step` | 下一步找谁 / 做什么 |
| `current_status` | 五态流转：`auto_flagged → pending_review → supplemented → confirmed_normal / confirmed_anomaly` |
| `anomaly_type` / `detail` / `timestamp` | 异常类型、自动检测说明、时间戳 |
| `manual_change` | 其它人工改动备注 |

通过 `evidence.get_by_row(original_row)` 或 `evidence.get_by_id(evidence_id)` 即可回溯证据。

## 核心设计：分母为 0 却被填成空字符串

这是本工具最核心的处理逻辑：

1. **检测**：当 denominator 字段为空字符串，且 count 字段之和也为 0 时，标记为 `denominator_zero_empty_string` 异常
2. **不自动修正**：与"分母为空但 count 之和 > 0"的情况不同（后者自动填充 count 之和），这种情况**不自动归正常**
3. **留待复核**：状态为 `PENDING_REVIEW`，在展示/导出/接口中均可见
4. **同一套数据**：ResultStore 的 `get_display_data()` / `get_api_response()` / `get_export_data()` 读同一份构建逻辑，分母=0 空字符串记录不会"一个地方显示异常、另一个地方消失"
5. **补录也不归正常**：实验助理补录后，仅标记为 `SUPPLEMENTED` 仍留在异常列表；必须经数据复核人 `reviewer_confirm(confirmed=True)` 才移入正常结果并参与卡方计算
6. **全链路留痕**：原始值、补录值、补录人、复核人、复核原因、下一步说明 全部在证据记录里，报告导出时一起写进 Markdown

## 项目结构

```
chi_square_questionnaire_cleaner/
├── README.md
├── app.py                        # Flask Web 服务入口
├── sample_data.csv               # 样例数据
├── e2e_test.sh                   # 端到端测试脚本（curl/bash 版）
├── web/
│   ├── templates/index.html      # 前端页面
│   └── static/app.js             # 前端交互脚本
├── src/
│   ├── __init__.py
│   ├── evidence.py               # 证据链模块（EvidenceRecord / EvidenceChain）
│   ├── result_store.py           # 统一结果源（单例 ResultStore）
│   ├── chi_square_cleaner.py     # 核心清洗引擎
│   ├── self_check.py             # 四项自检 + 卡方计算
│   └── workflow.py               # 三步工作流封装
└── tests/
    ├── __init__.py
    ├── test_all.py               # 25 项模块回归测试
    └── test_e2e_api.py           # 端到端 API 测试（调真实 HTTP 接口）
```
