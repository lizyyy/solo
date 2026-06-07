# 招聘简历匹配解释系统

## 一、系统概述

本系统用于管理招聘简历与职位的匹配解释，支持提示词版本管理、人工改判、知识库引用关联、评测报告生成等功能。

**核心角色**：
- 知识库编辑（小乔）：管理提示词版本、知识库引用链接及备注
- 安全审核同事：复核人工改判被批跑覆盖的记录
- 系统管理员：执行批跑、生成评测报告

---

## 二、边界规则（核心！）

### 规则1：人工改判被批跑覆盖的处理

**场景**：某条匹配解释已被人工改判，下一次系统批跑时重新生成了解释。

**处理流程**：
```
人工改判 → 批跑覆盖 → 标记为「待复核」→ 安全审核同事操作
                                      ├─ 通过 → 保留批跑结果
                                      └─ 驳回 → 回滚到人工改判值
```

**具体规则**：
1. 批跑时检测到记录有未被覆盖的人工改判，自动将状态设为 `OVERRIDDEN_BY_BATCH`（被批跑覆盖）
2. 设置 `needs_review = True`，记录进入待复核列表
3. **严禁**直接将此类记录标记为「正常」，必须经安全审核同事复核
4. 原始人工改判值保留在 `manual_overrides` 表中，随时可回滚

