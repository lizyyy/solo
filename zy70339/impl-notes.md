# 变更冻结日历 API - 补充说明

## 一、主要边界（复查清单）

### 1. 全局冻结 vs 服务级冻结

**边界定义：**
- **全局冻结（scope=global）**：影响所有服务，无 `affected_services` 限制
- **服务级冻结（scope=service）**：仅影响 `affected_services` 中列出的服务

**关键代码位置：**
- `src/freezeEngine.js:28-35` (`findCrossingWindows` 函数中的过滤逻辑)

**复查要点：**
- ✅ 全局冻结窗口应该对所有服务生效
- ✅ 服务级冻结窗口只对指定服务生效
- ✅ 服务名匹配是精确匹配（不是前缀匹配）
- ✅ 服务级冻结必须提供 `affected_services`（API 层校验）

### 2. 只读变更豁免规则

**边界定义：**
- 冻结窗口的 `allow_readonly=true` 时，只读类型变更（change_type=readonly）可豁免
- 如果变更时间跨越多个冻结窗口，**所有**窗口都必须豁免只读，否则仍被阻止

**关键代码位置：**
- `src/freezeEngine.js:81-91` (`evaluateChange` 函数中的只读豁免逻辑)

**复查要点：**
- ✅ 单个窗口豁免：只读变更可通过
- ✅ 多个窗口部分豁免：只读变更被阻止（因为 `blockedByNonReadonlyWindow` 为 true）
- ✅ 豁免只对 change_type=readonly 生效，其他类型仍被阻止
- ✅ 豁免检查发生在全局/服务级范围过滤之后

### 3. 时间窗口交叉判断

**边界定义：**
- 变更时间与冻结窗口有**任意重叠**即算命中，包括：
  - 变更完全在冻结窗口内
  - 变更开始在窗口内，结束在窗口外
  - 变更开始在窗口外，结束在窗口内
  - 变更完全包含冻结窗口

**关键代码位置：**
- `src/freezeEngine.js:21-36` (`findCrossingWindows` 函数)

**SQL 逻辑：**
```sql
WHERE NOT (end_time < ? OR start_time > ?)
-- 等价于：存在重叠
```

**复查要点：**
- ✅ 变更开始 = 冻结结束：不命中（边界值不重叠）
- ✅ 变更结束 = 冻结开始：不命中（边界值不重叠）
- ✅ 变更跨越多个冻结窗口：命中所有窗口

### 4. 例外审批有效期检查

**边界定义：**
- 审批有 `valid_from` 和 `valid_until`
- 变更的 `planned_start` 必须 >= `valid_from`
- 变更的 `planned_end` 必须 <= `valid_until`
- 审批有 `applicable_services`，如果指定则变更服务必须在列表中

**关键代码位置：**
- `src/freezeEngine.js:105-138` (例外审批检查逻辑)

**复查要点：**
- ✅ 审批未指定有效期（null）：默认可用（valid_from=纪元0，valid_until=9999-12-31）
- ✅ 审批未指定 applicable_services：适用于所有服务
- ✅ 变更时间超出审批有效期：审批失效
- ✅ 变更服务不在审批适用列表中：审批失效
- ✅ 只检查最新的已通过审批

### 5. 重复提交检测

**边界定义：**
- 变更申请的 `change_id` 有唯一约束
- 重复提交返回 409 Conflict，附带现有申请详情

**关键代码位置：**
- `src/database.js:33` (UNIQUE constraint on change_id)
- `src/freezeEngine.js:281-292` (捕获唯一约束异常)
- `src/index.js:139-141` (返回 409)

**复查要点：**
- ✅ 相同 change_id 第二次提交：409
- ✅ 重复提交时返回 existing_request 详情
- ✅ 重复提交时也返回 evaluation 结果（即使不创建记录）

---

## 二、一个失败路径（场景演练）

### 场景：大促前夜普通发布

