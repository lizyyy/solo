# 信用卡分期提前结清核对工具

## 背景

机构简称前后不一致这类记录一出现，财务复核人就会追问"信用卡分期提前结清"为什么前后不一致，基金会计林姐现在只能手工解释。

本工具解决以下问题：

1. ✅ **机构简称一致性校验**：导入后自动标出机构简称前后不一致的记录，别急着归正常，留给财务复核人复核
2. ✅ **追溯能力**：点到一条机构简称不一致时，能回到清算批次号或节假日顺延说明，不是只剩漂亮画面
3. ✅ **补录记录**：说明这条为什么被留下、还缺什么材料、下一步该找财务复核人还是找基金会计林姐
4. ✅ **多入口**：命令行、API、小看板任选
5. ✅ **自动同步**：补录节假日顺延说明后补录记录自动跟着变
6. ✅ **临时会场景**：财务复核人只看补录记录也能知道哪条来自清算批次号、哪条还等确认
7. ✅ **新人友好**：照 README 从样例跑到报告

---

## 快速开始

### 1. 安装依赖

```bash
cd credit_card_settlement
pip install -r requirements.txt
```

### 2. 一键跑通完整演示

```bash
cd credit_card_settlement
rm -f settlement.db  # 清理旧数据
python -m src.cli demo
```

这会自动完成：
1. 导入样例批次 `BATCH_20260601`
2. 标记机构简称不一致的记录
3. 基金会计林姐补录节假日顺延说明
4. 补录记录自动更新
5. 生成 HTML 报告和补录 CSV

然后查看生成的文件：
- `./output/demo_report.html` - 完整报告（含表格、图表、补录记录三种视图）
- `./output/demo_supplementary.csv` - 补录记录汇总（临时会用）

---

## 核心流程

### 三步标准流程

```
┌─────────────────────────┐    ┌──────────────────────────┐    ┌─────────────────────┐
│  1. 导入清算批次号      │ →  │  2. 林姐补录节假日说明    │ →  │  3. 补录记录更新     │
│                         │    │                          │    │                     │
│  CSV → 机构简称校验      │    │  补录说明 → 状态流转      │    │  自动同步追溯路径   │
│  不一致 → 异常待复核     │    │  不一致仍留给财务复核     │    │  流转至财务复核人   │
└─────────────────────────┘    └──────────────────────────┘    └─────────────────────┘
                                     ↓
                            ┌─────────────────────┐
                            │  4. 财务复核人复核   │
                            │  通过 / 退回        │
                            └─────────────────────┘
```

### 状态流转图

```
pending_import (待导入)
        ↓
  import_batch()
        ↓
┌─────────────────────────────────────┐
│ 机构简称一致？                        │
├───────────┬─────────────────────────┤
│    ✅ 是   │ → pending_fund_accounting │ 待林姐补录节假日
│    ❌ 否   │ → abnormal_need_review    │ 异常待复核（留给财务）
└───────────┴─────────────────────────┘
        ↓                           ↓
  add_holiday_note()           直接可复核
        ↓                           ↓
  pending_review (待财务复核) ←──────┘
        ↓
  review_by_finance()
        ↓
┌─────────────────────────┐
│  通过？                   │
├───────────┬─────────────┤
│    ✅ 是   │ → reviewed    │
│    ❌ 否   │ → pending_fund_accounting │ 退回林姐
└───────────┴─────────────┘
```

---

## 命令行使用

### 初始化数据库

```bash
python -m src.cli init
```

### 1. 导入清算批次

```bash
python -m src.cli import-batch ./sample_data/batch_20260601.csv \
  --batch-no BATCH_20260601 \
  --imported-by zhangsan \
  --remark "2026年6月第一批"
```

输出示例：
```
✅ 批次 [BATCH_20260601] 导入完成
   总记录数: 10
   机构简称不一致: 6 条

⚠️  发现 6 条机构简称不一致记录：
   - 流水号 CC20260601002: '招行' → 期望 '招商银行'
   - 流水号 CC20260601004: '工行' → 期望 '工商银行'
   - 流水号 CC20260601005: '招商银行信用卡中心' → 期望 '招商银行'
   - 流水号 CC20260601007: '农行' → 期望 '农业银行'
   - 流水号 CC20260601008: '中行' → 期望 '中国银行'

📋 不一致记录已标记为【异常待复核】状态，留给财务复核人处理。
📋 一致记录已流转至【待基金会计处理】，等待林姐补录节假日顺延说明。
```

### 2. 基金会计林姐补录节假日顺延说明

```bash
# 补录记录ID=1的节假日说明
python -m src.cli add-holiday 1 \
  "该笔清算日期遇端午节假期，顺延至2026-06-03处理，已与前台确认。" \
  --reviewed-by fund_accounting_lin
```

> 💡 即使是机构简称不一致的记录，林姐也可以先补录节假日说明。补录后记录状态变为"待财务复核"，但机构简称不一致的问题仍然保留给财务复核人处理。

