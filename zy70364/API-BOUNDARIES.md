# 邮件退信处理 API - 边界说明

## 一、主要边界

### 1. 业务类型边界

**营销邮件 (marketing)**
- 硬退信 → 立即禁止发送
- 软退信累计 3 次 → 暂停发送
- 用户退订 → 立即禁止发送
- 邮箱满、域名不可达 → 按软退信规则处理

**账单邮件 (billing)**
- 硬退信 → 允许发送但需人工确认 (`requires_manual_review: true`)
- 软退信 → 正常处理，不强制暂停
- 用户退订 → 不影响账单邮件 (仅禁止营销)
- 邮箱满、域名不可达 → 正常处理

### 2. 退信分类边界

| 退信类型 | 触发条件 | 对营销邮件影响 | 对账单邮件影响 |
|---------|---------|-------------|-------------|
| **硬退信 (hard_bounce)** | type=hard, 或 reason 含 "user unknown", "550 5.1.1" 等 | 禁止发送 | 允许但需人工确认 |
| **软退信 (soft_bounce)** | type=soft, 或 reason 含 "temporary", "greylisted" 等 | 累计计数，3次后暂停 | 正常处理 |
| **邮箱满 (mailbox_full)** | reason 含 "mailbox full", "quota exceeded" | 按软退信规则 | 正常处理 |
| **域名不可达 (domain_unreachable)** | reason 含 "domain not found", "DNS" 等 | 按软退信规则 | 正常处理 |
| **退订 (unsubscribe)** | type=unsubscribe/complaint, 或 reason 含 "unsubscribe" | 禁止发送 | 不影响 |

### 3. 地址状态边界

| 状态 | 条件 | 营销邮件 | 账单邮件 |
|------|------|---------|---------|
| **active** | 初始状态或无退信 | ✅ 可发送 | ✅ 可发送 |
| **soft_bounce** | 软退信 1-2 次 | ✅ 可重试 (剩余次数提示) | ✅ 可发送 |
| **suspended** | 软退信 ≥ 3 次 | ❌ 禁止 | ✅ 可发送 |
| **hard_bounce** | 硬退信 | ❌ 禁止 | ⚠️ 需人工确认 |
| **unsubscribed** | 用户退订 | ❌ 禁止 | ✅ 可发送 |

### 4. 幂等性边界

- 退信事件必须有唯一 `id`
- 相同 `id` 重复推送 → 返回 `{ duplicate: true, processed: false }`
- 地址状态**不会**因重复事件更新
- 软退信计数**不会**因重复事件增加

### 5. 查询边界

**地址状态查询** (`/api/addresses/:email`)
- 返回: 状态、软退信次数、最近退信原因、可发送类型
- 地址不存在 → 返回 404

**发送决策查询** (`/api/can-send/:email`)
- 必须指定 `business_type` (默认 marketing)
- 返回: can_send, reason, 状态详情

**投递质量报告** (`/api/delivery-quality`)
- 支持按日期范围、域名、业务类型过滤
- 返回: 汇总 + 按域名分组 + 按业务类型分组 + 按退信类型分组

---

## 二、一个失败路径

### 场景：硬退信用户尝试发送营销邮件

**路径步骤：**

1. **创建发送记录**
   ```
   POST /api/sends
   {
     "id": "send_001",
     "email": "invalid_user@test.com",
     "business_type": "marketing",
     "message_id": "msg_001"
   }
   → 201 Created, 记录存储成功
   ```

2. **接收硬退信**
   ```
   POST /api/bounces
   {
     "id": "bounce_001",
     "email": "invalid_user@test.com",
     "type": "hard",
     "reason": "550 5.1.1 User unknown",
     "message_id": "msg_001"
   }
   → 200 OK
   → 地址状态更新: active → hard_bounce
   → can_send_marketing: 1 → 0
   → can_send_billing: 1 (保持)
   ```

3. **下一次发送决策检查**
   ```
   GET /api/can-send/invalid_user@test.com?business_type=marketing
   → 200 OK
   {
     "email": "invalid_user@test.com",
     "business_type": "marketing",
     "can_send": false,
     "reason": "hard_bounce",
     "status": "hard_bounce"
   }
   ```

