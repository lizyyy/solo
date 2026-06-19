# DJ 场次曲目能量曲线

巡演统筹阿梅的专属工具，专治赠票售票混批、重复导入、口头约定三大顽疾。

## 核心原则

> 不要漂亮画面，要能复盘的记录和可重新跑的命令。

---

## 边界规则（写在代码里，不依赖口头约定）

### 1. 赠票和售票混在一个批次

#### 怎么判？
- 自动检测：批次中同时存在 `paid`（售票）和 `complimentary`（赠票）时，标记为 `MIXED` 状态
- 检测时机：导入排练群接龙时自动扫描
- 代码位置：[BoundaryRuleEngine.check_batch_mixed](file:///Users/lzy/pro/solo/workspaces/zy72413/src/rules/boundary_rules.py#L10-L25)

#### 怎么改？
- **不急着归正常**：混批先标记 `PENDING_REVIEW`，留给录音师复核
- 拆分批次：将混批拆分为独立的售票批次和赠票批次
- 代码位置：[BoundaryRuleEngine.split_mixed_batch](file:///Users/lzy/pro/solo/workspaces/zy72413/src/rules/boundary_rules.py#L45-L85)

#### 怎么回滚？
- 批次标记为 `ROLLED_BACK` 状态，保留所有修改记录
- 回滚操作记入审计日志，可追溯
- 代码位置：[BoundaryRuleEngine.rollback_batch](file:///Users/lzy/pro/solo/workspaces/zy72413/src/rules/boundary_rules.py#L88-L111)

### 2. 重复导入同一批排练群接龙

- 使用 SHA-256 哈希校验文件内容
- 同一内容重复导入时，自动跳过，**票数不会翻倍**
- 重复导入时明确说明哪些是复用记录、哪些是真新增
- 保存后明细、历史和后续结果都读到同一条更新
- 代码位置：[ImportEngine.find_existing_import](file:///Users/lzy/pro/solo/workspaces/zy72413/src/importer/importer.py#L22-L30)

### 3. 只改了一条备注怎么办？

- 所有修改都记入 `ModificationRecord`
- 每条修改记录包含：**改前文本、改后文本、修改原因**
- 阿梅改备注通过真实业务动作（`update-note` 命令）写入导入明细，并在审计链中留存
- 代码位置：[HistoryEngine.show_entity_diff](file:///Users/lzy/pro/solo/workspaces/zy72413/src/history/history.py#L50-L75)

### 4. 3D/图表展示原则

- 每个能量曲线点必须绑定 `source_ref`，可反查到原始材料来源（排练群接龙或合同截图）
- 暖场曲1的能量值3.5 → 能看到来自排练群接龙demo_rehearsal.txt的哪个批次哪张票
- 主曲1的能量值8.0 → 能看到来自合同截图的哪一页
- 代码位置：[TraceEngine.trace_energy_point_origin](file:///Users/lzy/pro/solo/workspaces/zy72413/src/trace/trace.py#L98-L142)

---

## 三步工作流（强制顺序，不能跳步）

```
第一步: 排练群接龙导入 → 第二步: 补看合同页截图 → 第三步: 授权提醒更新
```

### 关键规则
- 混批检测到后，**自动停在待复核状态**
- 录音师未复核完成前，**无法进入第三步授权**
- 代码位置：[WorkflowEngine.can_advance_to_stage](file:///Users/lzy/pro/solo/workspaces/zy72413/src/workflow/workflow.py#L26-L68)

---

## 快速开始

### 安装依赖

```bash
pip install -r requirements.txt
```

### 一键运行完整演示

```bash
python3 -m src.cli demo
```

演示会自动走完：创建场次 → 导入接龙（含混批）→ 重复导入测试 → 送复核 → 上传合同 → 录音师复核 → 授权完成

### 手动操作完整流程

以下是一个完整的真实样例，每一步都会产生真实的业务状态变化和审计记录：

#### 1. 创建场次
```bash
python3 -m src.cli init "夏日电音节" --date 2026-06-18 --venue "梅赛德斯奔驰文化中心" --dj-name "DJ Sonic"
```

#### 2. 导入排练群接龙
```bash
python3 -m src.cli import <show_id> data/demo_rehearsal.txt --operator 阿梅
# 输出：3批次7票，A区VIP有混票警告
```

#### 3. 阿梅修改导入备注（改前/改后/原因都写入审计链）
```bash
python3 -m src.cli update-note <show_id> --import-id <import_id> \
  --note "6月18日排练群接龙，共3个批次7张票，A区VIP存在赠票售票混票，已标记待录音师复核" \
  --reason "更新排练接龙备注，标注混票待复核" \
  --operator 阿梅
```

#### 4. 上传合同页截图
```bash
python3 -m src.cli upload-contract <show_id> data/contract_screenshot.jpg --note "核对合同页" --operator 阿梅
```

#### 5. 送审混批
```bash
python3 -m src.cli flag-review <show_id> <batch_id> --note "A区VIP同时含售票和赠票" --operator 阿梅
```

#### 6. 录音师复核
```bash
python3 -m src.cli review <show_id> <batch_id> --approve --note "已确认" --reviewer 录音师老王
```

#### 7. 设置能量曲线（每首曲目绑定原始材料来源）
```bash
python3 -m src.cli set-energy <show_id> \
  --tracks 暖场曲1 暖场曲2 主曲1 主曲2 收尾曲 \
  --energies 3.5 5.0 8.0 9.2 4.0 \
  --source-refs "排练群接龙demo_rehearsal.txt:B区普通:赵六" "排练群接龙demo_rehearsal.txt:A区VIP:张三" "合同截图:data/contract_screenshot.jpg:合同第2页曲目清单" "排练群接龙+合同交叉核对" "排练群接龙demo_rehearsal.txt:C区赠票:孙八" \
  --moods warmup build peak peak cool \
  --bpms 108 120 138 140 95 \
  --point-notes "暖场第一首" "情绪渐起" "全场高潮" "最高点Drop" "温柔收尾"
```

#### 8. 推进工作流
```bash
python3 -m src.cli advance <show_id> --reason "合同已核对" --operator 阿梅
python3 -m src.cli advance <show_id> --reason "混批已复核，能量曲线已绑定来源" --operator 阿梅
```

---

## 复盘与追溯

### 查看修改历史（审计链）
```bash
python3 -m src.cli history <show_id>
# 每条记录包含：操作人、改前文本、改后文本、修改原因
```

### 溯源查询（能量值从哪来）
```bash
# 查能量曲线曲目来源——暖场曲1的3.5来自排练群接龙还是合同截图？
python3 -m src.cli trace <show_id> --track-name "暖场曲1"
# 输出包含 source_ref 和匹配到的原始材料记录

# 查批次来源
python3 -m src.cli trace <show_id> --batch-id <batch_id>

# 查单张票来源
python3 -m src.cli trace <show_id> --ticket-id <ticket_id>
```

### 导出可重新跑的复盘脚本

复盘脚本使用 **隔离目录**（`data_replay_<show_id>/`），绝不污染主数据 `data/`：

```bash
python3 -m src.cli export-replay <show_id> --output my_show_replay.py
python3 my_show_replay.py  # 一键复现所有操作，写入隔离目录
```

复盘脚本完整重放：
1. 创建场次
2. 导入排练群接龙（含幂等去重）
3. 阿梅改备注（通过真实业务动作，改前/改后/原因写入审计链）
4. 上传合同截图
5. 送审 + 录音师复核（状态真实变化）
6. 设置能量曲线（每首曲目带 source_ref 可溯源）
7. 推进工作流 + 生成独立复盘报告（JSON + 文本）

#### 复盘可信验证（3 步自证）
1. 查看隔离目录的复盘报告 `cat data_replay_<show_id>/reports/replay_report_<show_id>.txt`
2. 核对审计链：备注/送审/授权/能量曲线都有改前/改后/原因
3. 对比主数据 SHA256：运行前后一致，证明不被污染

---

## 目录结构

```
src/
├── models/          # 数据模型定义
│   └── schemas.py   # 所有核心数据结构
├── rules/           # 边界规则引擎
│   └── boundary_rules.py  # 混批判断、拆分、回滚
├── importer/        # 导入去重
│   └── importer.py  # 哈希校验、幂等导入、备注更新
├── history/         # 历史版本
│   └── history.py   # 修改记录、差异对比（改前/改后/原因）
├── workflow/        # 工作流引擎
│   └── workflow.py  # 三步流程、复核机制
├── trace/           # 溯源系统
│   └── trace.py     # 能量点→排练群接龙/合同截图来源
├── storage/         # 持久化
│   └── storage.py   # 保存、加载、隔离目录复盘脚本
└── cli/             # 命令行入口
    └── main.py      # 所有命令
```

---

## 数据状态流转

### 批次状态
```
normal → mixed → pending_review → resolved
                                  → rolled_back
```

### 工作流阶段
```
stage_1_imported → stage_2_contract_reviewed → stage_3_authorized
     ↓                    ↓                            ↓
  接龙导入            合同补看                       授权更新
  自动检测混批        不能跳过                       混批必须先复核
```

---

## 给阿梅的检查清单

- [ ] 导入接龙后，先看有没有混批警告
- [ ] 混批别急着改，先 `flag-review` 给录音师
- [ ] 上传合同截图后再推进到第二步
- [ ] 所有混批都 `resolved` 了再进第三步授权
- [ ] 改备注时写清楚原因，`history` 命令能看到改前/改后/原因
- [ ] 设能量曲线时绑定 `--source-refs`，确保每个值能溯源
- [ ] `export-replay` 导出复盘脚本，在隔离目录重放验证
- [ ] 重放后对比主数据 SHA256，确认不被污染