### 3. 查看记录列表

```bash
# 全部记录
python -m src.cli list-records

# 按批次筛选
python -m src.cli list-records --batch-no BATCH_20260601

# 按状态筛选
python -m src.cli list-records --status abnormal_need_review
```

输出示例：
```
ID    流水号               批次            机构简称          一致性    状态            下一步
--------------------------------------------------------------------------------------
1     CC20260601001       BATCH_20260601  招商银行          ✅一致     待基金会计       林姐
2     CC20260601002       BATCH_20260601  招行              ❌不一致   异常待复核       财务复核人
3     CC20260601003       BATCH_20260601  工商银行          ✅一致     待基金会计       林姐
4     CC20260601004       BATCH_20260601  工行              ❌不一致   异常待复核       财务复核人
```

### 4. 财务复核人复核

```bash
# 通过
python -m src.cli review 2 --approved --comment "经核实'招行'确为招商银行简称，予以通过"

# 退回
python -m src.cli review 4 --rejected --comment "'工行'简称不规范，请联系业务部门确认标准名称"
```

### 5. 生成报告

```bash
# 生成完整 HTML 报告
python -m src.cli report --output ./output/report.html

# 按批次生成
python -m src.cli report --batch-no BATCH_20260601 --output ./output/report_0601.html

# 导出补录记录CSV（临时会用）
python -m src.cli export-supp --output ./output/supplementary.csv
```

---

## 报告功能

### 三种视图

1. **表格视图**（默认）
   - 机构简称不一致记录置顶显示
   - 点击"查看详情/追溯"可展开完整信息
   - 显示补录记录、节假日说明、追溯路径

2. **图表视图**
   - 数据概览柱状图
   - **点击"机构简称不一致"柱状图可快速定位到明细**
   - 不是空壳图表，点击有实际追溯能力

3. **仅看补录记录**（财务复核人快速查看）
   ```
   | 流水号 | 来源批次 | 留下原因 | 缺什么材料 | 下一步找谁 | 追溯路径 |
   ```
   ⏱️ 临时会前十分钟，打开这个视图够用。

### 追溯能力

每条不一致记录都可以：
- → 回到清算批次号（显示导入时间、导入人）
- → 查看节假日顺延说明（如果已补录）
- 查看完整追溯路径：`批次[XXX] → 机构简称不一致 → 林姐补录节假日 → 待财务复核`

---

## API / 小看板

### 启动 API 服务

```bash
python -m src.api
```

服务启动后：
- API 文档：http://localhost:8000/docs
- 小看板界面：http://localhost:8000/dashboard
- 完整报告：http://localhost:8000/api/report
- 补录CSV：http://localhost:8000/api/supplementary.csv

### 主要 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/records` | 获取记录列表 |
| GET | `/api/records/{id}` | 获取单条记录详情（含追溯信息） |
| POST | `/api/import` | 导入清算批次 CSV |
| POST | `/api/holiday-note` | 补录节假日顺延说明 |
| PUT | `/api/supplementary` | 更新补录记录 |
| POST | `/api/review` | 财务复核 |
| GET | `/api/report` | 生成 HTML 报告 |
| GET | `/api/supplementary.csv` | 导出补录记录 CSV |

### 小看板功能

- 📥 导入清算批次
- 👁️ 实时查看记录状态和负责人
- ✏️ 林姐补录节假日说明
- ✅ 财务复核人在线复核
- 🔍 搜索、筛选（状态、负责人、流水号）
- ⚠️ 一键筛选"仅看机构简称不一致"
- 📊 一键打开完整报告
- 📋 一键导出补录CSV

---

## 补录记录字段说明

每条记录都有对应的补录记录（`supplementary_records` 表），字段包括：

| 字段 | 说明 | 示例 |
|------|------|------|
| `reason_kept` | 为什么被留下 | 机构简称'招行'与标准库不一致，期望应为'招商银行'。需财务复核人确认是否调整。 |
| `missing_materials` | 还缺什么材料 | 待财务复核人确认机构简称差异 |
| `next_owner` | 下一步找谁 | `financial_reviewer` / `fund_accounting_lin` |
| `source_batch_no` | 来自哪个清算批次 | BATCH_20260601 |
| `trace_info` | 追溯路径 | 批次[BATCH_20260601] → 机构简称不一致 → 林姐补录节假日 → 待财务复核 |

> 💡 **核心设计**：补录记录不是冷冰冰的系统日志，而是用业务语言描述的"待办清单"。财务复核人一眼就能看懂。

---

## 机构简称标准库

