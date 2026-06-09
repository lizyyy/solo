# 线段相交施工冲突检测系统

服务教研组复核：点到断档能追溯原始行 · 参数版本有血有肉  
**v2.0 全链路一致性修订**：导入到报告、先服务复核、还缺什么材料全程串到同一份数据

## 核心设计理念

### 问题背景
教研组只想看一份能解释的"线段相交施工冲突"结果。数据分析师小祁面对手算反例里的人工删掉一行后编号断档时，需要能追溯到原始行，而不是只剩漂亮画面。

**第二轮修订根因**：按操作路走下来，「导入到报告」「先服务复核」「还缺什么材料」三个入口展示的不是同一份最新结果（v1和v2被重复计数），于是重做了单一数据源层，并补全了人工复核的四要素留存。

### 设计原则
1. **服务复核优先**：3D/图表展示前，先确保点到断档能回到手算反例或问卷原始行
2. **报告有温度**：不是冷冰冰的系统日志，要说明为什么留下、缺什么、下一步找谁
3. **断档不自动归位**：碰到人工删掉一行后编号断档时，不急着归正常，留给教研组复核
4. **新人可上手**：照README能从样例跑到报告
5. **全链路数据一致性（v2.0 新增）**：CLI status / API / 报告 / Web 面板**四个入口共用同一份最新参数版本去重结果**；列表、详情、摘要、历史记录、导出/报告跟随同一条记录联动更新

### 统一数据入口（所有展示必须走这两个函数）
- **`get_latest_parameter_versions(project)`**：按 segment_id 去重取每条线段 version 最大的那一条，摘要/列表/计数一律使用此返回值
- **`count_todo_by_latest_versions(project)`**：基于去重结果统计 `(待小祁数, 待教研组数)`

不要直接遍历 `project.parameter_versions` 做计数（会把同一条线段的 v1+v2 都统计进去）。

## 三步核心流程（必须走完）

```
第一步：手算反例第一次导入
    ↓
检测到编号断档 → 标记待补录（不急着归正常）
    ↓
第二步：数据分析师小祁补看问卷原始行
    ↓
参数版本页自动更新（版本号+1，记录变更）
    ↓
第三步：教研组复核 → 生成报告
```

## 快速开始

### 1. 环境准备

```bash
# 安装依赖
pip install fastapi uvicorn python-multipart
```

### 2. 命令行方式（推荐新人上手）

```bash
# 第一步：导入手算反例（含人工删除行导致的断档）
python -m segment_conflict.cli import \
    -i samples/hand_calculated.csv \
    -n 试点项目 \
    -r

# 查看项目状态（看到断档和待处理项）
python -m segment_conflict.cli status -p 试点项目.json

# 第二步：数据分析师小祁补录问卷原始行
# 补录线段#3（原始行4），关联问卷行3（被人工删除的那行）
python -m segment_conflict.cli supplement \
    -p 试点项目.json \
    -s 3 \
    -q 3 \
    -r 试点项目_补录后报告.txt

# 再看状态（版本号从v1变v2）
python -m segment_conflict.cli status -p 试点项目.json

# 第三步：教研组复核断档（不急着归正常，保留完整记录链）
python -m segment_conflict.cli review \
    -p 试点项目.json \
    -g 0 \
    --approved \
    --note "问卷行已补齐，数据完整"

# （可选）教研组直接复核单条线段参数版本
python -m segment_conflict.cli review-param \
    -p 试点项目.json \
    -s 3 \
    --approved \
    --note "数据无误，通过"

# 查看单条线段的完整变更链（v1→v2→…）
python -m segment_conflict.cli history -p 试点项目.json -s 3

# 生成最终报告（待处理数字与 status 完全一致）
python -m segment_conflict.cli report \
    -p 试点项目.json \
    -o 试点项目_最终报告.txt
```

### 3. API方式

```bash
# 启动后端服务
uvicorn segment_conflict.api:app --reload --host 0.0.0.0 --port 8000

# API文档
# http://localhost:8000/docs
```

#### API调用示例

