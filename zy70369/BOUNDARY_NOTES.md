# 异常订单人工仲裁台 - 边界说明文档

## 一、主要边界

### 1. 并发控制边界
**规则：同一订单同一时间只能被一个客服处理**

- 锁定机制：客服点击"锁定处理"后，订单被分配给该客服
- 排他锁：其他客服无法执行仲裁动作，只能查看
- 解锁权限：只有锁定人可以解锁，或系统超时自动解锁
- 数据库层面：使用事务 + 行级锁防止竞争条件

**代码位置：**
- 后端规则：`backend/src/rules/arbitrationRules.js` 的 `checkConcurrency` 函数
- 后端API：`backend/src/routes/exceptionRoutes.js` 的 `/:id/lock` 和 `/:id/unlock` 端点
- 前端控制：`frontend/src/pages/ExceptionDetail.tsx` 的 `canEdit` 变量

**复查要点：**
- [ ] 两个客服同时锁定同一订单时，只有一个能成功
- [ ] 被锁定的订单对其他客服展示"已被XX锁定"提示
- [ ] 非锁定人无法执行仲裁动作

---

### 2. 证据检查边界
**规则：证据缺失时不能执行高风险动作**

**高风险动作：**
- 退款 (REFUND)
- 回滚失败 (ROLLBACK_FAILED)

**各异常类型所需证据：**
| 异常类型 | 必需证据类型 |
|---------|-------------|
| 库存扣减失败 (INVENTORY_FAILURE) | 支付凭证 + 库存记录 |
| 物流取消 (LOGISTICS_CANCEL) | 支付凭证 + 物流记录 |
| 优惠异常 (DISCOUNT_EXCEPTION) | 支付凭证 + 优惠记录 |

**代码位置：**
- 后端规则：`backend/src/rules/arbitrationRules.js` 的 `canPerformAction` 函数
- 后端规则：`backend/src/rules/arbitrationRules.js` 的 `getEvidenceGaps` 函数
- 前端展示：`frontend/src/pages/ExceptionDetail.tsx` 中的证据缺口警告组件

**复查要点：**
- [ ] 证据缺口在页面顶部显著展示
- [ ] 点击高风险动作时检查证据完整性
- [ ] 证据缺失时返回明确错误信息

---

### 3. 防止重复退款边界
**规则：同一订单只能成功退款一次**

- 成功退款记录检查：查询 `arbitration_actions` 表中该订单是否有 `REFUND + SUCCESS` 记录
- 待处理退款检查：防止同时发起多笔退款
- 失败的退款可以重试，但成功的绝对不能重复

**代码位置：**
- 后端规则：`backend/src/rules/arbitrationRules.js` 的 `canPerformAction` 函数中关于 `REFUND` 的特殊检查
- 后端API：`backend/src/routes/exceptionRoutes.js` 的 `/:id/actions` 端点

**复查要点：**
- [ ] 退款成功后，再次点击退款按钮被拒绝
- [ ] 存在待处理退款时，无法发起新的退款
- [ ] 退款失败的记录可以重试

---

### 4. 状态锁定边界
**规则：仲裁完成后订单状态锁定，不可修改**

- 状态字段：`order_exceptions.status = 'RESOLVED'`
- 完成时间：`resolved_at` 字段填充
- 不可执行：任何仲裁动作（包括锁定、解锁）都被禁止
- 只读模式：前端禁用所有操作按钮

**代码位置：**
- 后端规则：`backend/src/rules/arbitrationRules.js` 的 `canPerformAction` 函数
- 后端API：`backend/src/routes/exceptionRoutes.js` 的 `/:id/resolve` 端点
- 前端控制：`frontend/src/pages/ExceptionDetail.tsx` 的 `isResolved` 变量

**复查要点：**
- [ ] 仲裁完成后，所有动作按钮禁用
- [ ] 后端拒绝任何对已完成订单的动作请求
- [ ] 已完成订单展示"仲裁已完成"状态卡片

