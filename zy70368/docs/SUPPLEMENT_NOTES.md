# 接口字段脱敏 API - 补充说明文档

## 一、主要边界（Boundary Conditions）

### 1. 角色边界
- **有效角色集合**：`customer_service`（客服）、`finance`（财务）、`outsourcing`（外包审计）
- **无规则角色**：若请求头中的 `x-role` 不在上述集合中，系统会按空规则处理，所有字段默认隐藏
- **策略中不存在的角色**：即使角色在有效集合中，但该角色在策略版本的 `fieldRules` 中没有定义规则，所有字段也会被隐藏

### 2. 字段规则边界
- **无规则字段**：资源中的字段如果在策略中没有对应规则定义，会被隐藏，审计记录中 `reason` 为 `no_rule_defined`
- **规则覆盖**：例外授权会覆盖策略规则，`grantedFields` 中的字段直接显示原值，不应用任何脱敏
- **脱敏类型**：
  - `last4`：只保留最后4位，其余用 `*` 替换
  - `partial`：字符串保留前后各3位，邮箱保留首尾字符和域名，数字保留首尾数字
  - `full`：全部替换为 `*`
  - 无 `mask` 属性或 `mask` 为 `null`：不脱敏，显示原值

### 3. 策略版本边界
- **草稿版本**：状态为 `draft` 的版本不会生效，只有 `published` 状态的版本才会被使用
- **当前版本**：`policy.currentVersion` 指向生效的版本号，发布新版本时会更新此值
- **版本保留**：所有历史版本都会保留，可用于审计和对比，不会被删除

### 4. 例外授权边界
- **多维度匹配**：例外授权需要同时匹配 `userId`、`role`、`resourceType`、`resourceId` 四个维度
- **资源范围限制**：例外授权绑定具体的 `resourceId`，不能通配多个资源
- **到期时间**：`expiresAt` 精确到秒，严格比较 `new Date(expiresAt) > now`
- **字段粒度**：`grantedFields` 是数组，支持授权部分字段，不是全部字段

### 5. 审计记录边界
- **成功与失败**：所有访问都会被记录，包括失败的访问（缺少认证头、资源不存在等）
- **关联信息**：每条审计记录关联 `policyVersionId`，用于后续审计时确定使用的策略版本
- **隐藏与脱敏区分**：
  - `hiddenFields`：完全不返回的字段
  - `maskedFields`：返回但被脱敏处理的字段

---

## 二、一个失败路径（A Failure Path）

### 场景：过期的例外授权尝试访问敏感字段

**路径编号**：FAIL-PATH-001

**用户故事**：外包审计人员张三因特殊审计需求，被临时授权查看客户 A 的手机号，授权有效期 7 天。第 8 天，张三再次尝试访问客户 A 的详情，期望还能看到手机号。

**完整流程**：

```
时序图：
  [T0] 管理员创建例外授权
       → POST /api/exceptions
       → userId=user_zhang_san, role=outsourcing
       → resourceType=customer, resourceId=CUSTOMER_A
       → grantedFields=["phone"]
       → expiresAt=T0 + 7天
       → 返回 201 Created

  [T1-T7] 张三访问客户 A
       → GET /api/customers/CUSTOMER_A
       → x-user-id: user_zhang_san
       → x-role: outsourcing
       → 检查例外授权：userId ✓, role ✓, resourceType ✓, resourceId ✓, expiresAt > now ✓
       → 例外授权生效，phone 字段显示原值（不脱敏）
       → 审计记录：exceptionApplied = { id, reason, expiresAt }

  [T8] 第8天，张三再次访问
       → GET /api/customers/CUSTOMER_A
       → x-user-id: user_zhang_san
       → x-role: outsourcing
       → 检查例外授权：
           userId ✓
           role ✓
           resourceType ✓
           resourceId ✓
           expiresAt (T0+7天) <= now (T8) ✗
       → 例外授权不生效
       → 按外包角色策略处理：phone 字段隐藏
       → 审计记录：exceptionApplied = null

  [张三视角]：
  - T1-T7：看到完整手机号 "13800138000"
  - T8：phone 字段不存在（被隐藏）
  - 张三困惑："为什么昨天还能看，今天就看不到了？"
```

