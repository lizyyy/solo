# 动态规划补货策略 - 数据复核追踪系统

## 系统目标

解决运营规划阿岚面临的核心问题：**触发问题的输入 → 补录/修正动作 → 保存后的状态变化 → 最终展示结果** 四环节串到**同一份最新数据**。当分母为0却被填成空字符串这类记录出现时，列表、详情、摘要、历史记录、导出/报告全部从同一数据源读取，数据复核人可直接回到证据，而非只看一个汇总数。

---

## 数据闭环一致性保障（核心）

### 同一记录·同一数据源

所有接口（列表/详情/历史/复核/导出/报告）**共用同一张主表 `formula_screenshots` + 统一序列化函数** `record_to_dict / record_summary / record_detail / record_export_row`，不存在「A 接口从缓存读、B 接口从主表读」的错位问题。

| 环节 | 读取/写入位置 | 触发后同步项 |
|-----|-------------|------------|
| 导入 | `formula_screenshots` + `batch_imports` | 批次 7 项状态统计 + 原始说法自动生成 + 边界规则触发记录 |
| 编辑（阿兰补备注） | 主表更新 + 历史表插行 | `current_version`+1 + `batch_imports` 状态统计重算 |
| 复核（老李/王姐） | 主表 4 个复核字段 + `review_records` 插行 | 状态流转 + 批次统计 + 历史表插行 |
| 课堂演示更新 | 主表 `result_value` | 版本+1 + 统计重算 |
| 列表页 `list-cmd` | 主表排序查询 + 批次表 join | 直接返回最新状态标签 |
| 详情页 `detail` | 主表 + 历史 + 复核记录（一次事务内） | 三表数据时间点一致 |
| 异常页 `abnormal` | 主表 status=abnormal 过滤 | 含完整人工复核字段 |
| 导出 `export` | 同一条主表 SQL，使用 `record_export_row` | 与详情显示值 100% 对齐 |
| 报告 `report` | 同一条主表 SQL + 批次表 | 统计数与 list-cmd 完全相同 |

### 人工复核四要素（结构化存储，不提前归正常）

任何需要人工复核的异常记录都会保留以下字段，**复核通过前 `status` 不变为 approved**：

| 字段 | 位置 | 含义 | 写入时机 |
|-----|------|-----|---------|
| `original_statement` | 主表 + 复核记录 | **原始说法**：分母为 X、结果被填成 Y、原始行号 Z | 导入时自动生成 + 复核时可重写 |
| `corrected_value` | 主表 + 复核记录 | **改后的值**：复核人建议修正的结果 | 复核时 escalate/approve_with_correction |
| `review_reason` | 主表 + 复核记录 | **处理原因**：为什么这么判 | 每次复核必填 |
| `next_handler` | 主表 + 复核记录 | **下一步找谁**：升级给谁继续处理 | 每次复核时录入 |

> **原则**：碰到分母为 0 却被填成空字符串 → 标记 `abnormal`，**不会自动改为 0 或 N/A**，必须人工复核四要素齐全后才能流转状态。

---

## 多源导入 & 字段归一化闭环

Excel/CSV 列名不统一是常见数据错位来源。系统通过 `FIELD_ALIASES` + `detect_columns()` + `normalize_row()` 三层归一，**无论中/英列名都落到同一套 canonical 字段**：

| 规范字段名 | 识别的列名别名（任意一种即可） |
|----------|-------------------------------|
| `sku_code` | SKU编码、sku_code、SKUCode、SKU、商品编码、物料编码 |
| `product_name` | 商品名称、product_name、ProductName、品名、商品名、物料名称 |
| `formula_expression` | 公式表达式、formula_expression、Formula、公式、表达式、计算规则 |
| `denominator_value` | 分母、denominator_value、Denominator、除数、分母值 |
| `numerator_value` | 分子、numerator_value、Numerator、被除数、分子值 |
| `result_value` | 结果、result_value、Result、计算结果、值、输出结果 |

