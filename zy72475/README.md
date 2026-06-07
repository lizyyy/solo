# 地下通道导视缺口 - 可复盘的居民投诉追踪系统

## 这是什么

这不是一个功能清单，而是**一份能复盘的记录**和**一组可重新跑的命令**。

解决的核心问题：同一小区有新旧两个名字时，市政巡检员追问"地下通道导视缺口"为什么前后不一致，城更项目经理阿宁不用再靠嘴解释，而是能回到原始证据。

---

## 核心设计原则

### 1. 留下证据，而不是只看汇总数
每条居民投诉编号都保留：
- **原始行号** (`original_line_number`) - Excel/CSV里的第几行
- **导入时间戳** (`import_timestamp`) - 什么时候导进来的
- **所有人工改动** (`history` 表) - 谁、什么时候、改了什么、为什么改
- **当前处理状态** (`status`) - 走到哪一步了

### 2. 边界规则写在代码里，不靠口头约定
边界规则集中在 [config.yaml](file:///Users/lzy/pro/solo/workspaces/zy72475/config.yaml) 和 [gap_tracker/boundary.py](file:///Users/lzy/pro/solo/workspaces/zy72475/gap_tracker/boundary.py)：

#### 同小区新旧名称判定规则
```
方式一: 别名映射（精确匹配）
  "阳光花园" → "阳光花园一期"
  "翠苑小区" → "翠苑社区"

方式二: 字符串相似度（模糊匹配）
  阈值: 0.8
  例: "阳光花院" vs "阳光花园" = 0.875 → 判定为同一小区
```

**碰到同一小区有新旧两个名字时：别急着归正常，自动标记为 `needs_review` 留给市政巡检员复核。**

#### 修改规则
- **不可变字段**（导入后永不修改）：`complaint_id`, `original_line_number`, `import_timestamp`
- **追踪历史的字段**：`community_name`, `status`, `remark`, `gap_count`

#### 回滚规则
- 任何变更都可以回滚
- 回滚本身也会产生一条历史记录
- 不可变字段永不回滚
- 审计链完整：`原始值 → 修改A → (回滚A) → 原始值`，每一步都留痕

### 3. 重复导入不翻倍
同一批居民投诉编号重复导入时，按 `complaint_id` 去重，已存在的直接跳过，**缺口数量不会翻倍**。

### 4. 改一条备注也能看出差别
即使只改了 `remark` 字段，历史记录里也能看到：
- 改前是什么
- 改后是什么
- 谁改的
- 什么时候改的
- 为什么改

---

## 三步工作流

```
第一步: 居民投诉编号第一次导入
        ↓ (admin)
  pending_import
        ↓ (project_manager: 阿宁)
第二步: 城更项目经理补看路口照片
        ↓
  photo_reviewed ────┐
        │            │ (发现小区名称疑似重复)
        │            ↓
        │        needs_review ──┐
        │            │          │ (inspector: 市政巡检员 复核不通过)
        │            │          ↓
        │            │       rejected
        │            │          │ (project_manager 重新处理)
        │            │          ↓
        │            └──── photo_reviewed
        ↓ (project_manager / inspector)
第三步: 给街道会看的摘要更新
        ↓
  summary_updated (终态)
```

### 状态流转权限
| 当前状态 | 可转到 | 允许角色 |
|---------|-------|---------|
| `pending_import` | `photo_reviewed` | admin |
| `photo_reviewed` | `summary_updated`, `needs_review` | project_manager |
| `needs_review` | `summary_updated`, `rejected` | inspector |
| `summary_updated` | (终态) | - |
| `rejected` | `photo_reviewed` | project_manager |

---

## 可重新跑的命令

### 安装依赖
```bash
pip install -r requirements.txt
```

### 命令清单

| 命令 | 说明 | 角色 |
|------|------|------|
| `python gap_cli.py import <文件路径>` | 第一步：导入居民投诉编号 | admin |
| `python gap_cli.py step2 <投诉编号>` | 第二步：阿宁补看路口照片 | project_manager |
| `python gap_cli.py mark_review <投诉编号>` | 标记为待巡检员复核 | project_manager |
| `python gap_cli.py step3 <投诉编号>` | 第三步：街道会看摘要更新 | project_manager / inspector |
| `python gap_cli.py update <投诉编号> <字段> <新值>` | 修改任意字段（除不可变字段） | 相关人员 |
| `python gap_cli.py history [投诉编号]` | 查看变更历史 | 所有 |
| `python gap_cli.py show <投诉编号>` | 查看单条记录详情（含原始行号） | 所有 |
| `python gap_cli.py list [--status xxx]` | 列出所有记录 | 所有 |
| `python gap_cli.py summary` | 查看缺口汇总 | 所有 |
| `python gap_cli.py rollback <history_id>` | 回滚到某个历史版本 | admin |
| `python gap_cli.py audit [投诉编号] [-o 输出文件]` | 导出审计报告 | 所有 |
| `python gap_cli.py rules` | 显示边界规则和工作流 | 所有 |
| `python gap_cli.py demo` | 运行完整演示流程 | 所有 |

### 快速上手：跑一遍演示
```bash
# 清空旧数据（首次运行）
rm -rf data/

# 跑完整演示
python gap_cli.py demo
```

演示会覆盖：
1. 导入3条记录（其中2条小区名相似，自动标记待复核）
2. 阿宁补看路口照片（第二步）
3. 阿宁改一条备注（验证历史追踪）
4. 街道会看摘要更新（第三步）
5. 重复导入同一批（验证去重，不翻倍）
6. 查看单条变更历史
7. 查看汇总统计

---

## 目录结构

```
.
├── config.yaml                 # 边界规则配置（同小区判定、状态工作流）
├── requirements.txt            # 依赖
├── gap_cli.py                  # 命令行入口（所有可重新跑的命令）
├── gap_tracker/
│   ├── __init__.py
│   ├── models.py               # 数据模型: ComplaintRecord, HistoryEntry
│   ├── boundary.py             # 边界规则实现
│   └── core.py                 # 核心逻辑
├── data/                       # 运行时数据（自动生成）
│   ├── complaints.json         # 投诉记录库
│   └── history.json            # 变更历史库
├── imports/                    # 导入文件放这里
└── exports/                    # 导出文件放这里
```

---

## 同一小区新旧名称场景处理示例

### 场景
第一次导入：
| complaint_id | community_name | gap_count | original_line_number |
|-------------|----------------|-----------|---------------------|
| TS20260001 | 阳光花园 | 2 | 2 |
| TS20260002 | 翠苑小区 | 3 | 3 |

第二次导入（新的Excel里小区改名了）：
| complaint_id | community_name | gap_count | original_line_number |
|-------------|----------------|-----------|---------------------|
| TS20260003 | 阳光花园一期 | 1 | 2 |
| TS20260004 | 翠苑社区 | 2 | 3 |

### 系统行为
1. `TS20260003` 的 `阳光花园一期` 与已存在的 `阳光花园` 匹配别名映射 → **自动标记 `needs_review`**
2. `TS20260004` 的 `翠苑社区` 与已存在的 `翠苑小区` 匹配别名映射 → **自动标记 `needs_review`**
3. 不会自动合并、不会自动归一化，**留给市政巡检员复核**
4. 巡检员复核通过后，再走第三步更新摘要

### 查看证据（市政巡检员追问时）
```bash
# 看 TS20260003 的详情，包括原始行号和匹配标记
python gap_cli.py show TS20260003

# 看 TS20260003 的所有变更历史
python gap_cli.py history TS20260003

# 导出完整审计报告给巡检员
python gap_cli.py audit TS20260003 -o exports/TS20260003_audit.json
```

---

## 市政巡检员追问时的标准回应

不用再手工解释，直接给命令和证据：

> **巡检员**："为什么阳光花园一会儿叫阳光花园一期？缺口数为什么前后对不上？"
>
> **阿宁**："我给您看原始记录和变更历史，都留痕了："
>
> ```bash
> python gap_cli.py show TS20260001
> python gap_cli.py show TS20260003
> python gap_cli.py history TS20260001
> python gap_cli.py history TS20260003
> ```
>
> "您看，TS20260001 是2月导的，原始Excel第2行，缺口2个；TS20260003是5月导的，原始Excel第2行，缺口1个。系统检测到两个小区名疑似同一处，已经标记为待您复核了。您看是合并还是分别统计，我按您的意见走。"

---

## 配置边界规则

编辑 [config.yaml](file:///Users/lzy/pro/solo/workspaces/zy72475/config.yaml) 的 `boundary_rules` 部分：

```yaml
boundary_rules:
  same_community_detection:
    enabled: true
    similarity_threshold: 0.8      # 调低会更敏感，调高会更严格
    alias_mapping:
      "旧名字": "新规范名"          # 在这里添加更多别名映射
      ...
```

添加新别名后不用改代码，重新跑命令即可。

---

## 数据持久化

所有数据存在 JSON 文件里，纯文本可读、可审计、可版本管理：
- `data/complaints.json` - 当前所有投诉记录
- `data/history.json` - 所有变更历史（追加写入，永不删除）

想重置就删掉 `data/` 目录。
