# 道路积水深度剖面系统

## 概述

本系统用于管理道路积水深度剖面数据，核心原则：**坐标原点说明和巡检照片两份证据合入同一结果，导出明细、页面展示、接口返回均读同一份数据，不出现同一个障碍物在某一出口显示异常而在另一出口消失的情况。**

## 三步主流程

| 步骤 | 操作 | 对应API | 说明 |
|------|------|---------|------|
| ① | 导入坐标原点说明 | `POST /api/profiles/{id}/import-origin` | 按行解析，每行产生一条 ProfileRecord，自动检测命名冲突 |
| ② | 设备工程师许工补看巡检照片 | `POST /api/profiles/{id}/attach-photo` | 为指定障碍物追加巡检照片证据 |
| ③ | 更新三维标注视图 | `POST /api/profiles/{id}/update-annotation` | 修改积水深度或三维坐标，所有变更留痕 |

## 状态机

```
IMPORTED ──补看照片──→ PHOTO_REVIEWED ──更新标注──→ ANNOTATION_UPDATED
   │                                                  │
   └──────检测到命名冲突────→ PENDING_REVIEW ←─────检测到命名冲突
                                   │
                          许工确认选用名称
                                   │
                                   ▼
                              CONFIRMED
                                   │
                              回滚操作
                                   │
                                   ▼
                              ROLLED_BACK → PENDING_REVIEW
```

**关键规则：处于 `PENDING_REVIEW` 状态的记录不会被自动推进到下一状态。**

## 边界规则：同一障碍物被标了两个名字

### 判定规则

1. 系统按 `obstacle_id` 分组，同一 `obstacle_id` 下出现 **2个及以上不同的 `obstacle_name`** 即判定为命名冲突
2. 冲突类型标记为 `DUPLICATE_NAME`
3. 冲突一旦检测到，关联的所有记录状态自动变为 `PENDING_REVIEW`
4. 即使后续有新证据（巡检照片、人工修改）加入，冲突不自动消除

### 修改规则

1. 设备工程师许工在"冲突处理"面板点击一个候选名称，系统以 **`conflict_id`（如 `conflict_OBS001`）作为 key 记录选择**，避免与 `obstacle_id` 混淆
2. 许工填写"处理原因"（为何选此名称）和"下一步复核人"（培训学员谁来复核）
3. 点击"确认选用"后系统完成以下动作：
   - 同一 `obstacle_id` 下所有记录的 `obstacle_name` 统一为选定名称
   - 名称变更作为 `MANUAL` 类型证据追加到 `evidence_trail` 和 `manual_changes`
   - 冲突对象写入：`resolution`、`reason`、`resolved_by`、`resolved_at`、`next_reviewer`
   - 记录状态变为 `CONFIRMED`
   - 审计日志追加含 `original_names`、`reason`、`next_reviewer` 的完整记录
   - 冲突处理区、列表、详情、摘要、画布、导出、接口全部重渲染为同一份新结果
4. 如果未选名称就点确认，弹出"请先选择一个名称"（由后端 `ValueError` 和前端双重保障）

### 回滚规则

1. 许工可对已确认的冲突执行回滚
2. 回滚后冲突状态变为 `ROLLED_BACK`，关联记录回到 `PENDING_REVIEW`
3. 回滚不会恢复被改过的名称（名称变更已留痕），需要重新选择
4. 回滚操作本身也记录在审计日志中

### 不自动吞掉的原则

- 同一障碍物被标了两个名字的记录，**绝不自动选择其中一个**
- 即使两边证据（坐标原点说明 vs 巡检照片）都指向同一障碍物，也不自动归正常
- 必须由设备工程师许工确认后才从 `PENDING_REVIEW` 推进
- 培训学员追问时，可通过证据追溯面板回到原始行号和人工改动记录

## 数据一致性保证

- 所有数据存储在 `backend/data/{profile_id}.json` 单一文件
- 导出明细（`GET /api/profiles/{id}/export`）、页面展示（`GET /api/profiles/{id}`）、接口返回均调用同一 `export_detail()` 函数
- 不存在"汇总数"和"明细"两套数据源

## 证据追溯

每条 `ProfileRecord` 包含：

| 字段 | 说明 |
|------|------|
| `evidence_trail` | 按时间排列的所有证据（坐标原点原始行 + 巡检照片 + 人工修改），含 `original_line_number` |
| `manual_changes` | 仅人工修改的记录，便于快速筛选 |
| `conflict_ids` | 关联的冲突ID列表 |

## 可重新跑的命令

```bash
# 1. 安装依赖
cd backend && pip install -r requirements.txt

# 2. 启动服务
cd backend && python run.py

# 3. 跑一遍完整三步工作流（含同一障碍物双名冲突场景）
cd .. && python scripts/demo_walkthrough.py
```

## 项目结构

```
backend/
  app/
    models.py    # 数据模型：ProfileRecord, NameConflict, EvidenceEntry 等
    service.py   # 核心逻辑：冲突检测、状态机、证据追溯
    api.py       # API层：所有出口读同一份结果
  data/          # 运行时数据（JSON文件）
  run.py         # 启动入口
static/
  index.html     # 前端：三维标注视图 + 证据面板 + 冲突处理
scripts/
  demo_walkthrough.py  # 可重跑的完整演示脚本
```
