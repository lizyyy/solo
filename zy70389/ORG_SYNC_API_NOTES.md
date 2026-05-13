# 组织架构同步 API - 补充说明文档

## 主要边界

### 1. 部门合并边界
- **规则**：部门合并时，原部门状态设为 `merged`，其所有员工的当前部门历史记录关闭（end_date 设为当前时间），并在目标部门创建新的历史记录。
- **关键逻辑**：`src/syncService.js:78-109` 中的 `handleDepartmentMerge` 函数
- **边界点**：
  - 目标部门必须已存在，否则会记录冲突并失败
  - 原部门的 parent_id 会指向目标部门，形成合并链，保持审计追溯
  - 员工部门历史（department_history 表）保留所有历史归属，不会丢失

### 2. 同一员工多条变更边界
- **规则**：当同一员工在一次同步中出现多条变更记录时，系统会记录冲突，但仍按顺序执行每条变更。
- **关键逻辑**：`src/syncService.js:111-135` 中的 `processEmployeeChanges` 函数
- **边界点**：
  - 冲突类型为 `multiple_changes`，需要人工确认
  - 所有变更记录仍会执行（按数组顺序），后续变更可能覆盖前面的
  - 冲突记录在 `sync_conflicts` 表，等待人工审核

### 3. 敏感角色回收边界
- **规则**：员工离职时，所有角色都会被回收，其中敏感角色（`is_sensitive=1`）会特别标记回收原因。
- **关键逻辑**：`src/syncService.js:230-268` 中的 `handleTermination` 函数
- **边界点**：
  - 角色回收通过 `employee_roles.revoked_at` 字段标记，而非物理删除
  - 回收日志记录在 `permission_revocation_logs` 表，可追溯
  - 敏感角色标记为 "员工离职 - 回收敏感角色"，普通角色标记为 "员工离职"

### 4. 批次状态边界
- **pending**：批次已创建，尚未执行
- **processing**：批次正在执行中
- **completed**：批次所有记录执行成功
- **partial**：批次部分记录执行失败，可重试
- **关键检查**：`src/syncService.js:275-277`，已完成的批次不可重复执行

---

## 一个失败路径

### 场景：部门合并时目标部门不存在

#### 路径步骤：
1. **请求导入**：调用 `POST /api/org-sync/import`，请求体包含：
   ```json
   {
     "source": "HR-SYNC-20260513",
     "departments": [
       {
         "id": "dept_ops",
         "name": "运维部",
         "action": "merge",
         "target_dept_id": "dept_non_existent"
       }
     ]
   }
   ```

2. **批次创建**：系统创建同步批次（`sync_batches.status = 'pending'`）

3. **部门处理**：调用 `createOrUpdateDepartment` → `handleDepartmentMerge`

4. **冲突检测**：
   - 检查目标部门：`SELECT id FROM departments WHERE id = 'dept_non_existent'` → 无结果
   - 记录冲突：`sync_conflicts.conflict_type = 'missing_target'`
   - 抛出错误：`目标部门不存在: dept_non_existent`

5. **记录失败**：
   - `sync_records.status = 'failed'`
   - `sync_records.error_message = '目标部门不存在: dept_non_existent'`

6. **批次执行**：
   - 统计失败计数 `failed_count = 1`
   - 批次状态设为 `partial`

7. **返回结果**：
   ```json
   {
     "batch_id": "uuid-xxx",
     "status": "partial",
     "statistics": { "total": 1, "success": 0, "failed": 1 },
     "failed_records": [{ "error_message": "目标部门不存在: dept_non_existent" }],
     "conflicts": [{ "conflict_type": "missing_target", "description": "目标部门不存在: dept_non_existent" }]
   }
   ```

#### 关键代码位置：
- `src/syncService.js:83-86`：目标部门存在性检查
- `src/syncService.js:41-46`：冲突记录创建
- `src/server.js:39-64`：整体导入流程

---

## 一次重复执行路径

### 场景：员工离职批次被重复调用

#### 第一次执行（正常流程）：
1. **导入请求**：
   ```json
   {
     "source": "HR-SYNC-20260513",
     "employees": [
       { "employee_id": "emp_1003", "action": "terminate" }
     ]
   }
   ```

2. **创建批次**：batch_001 状态为 `pending`

3. **员工离职处理**：
   - 查询 emp_1003 的活跃角色：r3（财务审批，敏感）、r4（系统管理员，敏感）
   - 检查 `permission_revocation_logs`：尚无记录
   - 回收 r3：
     - `employee_roles.revoked_at = CURRENT_TIMESTAMP`
     - 记录回收日志：`reason = '员工离职 - 回收敏感角色'`
   - 回收 r4：
     - 同样操作，记录回收日志

4. **批次完成**：
   - 状态 `completed`
   - `revocations` 数组包含 2 条记录（r3、r4）

#### 第二次尝试执行同一条离职（重复同步场景）：
1. **再次导入相同请求**（或调用 retry 接口）：
   - 如果调用 `/api/org-sync/batches/:batchId/retry`：
     - 检查批次状态 `sync_batches.status = 'completed'`
     - 抛出错误：`批次已完成，无需重试`（`src/syncService.js:317-319`）
   
   - 如果创建**新批次** batch_002 并导入相同的 terminate：
     - 创建新批次 batch_002
     - 处理员工离职：
       - 查询 emp_1003 的活跃角色：此时 r3、r4 的 `revoked_at` 已不为空，所以 `activeRoles` 为空数组
       - 跳过回收循环（无活跃角色可回收）
     - 记录执行成功（但实际上无权限变更）

2. **关键防重复机制**：
   - `src/syncService.js:246-249`：`isRevokedInBatch` 检查同一批次内不重复回收同一角色
   - `src/syncService.js:239-244`：仅查询 `revoked_at IS NULL` 的活跃角色，已回收的不会再次处理
   - `src/syncService.js:275-277`：已完成的批次不可重新执行

#### 重复执行的结果：
- **batch_001**：真正执行了权限回收，revocations 表有 2 条记录
- **batch_002**：执行成功但无实际权限变更，revocations 表无新增记录
- **审计完整性**：员工的角色历史（`employee_roles` 表的 `granted_at`/`revoked_at`）和回收日志（`permission_revocation_logs`）保持完整，不会出现重复回收记录

---

## 数据模型关键表说明

| 表名 | 用途 | 关键字段 |
|------|------|----------|
| `departments` | 部门主表 | `status` (active/merged), `parent_id` (合并追溯) |
| `department_history` | 员工部门历史 | `start_date`, `end_date` (保留审计链) |
| `employees` | 员工主表 | `status` (active/terminated) |
| `employee_roles` | 员工角色关联 | `granted_at`, `revoked_at` (软删除) |
| `roles` | 角色定义 | `is_sensitive` (敏感角色标记) |
| `sync_batches` | 同步批次 | `status`, `retry_count` |
| `sync_records` | 单条同步记录 | `status`, `error_message` |
| `permission_revocation_logs` | 权限回收日志 | `reason`, 防重复回收关键 |
| `sync_conflicts` | 同步冲突 | `requires_manual_review` |
