# 医疗问答安全回放系统

## 核心设计原则

> **结论可以简单，证据链不能断。**
>
> 人工改判表里的结论不能直接照抄作为最终结论。产品经理追问时，要能回到原始行号、看到人工改动、追溯每一步处理状态。

---

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python app.py
```

访问：http://localhost:5000

---

## 边界规则（代码固化，不只靠口头约定）

所有边界规则都写在代码里（`models.py`），同时记录在此文档中。

### 规则 1：REF_404_PASS - 引用链接 404 仍被判通过

**触发条件：**
- 样本的 `reference_url_status` = `404`
- 且 `manual_conclusion` = `通过`

**处理策略（代码中硬编码）：**
1. ✅ 自动标记为 `pending_product_review`（待产品经理复核）
2. ✅ 自动归入「冲突样本表」
3. ❌ **绝不**直接归入正常样本
4. ❌ **绝不**自动更新状态为已通过

**代码位置：**
- [models.py 第 300-307 行](file:///Users/lzy/pro/solo/workspaces/zy72505/models.py#L300-L307) `_determine_initial_status`
- [models.py 第 310-315 行](file:///Users/lzy/pro/solo/workspaces/zy72505/models.py#L310-L315) `_is_conflict`
- [models.py 第 411-421 行](file:///Users/lzy/pro/solo/workspaces/zy72505/models.py#L411-L421) 实时检测 404 状态

**回滚方式：**
- 产品经理复核后，可在「冲突样本」页操作，标记为通过或驳回
- 所有操作记录在 `review_history` 表中，可追溯

---

### 规则 2：PROMPT_VERSION_MISSING - 提示词版本号缺失

**触发条件：**
- 导入时 `prompt_version` 字段为空

**处理策略：**
1. 自动标记为 `pending_prompt`（待补充提示词版本）
2. 知识库编辑小乔补看后，手动补充版本号
3. 补充后自动流转为 `pending_review`（待审核）

**代码位置：**
- [models.py 第 300-302 行](file:///Users/lzy/pro/solo/workspaces/zy72505/models.py#L300-L302)
- [models.py 第 250-259 行](file:///Users/lzy/pro/solo/workspaces/zy72505/models.py#L250-L259) 补充后的状态流转

---

### 规则 3：CONCLUSION_CONFLICT - 结论冲突

**触发条件：**
- `original_conclusion` != `manual_conclusion`

**处理策略：**
1. 自动标记为 `pending_conflict_review`（待冲突审核）
2. 自动归入「冲突样本表」
3. 产品经理复核确认后，才能更新最终状态

**代码位置：**
- [models.py 第 305-306 行](file:///Users/lzy/pro/solo/workspaces/zy72505/models.py#L305-L306)
- [models.py 第 313-314 行](file:///Users/lzy/pro/solo/workspaces/zy72505/models.py#L313-L314)

---

## 数据模型（证据链完整的关键）

### 1. manual_review_records - 人工改判主表

| 字段 | 说明 | 为什么需要 |
|------|------|------------|
| `batch_id` | 批次ID | 按批次追溯 |
| `original_row_number` | 原始行号 | **对应 Excel 里的行号，产品经理要查原始表时能定位** |
| `question_id` | 问题ID | 关联原始问题 |
| `question` | 问题内容 | 完整留存 |
| `original_conclusion` | 原结论 | 改判前的状态 |
| `manual_conclusion` | 人工改判结论 | 改判后的状态 |
| `manual_remark` | 人工备注 | 改判理由 |
| `prompt_version` | 提示词版本号 | 小乔补看后填写 |
| `reference_url` | 引用链接 | 证据链接 |
| `reference_url_status` | 链接状态 | 200/404/unknown |
| `current_status` | 当前处理状态 | 见下方状态流转 |

**唯一键：** `(batch_id, original_row_number)` → 保证同一批次同一行不会重复导入

---

### 2. review_history - 历史变更记录表

> **产品经理追问时的最终依据。** 改前改后，一目了然。

| 字段 | 说明 |
|------|------|
| `record_id` | 关联主表记录 |
| `field_name` | 变更的字段名 |
| `old_value` | 改前值 |
| `new_value` | 改后值 |
| `operator` | 操作人 |
| `changed_at` | 变更时间 |

**示例：** 小乔补了一条备注
- `field_name`: `manual_remark`
- `old_value`: `(空)`
- `new_value`: `提示词版本号已核对，v2.3.1`
- `operator`: `小乔`

---

### 3. conflict_samples - 冲突样本表

专门存放需要产品经理复核的样本，不与正常样本混在一起。

| 字段 | 说明 |
|------|------|
| `record_id` | 关联主表记录 |
| `conflict_type` | 冲突类型（REF_404_PASS / CONCLUSION_CONFLICT / OTHER） |
| `product_review_status` | 产品经理复核状态（pending/approved/rejected） |
| `product_remark` | 产品经理复核意见 |

---

### 4. import_batches - 导入批次表

记录每次导入的批次信息，便于追溯。

---

### 5. boundary_rules - 边界规则配置表

所有边界规则的配置，可在代码里查看，也可在首页查看。

---

## 状态流转图

```
pending_prompt (待补充提示词版本)
        │
        ▼  小乔补充版本号
