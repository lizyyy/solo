# 用户导入撤销 API - 补充说明文档

## 1. 主要边界条件

### 1.1 用户类型边界

| 用户类型 | 导入行为 | 撤销行为 | 备注 |
|---------|---------|---------|------|
| **原始用户** (originalUser=true) | 执行 UPDATE（更新部门/角色） | 恢复原角色，不删除用户 | 导入前已存在的老用户 |
| **原始用户在批次中** (isPreExisting=true) | 同上 | 同上 | 批次预检时标记 |
| **新创建用户** (originalUser=false) | 执行 CREATE（插入新用户） | 删除用户 | 只有这类用户会被物理删除 |
| **批次内重复邮箱** | SKIP（跳过） | 不产生实际影响 | precheck 时检测到 duplicate_email |

### 1.2 状态流转边界

#### 批次状态流转
```
CREATED → PRECHECKING → PRECHECKED → IMPORTING → 
  ├─→ COMPLETED (全部成功)
  ├─→ PARTIALLY_COMPLETED (部分成功)
  └─→ FAILED (全部失败)
            ↓
         REVOKING → 
  ├─→ REVOKED (全部撤销成功)
  └─→ PARTIALLY_REVOKED (部分撤销失败)
```

**边界规则：**
- 只有 `COMPLETED`、`PARTIALLY_COMPLETED`、`FAILED` 状态才能执行撤销
- `CREATED` 状态的批次不能撤销（未执行导入操作）
- `REVOKING` 状态有并发控制（processingBatches Set）

#### 记录状态流转
```
PENDING → IMPORTING →
  ├─→ CREATED (新创建)
  ├─→ UPDATED (更新老用户)
  ├─→ SKIPPED (批次重复)
  └─→ FAILED (导入失败)
  
CREATED/UPDATED/SKIPPED/FAILED → REVOKING →
  ├─→ REVOKED (撤销成功)
  ├─→ NOT_REVOCABLE (不可撤销，如老用户)
  └─→ REVOKE_FAILED (撤销失败)
```

### 1.3 数据一致性边界

**导入时保存快照：**
- 老用户导入前的 `roleIds` 被保存到 `userOriginalRoleIds` Map
- 记录中的 `originalRoleIds` 字段也会保存一份
- 撤销时使用这个快照恢复

**批次追踪：**
- 所有由批次创建/修改的用户都记录 `sourceBatchId`
- 通过 `GET /api/report/users` 可追踪每个用户的来源批次

### 1.4 幂等性边界

| 操作 | 幂等保证方式 |
|-----|-------------|
| 批次撤销 | 检查 `processingBatches` Set，已在处理中直接返回 |
| 单用户撤销 | 检查 `processingRecords` Set，已在处理中直接返回 |
| 已撤销批次 | 返回 `getIdempotentRevokeResult()`，状态不变 |
| 已撤销记录 | 返回 `already_revoked` 状态 |
| 确认导入 | 已 `COMPLETED`/`PARTIALLY_COMPLETED` 直接返回原结果 |

---

## 2. 一个失败路径

### 场景：角色绑定失败后的补偿流程

#### 失败路径描述

```
步骤 1: 创建批次
└─→ 批次 BATCH-001 包含用户:
     ├─ 赵晓 (新用户, 角色: 管理员) ✓ 角色存在
     ├─ 钱多多 (新用户, 角色: 经理) ✓ 角色存在
     └─ 孙丽 (新用户, 角色: 不存在角色X) ✗ 角色不存在

步骤 2: 预检
└─→ 检测到孙丽的角色警告 (ROLE_NOT_FOUND)
     但管理员忽略警告，继续确认导入

步骤 3: 确认导入
└─→ 执行结果:
     ├─ 赵晓 → CREATED ✓ (创建成功，roleIds: [role-admin])
     ├─ 钱多多 → CREATED ✓ (创建成功，roleIds: [role-manager])
     └─ 孙丽 → CREATED ✓ (创建成功，但 roleIds: []) ← 角色绑定失败
     批次状态: PARTIALLY_COMPLETED (部分角色失败)

步骤 4: 发现问题
└─→ 管理员查看报告发现:
     赵晓、钱多多被错误创建（本来应该是实习生）
     孙丽角色为空

步骤 5: 执行撤销
└─→ 补偿流程:
     ├─ 赵晓 → delete_user() → 用户被删除 ✓
     ├─ 钱多多 → delete_user() → 用户被删除 ✓
     └─ 孙丽 → delete_user() → 用户被删除 ✓ (即使角色绑定失败也会删除)
     批次状态: REVOKED

步骤 6: 补偿验证
└─→ 检查用户列表:
     赵晓: 不存在 ✓ (已删除)
     钱多多: 不存在 ✓ (已删除)
     孙丽: 不存在 ✓ (已删除)
```

#### 补偿机制关键代码位置

**`src/services/revokeService.ts:157-193`**
```typescript
if (!record.isPreExisting && record.status === RecordStatus.CREATED) {
  const user = store.findUserByEmail(record.email);
  if (user) {
    const deleted = store.deleteUser(user.id);
    if (deleted) {
      record.status = RecordStatus.REVOKED;
      // ...
    }
  }
}
```