在 [src/validator.py](file:///Users/lzy/pro/solo/workspaces/zy72212/credit_card_settlement/src/validator.py#L6-L23) 中维护：

```python
STANDARD_ORG_NAMES = {
    "招商银行": "招商银行股份有限公司",
    "招行": "招商银行股份有限公司",
    "工商银行": "中国工商银行股份有限公司",
    "工行": "中国工商银行股份有限公司",
    # ... 更多
}
```

校验规则：机构简称必须在标准库的 key 中。"招行"、"工行"等简称虽然映射到正确的标准名称，但作为不规范简称，仍会被标记为不一致，留给财务复核人确认。

---

## 数据模型

### 核心表结构

```
settlement_batches (清算批次)
  ├─ id, batch_no, import_date, imported_by, total_records

settlement_records (清算记录)
  ├─ id, batch_id, serial_no, org_name, org_name_std, card_no, amount
  ├─ settlement_date, status, org_name_consistent, org_name_expected

holiday_notes (节假日顺延说明)
  ├─ id, record_id, note, reviewed_by, reviewed_at

supplementary_records (补录记录)
  ├─ id, record_id, reason_kept, missing_materials, next_owner
  └─ source_batch_no, trace_info, updated_by, updated_at
```

---

## 目录结构

```
credit_card_settlement/
├── README.md                    # 本文档
├── requirements.txt             # 依赖
├── settlement.db                # SQLite 数据库（运行后生成）
├── output/                      # 输出文件（运行后生成）
│   ├── demo_report.html
│   └── demo_supplementary.csv
├── sample_data/
│   └── batch_20260601.csv       # 样例数据
├── src/
│   ├── __init__.py
│   ├── models.py                # 数据模型
│   ├── database.py              # 数据库连接
│   ├── validator.py             # 机构简称校验
│   ├── workflow.py              # 工作流（导入/补录/复核）
│   ├── report.py                # 报告生成
│   ├── cli.py                   # 命令行入口
│   └── api.py                   # API + 小看板
└── tests/
    └── test_e2e.py              # 端到端测试
```

---

## 端到端测试

```bash
cd credit_card_settlement
python -m pytest tests/test_e2e.py -v
```

测试覆盖完整流程：
1. 导入清算批次
2. 验证机构简称不一致标记正确
3. 验证不一致记录状态为"异常待复核"（留给财务）
4. 林姐补录节假日说明
5. 验证补录记录自动更新
6. 财务复核人复核通过
7. 生成报告和CSV

---

## 关键设计决策

### 1. 机构简称不一致别急着归正常

> **用户需求**："中间碰到机构简称前后不一致时，别急着归正常，留给财务复核人复核"

**实现**：导入时检测到不一致，状态直接设为 `abnormal_need_review`（异常待复核），`next_owner` 设为 `financial_reviewer`。即使林姐补录了节假日说明，状态变为 `pending_review`，但 `org_name_consistent` 仍为 `False`，问题仍然暴露。

### 2. 补录记录自动同步

> **用户需求**："补录节假日顺延说明后补录记录要跟着变"

**实现**：在 `add_holiday_note()` 函数中，补录节假日说明后，自动更新对应补录记录的所有字段：
- `reason_kept`：加入节假日说明内容
- `missing_materials`：更新为"待财务复核人确认机构简称差异"或"无"
- `next_owner`：流转至财务复核人
- `trace_info`：追加"→ 林姐补录节假日说明"

### 3. 图表不是空壳

> **用户需求**："如果选择 3D 或图表展示，先服务复核：点到一条机构简称前后不一致时，要能回到清算批次号或节假日顺延说明，不要只剩漂亮画面"

**实现**：
- 图表视图的"机构简称不一致"柱状图可点击
- 点击后自动切换到表格视图，并滚动定位到第一条不一致记录
- 每条记录详情中有"→ 回到清算批次号"和"→ 查看节假日顺延说明"链接

### 4. 临时会场景

> **用户需求**："要照顾临时会前十分钟的场景，财务复核人只看补录记录也能知道哪条来自清算批次号、哪条还等确认"

**实现**：
- 报告有"仅看补录记录"视图，只显示关键信息
- 可导出补录记录 CSV，字段包括：流水号、来源批次、留下原因、缺材料、下一步、追溯路径
- 命令行 `export-supp` 命令一键导出

---

## 常见问题

### Q: 为什么"招行"明明是招商银行，还要标记为不一致？

A: 这是设计如此。虽然系统知道"招行"="招商银行，但不规范简称可能导致后续对账问题。系统只负责标记问题，最终确认权在财务复核人。

### Q: 林姐可以直接修改机构简称吗？

A: 不可以。林姐的职责是补录节假日顺延说明，机构简称的修改必须由财务复核人确认。这是职责分离。

### Q: 数据库文件在哪？

A: 默认在项目根目录 `settlement.db`。可以通过环境变量 `CC_SETTLEMENT_DB` 修改：
```bash
export CC_SETTLEMENT_DB="sqlite:////path/to/your.db"
```

---

## 下一步扩展

- [ ] 机构简称标准库支持从配置文件加载
- [ ] 支持批量导入多个批次
- [ ] 增加邮件通知（林姐/财务复核人待办提醒）
- [ ] 操作审计日志
- [ ] 支持 Excel 格式导入