pending_review (待审核)
        │
        ├─ 发现链接404且结论通过 → pending_product_review → 产品经理复核 → reviewed / rejected
        │
        └─ 原结论与人工结论冲突 → pending_conflict_review → 产品经理复核 → reviewed / rejected
```

状态列表：
- `pending_prompt` - 待补充提示词版本
- `pending_review` - 待审核
- `pending_product_review` - 待产品经理复核
- `pending_conflict_review` - 待冲突审核
- `reviewed` - 已复核
- `rejected` - 已驳回

---

## 三步标准操作流程

### 第一步：第一次导入人工改判表

**操作路径：** 顶部导航 → 导入

1. 填写批次ID（例如：`20240607_医疗QA_第3批`）
2. 上传 Excel / CSV 文件
3. 点击「开始导入」

**系统自动做什么：**
- ✅ 记录每条数据的**原始行号**（对应 Excel 行号）
- ✅ 检查提示词版本号，缺失则标记为 `pending_prompt`
- ✅ 检查引用链接状态，404 且结论为"通过" → 自动标记为 `pending_product_review`
- ✅ 检查原结论与人工结论是否冲突，冲突 → 归入冲突样本表
- ✅ 所有导入记录写入 `review_history`，留痕可追溯

---

### 第二步：知识库编辑小乔补看提示词版本号

**操作路径：** 顶部导航 → 记录 → 筛选状态「待补充提示词版本」

1. 逐条点击「查看证据」
2. 在「编辑记录」区域填写提示词版本号
3. 操作人填「小乔」
4. 点击「保存修改」

**系统自动做什么：**
- ✅ 记录状态自动从 `pending_prompt` 流转为 `pending_review`
- ✅ `review_history` 记录：改前（空）→ 改后（版本号），操作人小乔
- ✅ 如果此时检测到链接 404，自动升级为待产品经理复核

---

### 第三步：产品经理复核冲突样本表

**操作路径：** 顶部导航 → 冲突样本

1. 查看所有待复核的样本
2. 点击「复核」按钮
3. 选择复核结论（确认通过 / 驳回）
4. 填写复核意见
5. 点击「提交复核」

**系统自动做什么：**
- ✅ 更新 `conflict_samples` 表的复核状态
- ✅ 同步更新主表的 `current_status`
- ✅ 所有操作写入 `review_history`

---

## 去重机制

**问题：** 重复导入同一批人工改判表，数量会翻倍吗？

**答案：不会。**

实现方式：
- 主表的唯一键是 `(batch_id, original_row_number)`
- 同一批次ID重复导入时：
  - 对于已存在的行号：逐字段对比，只更新有变化的字段
  - 对于新增的行号：正常插入
  - 所有更新操作都记录在 `review_history` 中

代码位置：
- [models.py 第 205-297 行](file:///Users/lzy/pro/solo/workspaces/zy72505/models.py#L205-L297) `_update_existing_batch`

---

## 历史追溯

**问题：** 小乔只改了一条备注，历史里能看出改前改后的差别吗？

**答案：能，而且比你想要的更详细。**

每条记录的详情页（`/record/<id>`）底部都有「历史变更记录」表格，**六要素完整**：
1. 变更时间
2. 谁改的（操作人）
3. 改了什么字段
4. **改前文本**（红色）
5. **改后文本**（绿色）
6. **为什么改**（修改原因，必填项）

小乔改备注时，需要在「为什么改」里填理由（比如"质控复核时发现结论没问题，但备注不完整，补充低盐建议"），产品经理追问时一目了然。

---

## 批次回滚（人工改判表第一次导入支持回滚）

### 场景 1：重传了同一批，想撤销重传的改动
进入「批次详情」页 → 选择「① 清除重复导入痕迹，回滚到首次导入状态」→ 填写处理人和回滚原因 → 执行。

效果：
- 所有记录恢复到**第一次导入时**的内容和状态
- 重传造成的更新全部撤销
- 回滚前后的**完整 JSON 快照**（每条记录的所有字段）+ 回滚原因 + 处理人，全部存入 `batch_rollback_log`，产品经理可以从历史里查出来

### 场景 2：整个批次导错了，彻底删除
选择「② 彻底删除本批次」。

效果：
- 批次元数据、所有记录、历史、冲突样本，全部从主表删除
- **但回滚日志仍然保留**（证据链不能断）

---

## 重复导入不翻倍，历史批次和本次重传分清

### 去重键
`(batch_id, original_row_number)` —— 同一批次ID + 同一 Excel 行号，只保留一条。

### 重复导入时的统计
第二次重传同一批次时，系统会逐行对比，返回三个统计数字：
- **inserted（新增）**：上一次没有的行号，正常插入
- **updated（更新）**：内容有变化的行，逐字段更新并写入 `review_history`（操作人标记为 `reimport`）
- **unchanged（未变化）**：完全一样的行，不动

这样小乔即使重传 10 次，记录数也不会从 3 变成 30。历史变更里会明确区分：
- `initial_import` 操作人 = 首次导入
- `reimport` 操作人 = 重传时更新

---

## 三步流程的状态流转

### 第二步「知识库编辑小乔补看提示词版本号」完整逻辑

**状态优先级（从高到低）：**
1. `pending_product_review` — 引用链接 404 但结论通过（边界规则最高优先级，留给产品经理）
2. `pending_conflict_review` — 原结论与人工结论不一致
3. `pending_prompt` — 提示词版本号缺失
4. `pending_review` — 其他都正常，待审核

**补填版本号后会发生什么：**
小乔在详情页填完 `prompt_version` 后，保存时系统会：
1. 写入该字段的改前改后 + 操作人 + 原因
2. **重新评估完整状态**（而不是盲转 `pending_review`）
3. 如果新状态和旧状态不一样，额外写入一条 `current_status` 流转记录
4. 检测到 404 / 结论冲突时，自动补加到冲突样本表

举三个例子：
| 初始状态 | 小乔做了什么 | 补完后的状态 |
|----------|-------------|-------------|
| pending_prompt | 填版本号，链接200，结论一致 | pending_review ✅ |
| pending_prompt | 填版本号，链接**404**且结论通过 | pending_product_review ✅（不急着归正常） |
| pending_product_review（已经是边界规则） | 填版本号 | pending_product_review ✅（维持边界拦截） |

---

## API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/statistics` | GET | 获取统计数据 |
| `/api/boundary-rules` | GET | 获取边界规则列表 |

