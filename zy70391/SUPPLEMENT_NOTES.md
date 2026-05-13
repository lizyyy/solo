# 临时权限到期 API - 补充说明文档

## 项目概述

临时权限到期 API 是一个完整的权限生命周期管理系统，用于解决生产查询权限临时开给研发后，很多人过了排障期还保留着的问题。

## 快速开始

1. 安装依赖：
```bash
npm install
```

2. 启动服务：
```bash
npm start
```

3. 生成示例数据：
```bash
node generate_sample_data.js
```

4. 运行测试脚本：
```bash
bash test_curl_examples.sh
```

## 权限类型

系统支持三种权限类型：

| 权限类型 | 代码 | 最大有效期 | 说明 |
|---------|------|-----------|------|
| 数据库只读 | DB_READ_ONLY | 7天 | 生产数据库只读访问 |
| 日志查询 | LOG_QUERY | 14天 | 系统日志查询 |
| 发布操作 | DEPLOY_OPERATION | 3天 | 生产环境发布操作 |

## 核心API列表

### 1. 权限申请与审批

- `POST /api/permissions` - 申请临时权限
- `POST /api/permissions/:id/approve` - 审批通过
- `POST /api/permissions/:id/reject` - 审批拒绝
- `POST /api/permissions/:id/authorize` - 授权

### 2. 到期扫描与回收

- `POST /api/scan/expired` - 扫描并自动回收过期权限
- `GET /api/scan/summary` - 获取扫描汇总

### 3. 延期管理

- `POST /api/extensions` - 申请延期
- `POST /api/extensions/:id/approve` - 审批延期通过
- `POST /api/extensions/:id/reject` - 审批延期拒绝

### 4. 查询接口

- `GET /api/query/active` - 当前有效权限
- `GET /api/query/expiring?days=3` - 即将到期列表
- `GET /api/query/revoke-records` - 回收记录
- `GET /api/query/audit` - 审计报告

### 5. 访问控制

- `GET /api/permissions/:id/check-access` - 检查权限是否可用

---

## 核心规则实现

### 1. 高危权限最长有效期

**实现位置**: `services/permissionService.js:47-50`

高危权限（如发布操作）的最大有效期为3天。申请时会校验 `requestedDays` 不能超过该权限类型定义的 `maxValidityDays`。

**校验逻辑**:
```javascript
const maxValidityDays = getMaxValidityDays(permissionType);
if (requestedDays > maxValidityDays) {
  throw new Error(`${permissionType} 权限的最大有效期为 ${maxValidityDays} 天`);
}
```

**边界测试**:
- 请求发布操作权限，申请4天 → 应报错"最大有效期为3天"
- 请求数据库只读权限，申请8天 → 应报错"最大有效期为7天"

### 2. 延期必须重新审批

**实现位置**: `services/permissionService.js:463-685`

延期申请流程：
1. 只能对状态为 `authorized` 的权限申请延期
2. 延期申请创建后状态为 `pending`
3. 必须通过审批流程才能生效
4. 审批通过后才更新 `valid_to` 字段

**额外限制**:
- 已过期的权限不能申请延期
- 单次延期不能超过该权限的最大有效期
- 延期后总有效期不能超过最大有效期的2倍

### 3. 到期回收失败进入人工队列

**实现位置**: `services/permissionService.js:384-457`

回收失败处理流程：
1. 扫描到过期权限
2. 调用 `simulateExternalRevoke()` 模拟外部系统回收（有10%概率失败）
3. 如果回收失败：
   - 将权限状态设为 `revoke_failed`
   - 设置 `last_revoke_attempt` 时间戳
   - 创建 `revoke_tasks` 人工处理任务
   - 记录审计日志
4. 人工任务可通过 `GET /api/tasks/revokes` 查询

### 4. 重复扫描不能重复回收

**实现位置**: `services/permissionService.js:393-401`

防止重复回收的机制：
1. 扫描时只查询 `status = 'authorized'` 的过期权限
2. 已回收（`revoked`）或回收失败（`revoke_failed`）的权限会被排除
3. 对于有 `last_revoke_attempt` 的权限，直接跳过，不重复尝试

**代码逻辑**:
```javascript
for (const permission of expiredPermissions) {
  if (permission.last_revoke_attempt) {
    results.details.push({
      id: permission.id,
      status: 'skipped',
      reason: '上次回收失败，已在人工处理队列中'
    });
    continue;
  }
  // 处理回收...
}
```

### 5. 已回收权限不能继续使用

**实现位置**: `services/permissionService.js:788-826`

