# 智能质检漏检复盘系统

## ⚠️ 边界规则（必须严格遵守）

### 1. 数据完整性规则

**提示词版本号备注保留原则**
- **禁止**将 `raw_remark` 字段清洗成"干净数据"。备注是标注负责人周姐的重要工作痕迹
- 导入时自动识别所有包含 "remark"、"备注"、"note" 关键词的列，完整保留在 `raw_remark` 字段中
- 代码位置：[import_service.py#L150-L155](file:///Users/lzy/pro/solo/workspaces/zy72524/services/import_service.py#L150-L155)

**去重导入机制**
- 重复导入同一文件（基于 SHA256 文件哈希）会被拒绝，不会造成样本数量翻倍
- **业务批次识别（修复 Bug 2）**：按 `sheet_name` 业务批次名识别同一批次，改备注后重新导入不会创建新批次
  - 三级判断逻辑：完全相同哈希 → 拒绝；同名批次 → 更新；否则 → 新建
  - 已存在的样本：对比字段变化，备注变更逐条记录 `old_value` / `new_value`
  - 新增的样本：正常添加
  - 版本号自动 +1，历史版本保留可追溯
  - 代码位置：[import_service.py#L25-L30](file:///Users/lzy/pro/solo/workspaces/zy72524/services/import_service.py#L25-L30)、[import_service.py#L46-L66](file:///Users/lzy/pro/solo/workspaces/zy72524/services/import_service.py#L46-L66)
- `file_hash` 取消 unique 约束，支持同一批次多次更新时哈希变化
  - 代码位置：[models.py#L36](file:///Users/lzy/pro/solo/workspaces/zy72524/models.py#L36)

### 2. 低置信度样本处理规则

**判定规则：被平均指标盖住的样本**
- 当单样本置信度 < 阈值（默认 0.7），但整批平均置信度 ≥ 阈值时，标记 `masked_by_average = True`
- 这类样本**不得**被自动归为"正常"，必须由知识库编辑人工复核
- 代码位置：[confidence_service.py#L43-L82](file:///Users/lzy/pro/solo/workspaces/zy72524/services/confidence_service.py#L43-L82)

**修改规则：知识库编辑复核**
- 只有角色为 `kb_editor` 的用户可以对低置信度样本做最终判定
- 复核后状态变更必须记录完整历史
- 代码位置：[confidence_service.py#L85-L113](file:///Users/lzy/pro/solo/workspaces/zy72524/services/confidence_service.py#L85-L113)

**回滚规则**
- 任何状态变更都支持回滚
- 回滚基于 `SampleChangeHistory` 中上一条记录的 `old_status`
- 回滚操作本身也会被记录为一条历史
- 代码位置：[confidence_service.py#L116-L148](file:///Users/lzy/pro/solo/workspaces/zy72524/services/confidence_service.py#L116-L148)

### 3. 工作流规则（三步必须按顺序）

```
Step 1: 人工改判表导入
    ↓ （标注人员 / 标注负责人）
Step 2: 标注负责人补看提示词版本号
    ↓ （必须是标注负责人周姐，且所有低置信度样本已由知识库编辑复核）
Step 3: 模型版本对比更新
    ↓
完成
```

**Step 1 - 导入**
- 角色：`annotator` 或 `lead_annotator`
- 自动触发低置信度检测和平均掩盖检测

**步骤流转强制按顺序（修复 Bug 1）**
- **禁止跳步**：必须严格按 Step1 → Step2 → Step3 顺序推进
- 前置检查：推进 Step N 时，Step 1..N-1 必须全部标记为 `completed = True`
- 跳步时 API 返回 `ok=False`，错误信息明确提示"必须按顺序推进"
- 代码位置：[workflow_service.py#L39-L49](file:///Users/lzy/pro/solo/workspaces/zy72524/services/workflow_service.py#L39-L49)

**Step 2 - 提示词补看**
- 角色：**仅** `lead_annotator`（标注负责人周姐）
- **前置检查**：所有 `status = 'low_confidence'` 的样本必须已完成知识库复核
- 代码位置：[workflow_service.py#L69-L75](file:///Users/lzy/pro/solo/workspaces/zy72524/services/workflow_service.py#L69-L75)

**Step 3 - 模型更新**
- 角色：`kb_editor` 或 `lead_annotator`

### 4. 可视化证据链规则

**图表 / 3D 展示必须附带追溯链接**
- 置信度分布图中每一个柱子，点击后必须能看到该区间内的**所有样本明细**
- **真实下钻（修复 Bug 3）**：前端缓存完整样本列表，不是 alert 占位符
  - 点击柱子弹出 `showBinSamples` 函数渲染真实明细表格
  - 每个样本包含：
    - 🔗 回到人工改判表的链接：`/api/sheets/{sheet_id}`
    - 🔗 提示词版本号链接：`/api/prompts/{prompt_id}`
    - 🔗 完整变更历史：`/api/samples/{id}/history`
    - 🔗 回滚入口：`/api/samples/{id}/rollback`
  - 后端 `cachedConfidenceData` 缓存后端返回的完整数据用于下钻
  - 代码位置：[visualization_service.py#L82-L113](file:///Users/lzy/pro/solo/workspaces/zy72524/services/visualization_service.py#L82-L113)、[index.html#L321-L378](file:///Users/lzy/pro/solo/workspaces/zy72524/templates/index.html#L321-L378)
- 后端返回的每个区间包含完整样本列表，每个样本带所有证据链接

**禁止**：只展示漂亮的聚合指标，无法下钻到原始证据。

### 5. 历史可追溯规则

**单条备注修改可对比**
- 当周姐只改了一条备注时，`SampleChangeHistory` 会记录 `change_type = 'remark_update'`
- 通过 `/api/samples/{id}/history` 可以看到改前 `old_value` 和改后 `new_value` 的完整对比
- 代码位置：[import_service.py#L206-L217](file:///Users/lzy/pro/solo/workspaces/zy72524/services/import_service.py#L206-L217)

**不允许口头约定**
- 本 README 和代码是唯一的规则来源
- 任何流程变更必须同时更新代码和本文档

---

## 快速开始

### 安装依赖

```bash
pip install -r requirements.txt
```

### 启动服务

```bash
python app.py
```

访问 http://localhost:5001

### 测试数据准备

创建一个 Excel 文件，包含以下列（列名可灵活匹配）：
- `original_text` - 原始文本
- `model_prediction` - 模型预测结果
- `model_confidence` - 模型置信度（0-1）
- `manual_label` - 人工标注
- `备注` / `remark_*` - 任意数量的备注列（会被完整保留）

---

## API 参考

### 导入改判表
```
POST /api/sheets/import
Content-Type: multipart/form-data
- file: Excel文件
- sheet_name: 表名
- imported_by: 导入人
```

### 获取样本历史
```
GET /api/samples/{id}/history
```

### 知识库编辑复核
```
POST /api/samples/{id}/kb-review
{
    "kb_editor": "编辑姓名",
    "decision": "false_negative | normal | false_positive",
    "remark": "复核意见"
}
```

### 回滚样本状态
```
POST /api/samples/{id}/rollback
{
    "rolled_by": "操作人",
    "reason": "回滚原因"
}
```

### 推进工作流
```
POST /api/workflows/{sheet_id}/complete-step
{
    "step_name": "step1_import | step2_review_prompt | step3_model_update",
    "completed_by": "操作人",
    "user_role": "annotator | lead_annotator | kb_editor"
}
```

### 可视化数据
- 置信度分布：`GET /api/visualization/confidence-distribution/{sheet_id}`
- 状态汇总：`GET /api/visualization/status-summary/{sheet_id}`
- 被平均掩盖的样本：`GET /api/visualization/masked-samples/{sheet_id}`

---

## 数据模型

### ManualCorrectionSheet - 人工改判表
- `file_hash`: SHA256 文件哈希，用于去重（非 unique，支持同一批次多次更新）
- `version`: 版本号，重新导入时递增
- `is_current`: 是否为当前版本
- `change_history_count`: 该批次的备注变更历史总数

### ReviewSample - 复盘样本
- `unique_key`: 基于内容的 MD5，同表内唯一
- `raw_remark`: 原始备注，**不清洗**
- `is_low_confidence`: 是否低置信度
- `masked_by_average`: 是否被平均指标盖住
- `kb_reviewed`: 是否已由知识库编辑复核

### SampleChangeHistory - 样本变更历史
- 记录每一次字段修改、状态变更、回滚
- 包含 `old_value` / `new_value` 对比

### PromptVersion - 提示词版本
- `remark`: 标注负责人的备注

---

## 配置项

在 [config.py](file:///Users/lzy/pro/solo/workspaces/zy72524/config.py) 中修改：

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `LOW_CONFIDENCE_THRESHOLD` | 0.7 | 低于此值判定为低置信度 |
| `REVIEW_WORKFLOW_STEPS` | 3步 | 工作流步骤定义 |

---

## 🔧 更新日志

### v1.1 - 核心 Bug 修复

**Bug 1：步骤流转不严格，未完成 Step1 可推进 Step2**
- 根因：`can_advance_step` 仅检查 `target_idx == current_idx + 1`，未检查前置步骤 `completed` 标志
- 修复：新增 for 循环遍历前置步骤，检查 `step1_completed` / `step2_completed` / `step3_completed`
- 代码：[workflow_service.py#L39-L49](file:///Users/lzy/pro/solo/workspaces/zy72524/services/workflow_service.py#L39-L49)

**Bug 2：同名改判表改备注后重新导入创建新批次**
- 根因：仅按 `file_hash` 匹配，改备注后哈希变化，走新建分支
- 修复：新增 `get_existing_batch_by_name` 按业务批次名识别，三级判断逻辑
  - 完全相同哈希 → 拒绝
  - 同名批次 → 更新，统计 `remark_changed_count`
  - 否则 → 新建
- 额外修复：移除 `ManualCorrectionSheet.file_hash` 的 `unique=True` 约束
- 代码：[import_service.py#L25-L66](file:///Users/lzy/pro/solo/workspaces/zy72524/services/import_service.py#L25-L66)、[models.py#L36](file:///Users/lzy/pro/solo/workspaces/zy72524/models.py#L36)

**Bug 3：低置信度图表点击柱子只弹 alert，没有真实下钻**
- 根因：前端 `showBinSamples` 函数仅调用 `alert`，未使用后端返回的样本数据
- 修复：
  - 前端新增 `cachedConfidenceData` 缓存完整图表数据
  - 新增 `drilldownModal` 模态框展示真实明细表格
  - 每个样本带 4 个证据追溯链接（改判表、提示词、变更历史、回滚）
  - 新增 `fetchPrompt` 函数处理提示词链接点击
- 代码：[index.html#L321-L378](file:///Users/lzy/pro/solo/workspaces/zy72524/templates/index.html#L321-L378)

**验证**
- 单元测试：`python3 run_test.py` 全部 6 项通过
- 端到端测试：`python3 e2e_test.py` 完整流程验证通过
- 浏览器集成：服务运行在 http://localhost:5001，图表下钻、备注变更、步骤流转全部正常

---

## 设计哲学

> "我不介意界面简单，怕的是结论看着很满，追证据时断在半路。"

- 证据链优先于美观
- 可追溯优先于聚合指标
- 明确规则优先于口头约定
- 人工复核优先于自动判定（尤其对于低置信度样本）
