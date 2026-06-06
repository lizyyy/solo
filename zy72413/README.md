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
- 代码位置：[ImportEngine.find_existing_import](file:///Users/lzy/pro/solo/workspaces/zy72413/src/importer/importer.py#L22-L30)

### 3. 只改了一条备注怎么办？

- 所有修改都记入 `ModificationRecord`
- 可查看任意字段的改前改后差别
- 代码位置：[HistoryEngine.show_entity_diff](file:///Users/lzy/pro/solo/workspaces/zy72413/src/history/history.py#L50-L75)

### 4. 3D/图表展示原则

- 点击数据点必须能追溯到原始接龙/截图
- 不只显示漂亮数字，要有溯源链接
- 代码位置：[TraceEngine.get_visualization_context](file:///Users/lzy/pro/solo/workspaces/zy72413/src/trace/trace.py#L104-L150)

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
python -m src.cli demo
```

演示会自动走完：创建场次 → 导入接龙（含混批）→ 重复导入测试 → 送复核 → 上传合同 → 录音师复核 → 授权完成

### 手动操作

#### 1. 创建场次
```bash
python -m src.cli init "夏日电音节" --date 2026-07-15 --venue "上海体育馆" --dj-name "DJ MAX"
```

#### 2. 导入排练群接龙
```bash
python -m src.cli import <show_id> rehearsal.txt
```

#### 3. 标记混批待录音师复核
```bash
python -m src.cli flag-review <show_id> <batch_id> --note "A区发现赠票混入"
```

#### 4. 上传合同页截图
```bash
python -m src.cli upload-contract <show_id> ./contract_page1.jpg
```

#### 5. 录音师复核
```bash
python -m src.cli review <show_id> <batch_id> --approve --note "已确认"
```

#### 6. 推进工作流
```bash
python -m src.cli advance <show_id>
```

#### 7. 设置能量曲线
```bash
python -m src.cli set-energy <show_id> \
  --tracks "暖场曲1" "暖场曲2" "主场曲1" "主场曲2" "收尾曲" \
  --energies 3.5 5.0 8.5 9.0 6.0
```

---

## 复盘与追溯

### 查看修改历史
```bash
python -m src.cli history <show_id>
```

### 溯源查询（点击数据点的背后是什么）
```bash
# 查批次来源
python -m src.cli trace <show_id> --batch-id <batch_id>

# 查单张票来源
python -m src.cli trace <show_id> --ticket-id <ticket_id>

# 查能量曲线曲目来源
python -m src.cli trace <show_id> --track-name "主场曲1"
```

### 导出可重新跑的复盘脚本
```bash
python -m src.cli export-replay <show_id> --output my_show_replay.py
python3 my_show_replay.py  # 一键复现所有操作
```

---

## 目录结构

```
src/
├── models/          # 数据模型定义
│   └── schemas.py   # 所有核心数据结构
├── rules/           # 边界规则引擎
│   └── boundary_rules.py  # 混批判断、拆分、回滚
├── importer/        # 导入去重
│   └── importer.py  # 哈希校验、幂等导入
├── history/         # 历史版本
│   └── history.py   # 修改记录、差异对比
├── workflow/        # 工作流引擎
│   └── workflow.py  # 三步流程、复核机制
├── trace/           # 溯源系统
│   └── trace.py     # 数据点→原始素材
├── storage/         # 持久化
│   └── storage.py   # 保存、加载、复盘脚本
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
- [ ] 修改备注后用 `history` 命令确认有记录
- [ ] 最后用 `export-replay` 导出复盘脚本存档