**路径描述：**
```
提交普通变更申请 → 命中全局冻结 → 评估为 blocked → 状态设为 rejected → 返回拒绝原因
```

**步骤详解：**

1. **创建冻结窗口**（前置条件）
   ```bash
   # 创建双十一全局冻结
   curl -X POST http://localhost:3000/api/v1/freeze-windows \
     -H "Content-Type: application/json" \
     -d '{
       "name": "双十一前大促冻结",
       "start_time": "2026-11-10T00:00:00.000Z",
       "end_time": "2026-11-12T23:59:59.999Z",
       "scope": "global",
       "risk_level": "high",
       "allow_readonly": false
     }'
   ```

2. **提交变更申请**（失败起点）
   ```bash
   curl -X POST http://localhost:3000/api/v1/change-requests \
     -H "Content-Type: application/json" \
     -d '{
       "change_id": "RELEASE-2026-1110-001",
       "service": "user-service",
       "change_type": "normal",
       "risk_level": "medium",
       "planned_start": "2026-11-10T22:00:00.000Z",
       "planned_end": "2026-11-10T23:00:00.000Z",
       "description": "用户中心新功能上线"
     }'
   ```

3. **评估流程**（核心判断）
   - `findCrossingWindows` 检测到 2026-11-10 22:00 ~ 23:00 与全局冻结重叠
   - `evaluateChange` 检查 change_type=normal，非只读
   - 检查是否有 existing_approval：无
   - 结果：`status = "blocked"`, `can_publish = false`

4. **返回结果**
   ```json
   {
     "data": {
       "id": "...",
       "change_id": "RELEASE-2026-1110-001",
       "status": "rejected",
       "evaluation": {
         "can_publish": false,
         "status": "blocked",
         "reasons": [
           "变更时间窗口命中 1 个冻结窗口",
           "- 双十一前大促冻结 (2026-11-10T00:00:00.000Z ~ 2026-11-12T23:59:59.999Z, 风险等级: high)"
         ],
         "hit_windows": [
           { "name": "双十一前大促冻结", "scope": "global", "risk_level": "high", ... }
         ],
         "available_windows": [
           { "date": "2026-11-13", "available": true },
           { "date": "2026-11-14", "available": true },
           ...
         ]
       }
     }
   }
   ```

**失败原因：** 普通变更在大促全局冻结窗口内，且无例外审批。

**后续可选动作：**
- 等待冻结结束后发布（查看 available_windows）
- 走紧急修复流程（将 change_type 改为 emergency）
- 申请例外审批

---

## 三、一次重复执行路径（幂等性演练）

### 场景：紧急修复多次提交

**路径描述：**
```
第一次提交紧急变更 → 状态 exception_requested → 审批通过 → 状态 exception_approved
↓
第二次提交相同 change_id → 检测到重复 → 409 Conflict → 返回现有申请详情
↓
第三次评估（使用相同 change_id） → 检测到现有审批 → status = allowed
```

**步骤详解：**

1. **第一次提交**（创建记录）
   ```bash
   curl -X POST http://localhost:3000/api/v1/change-requests \
     -H "Content-Type: application/json" \
     -d '{
       "change_id": "HOTFIX-2026-1110-001",
       "service": "payment-service",
       "change_type": "emergency",
       "risk_level": "high",
       "planned_start": "2026-11-10T20:00:00.000Z",
       "planned_end": "2026-11-10T20:30:00.000Z",
       "description": "修复支付回调超时"
     }'
   ```
   - 结果：`status = "exception_requested"`
   - 因为 change_type=emergency，需要例外审批

2. **例外审批通过**
   ```bash
   curl -X POST http://localhost:3000/api/v1/change-requests/<request_id>/approve-exception \
     -H "Content-Type: application/json" \
     -d '{
       "approver": "director@example.com",
       "reason": "支付故障影响交易，紧急放行",
       "valid_from": "2026-11-10T19:00:00.000Z",
       "valid_until": "2026-11-10T21:00:00.000Z",
       "applicable_services": ["payment-service"]
     }'
   ```
   - 结果：`status = "exception_approved"`
   - 审批记录创建，包含有效期和适用服务