---

### 5. 重试边界
**规则：失败的动作可以重试，但成功的动作不能重试**

- 重试条件：`arbitration_actions.status = 'FAILED'`
- 禁止重试：`status = 'SUCCESS'` 的动作
- 重试计数：`retry_count` 字段累加
- 时间线记录：每次重试都在订单时间线中体现

**代码位置：**
- 后端API：`backend/src/routes/exceptionRoutes.js` 的 `/:id/actions/:actionId/retry` 端点
- 前端展示：`frontend/src/pages/ExceptionDetail.tsx` 的执行记录区域，带重试按钮

**复查要点：**
- [ ] 失败的动作显示"重试"按钮
- [ ] 成功的动作不显示"重试"按钮
- [ ] 重试后 `retry_count` 正确累加

---

## 二、一个失败路径

### 场景：退款失败路径

**路径描述：**
客服发起退款 → 支付网关超时 → 退款失败 → 时间线记录失败 → 可重试

**涉及的数据流转：**

1. **客服操作**：点击"退款"按钮 → 确认对话框确认
2. **后端处理**：
   - 检查权限（是否锁定人、是否已完成仲裁）
   - 检查证据完整性
   - 检查是否已有成功退款
   - 模拟支付网关调用（此处模拟70%成功率）
3. **失败场景**：
   ```
   支付网关超时 → 退款失败
   ```
4. **数据写入**：
   - `arbitration_actions` 表：
     - `status = 'FAILED'`
     - `last_error = '支付网关超时，退款失败'`
     - `retry_count = 0`
   - `order_timeline` 表：
     - `event_type = 'REFUND_FAILED'`
     - `event_data.retry_available = true`

**前端展示变化：**
- 执行记录中显示该动作为"失败"状态
- 显示红色错误信息："支付网关超时，退款失败"
- 显示"重试"按钮
- 时间线中新增一条红色的失败记录

**可重试性：**
- 客服可以点击"重试"按钮再次发起退款
- 每次重试都会累加 `retry_count`
- 时间线中会记录"重试退款成功/失败"

**代码位置：**
- 后端：`backend/src/routes/exceptionRoutes.js` 的退款模拟逻辑（`Math.random() > 0.3` 模拟成功率）
- 前端：`frontend/src/pages/ExceptionDetail.tsx` 的执行记录区域

**复查要点（按照此路径逐一验证）：**
1. [ ] 点击退款按钮 → 弹出确认框
2. [ ] 确认后发起请求（可能需要多次尝试触发失败）
3. [ ] 收到失败响应后显示错误提示
4. [ ] 执行记录中出现"失败"状态的退款记录
5. [ ] 该记录显示"重试"按钮
6. [ ] 时间线中出现红色的"退款失败"事件
7. [ ] 点击"重试"后，`retry_count` 变为1
8. [ ] 再次成功后状态变为"成功"，重试按钮消失

---

## 三、一次重复执行路径

### 场景：防止重复退款路径

**路径描述：**
客服A成功退款一次 → 客服B（或同一客服）再次尝试退款 → 被系统拒绝

**涉及的业务规则：**

1. **第一次退款（成功）：**
   - 检查：无成功退款记录 → 允许执行
   - 结果：`status = 'SUCCESS'`
   - 写入：`arbitration_actions` 表新增成功记录

2. **第二次退款（被拒绝）：**
   - 检查：
     ```sql
     SELECT * FROM arbitration_actions 
     WHERE order_exception_id = ? AND action_type = 'REFUND' AND status = 'SUCCESS'
     ```
     → **存在记录！**
   - 返回错误：`"该订单已执行过退款，不可重复退款"`
   - 前端：显示红色错误提示，不允许操作

**数据保护机制：**
- 数据库层面的唯一约束（逻辑上的，通过查询实现）
- 即使前端绕过，后端也会拒绝
- 同时检查待处理退款，防止并发退款

