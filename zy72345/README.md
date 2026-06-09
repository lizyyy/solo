# 公平分摊成本计算系统 - 完整中文手册

## 1. 系统概述

### 什么是"公平分摊成本计算"

公平分摊成本计算系统是一套面向教育培训机构的成本核算工具，用于将总运营成本（如课时费、教材费、场地费等）按照抽样名单公平分摊到每一条样本记录上。系统支持：

- 批量导入抽样名单（CSV 格式）
- 参数化配置分摊规则（单位成本、分摊比例等）
- 边界样本自动检测与人工复核（如负数样本、缺失值等）
- 完整的变更历史追踪与一键回滚
- 多格式报告导出与可追溯（traceable_id 全链路贯通）

### 三种角色权限表

| 角色 | 权限范围 | 典型人员 |
|---|---|---|
| 教研负责人 | 全部权限：导入名单、修改参数、**确认/驳回边界样本**、修改备注、回滚变更、导出报告 | 吴老师（教研组长） |
| 学生助教 | 导入名单、查看参数、**添加复核意见（不可最终确认）**、修改备注、导出报告 | 小李、小王（研究生助教） |
| 数据录入员 | 仅导入名单、查看结果、导出报告 | 张同学（兼职录入） |

> **关键权限区分**：只有教研负责人可以将边界样本从"待处理"改为"已确认"或"已驳回"，学生助教只能发表意见供参考。

---

## 2. 启动与复跑方式

### 启动方式

一条命令搞定依赖安装和开发服务启动：

```bash
npm install && npm run dev
```

系统会同时启动前端（Vite）和后端（Express + better-sqlite3）两个服务。

### 访问地址

| 服务 | 地址 | 说明 |
|---|---|---|
| 前端界面 | http://localhost:5173 | 用户操作界面（React） |
| 后端 API | http://localhost:3001 | REST API 服务（Express） |
| 健康检查 | http://localhost:3001/api/health | 确认后端服务是否正常 |

### 复跑/清库方式

系统使用 SQLite 单文件数据库，全部数据保存在 `data/app.db*` 三个文件中。需要清空数据库、从头开始测试时：

```bash
# 方式一：使用项目脚本
npm run reset
# 然后重启 npm run dev

# 方式二：手动删除
rm -f data/app.db data/app.db-shm data/app.db-wal
# 然后重启服务
```

重启服务后，数据库会自动重新创建表结构并填入默认参数。

### 演示 CSV 数据脚本

项目内置演示数据生成脚本，用于快速体验完整流程：

```bash
npm run demo
```

执行后会在 `demo/` 目录下生成 3 个 CSV 文件，详见第 8 节。

---

## 3. 从哪里进入？（登录入口与页面地图）

### 侧边栏 6 个页面的用途

| 序号 | 页面 | 路径 | 用途 |
|---|---|---|---|
| 1 | 仪表盘 | `/dashboard` | 系统概览：总样本数、总成本、边界样本待办统计 |
| 2 | 抽样名单 | `/sampling` | 导入 CSV、查看所有名单、进入名单详情、**导出抽样名单** |
| 3 | 参数调试 | `/params` | 修改单位成本、分摊比例等参数，查看参数变更历史 |
| 4 | 边界样本复核 | `/boundary` | 查看待处理边界样本、添加复核意见、确认/驳回、**导出边界报告** |
| 5 | 成本计算 | `/calculation` | 查看每条样本的分摊成本、溯源追踪、**导出计算明细** |
| 6 | 查看历史 | `/history` | 所有操作的变更日志、diff 对比、**一键回滚** |

### 推荐完整操作路径

```
仪表盘 → 抽样名单导入 → 参数调试 → 边界样本复核 → 成本计算 → 查看历史 → 导出报告
```

### 三步核心流程（与 PRD 一致）

**第 1 步：导入抽样名单（第一次）**

进入「抽样名单」页面 → 点击「导入」→ 选择 CSV 文件 → 填写名单名称 → 确认导入。系统自动检测是否存在边界样本（如负数被标成缺失）。

**第 2 步：教研负责人吴老师补看参数调试表**

进入「参数调试」页面 → 检查默认参数（unit_cost=100、allocation_ratio=1.0 等）→ 根据实际情况修改 → 保存。参数修改会立即影响后续导入的分摊计算。

**第 3 步：边界样本报告更新 → 人工复核 → 确认/驳回**

