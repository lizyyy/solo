# 太阳跟踪支架误差 - 质检系统

## 一、系统概述

本系统用于处理太阳跟踪支架的误差质检数据，核心目标是让质检员小白在开会前10分钟内，不用翻手写巡检备注就能直接看到"采样时间缺了半小时"等关键问题。

**所有边界规则同时写在代码（见 [boundary_rules.py](file:///Users/lzy/pro/solo/workspaces/zy72354/boundary_rules.py)）和本README中，不靠口头约定。**

---

## 二、边界规则（代码 & 文档双写）

### 2.1 安全阈值表

| 指标 | 阈值 | 说明 |
|------|------|------|
| 方位角误差 | ≤ 2.0° | 超过判定为异常 |
| 俯仰角误差 | ≤ 1.5° | 超过判定为异常 |
| 跟踪准确率 | ≥ 95.0% | 低于判定为异常 |
| 单条记录采样时长 | ≥ 30分钟 | 不足→**强制待质检员复核，不许自动归正常** |

> 代码常量定义：[boundary_rules.py#L14](file:///Users/lzy/pro/solo/workspaces/zy72354/boundary_rules.py#L14-L14)

---

### 2.2 采样时间缺半小时 - 处理规则

#### 🚨 怎么判（判定逻辑）

当 `采样时长 < 30分钟` 时：

1. **状态强制设为 `待质检员复核`**（不是"正常"也不是"异常"）
2. 问题提示直接说人话：`"采样时间缺了XX分钟（只有YY分钟，要求至少30分钟），请质检员复核后再处理"`
3. 对应代码：[boundary_rules.py#L94-L128](file:///Users/lzy/pro/solo/workspaces/zy72354/boundary_rules.py#L94-L128)

#### ✏️ 怎么改（修改逻辑）

1. 质检员必须先回**手写巡检备注**核对原始记录
2. 或先看**安全阈值表**确认判定标准
3. 修改后自动记录版本历史，改前改后清晰可见
4. 对应代码：[boundary_rules.py#L223-L264](file:///Users/lzy/pro/solo/workspaces/zy72354/boundary_rules.py#L223-L264)

#### ↩️ 怎么回滚（回滚逻辑）

1. 任何修改都可回滚到上一版本
2. 回滚后状态标记为 `已回滚`
3. 回滚操作本身也留痕
4. 对应代码：[boundary_rules.py#L266-L307](file:///Users/lzy/pro/solo/workspaces/zy72354/boundary_rules.py#L266-L307)

#### ❌ 不许做的事

- 不许直接把"采样时间缺半小时"的记录标记为正常（除非填写了复核说明）
- 不许自动修复采样时长（比如自动帮着补到30分钟）
- 不许跳过复核流程

对应代码：[workflow.py#L453-L467](file:///Users/lzy/pro/solo/workspaces/zy72354/workflow.py#L453-L467)

---

### 2.3 重复导入规则

1. 同一批手写巡检备注**重复导入时，"太阳跟踪支架误差"数量不会翻倍**
2. 通过内容哈希（`content_hash`）判断是否完全相同
3. 相同内容直接跳过，不会生成新的误差记录
4. 提示信息：`"温馨提示：X条'太阳跟踪支架误差'因内容完全相同未重复生成，数量不会翻倍"`

对应代码：[import_service.py#L44-L97](file:///Users/lzy/pro/solo/workspaces/zy72354/import_service.py#L44-L97)

---

### 2.4 单条备注修改 - 历史追踪规则

1. 质检员小白**只改一条备注**时，系统能看出改前改后的差别
2. 版本对比用中文显示字段名，如 `[采样开始时间] 改前: 08:10 → 改后: 08:35`
3. 所有历史版本永久保留，可随时查看

对应代码：[import_service.py#L200-L278](file:///Users/lzy/pro/solo/workspaces/zy72354/import_service.py#L200-L278)

---

### 2.5 3D/图表展示 - 复核追溯规则

1. 选择3D或图表展示时，**点击数据点必须能追溯回原始数据**，不能只剩漂亮画面
2. 点到"采样时间缺半小时"的记录时，自动给出跳转链接：
   - → 跳转手写巡检备注（看原文）
   - → 查看安全阈值表（核对判定标准）
   - → 去待复核列表处理
3. 点击图表不会直接改状态，必须走复核流程

对应代码：[visualization_review.py#L110-L165](file:///Users/lzy/pro/solo/workspaces/zy72354/visualization_review.py#L110-L165)

---

### 2.6 错误提示规则

所有错误提示**直接说人话，不吐内部字段名**：

| 内部编码 | 人话提示 |
|----------|----------|
| `SAMPLING_DURATION_TOO_SHORT_10min` | 采样时间缺了20分钟（只有10分钟，要求≥30分钟） |
| `SAMPLING_START_MISSING` | 没填采样开始时间，没法算时长，请补全 |
| `SAMPLING_END_MISSING` | 没填采样结束时间，没法算时长，请补全 |
| `AZIMUTH_EXCEEDS_2.5` | 方位角误差2.5°超过安全阈值2.0°，请重点关注 |
| `ELEVATION_EXCEEDS_1.8` | 俯仰角误差1.8°超过安全阈值1.5°，请重点关注 |
| `TRACKING_ACCURACY_LOW_93.0` | 跟踪准确率93.0%低于要求的95.0%，请检查设备 |

对应代码：[workflow.py#L44-L52](file:///Users/lzy/pro/solo/workspaces/zy72354/workflow.py#L44-L52)

---

## 三、标准三步工作流

### 第一步：导入手写巡检备注

1. 系统自动解析备注，生成"太阳跟踪支架误差"记录
2. 自动标出采样时间缺半小时的记录，状态设为"待复核"
3. 开会前快速看：调用 `get_quick_pending_summary()`，10秒掌握重点

代码：[workflow.py#L101-L174](file:///Users/lzy/pro/solo/workspaces/zy72354/workflow.py#L101-L174)

### 第二步：质检员补看安全阈值表

1. 点击待复核记录，自动跳转安全阈值表做对比
2. 每条指标标注 ✅/❌ 状态，一目了然
3. 采样时间缺半小时的记录会高亮提醒

代码：[workflow.py#L176-L279](file:///Users/lzy/pro/solo/workspaces/zy72354/workflow.py#L176-L279)

### 第三步：实验复盘图更新

1. 生成2D/3D图表，红点标出采样缺时的记录
2. 点击红点可直接跳回手写巡检备注或安全阈值表
3. 处理完后刷新图表，复盘图同步更新

代码：[workflow.py#L281-L336](file:///Users/lzy/pro/solo/workspaces/zy72354/workflow.py#L281-L336)

> **重要提醒**：中间碰到采样时间缺半小时时，别急着归正常，留给质检员复核。代码强制保证这一点。

---

### 3.1 人工复核信息包（采样时间缺半小时等待处理场景）

每条需要人工复核的记录都附带完整的信息包，**不会提前归到正常结果里**：

| 字段 | 说明 |
|------|------|
| 原始问题说法 | 保留判定时的原话，如：`"采样时间缺了20分钟（只有10分钟，要求≥30分钟）..."` |
| 改后的值 | 改前→改后的中文字段对比，如：`采样开始时间：08:00 → 08:00，采样时长：10 → 35` |
| 处理原因 | 修改人填写的复核说明，如：`"经核对原始巡检记录，实际采样到8:35，之前少记25分钟"` |
| 下一步找谁 | 按状态自动判断：<br>待复核→质检员小白<br>已修改→质检员主管<br>已回滚→质检员小白（请确认是否重新处理） |

代码入口：
- 详情接口：`workflow.get_full_error_detail(error_id)` → 返回含 `manual_review_packet` 字典
- 人话渲染：`workflow.render_error_detail_for_humans(error_id)` → 直接打印可读详情
- 报告导出：`workflow.export_report(error_ids=[...])` / `workflow.save_report_to_file(path)`
  报告包含：总览摘要 + 每条记录的**全链路详情 + 人工复核信息包 + 完整版本历史**

对应代码：[workflow.py#L606-L809](file:///Users/lzy/pro/solo/workspaces/zy72354/workflow.py#L606-L809)

### 3.2 同一份数据全链路同步规则

对同一条记录（同一个 `error_id`）的任何修改/回滚，以下视图**必须同时更新，不允许出现数据错位**：

1. **待复核列表** `import_service.get_pending_review_errors()` — 状态变化后自动进/出列表
2. **单条详情** `workflow.get_full_error_detail(error_id)` — 最新状态+历史+复核信息包
3. **总览摘要** `viz_service.get_visualization_summary()` — 按状态计数全部实时重算
4. **3D/2D图表** `viz_service.prepare_chart_data(ViewMode.*)` — 每个数据点同步最新状态与坐标
5. **版本历史** `import_service.get_error_history(error_id)` — 修改/回滚自动追加一条
6. **导出报告** `workflow.export_report()` — 基于上述最新快照生成

同 `error_id` 复用规则：
- 同一个 `note_id` 更新导入 → **error_id 不变，版本号+1，保留历史**（不会生成新记录）
- 完全相同内容重复导入 → **直接跳过，不新增、不改历史、数量不翻倍**

对应代码：[import_service.py#L61-L133](file:///Users/lzy/pro/solo/workspaces/zy72354/import_service.py#L61-L133)

---

## 四、文件结构

| 文件 | 职责 |
|------|------|
| [models.py](file:///Users/lzy/pro/solo/workspaces/zy72354/models.py) | 数据模型：巡检备注、误差记录、阈值表、版本历史 |
| [boundary_rules.py](file:///Users/lzy/pro/solo/workspaces/zy72354/boundary_rules.py) | 边界规则引擎：判定、修改、回滚 |
| [import_service.py](file:///Users/lzy/pro/solo/workspaces/zy72354/import_service.py) | 导入去重、历史版本追踪 |
| [visualization_review.py](file:///Users/lzy/pro/solo/workspaces/zy72354/visualization_review.py) | 3D/图表展示、复核追溯 |
| [workflow.py](file:///Users/lzy/pro/solo/workspaces/zy72354/workflow.py) | 三步工作流编排、人话错误提示 |
| [main.py](file:///Users/lzy/pro/solo/workspaces/zy72354/main.py) | 演示程序 |
| [test_e2e.py](file:///Users/lzy/pro/solo/workspaces/zy72354/test_e2e.py) | 端到端测试 |

---

## 五、快速运行

```bash
python main.py
```

运行后会演示完整流程：
1. 导入4条手写巡检备注（其中1条缺20分钟，1条没填采样时间）
2. 质检员补看安全阈值表，逐条对比
3. 生成3D复盘图，点击追溯原始数据
4. 修改一条缺时记录，查看改前改后对比
5. 重复导入验证不翻倍
6. 回滚刚才的修改

---

## 六、运行测试

```bash
python test_e2e.py -v
```

测试覆盖所有核心场景：
- 采样时间缺半小时的判定
- 重复导入不翻倍
- 单条修改历史追踪
- 3D图表点击追溯
- 修改和回滚流程
- 完整三步工作流

---

## 七、边界规则速查表

```
采样时长 < 30分钟 → 待复核（不许自动归正常）
  ├─ 怎么判：看 end - start < 30 → 标红 + 人话提示
  ├─ 怎么改：先查备注/阈值 → 修改 → 留历史
  └─ 怎么回滚：版本快照 → 一键回退 → 留痕

重复导入同一批备注 → 哈希比对 → 跳过不翻倍

单条改备注 → 生成版本记录 → 改前改后一目了然

3D/图表点击 → 不能只剩画面 → 必须能跳回备注/阈值表

所有错误提示 → 说人话 → 不许吐字段名
```
