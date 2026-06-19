# 医院急诊入口疏导 - 居民投诉处理系统

## 核心原则（写死在代码里，不口头约定）

1. **单一数据源**：页面展示、Excel 导出、API 返回，全部调用 `get_single_source()` 读同一份 SQLite 数据，绝不各自计算
2. **全链路审计**：每条投诉保留原始行号、每次人工改动、当前处理状态，市政巡检员追问可回到证据
3. **边界规则编码化**：同一小区新旧名怎么判、怎么改、怎么回滚，全部在代码（`core.py:ALIAS_RULES`）和本文档里，不靠口头约定
4. **可复现命令**：所有操作都是可重跑的 CLI 命令，不是功能清单
5. **断点补实**：导出明细含「原话历史/修改人/修改原因/冲突分组索引/待复核索引」4 份文件，可互相解释

---

## ⚠️ 干净库首次运行（很重要！）

以前的坑：**干净数据库中别名映射为空 → 阳光花园/阳光花园小区不会被标记 → 老马审核后直接通过 → 偏离「留给巡检员复核」主需求**

现在已修复：
- `import-data` 默认自动注入 5 对常见映射（阳光花园↔阳光花园小区、丽景苑↔丽景苑小区等），并大框醒目提示
- 注入后 4 条记录被标记冲突，老马审核后自动变 `PENDING_INSPECTOR`
- 可通过 `--no-seed-aliases` 关闭；也可提前单独运行 `seed-aliases`

```bash
# 方式一：单独先注入（推荐）
python cli.py seed-aliases

# 方式二：import-data 首次自动注入
python cli.py import-data --csv sample_complaints.csv
```

---

## 三步标准工作流

```
导入居民投诉编号 → 交通协管老马补看路口照片 → 市政巡检员复核（有冲突时） → 生成街道摘要
```

### 第一步：导入居民投诉编号

```bash
python cli.py import-data --csv sample_complaints.csv
```

- 首次自动注入 5 对常见小区新旧名映射（可 `--no-seed-aliases` 关闭）
- 自动标记 `original_line_no`（原始行号），永远保留
- 自动匹配小区新旧名映射，命中则 `has_alias_conflict=1`
- 状态初始化为 `IMPORTED`
- **输出醒目提示：已标记冲突 N 条，老马审核后会转巡检员复核**

### 第二步：交通协管老马补看路口照片

```bash
python cli.py lao-ma-review TS20260601001 BATCH-20260612-xxxx "入口右侧3辆违停，已劝离"
```

- 无冲突 → `PHOTO_REVIEWED`
- **有新旧名冲突 → `PENDING_INSPECTOR`，不归正常，留给市政巡检员复核**（🛑 红色提示 + 给出下一步命令）

### 第三步（前置）：市政巡检员复核小区新旧名冲突

```bash
# 采用新名
python cli.py inspector-review TS20260601002 BATCH-xxxx --use-new-name

# 保留旧名
python cli.py inspector-review TS20260601002 BATCH-xxxx --use-old-name
```

- 这是一次**「操作原子」**：同时修改 `community_name` + `community_name_normalized` + `has_alias_conflict` + `status` 四个字段
- 四者共享同一个时间戳，被视为同一次操作
- **回滚必须四者一起回，不能 name 回了 normalized 和 status 没回**

### 第四步：生成给街道会看的摘要

```bash
python cli.py summary
```

输出包含 4 部分：
1. **待复核明细 pending_trace**：含投诉编号、**原始行号**、小区、照片备注原话 → 可追回材料
2. **冲突分组溯源 conflict_groups**：按「阳光花园↔阳光花园小区」分组，列出组内每条的原始行号/批次/状态
3. **仅改照片备注清单 remark_only_list**：当日老马只改备注没改状态的记录，单独列出方便当日复核
4. **汇总 + 备注**：总数、待复核 N 条、受影响 N 条，一句话说明

---

## 同一小区新旧名字的边界规则