**关键代码位置**：

**src/services/maskingService.js:21-33**
```javascript
static checkExceptionAuthorization(userId, role, resourceType, resourceId) {
  const now = new Date();
  for (const exception of dataStore.exceptions.values()) {
    if (exception.userId === userId &&
        exception.role === role &&
        exception.resourceType === resourceType &&
        exception.resourceId === resourceId &&
        new Date(exception.expiresAt) > now) {  // ← 这里严格判断
      return exception;
    }
  }
  return null;
}
```

**失败原因**：
- 例外授权的 `expiresAt` 字段采用**严格大于**比较（`> now`）
- 当 `expiresAt` 等于当前时间或早于当前时间时，授权立即失效
- 没有宽限期或续约机制

**审计可追踪性**：
- T1-T7 的访问记录：`exceptionApplied` 不为 `null`，包含授权 ID、原因、到期时间
- T8 的访问记录：`exceptionApplied` 为 `null`
- 对比同一用户、同一资源的两条记录，可以发现授权状态的变化

**如何验证此失败路径**：
1. 启动服务，从 `/api/health` 获取 `customer1Id`
2. 执行 `user_outsourcing_special` 访问（有效授权，应看到 phone 和 email）
3. 执行 `user_outsourcing_expired` 访问（过期授权，不应看到 phone 和 email）
4. 查询审计记录，对比两者的 `exceptionApplied` 字段

---

## 三、一次重复执行路径（A Repeated Execution Path）

### 场景：同一请求在策略更新前后执行，对比结果

**路径编号**：REPEAT-PATH-001

**用户故事**：公司调整数据脱敏策略，决定：
1. 财务人员需要能看到客户备注（用于对账）
2. 客服人员不应再看到客户邮箱（减少信息泄露风险）

同一财务人员在策略更新前和更新后分别查询同一客户的详情，体验到不同的脱敏结果。

**完整流程**：

```
【阶段一：策略版本 1 生效】

  策略 v1 规则：
    财务角色：
      balance: visible=true, notes: visible=false
      （财务看不到备注）
    客服角色：
      email: visible=true, mask=partial
      （客服可以看到部分脱敏的邮箱）

  [REQ1] 财务人员李四查询客户 A（策略 v1）
       → GET /api/customers/CUSTOMER_A
       → x-user-id: user_li_si, x-role: finance
       → 响应：balance=15680.50, notes 不存在（隐藏）
       → 审计记录 LOG-001：
           policyVersion = 1
           hiddenFields.includes({field: "notes", reason: "policy_hidden"})

  [REQ2] 客服人员王五查询客户 A（策略 v1）
       → GET /api/customers/CUSTOMER_A
       → x-user-id: user_wang_wu, x-role: customer_service
       → 响应：email="z****n@example.com"（部分脱敏）
       → 审计记录 LOG-002：
           policyVersion = 1
           maskedFields.includes({field: "email", maskType: "partial"})

【阶段二：策略更新】

  [ADMIN1] 管理员创建策略版本 2
       → POST /api/policies/CUSTOMER_POLICY_ID/versions
       → fieldRules:
           finance.notes.visible = true
           customer_service.email.visible = false
       → 状态：draft

  [ADMIN2] 管理员对比 v1 和 v2
       → GET /api/policies/compare/V1_ID/V2_ID
       → 差异：
           finance.notes: hidden → visible
           customer_service.email: visible(partial) → hidden

  [ADMIN3] 管理员发布 v2
       → POST /api/policies/CUSTOMER_POLICY_ID/versions/2/publish
       → policy.currentVersion = 2

【阶段三：策略版本 2 生效】

  策略 v2 规则：
    财务角色：
      balance: visible=true, notes: visible=true
      （财务现在能看到备注）
    客服角色：
      email: visible=false
      （客服不能看到邮箱）

  [REQ3] 财务人员李四再次查询客户 A（策略 v2）
       → GET /api/customers/CUSTOMER_A
       → x-user-id: user_li_si, x-role: finance
       → 响应：balance=15680.50, notes="VIP客户，需要特别服务"（可见）
       → 审计记录 LOG-003：
           policyVersion = 2
           notes 不再在 hiddenFields 中

  [REQ4] 客服人员王五再次查询客户 A（策略 v2）
       → GET /api/customers/CUSTOMER_A
       → x-user-id: user_wang_wu, x-role: customer_service
       → 响应：email 不存在（隐藏）
       → 审计记录 LOG-004：
           policyVersion = 2
           hiddenFields.includes({field: "email", reason: "policy_hidden"})
```

