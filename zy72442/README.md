# 伴奏降噪返工记录系统

解决请假课时被算进已消耗时，巡演统筹追问"伴奏降噪返工记录"前后不一致的问题。

---

## 🔧 关键修复（v2 版本）

### 修复的问题
**之前**：人工修正只改了文字说明，重跑流程又从底层读原始数据，导致"人工说只有1节，但重跑显示2节"的前后不一致。

**现在**：
- ✅ 人工修正 `leave_hours_count` 同时改底层 `audio_notes` 表
- ✅ 原始值 `original_leave_hours_count` 永久保留用于审计
- ✅ 重跑流程读取修正后的当前值，不再覆盖
- ✅ 还缺什么材料 带 `missing_materials_source` 追溯依据
- ✅ 每条返工记录带 `source_material`，能追回原始材料

### 数据一致性保证
```
底层数据双轨制：
├── audio_notes.leave_hours_count = 1节      # 当前值（可修正）
└── audio_notes.original_leave_hours_count = 2节  # 原始值（永久保留）

每个版本核对表都记录：
├── leave_hours_count_used = 1节   # 本版本实际使用的数值
├── data_source = rerun_with_correction  # 数据来源标记
└── missing_materials_source = 依据：重跑时读取audio_notes表当前值1节...
```

---

## 核心设计

### 曲目核对表回答三个问题 + 追溯
1. **为什么被留下** - 这条记录为什么卡在这（包含原始值 vs 修正值对比）
2. **还缺什么材料** - 还差什么才能往前走
3. **材料来源依据** - 为什么需要这些材料，从哪条记录触发的
4. **下一步该找谁** - 找巡演统筹还是找音乐老师许老师，具体做什么

### 返工记录（伴奏降噪返工记录）
不是冷冰冰的系统日志，每一条都记录：
- 谁改了
- 改了什么（字段：旧值 → 新值）
- 为什么改
- 改完影响哪些结果
- 📎 **原始材料依据**（新增）：能追回触发变更的原始材料

### 请假课时异常处理
碰到请假课时被算进已消耗，**别急着归正常**，留给巡演统筹复核。

---

## 三种入口

### 1. 命令行（CLI）
```bash
# 初始化演示数据（推荐先跑这个）
python3 cli.py demo-setup

# 查看所有曲目核对表
python3 cli.py list-checklists

# 查看单个曲目完整详情（含返工记录时间线 + 历史版本追溯）
python3 cli.py show 1

# 导入音频备注
python3 cli.py import-note --track-name "曲目名.wav" --has-leave-hours --leave-hours-count 2 --imported-by 1 --source-material "原始材料：XXX"

# 补录授权期限页
python3 cli.py add-auth --audio-note-id 1 --auth-number AUTH-XXX --valid-from 2024-01-01 --valid-to 2024-12-31 --uploaded-by 1

# ⭐ 人工修正底层请假课时数（关键修复）
python3 cli.py correct --audio-note-id 1 --field leave_hours_count --old-value 2 --new-value 1 --reason "发现重复统计1节" --operator-id 1 --source-material "原始材料：考勤表扫描件"

# 人工修正其他字段
python3 cli.py correct --audio-note-id 1 --field reason_kept --old-value "旧原因" --new-value "新原因" --reason "发现了新情况" --operator-id 1

# 重跑流程（自动读取修正后的值）
python3 cli.py rerun --audio-note-id 1 --reason "修正后重跑" --operator-id 1

# 巡演统筹复核完成
python3 cli.py review-complete --audio-note-id 1 --operator-id 2
```

### 2. REST API
```bash
# 启动服务
python3 api.py
# 访问 http://127.0.0.1:5001/ 看小看板

# API 列表
GET  /api/checklists              # 所有曲目核对表
GET  /api/checklists/<id>         # 单个曲目详情（含历史版本）
POST /api/import                  # 导入音频备注
POST /api/auth                    # 补录授权期限页
POST /api/correct                 # 人工修正
POST /api/rerun                   # 重跑流程
POST /api/review-complete         # 巡演统筹复核完成
GET  /api/rework-records          # 返工记录
```

### 3. 小看板（Web）
启动 `python3 api.py` 后访问 `http://127.0.0.1:5001/`
- 卡片式展示所有曲目，状态一目了然
- 自动显示"已修正 X→Y节"标签
- 点击卡片看详情：
  - 音频备注（原始值 vs 当前值对比）
  - 曲目核对表（为什么被留下、还缺什么、材料依据）
  - 历史版本追溯（每个版本用了多少节、来源是什么）
  - 返工记录时间线（彩色标记不同操作类型，带原始材料依据）
- 统计面板：待复核数、缺授权数、已修正数等

---

## 演示数据说明（已修复数据不一致）

运行 `python3 cli.py demo-setup` 后会生成：

### 演示账号
| 用户ID | 姓名 | 角色 |
|--------|------|------|
| 1 | 许老师 | 音乐老师 |
| 2 | 巡演统筹小王 | 巡演统筹 |
| 3 | 管理员 | 管理员 |