**相关代码**：
- [MatchExplanationService.batch_run_update](file:///Users/lzy/pro/solo/workspaces/zy72504/services.py#L255-L332)
- [MatchExplanationService.review_override](file:///Users/lzy/pro/solo/workspaces/zy72504/services.py#L397-L448)

---

### 规则2：重复导入提示词版本号不翻倍

**场景**：知识库编辑小乔重复导入同一批提示词版本。

**处理规则**：
1. 以 `version_number` 为唯一键，已存在的版本号直接跳过，不创建新记录
2. 批量导入返回结果明确区分「已创建」和「已跳过」
3. 提示词内容变更必须使用新的版本号，不允许修改已有版本的内容

**相关代码**：
- [PromptVersionService.import_version](file:///Users/lzy/pro/solo/workspaces/zy72504/services.py#L33-L74)
- [PromptVersionService.batch_import](file:///Users/lzy/pro/solo/workspaces/zy72504/services.py#L76-L112)

---

### 规则3：历史记录可追溯，改前改后清晰可见

**场景**：知识库编辑小乔只修改了一条备注，需要查看变更前后对比。

**处理规则**：
1. 每次字段变更都记录 `old_value` 和 `new_value`
2. 生成人类可读的 `diff_summary`（如：备注: '旧备注' → '新备注'）
3. 备注修改单独标记 `change_type = REMARK_CHANGE`，便于筛选
4. 历史记录不可删除、不可修改，保证审计完整性
5. 按时间倒序展示，最新变更在最前

**相关代码**：
- [ChangeHistoryService.record_change](file:///Users/lzy/pro/solo/workspaces/zy72504/services.py#L135-L169)
- [ChangeHistoryService._generate_diff_summary](file:///Users/lzy/pro/solo/workspaces/zy72504/services.py#L171-L178)

---

### 规则4：3D/图表展示可追溯源数据

**场景**：使用3D或图表展示匹配数据时，点击数据点需能溯源。

**处理规则**：
1. 每个展示的数据点必须绑定 `match_explanation_id`
2. 通过该 ID 可查找到：
   - 关联的提示词版本号（`prompt_version.version_number`）
   - 关联的知识库引用链接（`knowledge_base_refs.ref_link`）
   - 完整的变更历史记录
3. 禁止只展示漂亮画面而丢失数据溯源能力

**相关代码**：
- [MatchExplanation 模型关联](file:///Users/lzy/pro/solo/workspaces/zy72504/models.py#L66-L99)

---

### 规则5：错误提示说人话，不吐内部字段名

**场景**：用户操作出错时，错误信息要友好易懂。

**处理规则**：
1. 所有业务异常继承 `ResumeMatchingError`，包含 `user_message`（人话）和 `detail`（技术细节）
2. 前端展示时使用 `user_message`，不暴露内部字段名
3. 示例：
   - ❌ 错误：`field 'prompt_version_id' cannot be null`
   - ✅ 正确：`请选择提示词版本，这是必填项。`

**相关代码**：
- [errors.py 所有异常类](file:///Users/lzy/pro/solo/workspaces/zy72504/errors.py)
- [get_user_friendly_error()](file:///Users/lzy/pro/solo/workspaces/zy72504/errors.py#L84-L87)

---

### 规则6：三步流程串联，中间异常留待复核

**标准三步流程**：
1. **提示词版本号第一次导入** → 创建 `PromptVersion` 记录
2. **知识库编辑小乔补看知识库引用链接** → 创建/关联 `KnowledgeBaseRef`
3. **评测报告更新** → 生成当日 `EvaluationReport`

**边界规则**：
- 流程中间如碰到人工改判被批跑覆盖，**别急着归正常**
- 自动加入待复核列表，留给安全审核同事处理
- 三步流程执行结果中包含 `pending_review` 字段，列出所有待复核项

**相关代码**：
- [WorkflowService.run_three_step_workflow](file:///Users/lzy/pro/solo/workspaces/zy72504/services.py#L764-L819)

---

### 规则7：知识库备注修改影响评测报告

**场景**：知识库编辑小乔只改了知识库引用链接的备注。

**处理规则**：
1. 修改备注时，所有关联了该知识库引用的匹配解释都记录变更历史
2. 当日评测报告中：
   - 统计受备注修改影响的记录数量（`remark_change_count`）
   - 在评测明细中逐条列出，标记 `needs_review = True`
   - 备注说明：「知识库备注已修改，请安全审核同事复核」
3. 方便安全审核同事当天完成复核

**相关代码**：
- [KnowledgeBaseService.update_remark](file:///Users/lzy/pro/solo/workspaces/zy72504/services.py#L549-L589)
- [EvaluationService.generate_daily_report](file:///Users/lzy/pro/solo/workspaces/zy72504/services.py#L639-L737)

---

## 三、状态流转图

```
              正常 (normal)
                  │
                  ▼
          人工改判 (manual_overridden)
                  │
          ┌───────┴───────┐
          ▼               ▼
    批跑覆盖         回滚 (rolled_back)
(overridden_by_batch)
          │
     ┌────┴────┐
     ▼         ▼
  审核通过   审核驳回
(approved) (rejected → 回到人工改判)
```

---

## 四、快速开始

### 安装依赖

```bash
pip install -r requirements.txt
```

### 初始化数据库

```python
from services import init_database
init_database()
```

### 运行演示

```bash
python demo.py
```

---

## 五、核心 API 一览

| 服务类 | 方法 | 用途 |
|--------|------|------|
| PromptVersionService | import_version | 导入提示词版本 |
| | batch_import | 批量导入（跳过重复） |
| MatchExplanationService | create_explanation | 创建匹配解释 |
| | create_manual_override | 人工改判 |
| | batch_run_update | 批跑更新（处理覆盖） |
| | review_override | 安全审核复核 |
| | rollback_override | 回滚人工改判 |
| | get_pending_review | 获取待复核列表 |
| KnowledgeBaseService | update_remark | 修改备注（记录影响） |
| | link_to_explanation | 关联到匹配解释 |
| EvaluationService | generate_daily_report | 生成每日评测报告 |
| WorkflowService | run_three_step_workflow | 执行三步标准流程 |
| ChangeHistoryService | get_history_for_explanation | 查看变更历史 |

---

## 六、数据表说明

| 表名 | 说明 |
|------|------|
| prompt_versions | 提示词版本库 |
| knowledge_base_refs | 知识库引用链接 |
| match_explanations | 匹配解释主表 |
| manual_overrides | 人工改判记录（含原始值） |
| rollback_records | 回滚操作记录 |
| change_history | 所有变更的审计日志 |
| evaluation_reports | 评测报告主表 |
| evaluation_items | 评测报告明细 |

---

## 七、注意事项

1. **所有边界规则都在代码中强制实现**，不靠口头约定
2. 关键操作都有历史记录，可审计可追溯
3. 人工改判被批跑覆盖是最高优先级的待复核项
4. 错误提示要面向用户，不暴露技术细节
5. 知识库备注修改不算小改动，会影响评测报告