3. **第二次提交**（重复提交，触发 409）
   ```bash
   curl -X POST http://localhost:3000/api/v1/change-requests \
     -H "Content-Type: application/json" \
     -d '{
       "change_id": "HOTFIX-2026-1110-001",
       "service": "payment-service",
       "change_type": "emergency",
       "risk_level": "high",
       "planned_start": "2026-11-10T20:00:00.000Z",
       "planned_end": "2026-11-10T20:30:00.000Z"
     }'
   ```
   - 返回：409 Conflict
   - `error: "DUPLICATE_CHANGE_ID"`
   - 附带 `existing_request`（status=exception_approved）和 `evaluation`

4. **第三次评估**（使用 evaluate 接口，验证审批有效性）
   ```bash
   curl -X POST http://localhost:3000/api/v1/evaluate \
     -H "Content-Type: application/json" \
     -d '{
       "change_id": "HOTFIX-2026-1110-001",
       "service": "payment-service",
       "change_type": "emergency",
       "risk_level": "high",
       "planned_start": "2026-11-10T20:00:00.000Z",
       "planned_end": "2026-11-10T20:30:00.000Z"
     }'
   ```
   - 检查到 existing.status = "exception_approved"
   - 检查 latestApproval：
     - valid_from = 2026-11-10T19:00:00 <= planned_start ✓
     - valid_until = 2026-11-10T21:00:00 >= planned_end ✓
     - applicable_services = ["payment-service"] 包含当前服务 ✓
   - 结果：`status = "allowed"`, `can_publish = true`
   - 返回 `existing_approval` 详情：
     ```json
     "existing_approval": {
       "approval_id": "...",
       "valid_from": "2026-11-10T19:00:00.000Z",
       "valid_until": "2026-11-10T21:00:00.000Z",
       "applicable_services": ["payment-service"]
     }
     ```

**重复执行的关键特性：**
- ✅ 写入操作（POST /change-requests）有去重保护
- ✅ 读取操作（POST /evaluate）是幂等的，可重复查询
- ✅ 审批信息在重复评估时自动生效，无需再次申请
- ✅ 发布系统可以轮询 evaluate 接口获取最新状态

---

## 四、API 返回字段速查

### POST /api/v1/evaluate 返回结构

| 字段 | 类型 | 说明 |
|------|------|------|
| `can_publish` | boolean | 是否可立即发布 |
| `status` | string | 状态：`allowed` / `requires_exception` / `blocked` |
| `reasons` | string[] | 拒绝/通过原因列表 |
| `hit_windows` | array | 命中的冻结窗口详情 |
| `requires_exception` | boolean | 是否需要例外审批 |
| `existing_approval` | object/null | 有效的例外审批信息（如有） |
| `available_windows` | array | 未来一周可发布日期 |
| `duplicate_check` | object/null | 重复提交检测结果 |

### existing_approval 结构

| 字段 | 类型 | 说明 |
|------|------|------|
| `approval_id` | string | 审批记录ID |
| `valid_from` | string | 审批生效开始时间 |
| `valid_until` | string | 审批失效时间 |
| `applicable_services` | string[]/null | 适用的服务列表，null表示所有服务 |

### 发布系统集成建议

1. **调用时机**：发布工单创建时、发布执行前
2. **判断逻辑**：
   ```javascript
   if (evaluation.can_publish) {
     // 允许发布
   } else if (evaluation.requires_exception) {
     // 引导用户申请例外审批
   } else {
     // 阻止发布，显示 reasons
     // 展示 available_windows 供用户选择
   }
   ```
3. **状态轮询**：紧急审批通过后，可通过相同 change_id 再次调用 evaluate 确认放行