**可对比的两个维度**：

**维度 1：同一用户，策略更新前后（REQ1 vs REQ3）**

| 对比项 | REQ1 (v1) | REQ3 (v2) |
|--------|----------|----------|
| policyVersion | 1 | 2 |
| notes 字段 | 隐藏 | 可见 |
| 审计 LOG | LOG-001 | LOG-003 |
| hiddenFields | 包含 notes | 不包含 notes |

**维度 2：策略更新前后，查看审计记录**

```
查询同一资源的所有访问记录：
GET /api/audit/by-resource/customer/CUSTOMER_A

返回顺序（按时间倒序）：
  1. LOG-004 (王五, v2, email隐藏)
  2. LOG-003 (李四, v2, notes可见)
  3. LOG-002 (王五, v1, email脱敏)
  4. LOG-001 (李四, v1, notes隐藏)

审计人员可以清晰看到：
- 哪次访问使用了哪个策略版本
- 同一用户在不同策略下的字段可见性变化
- 策略更新的时间点（REQ2 和 REQ3 之间）
```

**关键代码位置**：

**src/services/maskingService.js:78-154** `filterResponse` 方法
- 每次调用都会获取当前发布的策略版本
- 策略更新后立即生效，无需重启

**src/services/maskingService.js:229-253** `publishPolicyVersion` 方法
- 更新 `policy.currentVersion` 字段
- 将版本状态改为 `published`

**如何验证此重复执行路径**：
1. 启动服务，从 `/api/health` 获取所有 ID
2. 执行 `user_finance_001` 访问（v1，notes 隐藏）
3. 执行 `user_cs_001` 访问（v1，email 脱敏）
4. 执行策略更新（参照 curl 示例脚本的示例 3）
5. 执行 `user_finance_002` 访问（v2，notes 可见）
6. 执行 `user_cs_002` 访问（v2，email 隐藏）
7. 查询审计记录，对比 4 次访问的 `policyVersion` 和字段可见性

---

## 四、复查清单（For Next Round Review）

基于上述边界和路径，下一轮复查时可以直接检查：

### 边界检查
- [ ] 请求头缺少 `x-user-id` 或 `x-role` 时，返回 401 并记录审计
- [ ] 无效角色（如 `admin`）访问时，所有字段被隐藏
- [ ] 策略中未定义的字段（如新增字段）被隐藏，审计 reason 为 `no_rule_defined`
- [ ] 例外授权的 `resourceId` 不匹配时，授权不生效
- [ ] 同一资源存在多个例外授权时，只有当前用户的授权生效

### 失败路径验证（FAIL-PATH-001）
- [ ] `user_outsourcing_special` 能看到 phone 和 email
- [ ] `user_outsourcing_expired` 看不到 phone 和 email
- [ ] 两者的审计记录中 `exceptionApplied` 字段不同
- [ ] 修改系统时间后，`user_outsourcing_special` 的授权在 7 天后失效

### 重复执行路径验证（REPEAT-PATH-001）
- [ ] 策略 v1 下：财务看不到 notes，客服能看到 email
- [ ] 创建 v2 草稿后，访问仍使用 v1
- [ ] 对比 v1 和 v2 能正确识别差异
- [ ] 发布 v2 后，访问使用 v2
- [ ] 策略 v2 下：财务能看到 notes，客服看不到 email
- [ ] 审计记录包含使用的策略版本号
- [ ] 查询 `/api/audit/by-resource/customer/{id}` 能看到策略切换的时间点