```bash
# 第一步：导入手算反例
curl -X POST "http://localhost:8000/import?name=试点项目" \
    -F "file=@samples/hand_calculated.csv"

# 查看项目
curl http://localhost:8000/projects/试点项目

# 第二步：补录问卷原始行（返回 before/after 快照 + 变更四要素）
curl -X POST http://localhost:8000/supplement \
    -H "Content-Type: application/json" \
    -d '{
        "project_name": "试点项目",
        "segment_id": 3,
        "questionnaire_row": 3
    }'

# 获取项目详情（返回 latest_parameters 已去重数组，前端不得直接用 parameter_versions 计数）
curl http://localhost:8000/projects/试点项目

# ✅ v2.0 新增：最新参数版本分页（按 status / next_owner 筛选）
curl "http://localhost:8000/projects/试点项目/latest-params?next_owner=教研组"

# ✅ v2.0 新增：单条线段完整变更链（v1→v2→…）
curl http://localhost:8000/projects/试点项目/segments/3/history

# ✅ v2.0 新增：人工复核记录链
curl http://localhost:8000/projects/试点项目/review-records

# ✅ v2.0 新增：教研组复核断档（不急着归正常，返回ReviewRecord + 相邻线段同步结果）
curl -X POST http://localhost:8000/review-gap \
    -H "Content-Type: application/json" \
    -d '{
        "project_name": "试点项目",
        "gap_index": 0,
        "approved": true,
        "note": "问卷行已补齐，数据完整"
    }'

# ✅ v2.0 新增：教研组复核参数版本
curl -X POST http://localhost:8000/review-param \
    -H "Content-Type: application/json" \
    -d '{
        "project_name": "试点项目",
        "segment_id": 3,
        "approved": true,
        "note": "数据无误"
    }'

# 第三步：下载报告
curl http://localhost:8000/report/试点项目 -o 试点项目报告.txt

# 3D 可视化数据（线段上挂 trace 字段，与 CLI/报告一致）
curl http://localhost:8000/3d-data/试点项目
```

### 4. 小看板方式（带3D可视化）

```bash
# 启动后端（同上）
uvicorn segment_conflict.api:app --reload

# 打开前端页面
open web/index.html
```

**小看板功能**：
- 3D可视化展示线段和冲突点（Three.js渲染）
- 鼠标悬停查看线段详情，点击追溯原始行
- 断档追踪面板：显示人工删除行导致的编号断档
- 冲突列表：按严重程度排序，点击可定位
- 参数版本页：显示每条线段为什么被留下、缺什么材料、下一步找谁

## 数据格式说明

### 导入CSV格式（手算反例）

| 字段 | 说明 | 必填 |
|------|------|------|
| `id` | 线段ID | 是 |
| `original_row_num` | 原始行号（用于检测断档） | 是 |
| `name` | 线段名称 | 是 |
| `start_x/y/z` | 起点3D坐标 | 是 |
| `end_x/y/z` | 终点3D坐标 | 是 |
| `category` | 类别（管道/电缆/结构/暖通） | 是 |
| `source_type` | 数据来源 | 否 |
| `is_deleted` | 是否已标记删除 | 否 |
| `deleted_reason` | 删除原因 | 否 |
| `questionnaire_row` | 关联问卷原始行号 | 否 |
| `remark` | 备注 | 否 |

**关键设计**：`original_row_num` 不连续时自动标记为断档，留给教研组复核。

## 断档检测机制

系统自动检测 `original_row_num` 编号不连续的情况：

```
原始行号：1, 2, 4, 5, 6, 8, 9, 10, 11, 13, 14, 15
                ↑        ↑              ↑
              断档1     断档2           断档3
            (缺失行3)  (缺失行7)     (缺失行12)
```

**断档状态流转**：
```
pending_supplement（待补录）
    → 小祁补录问卷行 → supplemented（已补录待复核）
        → 教研组复核通过 → resolved（已解决）
        → 教研组驳回 → rejected（已驳回）
```

## 参数版本页设计（v2.0 含变更四要素）

每条线段都有参数版本记录。**展示时只取最新版本（按segment_id去重）**，但完整保留 v1→v2→… 历史链供追溯。

| 字段 | 说明 |
|------|------|
| `version` | 版本号，每次变更+1 |
| `kept_reason` | **为什么被留下**（服务教研组复核） |
| `missing_materials` | **还缺什么材料**（与补录动作双向同步） |
| `next_owner` | **下一步找谁**：数据分析师小祁 / 教研组 / （已完成） |
| `status` | needs_supplement / ready_for_review / pending_review / resolved / rejected |
| `original_value` | ✅ **变更四要素-原始说法** |
| `new_value` | ✅ **变更四要素-改后值** |
| `change_reason` | ✅ **变更四要素-处理原因** |
| `change_log` | 变更历史备注 |
| `created_by` | 操作人 |
| `created_at` | 时间戳 |

