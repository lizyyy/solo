# 医院急诊入口疏导 - 居民投诉处理系统

## 核心原则（写死在代码里，不口头约定）

1. **单一数据源**：页面展示、Excel 导出、API 返回，全部调用 `get_single_source()` 读同一份 SQLite 数据，绝不各自计算
2. **全链路审计**：每条投诉保留原始行号、每次人工改动、当前处理状态，市政巡检员追问可回到证据
3. **边界规则编码化**：同一小区新旧名怎么判、怎么改、怎么回滚，全部在代码里，不靠口头约定
4. **可复现命令**：所有操作都是可重跑的 CLI 命令，不是功能清单

---

## 三步标准工作流

```
导入居民投诉编号 → 交通协管老马补看路口照片 → 市政巡检员复核（有冲突时） → 生成街道摘要
```

### 第一步：导入居民投诉编号

```bash
python cli.py import-data --csv sample_complaints.csv
```

- 自动标记 `original_line_no`（原始行号），永远保留
- 自动匹配小区新旧名映射，命中则 `has_alias_conflict=1`
- 状态初始化为 `IMPORTED`

### 第二步：交通协管老马补看路口照片

```bash
python cli.py lao-ma-review TS20260601001 BATCH-20260607-xxxx "照片备注内容"
```

- 无冲突的记录 → 状态变为 `PHOTO_REVIEWED`
- **有新旧名冲突的记录 → 状态变为 `PENDING_INSPECTOR`，不归正常，留给市政巡检员复核**

### 第三步：市政巡检员复核（有冲突时）

```bash
# 采用新名
python cli.py inspector-review TS20260601002 BATCH-20260607-xxxx --use-new-name

# 保留旧名
python cli.py inspector-review TS20260601002 BATCH-20260607-xxxx --use-old-name
```

- 复核后 `has_alias_conflict=0`，状态变为 `PHOTO_REVIEWED`
- 所有改名操作记录在 `audit_log`，可回滚

### 第四步：生成给街道会看的摘要

```bash
python cli.py summary
```

输出包含：
- 待巡检员复核的记录清单
- **当日仅修改照片备注的受影响记录，方便巡检员当日复核**

---

## 同一小区新旧名字的边界规则

> 规则同时写在代码 `core.py:ALIAS_RULES` 和这里，两边一致。

### 怎么判（自动判定）
1. 导入时遍历 `community_aliases` 表，小区名命中旧名或新名都算冲突
2. 冲突标记 `has_alias_conflict=1`，状态不自动推进

### 怎么改（人工操作）
1. 老马审核后冲突记录 → `PENDING_INSPECTOR`，必须等巡检员
2. 巡检员可选：保留旧名 / 改用新名
3. 修改操作：更新 `community_name` + `community_name_normalized` + 清除冲突标记

### 怎么回滚
```bash
python cli.py rollback <记录ID> community_name
```
- 读 `audit_log` 取上一个值写回
- 回滚本身也记录审计

### 别名映射维护
```bash
# 添加映射
python cli.py add-alias "阳光花园" "阳光花园小区"

# 查看全部
python cli.py list-aliases
```

---

## 日常检查机制

### 老马只改照片备注的场景
- 系统自动识别：当日修改字段只有 `photo_remark`（+ 状态流转）的记录
- 街道摘要里 `remark_only_list` 单独列出
- 摘要备注：「仅修改照片备注的有N条，已标记请当日复核」

---

## 证据回溯

### 查看单条记录的完整审计轨迹
```bash
python cli.py audit <记录ID>
```

输出：时间、操作人、字段、旧值→新值、修改原因。市政巡检员追问时直接拿这个。

### 查看所有记录（单一数据源）
```bash
python cli.py list --format table   # 页面用
python cli.py list --format csv     # 导出用
python cli.py list --format json    # API 用
```

三种输出读同一份数据，保证一致。

---

## 可重跑命令速查

| 操作 | 命令 |
|------|------|
| 初始化（首次） | `python cli.py info` |
| 导入投诉 | `python cli.py import-data --csv xxx.csv` |
| 老马审核照片 | `python cli.py lao-ma-review <投诉号> <批次号> <备注>` |
| 巡检员复核冲突 | `python cli.py inspector-review <投诉号> <批次号> --use-new-name` |
| 生成街道摘要 | `python cli.py summary` |
| 查看全部记录 | `python cli.py list` |
| 查看审计轨迹 | `python cli.py audit <记录ID>` |
| 回滚字段 | `python cli.py rollback <记录ID> <字段名>` |
| 添加小区别名 | `python cli.py add-alias <旧名> <新名>` |
| 查看边界规则 | `python cli.py rules` |

---

## 验证全流程

```bash
python verify.py
```

会跑通：导入→老马审核→巡检员复核→生成摘要→审计回溯→日常检查→回滚→一致性验证。