**`src/services/revokeService.ts:114-154`**
```typescript
if (record.isPreExisting && record.status === RecordStatus.UPDATED) {
  const user = store.findUserByEmail(record.email);
  if (user) {
    const originalRoleIds = store.getUserOriginalRoleIds(user.id);
    if (originalRoleIds) {
      user.roleIds = originalRoleIds;  // 恢复原角色
      store.updateUser(user);
      // ...
    }
  }
}
```

---

## 3. 一次重复执行路径

### 场景：网络超时导致客户端重复调用撤销 API

#### 路径描述

```
时间线:
T0: 管理员点击"撤销批次"按钮
T1: 客户端发送请求 → 服务器开始执行 revokeBatch(BATCH-001)
    ├─ processingBatches.add("BATCH-001")
    ├─ 开始遍历记录...
T2: 网络超时，客户端认为请求失败
T3: 用户再次点击按钮（或客户端自动重试）
T4: 第二个请求到达服务器
    └─ 检查 processingBatches.has("BATCH-001") → true
    └─ 直接返回空结果（幂等处理）
T5: 第一个请求完成
    ├─ processingBatches.delete("BATCH-001")
    └─ 返回撤销结果给客户端
T6: 用户再次尝试撤销（确认已完成）
    ├─ 检查 batch.status === REVOKED
    └─ 返回 getIdempotentRevokeResult()（所有记录状态已撤销）
```

#### 重复执行的三个层级

| 层级 | 触发条件 | 处理方式 | 代码位置 |
|-----|---------|---------|---------|
| **并发层** | 请求同时到达 | `processingBatches` Set 拦截 | `revokeService.ts:204-214` |
| **状态层** | 批次已 REVOKED | 返回幂等结果 | `revokeService.ts:233-235` |
| **记录层** | 单个记录已 REVOKED | `already_revoked` 状态 | `revokeService.ts:91-93` |

#### 关键幂等检查代码

**并发保护：** `src/services/revokeService.ts:204-214`
```typescript
revokeBatch(batchId: string, force?: boolean): RevokeResult {
  if (this.processingBatches.has(batchId)) {
    return {
      batchId,
      totalProcessed: 0,
      revoked: 0,
      // ...
    };
  }
  // ...
}
```

**已撤销状态保护：** `src/services/revokeService.ts:233-235`
```typescript
if (batch.status === BatchStatus.REVOKED && !force) {
  return this.getIdempotentRevokeResult(batchId, '批次已完全撤销');
}
```

**记录级别保护：** `src/services/revokeService.ts:91-93`
```typescript
if (record.status === RecordStatus.REVOKED) {
  return { status: 'already_revoked', message: '已撤销，幂等处理', compensations: [] };
}
```

---

## 4. 复查清单（下一轮照着查）

### 4.1 边界条件复查

- [ ] **用户类型区分**
  - [ ] 原始用户(originalUser=true)是否永不被删除？
  - [ ] 新创建用户撤销时是否被删除？
  - [ ] 老用户更新后撤销是否只恢复角色？

- [ ] **状态检查**
  - [ ] CREATED/PRECHECKING 状态的批次能否被撤销？（应该不能）
  - [ ] COMPLETED/PARTIALLY_COMPLETED 能否被撤销？（应该能）
  - [ ] REVOKED 状态能否被再次撤销？（应该幂等返回）

- [ ] **数据一致性**
  - [ ] 导入前是否保存老用户的 roleIds 快照？
  - [ ] 撤销时是否使用快照恢复而非空数组？
  - [ ] 用户的 sourceBatchId 是否正确追踪？

### 4.2 失败路径复查

- [ ] **角色绑定失败补偿**
  - [ ] 角色不存在时用户是否仍被创建？
  - [ ] 这类用户撤销时是否被正确删除？
  - [ ] 补偿记录中是否包含失败原因？

- [ ] **部分成功处理**
  - [ ] 部分成功时批次状态是否为 PARTIALLY_COMPLETED？
  - [ ] 报告中是否区分 CREATED 和 UPDATED？
  - [ ] 撤销时成功和失败的用户是否分别处理？

### 4.3 重复执行路径复查

- [ ] **并发保护**
  - [ ] 同时发送两个撤销请求，第二个是否被拦截？
  - [ ] processingBatches Set 是否正确维护？

- [ ] **幂等性**
  - [ ] 已撤销批次再次撤销是否返回相同结果？
  - [ ] 已撤销用户再次撤销是否返回 already_revoked？
  - [ ] 多次调用后数据是否一致？

### 4.4 报告功能复查

- [ ] **可撤销性说明**
  - [ ] 报告中每个用户是否标注 isPreExisting？
  - [ ] 报告中每个用户是否标注 canBeRevoked？
  - [ ] 老用户是否明确显示"导入前已存在，撤销不会删除"？

- [ ] **重新导入上下文**
  - [ ] reimport-context 是否包含所有错误信息？
  - [ ] 是否区分角色错误、部门错误？
  - [ ] 是否列出所有 preExistingUsers？