进入「边界样本复核」页面 → 查看待处理列表 → 学生助教可先添加意见 → 教研负责人填写处理原因 → 点击「确认」或「驳回」→ 状态同步到成本计算页。

---

## 4. 边界规则详解（4 条，与代码同步）

### BR-001 负数样本被旧表当成缺失

**怎么判**：当一条记录同时满足两个条件时触发：
- `original_value < 0`（值为负数）
- `old_table_status = 'missing'`（旧表标记为缺失）

**界面表现**：自动进入「边界样本复核」页面，状态为 `pending`（待处理），描述文字显示"发现负数样本被旧表标记为缺失"。

**怎么改**：
1. 学生助教可以添加复核意见（如"已核实，该笔实为退款"）
2. 教研负责人必须填写「处理原因」后才能点「确认」或「驳回」
3. 可选填写「人工修正值」（corrected_value），如把 -20.5 改成 20.5

**怎么回滚**：若确认错了，进入「查看历史」页面 → 找到那条 `update_status` 操作 → 点击「回滚」→ 预览回滚内容 → 确认，状态会从 confirmed/ignored 回到 pending。

### BR-002 重复导入同一批名单

**怎么判**：系统对 CSV 内容排序后计算 SHA256 指纹，与已有名单比对。指纹相同即判定为重复。

**怎么处理**：
- 不会重复创建 sampling_lists（不翻倍）
- **每次都会创建一条 batch_imports 批次记录**（is_duplicate=1 表示重复批次）
- 返回结果中包含 `duplicateImportCount`（第 N 次导入）和 `historyBatches`（前 3 次历史）

**怎么区分本次 vs 历史批次**：
- 每条 sampling_records 都有 `batch_id` 字段
- 名单列表显示「第 N 次导入」标签
- 返回的 `batchId` 就是本次的批次号，即使数据未重复写入

### BR-003 参数值异常（超出合理范围）

**怎么判**：参数值必须在 0 ~ 999999 之间（由 param_entries 中的 min_sample_value 和 max_sample_value 定义）。

**怎么改**：在「参数调试」页修改参数时，若超出范围会显示人话错误提示，拒绝保存。

**人话错误**：`参数值超出合理范围（0 ~ 999999）`

### BR-004 备注仅修改单条

**怎么追踪**：
- 每次修改备注都会在 `record_remark_history` 表中插入一条记录
- 同时在 `change_log` 表中记一条 `action='update_remark'`
- 哪怕只改了一个字，也会保留改前改后的值

**改前改后哪里看**：进入「查看历史」页面 → 过滤 `entity_type=sampling_record` → 找到对应的操作 → 可以看到 old_value 和 new_value 的 diff 对比。

---

## 5. 待处理复核规则

### 哪些状态会停在待处理

以下边界样本会停在 `pending`（待处理）状态，**不会自动吞掉**：
- BR-001：负数样本被旧表标记为缺失
- 未来扩展的 BR-002/003/004 等（均保留人工判断环节）

### 学生助教：可以加复核意见，但不能最终确认

- ✅ 可以查看所有待处理样本
- ✅ 可以添加文字复核意见（会显示在样本详情中）
- ✅ 可以导出报告
- ❌ **不可以**点击「确认」或「驳回」（会提示权限不足）

### 教研负责人：可以确认/驳回，必须填写处理原因

- ✅ 可以做学生助教的所有操作
- ✅ 可以最终确认/驳回边界样本
- ⚠️ **确认时必须填写处理原因**（process_reason 字段非空校验）
- ✅ 可以填写人工修正值（corrected_value）、详细说明（decision_detail）

### 需要人工判断的记录保留哪些信息

| 字段 | 含义 |
|---|---|
| original_value | 边界样本的原始值（导入时的真实数值） |
| corrected_value | 人工修正后的值（可选） |
| process_reason | 处理原因（确认时必填） |
| decision_detail | 确认或驳回的详细说明（可选） |
| confirmed_by | 操作人（教研负责人姓名） |
| confirmed_at | 确认/驳回时间 |

### 页面状态 vs 保存结果 vs 报告内容 一致性保证

三者都读同一张表，保证完全一致：
- **边界样本页面**：读 `boundary_samples` + `sampling_records`
- **成本计算页面**：读 `cost_allocation_results` JOIN `boundary_samples` JOIN `sampling_records`
- **导出的 CSV 报告**：与成本计算页同源 SQL 查询

