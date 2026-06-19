# 钢琴考级曲目准备系统

> 可复盘、可追溯、可重跑 —— 不靠口头约定，只看证据链

## 解决的问题

| 痛点 | 解决方案 |
|------|---------|
| 同一首歌有现场名和版权名，音乐老师追问前后不一致 | 自动标记「需复核」，留给老师判定，不自动归一 |
| 老周手工解释，没有证据 | 完整保留原始行号、变更历史、操作人 |
| 重复导入导致数量翻倍 | 按真实报名对象（学生+歌名）去重，原始行号保留但不参与判定 |
| 同一批接龙里"小明-小星星"重复出现在多行，被误判成多条 | 按 dedupe_key（批次+学生+歌名）判定，与行号无关 |
| 回滚后追溯仍显示"合同补录"，像还有效 | 回滚时空壳 contract_info 整体清空，追溯/周报不再误判 |
| 只改了一条备注，看不出差别 | 每条变更都有改前/改后记录，操作人、时间戳齐全 |
| 复查时要重新翻聊天记录 | 三段追溯：接龙来源 → 合同补录 → 人工确认，一站式查看 |

---

## 边界规则（写死在代码里，不靠口头约定）

### 规则 1: 现场名 ≠ 版权名 怎么判？

**判定逻辑**（见 [engine.py](file:///Users/lzy/pro/solo/workspaces/zy72425/piano_exam_prep/engine.py#L131-L160)）：
- 补录合同时，自动比对 `song_display_name` (现场名) 和 `song_copyright_name` (版权名)
- **不一致 → 自动标记为 `needs_review`（需复核）**，并记录原因
- **不自动归一，不自动判定为正常**，必须等音乐老师人工确认
- 一致 → 状态保持 `pending`

**怎么改？**
- 音乐老师执行 `review` 命令，`--confirm` 确认通过，可选 `--final-name` 指定最终歌名
- 或 `--confirm` 不加表示驳回，要求重新补录

**怎么回滚？**
```bash
python prep.py history --record-id REC_xxx  # 找到要回滚到的历史点ID（HIST_xxx）
python prep.py rollback --record-id REC_xxx --history-id HIST_xxx --operator 王老师
```

### 规则 2: 重复导入怎么判？

**判定逻辑**（见 [engine.py](file:///Users/lzy/pro/solo/workspaces/zy72425/piano_exam_prep/engine.py#L20-L99)）：
- 每条接龙有两个哈希：
  - `dedupe_key` = `sha256(batch_id:student:song)` — **用于去重判断，不包含行号**
  - `source_hash` = `sha256(batch_id:line_number:student:song)` — 用于证据行独立存储
- **同一批接龙里"小明-小星星"出现在第1行、第3行、第6行，行号不同但 dedupe_key 相同 → 判为本次重复**
- 三种结果，每条都标注清楚，不靠总数糊过去：
  - ✅ **新记录 (NEW)** — 历史上没出现过该（批次+学生+歌曲）
  - ⚠️  **历史重复 (HISTORY_DUPLICATE)** — 之前其他批次已存在该学生+歌曲
  - 🔁 **本次重复 (BATCH_DUPLICATE)** — 同一批接龙里该学生+歌曲重复出现多行
- 每行原始证据（含行号）都会独立保存，关联到同一条 record，追溯时能看到所有原始行

**导入输出示例（同批小明重复 3 行）：**
```
行号   学生    曲目       类型         记录ID        备注
------------------------------------------------------------------
1     小明    小星星    ✅ 新记录     REC_xxx      新增报名记录
2     小红    致爱丽丝   ✅ 新记录     REC_yyy      新增报名记录
3     小明    小星星    🔁 本次重复   REC_xxx      本批次内重复，关联到已有记录
4     小华    月光奏鸣曲 ✅ 新记录     REC_zzz      新增报名记录
6     小明    小星星    🔁 本次重复   REC_xxx      本批次内重复，关联到已有记录
------------------------------------------------------------------
总计 5 条 | 新记录 3 | 历史重复 0 | 本次重复 2
```

**验证命令：**
```bash
# 运行完整的 36 点验证脚本（真实样例：同批小明重复+补录合同+回滚）
python3 test_duplicate_rollback.py

# 或用 reimport-test 简单验证
python prep.py reimport-test --batch-id BATCH_001 --input-file examples/signup_batch_001.txt --operator 测试
```

### 规则 3: 变更怎么留痕？

**判定逻辑**（见 [engine.py](file:///Users/lzy/pro/solo/workspaces/zy72425/piano_exam_prep/engine.py#L312-L334)）：
- 每一次操作（创建、补录、复核、改备注、回滚）都生成一条 `ChangeHistory`
- 每条历史包含：`history_id`、操作人、时间、操作类型、每个字段的旧值→新值
- 即使只改一个备注字段，也能看出改前改后的差别
- 回滚操作本身也会留下历史记录

### 规则 4: 备注怎么改才不覆盖原话？

**判定逻辑**（见 [engine.py](file:///Users/lzy/pro/solo/workspaces/zy72425/piano_exam_prep/engine.py#L336-L378)）：
- 默认覆盖模式：直接替换原值
- 追加模式（`--append`）：在原值后面追加，保留原话
  - 格式：`原值\n[时间 操作人] 新内容（原因: 修改原因）`
- `discrepancy_note` 等说明性字段，系统自动操作时也采用追加模式，不覆盖之前的人工备注
- 历史记录里始终保留完整的 old→new，不怕覆盖

**示例：**
```bash
# 追加模式改备注，原话保留
python prep.py update \
  --record-id REC_xxx \
  --field discrepancy_note \
  --value "家长说孩子平时就叫小星星" \
  --operator 老周 \
  --note "补充家长反馈" \
  --append
```

### 规则 5: 回滚怎么用？

**判定逻辑**（见 [engine.py](file:///Users/lzy/pro/solo/workspaces/zy72425/piano_exam_prep/engine.py#L392-L432)）：
- 回滚到指定 `history_id` **之前**的状态，该历史点及之后的所有变更都会被撤销
- 回滚操作本身也会留下一条历史记录，可追溯
- 正确处理枚举类型（状态、阶段）、嵌套对象（合同信息）、时间字段
- 回滚后，明细、历史、后续查询都读到同一条更新后的记录

**怎么用：**
```bash
# 第一步：看历史，找到要回滚到哪个点之前
python prep.py history --record-id REC_xxx
# 输出里每条都有 HIST_xxx 格式的 history_id

# 第二步：执行回滚
python prep.py rollback \
  --record-id REC_xxx \
  --history-id HIST_xxx \
  --operator 王老师
```

**回滚清理（写死在代码里，避免残留误导）**（见 [storage.py](file:///Users/lzy/pro/solo/workspaces/zy72425/piano_exam_prep/storage.py#L91-L145) + [engine.py](file:///Users/lzy/pro/solo/workspaces/zy72425/piano_exam_prep/engine.py#L462-L497)）：
- `ContractInfo.is_valid()` 判断合同信息是否有效：合同号/版权名/截图路径任一非空才算有效
- 回滚把合同关键字段都清空后，**`contract_info` 整体被设为 `None`**，不留下空壳
- 存盘时无效合同不写入；读盘时空壳自动还原为 `None`
- **trace 追溯**、**list 明细**、**weekly-report 周报**、**导出 JSON** 都用 `is_valid()` 判断
- 音乐老师看到 `trace` 第二段显示 `(未补录)` 就可以确认：合同补录已彻底回滚，不是仍有效

---

## 标准三步工作流

### 第一步：排练群接龙导入

```bash
# 准备接龙文本文件，例如 examples/signup_batch_001.txt:
# 1. 小明 - 小星星
# 2. 小红 - 致爱丽丝
# ...

python prep.py import \
  --batch-id BATCH_001 \
  --input-file examples/signup_batch_001.txt \
  --operator 老周
```

**证据留存：**
- `data/signups/*.json` - 原始接龙记录，含 `original_line_number` (原始行号)
- `data/records/*.json` - 曲目记录
- `data/history/*.json` - 变更历史

### 第二步：老周补看合同页截图

```bash
# 先查看所有记录，拿到 record_id
python prep.py list

# 给小明补录合同（现场名「小星星」≠ 版权名「小星星变奏曲」）
python prep.py supplement \
  --record-id REC_xxx \
  --contract-id CT-2024-001 \
  --copyright-name "小星星变奏曲" \
  --screenshot screenshots/ct_2024_001.png \
  --operator 老周 \
  --note "合同第3页截图"
```

**关键行为：**
- 如果现场名 ≠ 版权名 → 自动标记为「需复核」，不急着归正常
- 留给音乐老师下一步人工判定

### 第三步：音乐老师复核 + 生成周报

```bash
# 复核通过，指定最终歌名
python prep.py review \
  --record-id REC_xxx \
  --operator 王老师 \
  --confirm \
  --final-name "小星星变奏曲" \
  --note "已确认，以版权名为准"

# 生成给店长的周报
python prep.py weekly-report --operator 老周
```

---

## 复盘与追溯命令

### 三段追溯（音乐老师第二天复查不用翻聊天记录）

```bash
python prep.py trace --record-id REC_xxx
```

输出三段信息：
1. **第一段：排练群接龙来源** — 哪个批次、第几行、原始文本
2. **第二段：合同页截图补录** — 合同号、版权名、截图路径、补录人
3. **第三段：人工确认** — 审核状态、确认人、备注
4. 附带完整变更历史

### 查看变更历史

```bash
# 单条记录的历史
python prep.py history --record-id REC_xxx

# 所有历史
python prep.py history
```

### 查看所有记录状态

```bash
python prep.py list
```

---

## 数据目录结构

```
data/
├── signups/          # 原始接龙记录（证据第一手资料）
│   └── <hash>.json   # 含 original_line_number, raw_text, batch_id
├── records/          # 曲目主记录
│   └── REC_<id>.json # 当前状态、合同信息、审核状态
└── history/          # 所有变更的审计日志
    └── HIST_<id>.json # 谁、什么时候、改了什么、旧值→新值
```

所有文件都是 JSON，可直接阅读，不依赖数据库。

---

## 可重新跑的命令（完整演示）

```bash
# 清空演示数据，重新跑一遍完整流程
rm -rf demo_data
python3 demo_workflow.py

# 然后用命令复盘
python prep.py --data-dir demo_data list
python prep.py --data-dir demo_data trace --record-id <从上面的输出里复制>
python prep.py --data-dir demo_data history --record-id <同上>
```

---

## 核心代码参考

| 模块 | 作用 |
|------|------|
| [models.py](file:///Users/lzy/pro/solo/workspaces/zy72425/piano_exam_prep/models.py) | 数据模型定义，枚举值 |
| [storage.py](file:///Users/lzy/pro/solo/workspaces/zy72425/piano_exam_prep/storage.py) | 本地 JSON 存储，去重哈希 |
| [engine.py](file:///Users/lzy/pro/solo/workspaces/zy72425/piano_exam_prep/engine.py) | 核心业务逻辑：边界规则、工作流、追溯 |
| [cli.py](file:///Users/lzy/pro/solo/workspaces/zy72425/piano_exam_prep/cli.py) | 命令行接口，所有可重跑的命令 |

---

## 不在功能清单里的东西

这个系统给人的不是功能清单，而是：
1. ✅ **一份能复盘的记录** —— 所有操作都有时间、有人、有改前改后
2. ✅ **可重新跑的命令** —— 上面的每条命令都能重复执行，结果可复现
3. ✅ **写死在代码里的规则** —— 同一首歌两个名字怎么判，不用老周再解释