归一化位置：[normalizer.py](src/dp_strategy/normalizer.py#L22-L113)

---

## 核心功能

### 1. 完整证据留存
- **原始行号记录**：每条导入数据保留原始 Excel/CSV 行号（`original_row_number`），可回溯到源文件
- **人工改动追踪**：所有修改记录操作人、时间、原因、改前改后值（`FormulaHistory.before_data / after_data / diff_fields`）
- **状态流转**：pending → reviewing → approved/rejected，异常永久标记直到人工处理

### 2. 防重复导入
- 基于文件 MD5 哈希值判断重复（`BatchImport.file_hash`）
- 重复导入直接返回原批次ID + 原批次统计，不会「数量翻倍」
- 即使改名/改路径导入同一内容也会被拦截

### 3. 边界规则引擎
所有边界规则**同时写入代码 + 数据库 + README**，不再依赖口头约定。

#### 已实现的边界规则（含优先级）

| 优先级 | 规则名称 | 判定条件 | 处理方式 | 回滚方式 |
|-------|---------|---------|---------|---------|
| 100 | **分母为0组合检测** | `denominator_value == 0` | `abnormal_type = zero_denominator_empty_result`，记录原始行号 | `rollback` 批次级回滚 |
| 90 | **分母为0状态设置** | `denominator_value == 0` | `status = abnormal`（异常待复核） | 人工复核后流转 |
| 80 | **结果空字符串检测** | `result_value` 为空/nan | `abnormal_type = empty_string`，备注需复核人确认 | 人工复核后流转 |

#### 边界规则三重位置
1. 配置化定义：[boundary_rules.py](src/dp_strategy/boundary_rules.py#L180-L247) `init_boundary_rules()`
2. 导入内联判定：[importer.py](src/dp_strategy/importer.py#L84-L136) `_apply_boundary_rules()`
3. 数据库持久化：`boundary_rules` 表，可 SQL 查询/增改

### 4. 历史版本对比
- 每次修改版本号 +1（`current_version` 递增）
- 可查看任意两版本差异（`diff` 命令）
- 即使只改了 `abnormal_note` 一条备注，也能在 diff 中显示
- 历史记录不物理删除，回滚本身也会入历史

### 5. 批次回滚功能
- `rollback` 命令整批次回滚，状态改为 `rollbacked`
- 回滚后 `batch_imports` 的 7 项状态统计**同步重算**（`rollbacked_count` 增加、其余归零）
- 回滚操作本身插入历史表（change_type=ROLLBACK）

---

## 返工场景完整流程

> **旧公式截图先给出旧结论 → 后来老师批注补到现场说法 → 运营规划阿岚能看到课堂演示结果为什么变了**

| 阶段 | 动作 | 写入/同步项 |
|-----|------|------------|
| ① 旧公式截图导入 | 阿兰执行 `import-file` | 5 条记录入库，SKU002/004 分母=0→自动标 `abnormal`，自动生成 `original_statement` |
| ② 数据复核人追问 | 老李执行 `abnormal` | 列表显示原始行号、原始说法、下一步找谁（空） |
| ③ 补看老师批注 | 阿兰 `edit abnormal_note` | 版本1→2，批次统计不变，`abnormal` 列表、`detail`、`history` 同步看到老师批注 |
| ④ 升级复核（不提前归正常） | 老李 `review --decision escalate` | 写入四要素：原始说法/修正值/处理原因/下一步→王姐；状态 `reviewing`；批次 `abnormal_count` 2→1 |
| ⑤ 课堂演示结果更新 | 系统 `edit result_value = N/A(下架)` | 版本2→3→4，结果值与详情一致 |
| ⑥ 组长批准带修正 | 王姐 `review --decision approve_with_correction` | 状态 `approved`，`corrected_value` 同步到 `result_value`；批次 `approved_count=1` |
| ⑦ 最终复盘 | 报告/导出/历史 任一入口 | 全部从同一份主表读取，数值 100% 对齐 |

---

## 目录结构

```
.
├── README.md                           # 本文档（含闭环一致性+边界规则表）
├── pyproject.toml                      # 项目配置
├── src/dp_strategy/
│   ├── __init__.py
│   ├── models.py                       # 数据模型 + FIELD_ALIASES 字段别名表
│   ├── normalizer.py                   # 统一序列化：列表/详情/导出共用4个函数
│   ├── importer.py                     # 导入、编辑、复核、列表、导出、报告
│   ├── boundary_rules.py               # 规则引擎 + 回滚（含批次统计重算）
│   └── cli.py                          # CLI：10 个命令覆盖全环节
├── data/
│   ├── raw/
│   │   ├── sample_formulas.csv         # 中文列名样例
│   │   └── sample_english_columns.csv  # 英文列名样例（验证归一化）
│   └── processed/                      # SQLite + 导出/报告输出
├── scripts/
│   ├── e2e_closed_loop.py              # 端到端闭环验证脚本（9步检查）
│   └── demo_rework_scenario.py         # 返工场景演示
└── tests/
```

---

## 快速开始

```bash
# 1. 安装依赖
pip install pandas sqlalchemy click pydantic openpyxl

# 2. （可选）运行端到端闭环自动验证
PYTHONPATH=src python3 scripts/e2e_closed_loop.py
```

自动验证脚本会检查 9 步全链路：中文CSV导入 → 防重复拦截 → 英文CSV归一化 → 异常列表=详情=历史一致 → 改备注同步 → 复核四要素写入+统计同步 → 课堂演示更新+版本递增 → 导出/报告数据完全对齐 → 回滚统计归零。

---

## CLI 命令速查表

### 导入 & 防重
```bash
# 中文列名CSV
PYTHONPATH=src python3 -m dp_strategy.cli import-file data/raw/sample_formulas.csv --imported-by "阿兰"
# 再次导入同一文件 → 被MD5拦截
PYTHONPATH=src python3 -m dp_strategy.cli import-file data/raw/sample_formulas.csv
```

### 查看（列表/详情/历史/对比/异常/报告）
```bash
# 列表（同一份最新数据，附批次统计）
PYTHONPATH=src python3 -m dp_strategy.cli list-cmd --batch-id <批次ID>
# 详情（主表+历史+复核，一次事务内取）
PYTHONPATH=src python3 -m dp_strategy.cli detail <记录ID>
# 历史版本轨迹
PYTHONPATH=src python3 -m dp_strategy.cli history <记录ID>
# 版本差异（即使只改备注也能看出来）
PYTHONPATH=src python3 -m dp_strategy.cli diff <记录ID> 1 2
# 异常记录列表（含原始说法/下一步找谁）
PYTHONPATH=src python3 -m dp_strategy.cli abnormal --batch-id <批次ID>
# 生成复核报告（文本+落盘）
PYTHONPATH=src python3 -m dp_strategy.cli report <批次ID> --output-path data/processed/报告.txt
```

### 编辑 & 复核（所有操作同步更新批次统计）
```bash
# 阿兰补老师批注
PYTHONPATH=src python3 -m dp_strategy.cli edit <ID> abnormal_note "老师批注: 已下架" \
    --edited-by "阿兰" --reason "补看老师批注"
# 升级复核（写四要素，不提前归正常）
PYTHONPATH=src python3 -m dp_strategy.cli review <ID> \
    --decision escalate --reviewer "老李" --comment "需组长确认" \
    --corrected-value "N/A(下架)" --review-reason "下架商品需统一规则" --next-handler "王姐"
# 带修正值批准（corrected_value → result_value，状态→已通过）
PYTHONPATH=src python3 -m dp_strategy.cli review <ID> \
    --decision approve_with_correction --reviewer "王姐" --comment "组长确认可N/A" \
    --corrected-value "N/A(下架)" --review-reason "课堂演示验证" --next-handler "小陈（归档）"
```

### 导出 & 回滚
```bash
# 导出Excel（与详情显示值100%对齐）
PYTHONPATH=src python3 -m dp_strategy.cli export data/processed/复核结果.xlsx --batch-id <批次ID> --format xlsx
# 批次回滚（状态→rollbacked，批次统计同步重算）
PYTHONPATH=src python3 -m dp_strategy.cli rollback <批次ID> --reason "数据错误需重导" --by "管理员"
```

### 初始化
```bash
PYTHONPATH=src python3 -m dp_strategy.cli init-rules
```

---

## 批次状态统计字段（每次变更同步重算）

`BatchImport` 表 7 项统计字段，**任何主表状态变更都会调用 `_refresh_batch_counts()` 重算**，不会出现「历史改了但汇总数没跟上」：

| 字段 | 含义 |
|-----|------|
| `total_records` | 批次内记录总数 |
| `success_count` | 非 rollbacked 的记录数 |
| `pending_count` | status=pending |
| `abnormal_count` | status=abnormal（异常待复核，含分母0空串） |
| `reviewing_count` | status=reviewing（升级待处理） |
| `approved_count` | status=approved（复核通过） |
| `rejected_count` | status=rejected（驳回返工） |
| `rollbacked_count` | status=rollbacked（已回滚） |

---

## 注意事项

1. **异常绝不自动修正**：分母为 0 / 结果空字符串等仅标记为 abnormal，必须人工走完四要素复核流程
2. **`original_result` 永不修改**：首次导入时的值永久保存，后续任何修改都不覆盖此字段
3. **四要素缺一不可**：`escalate / approve_with_correction` 前建议补齐原始说法、改后值、处理原因、下一步找谁
4. **重复导入按内容哈希**：仅重命名文件不会绕过 MD5 拦截；若确实需要再导一次，请先 `rollback` 原批次或修改文件内容
5. **版本永久递增**：rollback 也会使 current_version +1，所有变更可追溯