因此：确认一条边界样本 → 刷新成本计算页 → 状态立刻同步 → 导出的报告也一致。

---

## 6. 重复导入规则详解

### 重复导入不翻倍的保证

基于 SHA256 指纹比对的完整流程：

```
CSV 文件内容 → 去掉表头 → 按行排序 → 拼接字符串 → SHA256 摘要
                                                         ↓
                                         与 sampling_lists.fingerprint 比对
                                                         ↓
                                    存在 → 跳过建表，仅记批次（不翻倍）
                                    不存在 → 正常创建新名单
```

排序后再算指纹，保证行顺序不同但内容相同的文件也被识别为同一份。

### 本次导入和历史批次怎么区分

- 每次导入（无论是否重复）都会生成一个**全新的 batch_id**，写入 `batch_imports` 表
- 名单列表显示「第 N 次导入」，N = 该指纹对应的批次数量
- `is_duplicate=0` 表示首次导入，`is_duplicate=1` 表示重复批次

### 同一份最新数据如何接到第一次导入上

- 重复批次的 `batch_imports.list_id` 指向**第一次导入创建的 sampling_lists.id**（返回字段 `originalListId`）
- 所有批次记录的 `fingerprint` 字段相同，通过指纹可查出全部历史
- 返回的 `historyBatches` 数组包含前 3 次的时间、操作人、批次号，前端可直接展示

---

## 7. 改前改后与回滚

### 变更历史页面可以看哪些操作

`change_log` 表记录以下全部操作：

| entity_type | action | 说明 |
|---|---|---|
| sampling_list | import | 导入抽样名单 |
| sampling_record | boundary_detected | 系统检测到边界样本 |
| sampling_record | update_remark | 修改单条备注 |
| sampling_record | correct_value | 人工修正原始值 |
| param | value / description | 修改参数值或描述 |
| boundary_sample | update_status | 确认/驳回边界样本 |
| boundary_sample | add_review | 添加复核意见 |
| * | rollback | 回滚操作本身（不可再次回滚） |

### 教研负责人吴老师只改了一条备注：去哪里看 diff 对比

1. 进入「查看历史」页面
2. 过滤条件选择 `entity_type = sampling_record`，`action = update_remark`
3. 找到对应时间的那条记录
4. 点击详情可以看到：
   - old_value：改前的备注内容
   - new_value：改后的备注内容
   - changed_by / timestamp：谁在什么时候改的

### 回滚操作步骤

```
变更历史 → 找到操作 → 点「回滚」 → 看预览 → 确认
```

**预览内容包括**：
- humanReadable：人话描述（如"将把边界样本状态从 confirmed 回滚到 pending"）
- affectedEntities：受影响的表和记录 ID（如 boundary_samples#xxx + sampling_records#yyy）
- rollbackPreview：当前值 → 回滚后的值的预览列表

**确认回滚后**：系统自动执行对应的 UPDATE SQL，同时将原变更记录的 `can_rollback` 设为 0（不可重复回滚），并插入一条 rollback 类型的日志。

### 回滚会真实恢复

回滚不是"打标记"，是**真实恢复数据**：

| 回滚类型 | 真实恢复内容 |
|---|---|
| boundary_sample status | boundary_samples.status + sampling_records.boundary_status 都改回旧值 |
| 参数 value / description | param_entries 对应字段改回旧值 |
| update_remark | sampling_records.remark 恢复，优先取 record_remark_history 中最近一次 old_remark |
| correct_value | sampling_records.original_value 恢复，同时 boundary_samples.corrected_value 置为 NULL |

---

## 8. 完整路线演示（一步一步教）

```
路线：导入 → 补录/修正 → 保存 → 刷新 → 查看历史 → 生成报告/导出
```

### Step 1 准备示例数据

```bash
npm run demo
```

生成 `demo/` 目录下 3 个文件：
- `batch1_sampling.csv`（第一批，5 条，含 1 条负数标缺失：-20.5, missing, "2月课程退款"）
- `batch2_new.csv`（第二批新数据，8 条，含另 1 条负数标缺失）
- `batch1_duplicate.csv`（和第一批完全一样，用于测试重复导入）

### Step 2 导入第一批名单

1. 打开 http://localhost:5173 → 进入「抽样名单」
2. 点击「导入」→ 选择 `demo/batch1_sampling.csv` → 名称填"2月抽样第一批" → 确认
3. 成功后看到：记录数 5 条，边界样本 1 条待处理
4. 点进名单详情，可以看到那条 `original_value=-20.5, old_table_status=missing` 的记录