> 规则同时写在 [core.py ALIAS_RULES](file:///Users/lzy/pro/solo/workspaces/zy72456/core.py#L25-L35) 和这里，两边一致。用 `python cli.py rules` 随时查看。

### 怎么判（自动判定）
1. 首次导入前自动注入常见 5 对别名映射（阳光花园↔阳光花园小区等）
2. 导入时匹配 `community_aliases` 表，命中旧名或新名都算冲突
3. 冲突标记 `has_alias_conflict=1`，状态不自动推进

### 怎么改（人工操作）
1. 老马审核冲突记录 → `PENDING_INSPECTOR`，必须等巡检员
2. 巡检员可选：保留旧名 / 改用新名
3. 一次操作原子更新：`community_name` + `community_name_normalized` + `has_alias_conflict` + `status`

### 怎么回滚（关键！）

**不要用单字段回滚！** 巡检员复核改了 4 个字段（含 `community_name_normalized`），必须整体回：

```bash
# ✅ 正确：按操作原子整体回滚（推荐）
python cli.py rollback-op <记录ID>

# ⚠️  保留：单字段回滚（仅用于备注等独立字段，改 name 不推荐用这个）
python cli.py rollback <记录ID> community_name
```

整体回滚机制：
- 按 `(changed_at, changed_by)` 分组识别「操作原子」
- 跳过「回滚」本身的审计条目，找到上一次真实操作
- 把该操作内所有字段按反序回滚
- 回滚本身也写审计，原因含「按操作原子回滚（撤销：xxx）」

### 别名映射维护

```bash
# 添加
python cli.py add-alias "阳光花园" "阳光花园小区"

# 查看全部
python cli.py list-aliases

# 重置
python cli.py seed-aliases --force
```

---

## 日常检查机制

### 老马只改照片备注的场景
- **首次照片审核**（IMPORTED → PENDING/REVIEWED）是正常工作流，不算"仅改备注"
- **二次备注修改**（已审核记录上改 photo_remark，不改状态）才是"仅改备注"，审计原因为"老马修改照片备注"
- 街道摘要里 `remark_only_list` 单独列出二次备注修改的记录，**含原始行号 + 小区名 + 备注原话**
- 摘要备注：「仅修改照片备注的有 N 条，已标记请当日复核」

---

## 证据回溯

### 查看单条记录的完整审计轨迹
```bash
python cli.py audit <记录ID>
```

输出：时间、操作人、字段、**原值 → 新值**、修改原因。回滚前后的值也在里面（原因含「回滚」）。

### 查看所有记录（单一数据源）

```bash
python cli.py list --format table   # 页面展示用
python cli.py list --format csv     # 简单导出用
python cli.py list --format json    # API 返回用
```

三种格式读同一份 `get_single_source()`，保证一致。

---

## 📦 导出明细（断点补实：4 份文件互相解释）

```bash
python cli.py export                # CSV + JSON 全导出
python cli.py export --format csv   # 只导出 CSV
python cli.py export --format json  # 只导出 JSON
python cli.py export --batch BATCH-xxxx  # 按批次导出
```

输出 4 份 CSV + 1 份 JSON（都在 `exports/` 目录）：

| # | 文件 | 内容 | 解决什么问题 |
|---|------|------|-------------|
| 1 | `*_1detailed.csv` | 每条一行：原始导入值 + 最终值 + **小区名修改历史(JSON)** + **标准化名修改历史(JSON)** + **备注修改历史(JSON)** + **状态流转历史(JSON)** | 不把备注覆盖成最终值，历史里留住原话、修改人、原因；标准化名变更可追踪 |
| 2 | `*_2audit.csv` | 所有字段每次修改一行：时间/操作人/记录ID/投诉编号/原始行号/字段名/原值/新值/修改原因 | 回滚前后的值、修改人和原因直接从这里查 |
| 3 | `*_3conflict_index.csv` | 冲突分组索引：`阳光花园↔阳光花园小区` → 每条的投诉号/原始行号/批次/状态 + `trace_hint` | **从阳光花园/阳光花园小区追回原始材料** |
| 4 | `*_4pending_index.csv` | 待巡检员复核清单：含备注原话、照片上传时间、回滚命令提示 | **从「留给市政巡检员复核」追回触发导出的明细** |

### 溯源链路（互相能解释）

```
街道摘要 summary.conflict_groups
  → conflict_index.csv 的 conflict_pair + original_line_no
    → detailed.csv 的 original_line_no + community_name_history (JSON，含修改人和原因)
      → audit.csv 按 record_id 展开每一次修改的原值/新值/原因
```

```
街道摘要 summary.pending_list
  → pending_index.csv 的 record_id + photo_remark (原话)
    → audit.csv 查看老马审核、巡检员复核、回滚的完整轨迹
      → rollback-op <记录ID> 整体撤销
```

---

## 可重跑命令速查

| 操作 | 命令 |
|------|------|
| 初始化别名映射（首次） | `python cli.py seed-aliases` |
| 重置别名映射 | `python cli.py seed-aliases --force` |
| 导入投诉 | `python cli.py import-data --csv xxx.csv` |
| 老马审核照片 | `python cli.py lao-ma-review <投诉号> <批次号> <备注>` |
| 巡检员复核冲突 | `python cli.py inspector-review <投诉号> <批次号> --use-new-name` |
| **整体回滚一次操作（推荐）** | `python cli.py rollback-op <记录ID>` |
| 单字段回滚（慎用） | `python cli.py rollback <记录ID> <字段名>` |
| 生成街道摘要 | `python cli.py summary` |
| 查看全部记录 | `python cli.py list` |
| **导出明细 4 文件** | `python cli.py export` |
| 查看审计轨迹 | `python cli.py audit <记录ID>` |
| 添加小区别名 | `python cli.py add-alias <旧名> <新名>` |
| 查看别名列表 | `python cli.py list-aliases` |
| 查看边界规则 | `python cli.py rules` |
| 系统信息+别名数检查 | `python cli.py info` |

---

## 一键验证全流程

```bash
python verify.py
```

完整核对 4 大场景 56 个断点：
1. **场景 A（回滚同步）**：导入 → 老马首次审核 → 巡检员采用新名 → rollback-op → **四字段同步恢复**（展示名+标准化名+冲突标记+状态），不会旧名配新标准名
2. **场景 B（首次 vs 二次）**：首次照片审核不在 remark_only 清单 → 二次备注修改在 remark_only 清单
3. **场景 C（导出明细）**：detailed 含展示名+标准化名+冲突标记+状态+历史JSON（含 normalized_name_history）+修改人+原因
4. **场景 D（互相解释）**：摘要的 pending_trace/conflict_groups/remark_only_list 与导出文件能互相回溯到原始行号

---

## 关键代码位置

| 功能 | 位置 |
|------|------|
| 默认别名 + 边界规则常量 | [core.py DEFAULT_COMMUNITY_ALIASES / ALIAS_RULES](file:///Users/lzy/pro/solo/workspaces/zy72456/core.py#L17-L36) |
| 导入 + 首次自动注入 | [core.py import_complaints / seed_default_aliases](file:///Users/lzy/pro/solo/workspaces/zy72456/core.py#L56-L108) |
| 老马审核（首次审核 vs 二次改备注） | [core.py lao_ma_review_photo](file:///Users/lzy/pro/solo/workspaces/zy72456/core.py#L129-L165) |
| 巡检员复核（操作原子四字段） | [core.py inspector_resolve_alias](file:///Users/lzy/pro/solo/workspaces/zy72456/core.py#L168-L200) |
| 操作原子分组 + 整体回滚 | [core.py _group_operations / rollback_last_operation](file:///Users/lzy/pro/solo/workspaces/zy72456/core.py#L203-L278) |
| 摘要（含 conflict_groups + pending_trace + remark_only） | [core.py generate_daily_summary](file:///Users/lzy/pro/solo/workspaces/zy72456/core.py#L290-L370) |
| 导出明细四文件打包 | [core.py build_export_package](file:///Users/lzy/pro/solo/workspaces/zy72456/core.py#L410-L530) |
| log_audit 默认本地时间 | [db.py log_audit](file:///Users/lzy/pro/solo/workspaces/zy72456/db.py#L83-L98) |