---

## 文件结构

```
.
├── app.py              # Flask 应用入口，路由和视图
├── models.py           # 数据模型和核心业务逻辑（边界规则在这里）
├── requirements.txt    # 依赖清单
├── README.md           # 本文档（边界规则也写在这里）
├── medical_review.db   # SQLite 数据库（自动创建）
├── uploads/            # 上传文件存放目录（自动创建）
└── templates/          # HTML 模板
    ├── base.html
    ├── index.html      # 概览页
    ├── import.html     # 导入页
    ├── records.html    # 记录列表
    ├── record_detail.html  # 记录详情（证据链）
    ├── conflicts.html  # 冲突样本表
    └── workflow.html   # 三步流程说明
```

---

## 测试验证

运行测试脚本验证核心功能：

```bash
python test_system.py
```

测试内容包括：
1. 导入新批次
2. 重复导入（去重验证）
3. 小乔补充提示词版本号
4. 404 链接自动标记
5. 冲突样本生成
6. 产品经理复核流程
7. 历史变更记录追溯

---

## 注意事项

1. **人工改判表里的结论不能直接照抄作为最终结论。** 要走完三步流程，经过复核。
2. **引用链接 404 但人工判了通过的，千万别手动绕过复核流程。** 代码里已经做了拦截，按规则来。
3. **所有操作都留痕。** 不要直接改数据库，通过界面操作才能保证历史记录完整。
4. **边界规则改了之后，记得同时更新：**
   - `models.py` 里的代码逻辑
   - `boundary_rules` 表的数据
   - 本文档（README.md）