**完整变更链示例**（`history` 命令查看）：
```
线段#3 暖通管C1 完整变更链:
  v1  <需补录>
    原始说法: 未关联问卷原始行
    改后值  : （待数据分析师小祁补录）
    处理原因: 首次导入手算反例
    为什么被留下: 手算反例导入，暂未关联问卷原始行
    还缺什么材料: 问卷原始行关联、数据源验证
    下一步找谁: 数据分析师小祁

  v2  <待复核(材料齐)>
    原始说法: 问卷原始行 = 未关联
    改后值  : 问卷原始行 = 3
    处理原因: 补看问卷原始行后补录，提升数据完整度
    为什么被留下: 已关联问卷原始行，数据完整度提升
    还缺什么材料: 无
    下一步找谁: 教研组

  v3  <待复核(材料齐)>   ← 相邻断档复核同步追加
    原始说法: 相邻断档状态 = supplemented
    改后值  : 相邻断档状态 = resolved（问卷行已补齐）
    处理原因: 相邻断档状态变更，同步更新本线段状态
    下一步找谁: 教研组
```

## 人工复核记录链 ReviewRecord（v2.0 新增）

每次教研组操作都会独立写入 `ReviewRecord`，保留完整四要素（不提前归正常）：

| 字段 | 说明 |
|------|------|
| `target_type` | `gap` 断档复核 / `segment_parameter` 参数版本复核 |
| `original_status` | 原始说法（状态） |
| `new_status` | 改后值（状态） |
| `reason` | 处理原因（复核意见） |
| `next_owner` | 下一步找谁 |
| `reviewer` / `reviewed_at` | 操作人、时间戳 |
| `changes` | 前后状态、已补录行、备注等完整快照 |

报告第五部分、Web 面板「复核记录」Tab 独立展示完整链路。

## 报告格式（v2.0 共7个章节，统计基于同一份最新参数版本）

报告不是冷冰冰的系统日志，而是有温度的分析文档：

1. **数据概览**：与 CLI status / API 摘要完全一致的线段数、冲突数、待处理数
2. **编号断档追踪**：每处断档的状态流转、已补录行、复核人、下一步找谁（不提前归正常）
3. **线段相交冲突列表**：严重程度分级、交点坐标、关联线段
4. **参数版本页（数据血缘追踪）**：展示最新版本，每条记录变更四要素（原始说法→改后值→处理原因→下一步找谁）
5. ✅ **人工复核记录链（v2.0 新增）**：ReviewRecord 完整四要素
6. ✅ **参数版本完整历史（v2.0 新增）**：每条线段 v1→v2→… 变更链，专供追溯
7. **下一步行动指引**：与其他入口摘要一致的待办清单

**末尾一致性说明**：本报告「待处理数量」「参数版本」与 CLI status / API / Web 面板均基于同一份最新参数版本去重结果。

## 目录结构

```
.
├── README.md                     # 本文档
├── segment_conflict/
│   ├── __init__.py
│   ├── models.py                 # 数据模型定义
│   ├── algorithms.py             # 3D线段相交检测、断档检测
│   ├── processor.py              # 核心处理流程
│   ├── cli.py                    # 命令行入口
│   └── api.py                    # FastAPI后端
├── web/
│   └── index.html                # 小看板前端（3D可视化）
├── samples/
│   ├── hand_calculated.csv       # 手算反例（含人工删除行）
│   └── questionnaire_original.csv # 问卷原始行对照
└── tests/
    └── test_three_steps.py       # 三步流程集成测试
```

## 核心算法

### 3D线段相交检测

使用参数化方法计算两条3D线段的最近距离：
- 精确相交：距离 < 0.01m（critical）
- 近似相交：距离 < 0.03m（high）
- 距离过近：距离 < 0.05m（medium）