权限访问检查逻辑 `checkPermissionAccess()`：
1. 检查权限是否存在
2. 检查状态是否为 `authorized`（非 authorized 包括 revoked 都不允许）
3. 检查当前时间是否在有效期限内
4. 任何一项不满足都返回 `allowed: false`

---

## 主要边界条件

### 边界1: 权限类型最大有效期

**边界值**:
- DB_READ_ONLY: 7天
- LOG_QUERY: 14天  
- DEPLOY_OPERATION: 3天

**测试场景**:
```bash
# 测试1: 申请有效期等于最大值（应该通过）
curl -X POST http://localhost:3000/api/permissions \
  -H "Content-Type: application/json" \
  -d '{
    "applicant": "test1@company.com",
    "permissionType": "DEPLOY_OPERATION",
    "reason": "测试边界值",
    "requestedDays": 3
  }'

# 测试2: 申请有效期超过最大值（应该失败）
curl -X POST http://localhost:3000/api/permissions \
  -H "Content-Type: application/json" \
  -d '{
    "applicant": "test2@company.com",
    "permissionType": "DEPLOY_OPERATION",
    "reason": "测试边界值",
    "requestedDays": 4
  }'
```

### 边界2: 延期申请时间窗口

**边界条件**:
- 权限必须是 `authorized` 状态
- 权限不能已过期（`valid_to` > 当前时间）
- 延期后总有效期不能超过最大有效期的2倍
- 单次延期不能超过最大有效期

**测试场景**:
```bash
# 测试1: 对已过期权限申请延期（应该失败）
# 需要先创建一个已过期的权限，然后尝试延期

# 测试2: 延期超过最大有效期（应该失败）
# DB_READ_ONLY 最大7天，尝试延期8天
```

### 边界3: 权限状态流转

**状态流转图**:
```
pending → approved → authorized → [revoked|revoke_failed|expired]
   ↓
rejected
```

**不允许的状态转换**:
- `pending` 不能直接跳转到 `authorized`（必须先 approved）
- `approved` 不能跳转到 `pending`
- `rejected` 不能转换到其他状态
- `revoked` 不能再转换到其他状态

**校验代码**: `services/permissionService.js` 中各方法都有状态检查

### 边界4: 扫描任务幂等性

**边界条件**:
- 多次调用 `/api/scan/expired` 不会重复处理同一个权限
- 已设置 `last_revoke_attempt` 的权限会被跳过
- 人工处理任务只创建一次

---

## 失败路径示例

### 失败路径: 到期回收失败

**前置条件**:
- 有一个已过期的授权权限
- 外部系统回收接口返回失败（模拟为10%概率）

**执行步骤**:

1. **准备测试数据**：
```bash
node generate_sample_data.js
```

2. **查看当前权限状态**：
```bash
# 查看已过期的权限
curl http://localhost:3000/api/permissions/expired
```

3. **执行扫描**：
```bash
# 可能需要多次执行才能触发回收失败
curl -X POST http://localhost:3000/api/scan/expired
```

4. **观察回收失败**：
```bash
# 查看扫描结果
curl http://localhost:3000/api/scan/summary

# 查看待办回收任务
curl http://localhost:3000/api/tasks/revokes

# 查看回收记录（应包含 revoke_failed 状态）
curl http://localhost:3000/api/query/revoke-records
```

5. **检查失败权限的访问**：
```bash
# 找到 revoke_failed 状态的权限ID
curl "http://localhost:3000/api/permissions?status=revoke_failed"

# 尝试使用该权限（应该失败）
curl http://localhost:3000/api/permissions/<permission_id>/check-access
```

**预期结果**:
- 扫描结果中 `failed > 0`
- 待办任务列表中有记录
- 权限状态为 `revoke_failed`
- 检查访问返回 `allowed: false`

---

## 重复执行路径示例

### 重复路径: 多次执行到期扫描

**前置条件**:
- 有多个已过期的授权权限
- 其中一些可能已尝试过回收但失败

**执行步骤**:

1. **第一次扫描**：
```bash
curl -X POST http://localhost:3000/api/scan/expired
```

2. **查看结果**：
```bash
curl http://localhost:3000/api/scan/summary
```

3. **记录结果**:
- 记录 `total`, `success`, `failed` 数量
- 记录 `pendingRevokeTasks` 数量

4. **第二次扫描（间隔很短）**：
```bash
curl -X POST http://localhost:3000/api/scan/expired
```

5. **再次查看结果**：
```bash
curl http://localhost:3000/api/scan/summary
```

**预期结果**:
- 第二次扫描的 `total` 应该小于等于第一次
- 成功回收的权限不会再次出现在 `total` 中
- 回收失败的权限在 `details` 中会显示 `status: 'skipped'`
- 待办任务数量不会重复增加

