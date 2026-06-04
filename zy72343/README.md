# 线段相交施工冲突检测系统

服务教研组复核：点到断档能追溯原始行 · 参数版本有血有肉

## 核心设计理念

### 问题背景
教研组只想看一份能解释的"线段相交施工冲突"结果。数据分析师小祁面对手算反例里的人工删掉一行后编号断档时，需要能追溯到原始行，而不是只剩漂亮画面。

### 设计原则
1. **服务复核优先**：3D/图表展示前，先确保点到断档能回到手算反例或问卷原始行
2. **报告有温度**：不是冷冰冰的系统日志，要说明为什么留下、缺什么、下一步找谁
3. **断档不自动归位**：碰到人工删掉一行后编号断档时，不急着归正常，留给教研组复核
4. **新人可上手**：照README能从样例跑到报告

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

# 第三步：生成最终报告
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

# 第二步：补录问卷原始行
curl -X POST http://localhost:8000/supplement \
    -H "Content-Type: application/json" \
    -d '{
        "project_name": "试点项目",
        "segment_id": 3,
        "questionnaire_row": 3
    }'

# 第三步：下载报告
curl http://localhost:8000/report/试点项目 -o 试点项目报告.txt
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

## 参数版本页设计

每条线段都有参数版本记录，包含：

| 字段 | 说明 |
|------|------|
| `version` | 版本号，每次变更+1 |
| `kept_reason` | 为什么被留下 |
| `missing_materials` | 还缺什么材料 |
| `next_owner` | 下一步该找教研组还是小祁 |
| `status` | 状态：needs_supplement / ready_for_review / resolved |
| `change_log` | 变更历史 |
| `created_by` | 操作人 |
| `created_at` | 时间戳 |

**示例**：
```
线段#3 暖通管C1: v2
  保留原因: 已关联问卷原始行，数据完整度提升
  缺失材料: 无
  下一步: 教研组
  状态: 待复核
  最近变更: 数据分析师小祁补录问卷原始行: 3（原: None）
  创建人: 数据分析师小祁 · 2024-xx-xx
```

## 报告格式

报告不是冷冰冰的系统日志，而是有温度的分析文档：

1. **数据概览**：线段数、冲突数、断档数
2. **编号断档追踪**：每处断档的状态、已补录行、下一步找谁
3. **线段相交冲突列表**：严重程度分级、交点坐标、关联线段
4. **参数版本页**：分"待小祁处理"和"待教研组复核"两部分
5. **下一步行动指引**：清晰的待办清单

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
python -m pytest tests/test_three_steps.py -v
```

测试内容：
1. 第一步：导入手算反例，验证断档检测正确
2. 第二步：小祁补录问卷行，验证参数版本更新
3. 第三步：生成报告，验证报告包含断档追踪和版本信息

## 关键设计细节检查清单

- [x] 碰到断档不急着归正常，留给教研组复核
- [x] 参数版本页说明为什么被留下、缺什么、下一步找谁
- [x] 3D可视化点击能追溯到原始行
- [x] 报告有温度，不是系统日志
- [x] 命令行/API/小看板三种入口
- [x] 补录问卷行后参数版本页自动更新
- [x] 新人照README能从样例跑到报告
- [x] 三步流程完整闭环

## 常见问题

**Q: 为什么不自动补全断档？**
A: 这是刻意设计。人工删除行可能有业务原因，系统不做自动判断，留给教研组复核。数据分析师小祁只负责关联问卷原始行，最终决定权在教研组。

**Q: 为什么要保留is_deleted的线段？**
A: 因为删除操作本身也是重要信息。参数版本页会解释这条为什么被标记删除，等待教研组最终确认。

**Q: 版本号有什么用？**
A: 每次补录或复核操作都会递增版本号，完整记录数据血缘。教研组可以追溯每条数据的变更历史。