**代码位置：**
- 后端规则：`backend/src/rules/arbitrationRules.js` 的 `canPerformAction` 函数
- 检查逻辑：
  ```javascript
  if (actionType === 'REFUND') {
    const refundActions = await allAsync(
      `SELECT * FROM arbitration_actions 
       WHERE order_exception_id = ? AND action_type = 'REFUND' AND status = 'SUCCESS'`,
      [exceptionId]
    );
    
    if (refundActions.length > 0) {
      return { allowed: false, reason: '该订单已执行过退款，不可重复退款' };
    }
  }
  ```

**复查要点（按照此路径逐一验证）：**
1. [ ] 选择一个订单，执行退款操作（确保成功）
2. [ ] 查看执行记录，确认有一条"成功"状态的退款
3. [ ] 再次点击"退款"按钮
4. [ ] 确认后发起请求
5. [ ] 后端返回错误："该订单已执行过退款，不可重复退款"
6. [ ] 前端显示红色错误提示
7. [ ] 执行记录中没有新增第二条退款记录
8. [ ] 时间线中没有新增事件

---

## 四、API端点列表

### 异常订单相关

| 方法 | 端点 | 功能 |
|------|------|------|
| GET | `/api/exceptions` | 获取异常订单列表 |
| GET | `/api/exceptions/:id` | 获取异常订单详情（含证据、动作、时间线） |
| POST | `/api/exceptions/:id/lock` | 锁定订单 |
| POST | `/api/exceptions/:id/unlock` | 解锁订单 |
| POST | `/api/exceptions/:id/actions` | 执行仲裁动作 |
| POST | `/api/exceptions/:id/actions/:actionId/retry` | 重试失败动作 |
| POST | `/api/exceptions/:id/resolve` | 完成仲裁 |

### 导出相关

| 方法 | 端点 | 功能 |
|------|------|------|
| GET | `/api/export/arbitration/csv` | 导出仲裁记录CSV |
| GET | `/api/export/arbitration/:id/details` | 获取单条仲裁详情（JSON） |

---

## 五、数据库表结构

### 核心表

#### orders（订单表）
- `id`: 主键
- `order_no`: 订单号（唯一）
- `user_id`: 用户ID
- `total_amount`: 订单金额
- `status`: 订单状态
- `created_at`, `updated_at`: 时间戳

#### order_exceptions（异常记录表）
- `id`: 主键
- `order_id`: 关联订单
- `exception_type`: 异常类型（INVENTORY_FAILURE/LOGISTICS_CANCEL/DISCOUNT_EXCEPTION）
- `status`: 异常状态（PENDING/RESOLVED）
- `locked_by`, `locked_at`: 锁定信息
- `resolution`, `resolution_reason`, `resolved_at`: 仲裁结果
- `evidence_gap`: 证据缺口描述

#### order_evidence（证据表）
- `id`: 主键
- `order_exception_id`: 关联异常
- `evidence_type`: 证据类型（PAYMENT/INVENTORY/LOGISTICS/DISCOUNT）
- `evidence_data`: JSON格式的证据数据
- `is_valid`: 是否有效

#### arbitration_actions（仲裁动作表）
- `id`: 主键
- `order_exception_id`: 关联异常
- `action_type`: 动作类型（REFUND/RESEND/CLOSE/CONTINUE_FULFILLMENT/ROLLBACK_FAILED）
- `action_data`: 动作参数
- `status`: 执行状态（PENDING/SUCCESS/FAILED）
- `executed_by`, `executed_at`: 执行人、时间
- `retry_count`: 重试次数
- `last_error`: 最后错误信息

#### order_timeline（订单时间线）
- `id`: 主键
- `order_id`: 关联订单
- `event_type`: 事件类型
- `event_data`: 事件数据（JSON）
- `operator`: 操作者
- `created_at`: 时间戳

#### operators（操作员表）
- `id`: 主键
- `name`: 姓名
- `role`: 角色