**验证代码**:
```javascript
// services/permissionService.js 第393-401行
if (permission.last_revoke_attempt) {
  results.details.push({
    id: permission.id,
    status: 'skipped',
    reason: '上次回收失败，已在人工处理队列中'
  });
  continue;
}
```

---

## 延期审批通过后原到期记录保留

**实现机制**:

1. **原始到期时间保留**:
   - `permissions` 表中的 `original_valid_to` 字段永远不会更新
   - 每次延期只更新 `valid_to` 字段
   - `extension_count` 字段记录延期次数

2. **延期历史完整记录**:
   - 所有延期申请都保存在 `extensions` 表中
   - 每个延期记录包含：
     - `original_valid_to`: 延期前的到期时间
     - `new_valid_to`: 延期后的到期时间
     - `additional_days`: 增加的天数
     - `approval_id`: 关联的审批记录

3. **审计日志追踪**:
   - `REQUEST_EXTENSION`: 记录申请
   - `APPROVE_EXTENSION`/`REJECT_EXTENSION`: 记录审批

**查询验证**:
```bash
# 查看权限的完整历史
curl "http://localhost:3000/api/query/audit?permissionId=<permission_id>"

# 或者直接查询extensions表
# sqlite3 temp_permissions.db "SELECT * FROM extensions WHERE permission_id = '<id>'"
```

---

## 数据库表结构

### permissions 表
```sql
- id (主键)
- applicant (申请人)
- permission_type (权限类型)
- reason (申请原因)
- requested_days (申请天数)
- valid_from (生效时间)
- valid_to (到期时间)
- status (状态)
- approval_id (审批ID)
- extension_count (延期次数)
- original_valid_to (原始到期时间，永不更新)
- last_revoke_attempt (上次回收尝试时间)
- notes (备注)
```

### extensions 表
```sql
- id (主键)
- permission_id (关联权限ID)
- applicant (申请人)
- additional_days (增加天数)
- reason (延期原因)
- status (状态)
- original_valid_to (延期前到期时间)
- new_valid_to (延期后到期时间)
- approval_id (审批ID)
```

### audit_logs 表
```sql
- id (主键)
- permission_id (关联权限ID，可为空)
- action (操作类型)
- actor (操作人)
- details (详情JSON)
- created_at (时间戳)
```

### revoke_tasks 表
```sql
- id (主键)
- permission_id (关联权限ID)
- reason (失败原因)
- status (任务状态)
- assigned_to (分配人)
- resolved_at (解决时间)
```

---

## 审计动作类型

| 动作类型 | 说明 |
|---------|------|
| CREATE_PERMISSION | 创建权限申请 |
| APPROVE_PERMISSION | 审批通过 |
| REJECT_PERMISSION | 审批拒绝 |
| AUTHORIZE_PERMISSION | 授权 |
| REVOKE_PERMISSION | 回收 |
| REVOKE_FAILED | 回收失败 |
| CREATE_REVOKE_TASK | 创建回收任务 |
| REQUEST_EXTENSION | 申请延期 |
| APPROVE_EXTENSION | 审批延期通过 |
| REJECT_EXTENSION | 审批延期拒绝 |

---

## 测试清单

### 功能测试
- [ ] 三种权限类型的正常申请、审批、授权流程
- [ ] 超过最大有效期的申请被拒绝
- [ ] 已授权权限的正常延期申请与审批
- [ ] 对已过期权限申请延期被拒绝
- [ ] 到期扫描能够发现已过期权限
- [ ] 成功回收后权限状态变为 revoked
- [ ] 回收失败后创建人工任务
- [ ] 重复扫描不会重复处理
- [ ] 已回收权限访问检查失败

### 查询测试
- [ ] GET /api/query/active - 只返回 authorized 状态
- [ ] GET /api/query/expiring - 返回指定天数内到期的
- [ ] GET /api/query/revoke-records - 返回 revoked 和 revoke_failed
- [ ] GET /api/query/audit - 可按权限ID、动作类型过滤

---

## 常见问题

### Q: 如何手动触发外部回收？
A: 当前实现中 `simulateExternalRevoke()` 是模拟的，实际部署时应替换为真实的外部系统调用。

### Q: 扫描任务如何定时执行？
A: 可以使用 cron 或任务调度器定期调用 `POST /api/scan/expired`。

### Q: 如何处理人工回收任务？
A: 从 `GET /api/tasks/revokes` 获取待办，人工处理后调用 `POST /api/permissions/:id/revoke` 手动回收。

### Q: 审计日志如何导出？
A: 可以直接查询 `audit_logs` 表，或通过 `GET /api/query/audit` API 分页查询。