### 演示曲目 #1 - 夜曲_降噪版_v2.wav（完整异常流程 + 修复演示）
```
五步标准流程（已修复数据不一致）：

1. 音频文件备注第一次导入
   → 原始记录：2节请假课时被算入已消耗
   → 底层：leave_hours_count=2, original_leave_hours_count=2
   → 还缺材料：请假课时原始消耗明细报表
   → 材料依据：系统自动检测音频文件备注中的请假课时标记

2. 补录授权期限页
   → 授权号：AUTH-2024-SPRING-0012
   → 状态更新为：待巡演统筹复核

3. ⭐ 人工修正底层数据（关键修复点）
   → 操作：许老师修正 leave_hours_count: 2 → 1
   → 原因：2024年3月15日的记录是系统重复统计
   → 底层：leave_hours_count=1, original_leave_hours_count=2 (保留)
   → 原始材料依据：授课老师签字的考勤表原件扫描件
   → 影响：曲目核对表同步更新使用值为1节

4. 重跑流程（修正后重跑，验证数据一致）
   → 重跑时读取：audio_notes.leave_hours_count=1节
   → 新版本核对表：使用1节数据
   → 为什么被留下："重跑后检测到1节请假课时（原始2节，已人工修正...）"
   → 还缺材料：请假课时消耗原始明细报表、人工修正说明文件、复核确认单
   → 材料依据："依据：重跑时读取audio_notes表当前值1节，原始值2节，差异来自rework_records表中的人工修正记录"
   → 数据来源标记：rerun_with_correction

5. 留给巡演统筹复核
   → 下一步：巡演统筹核对原始2节与现显示1节的差异
   → 所有版本 leave_hours_count_used = 1节，口径完全一致
```

### 演示曲目 #2 - 稻香_现场版.wav（正常流程）
无请假课时异常，走完导入 → 补授权的标准流程。

---

## 标准三步流程（许老师给新人讲）

以「夜曲_降噪版_v2.wav」为例：

### 第一步：音频文件备注第一次导入
```
许老师导入音频 → 系统检测到请假课时被算入已消耗（原始2节）
→ 自动标记「请假课时异常」→ 留给巡演统筹，不急着归正常
→ 还缺什么材料：请假课时原始消耗明细报表
→ 材料来源依据：系统自动检测音频文件备注中的请假课时标记
```

### 第二步：音乐老师许老师补看授权期限页
```
许老师找到授权文件 → 录入授权编号、有效期起止
→ 系统自动更新曲目核对表
→ 同时检查请假课时数据，发现问题准备修正
```

### 第三步：人工修正 + 重跑 + 曲目核对表更新（关键修复）
```
⭐ 修正底层数据（不是只改文字）：
  许老师核对考勤表 → 发现1节重复统计
  → 修正 leave_hours_count: 2 → 1
  → 原始值2节永久保留用于追溯
  → 原始材料：考勤表扫描件、课时统计对比表

🔄 重跑流程：
  系统读取修正后的1节数据
  → 为什么被留下：自动包含"原始2节 vs 修正后1节"的对比说明
  → 还缺什么材料：自动关联到需要复核的原始材料
  → 材料来源依据：明确说明1节/2节差异来自哪条返工记录
  → 所有版本数据口径一致，都是1节

👀 留给巡演统筹：
  巡演统筹打开系统 → 看到待复核列表
  → 点进去看完整返工记录时间线
  → 能看到：谁改了什么、为什么改、改完影响哪条结果
  → 能从还缺什么材料的依据，追回原始考勤表等材料
  → 确认无误后标记完成
```

---

## 追溯机制说明

### 能回答巡演统筹的所有问题
| 问题 | 从哪里看 |
|------|----------|
| 为什么一会儿说2节一会儿说1节？ | `audio_notes` 表：original=2, current=1，修正说明记录了原因 |
| 谁改的？什么时候改的？ | `rework_records` 表：许老师，2026-06-12，动作manual_correction |
| 依据什么改的？ | `rework_records.source_material`：考勤表扫描件、课时统计对比表 |
| 改完影响了哪些结果？ | `rework_records.affected_results`：底层2→1，核对表同步更新 |
| 还缺什么材料？为什么缺？ | `track_checklists.missing_materials` + `missing_materials_source` |
| 1节/2节的差异从哪来？ | `missing_materials_source`：差异来自rework_records表第X条记录 |

### 新增数据库字段
| 表 | 字段 | 用途 |
|----|------|------|
| `audio_notes` | `original_leave_hours_count` | 原始导入值，永久保留 |
| `audio_notes` | `leave_hours_correction_note` | 修正说明 |
| `audio_notes` | `last_corrected_by/at` | 最后修正人/时间 |
| `track_checklists` | `leave_hours_count_used` | 本版本实际使用的课时数 |
| `track_checklists` | `missing_materials_source` | 还缺材料的依据说明 |
| `track_checklists` | `data_source` | 数据来源标记（initial_import/rerun_with_correction等） |
| `rework_records` | `source_material` | 每条操作的原始材料依据 |

---

## 项目文件结构

```
.
├── config.py              # 角色、状态、标签配置
├── cli.py                 # 命令行入口（支持 --source-material 参数）
├── api.py                 # REST API + Web 服务
├── requirements.txt       # 依赖
├── app/
│   ├── __init__.py
│   ├── database.py        # SQLite 数据库层（含新增追溯字段）
│   └── services.py        # 核心业务逻辑（已修复数据一致性）
├── static/
│   └── index.html         # 小看板前端（已增强追溯展示）
└── README.md              # 本文档
```