算法实现：`segment_3d_intersection()` in [algorithms.py](file:///Users/lzy/pro/solo/workspaces/zy72343/segment_conflict/algorithms.py#L46-L95)

### 编号断档检测

遍历排序后的原始行号，检测编号不连续点：
`detect_gaps()` in [algorithms.py](file:///Users/lzy/pro/solo/workspaces/zy72343/segment_conflict/algorithms.py#L141-L190)

## 验证三步流程

运行集成测试验证完整流程：

```bash
python3 -m pytest tests/test_three_steps.py -v
```

**共 28 个测试用例**（第一轮15 + 第二轮新增13）：

**第一轮（三步流程基础）**：
1. 第一步：导入手算反例，验证断档检测正确、参数版本初始化、断档不自动归位
2. 第二步：小祁补录问卷行，验证线段更新、断档状态更新、参数版本号递增、保留原因变化
3. 第三步：生成报告，验证包含断档追踪、参数版本、行动指引、有温度的报告格式
4. 完整流程端到端、追溯原始行、已删除线段保留在历史

**✅ 第二轮新增（全链路一致性专项）**：
5. **TestConsistencyAllEntryPoints（4个）**：导入/补录后 processor 内部计数与报告一致、同一条线段的 v1+v2 不被重复统计、保存加载后统计不变
6. **TestParameterVersionFourElements（3个）**：v1 就填入四要素、补录新版本记录变更、已删除线段的四要素清晰
7. **TestReviewRecordsChain（3个）**：断档复核生成 ReviewRecord、断档复核同步追加相邻线段参数版本、参数版本复核不提前归正常
8. **TestLatestVsHistorySeparation（3个）**：历史链按版本号升序、去重函数真正取 version 最大的、还缺什么材料在最新PV/报告/API三处文字一致

## 关键设计细节检查清单

- [x] 碰到断档不急着归正常，留给教研组复核
- [x] 参数版本页说明为什么被留下、缺什么、下一步找谁
- [x] 3D可视化点击能追溯到原始行
- [x] 报告有温度，不是系统日志
- [x] 命令行/API/小看板三种入口
- [x] 补录问卷行后参数版本页自动更新
- [x] 新人照README能从样例跑到报告
- [x] 三步流程完整闭环
- [x] **✅ v2.0 全链路一致性**：CLI/API/报告/Web 四处待处理数量完全一致（同一份最新参数版本去重）
- [x] **✅ v2.0 变更四要素**：每条 ParameterVersion 有 `original_value / new_value / change_reason / next_owner`
- [x] **✅ v2.0 人工复核记录链**：ReviewRecord 独立记录每次教研组操作（原始说法→改后值→处理原因→下一步找谁）
- [x] **✅ v2.0 相邻线段同步**：断档复核后，前后两条线段各追加参数新版本（不漏掉影响）
- [x] **✅ v2.0 不提前归正常**：supplemented / partially_resolved 是独立状态，必须教研组显式操作才流转
- [x] **✅ v2.0 最新 vs 历史区分**：展示用 latest（去重）、追溯用完整 history，API 返回明确的 `consistency_warning`
- [x] **✅ v2.0 保存/加载无损**：JSON 序列化完整保留所有字段，加载后统计不变

## 常见问题

**Q: 为什么不自动补全断档？**
A: 这是刻意设计。人工删除行可能有业务原因，系统不做自动判断，留给教研组复核。数据分析师小祁只负责关联问卷原始行，最终决定权在教研组。

**Q: 为什么要保留is_deleted的线段？**
A: 因为删除操作本身也是重要信息。参数版本页会解释这条为什么被标记删除，等待教研组最终确认。

**Q: 版本号有什么用？**
A: 每次补录或复核操作都会递增版本号，完整记录数据血缘。教研组可以追溯每条数据的变更历史。

**Q: 同一条线段的 v1、v2 会被重复统计吗？**
A: 不会。v2.0 引入了统一入口 `get_latest_parameter_versions()`，所有展示（CLI status / API 摘要 / 报告 / Web面板）都先按 segment_id 去重，只取 version 最大的那条，确保同一条线段不会被重复计数。

**Q: 为什么断档复核完成后，前后两条线段也有新版本？**
A: 这是刻意设计的「相邻同步」机制。断档变更会直接影响相邻两条线段的上下文（例如原来「相邻断档待补录」的说明要更新），所以会分别追加 ParameterVersion 新版本，保证数据血缘不丢失。详情用 `cli history` 命令查看。

**Q: 保存项目再加载后，统计数字会变吗？**
A: 不会。JSON 序列化时会完整保存 `review_records`、`parameter_versions` 全部字段（含 original_value / new_value / change_reason），load_project 重新加载后 `count_todo_by_latest_versions()` 的结果与保存前完全一致。