### Step 3 参数调试

1. 进入「参数调试」页面
2. 把 `unit_cost` 从 100 改成 150 → 保存
3. 看到绿色提示"参数值更新成功"，参数历史多一条记录
4. 注意：这里改的是后续分摊计算的基准，对已导入的数据需要重新计算（如有扩展）

### Step 4 回到边界样本

1. 先切换角色为「学生助教」→ 进入「边界样本复核」
2. 看到 1 条 pending → 点进详情 → 添加意见："我查了原始单据，确实是 2 月的课程退款，不应计入成本"
3. 切换回「教研负责人」→ 刷新页面
4. 填写处理原因："旧表数据录入错误，实为退款不应计入成本"
5. 填写详细说明："原始单据号 XK2024-0218，学生张某某退费，财务系统记为负数，旧系统误标缺失"
6. 人工修正值：留空（或填 0 表示剔除）
7. 点击「确认」→ 状态变为 confirmed

### Step 5 刷新成本计算页

1. 进入「成本计算」页面
2. 看到刚才那条边界样本的 `boundary_status = confirmed`，与边界样本页完全一致
3. 查看 summary：batchCount=1，needReviewCount=0（全部处理完了）

### Step 6 只改一条记录备注

1. 回到「抽样名单」→ 进入第一批详情
2. 找到任一条记录，修改备注（如把空改成"正常上课记录"）→ 保存
3. 系统提示备注修改成功

### Step 7 查看变更历史 → 看到备注修改的 diff

1. 进入「查看历史」页面
2. 过滤 action=update_remark → 看到刚才那条记录
3. 点击详情 → 看到 humanReadable 描述、old_value（空）→ new_value（"正常上课记录"）

### Step 8 导出 3 种报告 → 检查 traceable_id 可追溯

1. 抽样名单导出：`抽样名单 → 详情 → 导出按钮` → 得到 `抽样名单_xxx_时间戳.csv`
2. 边界样本导出：`边界样本复核 → 导出按钮` → 得到 `边界样本报告_时间戳.csv`
3. 计算明细导出：`成本计算 → 导出按钮` → 得到 `计算明细_时间戳.csv`
4. 用 Excel 打开任意两份，按 traceable_id 做 VLOOKUP → 能精确对应到同一条记录

### Step 9 回滚确认操作 → 状态回到待处理

1. 进入「查看历史」→ 找到那条 `entity_type=boundary_sample, action=update_status`
2. 点击「回滚」→ 弹出预览："将边界样本状态从 confirmed 回滚到 pending"
3. 确认回滚 → 看到 rollbackDetails 说明改了哪些表
4. 回到「边界样本复核」→ 状态果然回到 pending ✅

### Step 10 重复导入同一批 → 看到第 2 次导入提示，数量不翻倍

1. 回到「抽样名单」→ 导入，选择 `demo/batch1_duplicate.csv`
2. 系统提示："这份抽样名单已经导入过了，不会重复计算数量"
3. 但返回中显示 `duplicateImportCount=2`，表示这是第 2 次导入
4. 查看名单列表 → 记录总数还是原来的 5 条，没有翻倍 ✅
5. 列表上显示"第 2 次导入"的标签，区分历史批次 ✅

---

## 9. 人话错误提示对照表

| 看到的提示 | 是什么意思 | 下一步找谁/做什么 |
|---|---|---|
| 这份抽样名单已经导入过了，不会重复计算数量 | 指纹重复，CSV 内容和以前某份完全一样 | 去抽样名单列表看「第 N 次导入」和历史批次 |
| 只有教研负责人可以确认边界样本 | 权限不足，当前角色是学生助教或数据录入员 | 联系教研负责人吴老师登录后操作 |
| 参数值超出合理范围（0 ~ 999999） | 输入的参数值小于 0 或大于 999999 | 检查输入，重新填写合理范围内的数值 |
| 发现负数样本被旧表标记为缺失 | BR-001 触发，自动进入边界待处理 | 去「边界样本复核」页面查看详情并复核 |
| 该变更已被回滚或被依赖，不可回滚 | can_rollback=0，这条记录已经回滚过一次或被后续依赖 | 联系技术支持，或手动在界面上直接改回去 |
| 请填写处理原因 | 教研负责人确认边界样本时 process_reason 为空 | 在确认弹窗中填写处理原因后再提交 |
| 请上传CSV文件 | 导入时没选文件或文件为空 | 选择有效的 .csv 文件再重试 |
| 缺少备注参数 | 修改备注 API 调用时 remark 参数缺失 | 检查前端传参，确保 remark 字段存在 |