4. **发送系统决策**: 跳过该地址，不发送营销邮件

5. **账单邮件决策检查** (对比)
   ```
   GET /api/can-send/invalid_user@test.com?business_type=billing
   → 200 OK
   {
     "email": "invalid_user@test.com",
     "business_type": "billing",
     "can_send": true,
     "reason": "billing_requires_manual_confirmation",
     "status": "hard_bounce",
     "requires_manual_review": true
   }
   ```

**关键检查点:**
- ✅ 硬退信和退订状态分开 (hard_bounce ≠ unsubscribed)
- ✅ 营销邮件被禁止
- ✅ 账单邮件有特殊处理逻辑
- ✅ 地址状态影响下一次发送决策

---

## 三、一次重复执行路径

### 场景：同一退信事件被重复推送

**路径步骤：**

1. **第一次推送**
   ```
   POST /api/bounces
   {
     "id": "bounce_dup_001",
     "email": "temp_user@example.com",
     "type": "soft",
     "reason": "Greylisted - try again later",
     "message_id": "msg_dup_001"
   }
   → 200 OK
   {
     "id": "bounce_dup_001",
     "processed": true,
     "duplicate": false,
     "bounce_type": "soft_bounce",
     "address_status": {
       "email": "temp_user@example.com",
       "status": "soft_bounce",
       "soft_bounce_count": 1,
       "can_send_marketing": true,
       "can_send_billing": true
     }
   }
   ```

2. **检查当前状态**
   ```
   GET /api/addresses/temp_user@example.com
   → soft_bounce_count: 1
   ```

3. **第二次推送 (相同 id)**
   ```
   POST /api/bounces
   {
     "id": "bounce_dup_001",
     "email": "temp_user@example.com",
     "type": "soft",
     "reason": "Greylisted - try again later",
     "message_id": "msg_dup_001"
   }
   → 200 OK
   {
     "id": "bounce_dup_001",
     "processed": false,
     "duplicate": true,
     "message": "Bounce event already processed (idempotent)"
   }
   ```

4. **再次检查状态 (验证幂等性)**
   ```
   GET /api/addresses/temp_user@example.com
   → soft_bounce_count: 1 (不变，不是 2!)
   ```

5. **第三次推送 (不同 id，相同邮件)**
   ```
   POST /api/bounces
   {
     "id": "bounce_dup_002",
     "email": "temp_user@example.com",
     "type": "soft",
     "reason": "Another temp failure",
     "message_id": "msg_dup_002"
   }
   → 200 OK
   → soft_bounce_count: 2 (增加了，因为 id 不同)
   ```

**关键检查点:**
- ✅ 相同 id 重复推送 → 返回 `duplicate: true`
- ✅ 地址状态**不**更新
- ✅ 软退信计数**不**增加
- ✅ 不同 id 相同邮件 → 正常处理，计数增加
- ✅ 事件表有唯一索引防重复存储

---

## 四、复查清单

下次复查时请检查：

### 核心逻辑
1. [ ] 硬退信后 `can_send_marketing = false`
2. [ ] 硬退信后 `can_send_billing = true` 且 `requires_manual_review = true`
3. [ ] 退订后 `can_send_marketing = false`，但 `can_send_billing = true`
4. [ ] 软退信 3 次后状态变为 `suspended`
5. [ ] 软退信 < 3 次时 `can_send_marketing = true`
6. [ ] 重复事件 (`id` 相同) 不更新状态

### 数据一致性
1. [ ] 硬退信和退订是**不同**状态 (`hard_bounce` vs `unsubscribed`)
2. [ ] 投递质量报告能按域名和业务类型分组
3. [ ] 地址状态变化立即影响 `can-send` 决策

### API 契约
1. [ ] `/api/can-send` 返回 `reason` 字段解释决策
2. [ ] `/api/bounces` 重复事件返回 `duplicate: true`
3. [ ] `/api/delivery-quality` 包含 `bounceRate` 百分比