---

## 10. 计算明细字段说明表

下表列出所有导出报告（抽样名单、边界样本、计算明细）中出现的字段及含义：

### 通用可追溯字段（所有报告都应包含）

| 字段名 | 类型 | 含义 |
|---|---|---|
| traceable_id | TEXT | 全链路可追溯 ID，等于 sampling_records.id，三份报告按此字段可 VLOOKUP 关联 |
| batch_id | TEXT | 批次 ID，对应 batch_imports.id，区分第 N 次导入 |
| list_name | TEXT | 所属抽样名单的名称 |

### 抽样名单导出字段

| 字段名 | 类型 | 含义 |
|---|---|---|
| traceable_id | TEXT | 可追溯 ID（见上） |
| original_value | REAL | 样本原始数值（导入的第一列） |
| is_negative | INTEGER | 是否负数（1=是，0=否） |
| old_table_status | TEXT | 旧表状态（normal/missing/anomaly） |
| is_boundary | INTEGER | 是否边界样本（1=是，0=否） |
| boundary_status | TEXT | 边界状态（pending/confirmed/ignored） |
| remark | TEXT | 单条备注（可随时修改） |
| batch_id | TEXT | 批次 ID（见上） |
| import_time | TEXT | 批次导入时间 |
| list_name | TEXT | 名单名称（见上） |

### 边界样本报告导出字段

| 字段名 | 类型 | 含义 |
|---|---|---|
| traceable_id | TEXT | 可追溯 ID（见上） |
| original_value | REAL | 边界样本原始值 |
| corrected_value | REAL | 人工修正后的值（NULL 表示未修正） |
| is_negative | INTEGER | 是否负数 |
| old_table_status | TEXT | 旧表状态 |
| type | TEXT | 边界规则编号（如 BR-001） |
| status | TEXT | 处理状态（pending/confirmed/ignored） |
| process_reason | TEXT | 处理原因（教研负责人填写） |
| decision_detail | TEXT | 确认/驳回详细说明 |
| confirmed_by | TEXT | 最终确认人姓名 |
| confirmed_at | TEXT | 确认/驳回时间 |
| detected_at | TEXT | 边界检测时间 |
| list_name | TEXT | 所属名单名称 |
| batch_id | TEXT | 批次 ID |
| review_comments_count | INTEGER | 复核意见条数（学生助教加了几条意见） |

### 计算明细导出字段

| 字段名 | 类型 | 含义 |
|---|---|---|
| traceable_id | TEXT | 可追溯 ID（见上） |
| original_value | REAL | 样本原始值（可能已被人工修正） |
| allocated_cost | REAL | 分摊到本条的成本金额 = unit_cost × allocation_ratio / 总样本数 |
| is_boundary | INTEGER | 是否边界样本 |
| boundary_type | TEXT | 边界规则编号（如 BR-001） |
| boundary_status | TEXT | 边界状态 |
| corrected_value | REAL | 人工修正值（来自 boundary_samples） |
| process_reason | TEXT | 处理原因（来自 boundary_samples） |
| confirmed_by | TEXT | 确认人 |
| list_name | TEXT | 名单名称 |
| batch_id | TEXT | 批次 ID |
| source_param_key | TEXT | 分摊来源参数键名（如 unit_cost） |
| source_param_value | REAL | 分摊来源参数值（如 150） |

### 成本计算 Summary 字段

| 字段名 | 类型 | 含义 |
|---|---|---|
| totalSamples | INTEGER | 总样本数（所有名单合计） |
| totalCost | REAL | 总成本（= allocated_cost 之和） |
| boundaryCount | INTEGER | 边界样本总数 |
| pendingCount | INTEGER | 待处理边界样本数（= needReviewCount） |
| confirmedCount | INTEGER | 已确认边界样本数 |
| ignoredCount | INTEGER | 已驳回边界样本数 |
| batchCount | INTEGER | 批次数量（有多少个 batch_id） |
| needReviewCount | INTEGER | 需要复核的数量（= pendingCount，给前端显示用） |
