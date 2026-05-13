# 账户余额冻结 API - 补充说明文档

## 1. API 主要边界条件

### 1.1 账户状态边界
- **账户关闭后不能新增冻结**：当账户状态为 `closed` 时，任何冻结请求都将被拒绝，返回错误码 `ACCOUNT_CLOSED`
- **验证位置**：`services.py:69-70` 中的 `freeze()` 方法
- **边界检查**：
  - 账户必须存在且状态为 `active`
  - 关闭的账户只能查询历史流水，不能进行任何资金操作

### 1.2 冻结金额边界
- **余额不足不能冻结**：当账户可用余额小于请求冻结金额时，返回错误码 `INSUFFICIENT_BALANCE`
- **验证位置**：`services.py:72-73`
- **计算公式**：`可用余额 >= 冻结金额`
- **注意**：冻结金额必须大于 0，否则返回 `INVALID_AMOUNT`

### 1.3 业务单幂等性边界
- **同一业务单重复冻结幂等**：相同 `business_order_id` 的冻结请求只会执行一次，后续请求返回 `is_duplicate: true`
- **验证位置**：`services.py:55-63`
- **幂等策略**：
  - 首次请求：创建冻结记录，扣减可用余额，增加冻结余额
  - 重复请求：返回已有记录，不进行金额变更，`transaction` 为 `null`
  - 数据库层面通过 `business_order_id` 唯一约束确保并发安全性

### 1.4 扣划金额边界
- **扣划不能超过冻结额**：扣划金额必须小于等于当前冻结记录的 `current_amount`
- **验证位置**：`services.py:188-192`
- **边界检查**：
  - 冻结记录必须存在且状态不是 `closed`
  - `扣划金额 <= 当前冻结金额`
  - 超过时返回 `EXCEED_FROZEN_AMOUNT`

### 1.5 部分解冻边界
- **解冻金额 <= 当前冻结金额**：每次解冻都会减少冻结金额，增加可用余额
- **验证位置**：`services.py:134-138`
- **状态转换逻辑**（`services.py:146-151`）：
  - 解冻后剩余冻结额为 0 且未扣划 → 状态变为 `unfrozen`
  - 解冻后剩余冻结额为 0 但有扣划 → 状态变为 `deducted`
  - 解冻后仍有剩余冻结额 → 状态变为 `partial_unfrozen`

### 1.6 争议关闭边界
- **争议关闭前必须处理完所有冻结余额**：关闭争议时 `current_amount` 必须为 0
- **验证位置**：`services.py:242-246`
- **关闭后拦截**：
  - 争议关闭后状态变为 `closed`
  - 再次操作同一业务单（冻结、解冻、扣划）将被明确拦截
  - 返回错误码 `DISPUTE_CLOSED`
- **关闭后幂等**：重复关闭请求返回 `is_duplicate: true`

## 2. 一个失败路径（超额扣划场景）

### 2.1 失败场景描述
**场景**：用户账户有部分冻结余额，但尝试扣划金额超过当前冻结额

### 2.2 完整执行步骤
1. **账户充值 1000 元**
   - 接口：`POST /api/accounts/acc_001/deposit`
   - 数据：`{"amount": 1000}`
   - 结果：可用余额 = 1000，冻结余额 = 0，总余额 = 1000

2. **发起冻结 500 元**
   - 接口：`POST /api/accounts/acc_001/freeze`
   - 数据：`{"business_order_id": "order_001", "amount": 500, "reason": "用户投诉"}`
   - 结果：可用余额 = 500，冻结余额 = 500，总余额 = 1000

3. **部分解冻 200 元**
   - 接口：`POST /api/accounts/acc_001/unfreeze`
   - 数据：`{"business_order_id": "order_001", "amount": 200}`
   - 结果：可用余额 = 700，冻结余额 = 300，总余额 = 1000
   - 冻结记录状态：`partial_unfrozen`

4. **尝试超额扣划 400 元（失败步骤）**
   - 接口：`POST /api/accounts/acc_001/deduct`
   - 数据：`{"business_order_id": "order_001", "amount": 400}`
   - 当前冻结额：300 元
   - 请求扣划：400 元

### 2.3 失败原因分析
- **触发条件**：`400 > 300`（扣划金额 > 当前冻结金额）
- **验证代码**：`services.py:188-192`
  ```python
  if freeze_record.current_amount < amount:
      raise ServiceError(
          f"扣划金额超过当前冻结额，当前冻结额: {freeze_record.current_amount}",
          code="EXCEED_FROZEN_AMOUNT"
      )
  ```

### 2.4 失败响应
```json
{
    "success": false,
    "error": {
        "code": "EXCEED_FROZEN_AMOUNT",
        "message": "扣划金额超过当前冻结额，当前冻结额: 300.0"
    }
}
```

### 2.5 系统状态变化
- **账户余额**：无变化（可用 700，冻结 300，总余额 1000）
- **冻结记录**：无变化（current_amount = 300）
- **流水记录**：无新增流水（事务回滚）

### 2.6 正确的后续操作
应该扣划 300 元而不是 400 元：
```bash
curl -s -X POST "http://localhost:5001/api/accounts/acc_001/deduct" \
  -H "Content-Type: application/json" \
  -d '{"business_order_id": "order_001", "amount": 300}'
```

## 3. 一次重复执行路径（重复冻结场景）

### 3.1 场景描述
**场景**：客服可能因网络超时或操作失误，对同一笔业务单重复发起冻结请求

### 3.2 完整执行步骤
1. **首次冻结请求（成功）**
   - 接口：`POST /api/accounts/acc_001/freeze`
   - 数据：`{"business_order_id": "order_001", "amount": 500, "reason": "用户投诉"}`
   - 验证流程（`services.py:55-63`）：
     - 检查 `business_order_id` 是否已存在
     - 不存在 → 继续执行
     - 检查账户状态（必须是 active）
     - 检查可用余额是否充足
   
   - 执行操作（`services.py:75-116`）：
     - 创建 `FreezeRecord` 记录
     - `account.available_balance -= 500`（1000 → 500）
     - `account.frozen_balance += 500`（0 → 500）
     - 写入 `Transaction` 流水
     - 数据库事务提交
   
   - 结果：
     - 可用余额：500
     - 冻结余额：500
     - 总余额：1000（不变）
     - 冻结记录状态：`frozen`
     - 响应中 `is_duplicate: false`

2. **重复冻结请求（幂等处理）**
   - 接口：`POST /api/accounts/acc_001/freeze`
   - 数据：`{"business_order_id": "order_001", "amount": 500, "reason": "用户投诉"}`
   
   - 验证流程（`services.py:55-63`）：
     - 检查 `business_order_id` 是否已存在
     - **存在 → 直接返回已有记录**
     - 检查该记录状态是否为 `closed`
     - 非关闭状态 → 返回幂等响应
   
   - 执行操作：
     - **不创建新的冻结记录**
     - **不修改账户余额**
     - **不写入新流水**
     - 返回已有冻结记录
   
   - 结果：
     - 可用余额：仍为 500（无变化）
     - 冻结余额：仍为 500（无变化）
     - 总余额：仍为 1000（无变化）
     - 冻结记录状态：仍为 `frozen`
     - 响应中 `is_duplicate: true`
     - `transaction: null`（无新流水）

### 3.3 幂等性保障机制
1. **应用层检查**（`services.py:55-56`）
   - 查询 `FreezeRecord` 是否存在该 `business_order_id`
   - 存在则直接返回，不执行后续逻辑

2. **数据库层约束**（`models.py:56`）
   - `business_order_id = db.Column(db.String(64), unique=True, nullable=False)`
   - 数据库唯一约束确保即使并发请求，也只会插入一条记录

3. **异常捕获重试**（`services.py:101-110`）
   - 捕获 `IntegrityError`（唯一约束冲突）
   - 回滚事务后查询已有记录并返回

### 3.4 重复请求响应示例
```json
{
    "success": true,
    "data": {
        "freeze_record": {
            "freeze_record_id": 1,
            "business_order_id": "order_001",
            "account_id": "acc_001",
            "original_amount": 500.0,
            "current_amount": 500.0,
            "deducted_amount": 0.0,
            "status": "frozen",
            "reason": "用户投诉商品质量问题",
            "created_at": "2026-05-13T09:06:11.165847",
            "updated_at": "2026-05-13T09:06:11.165848"
        },
        "transaction": null,
        "is_duplicate": true
    }
}
```

## 4. 流水可追踪性与账户摘要重算

### 4.1 流水设计要点
- **所有资金操作都生成流水**：充值、冻结、解冻、扣划、争议关闭
- **每条流水记录操作后的余额**：`available_balance_after`, `frozen_balance_after`, `total_balance_after`
- **流水关联业务单**：`business_order_id` 字段可追溯每笔操作来源

### 4.2 账户摘要重算逻辑
查询接口 (`services.py:272-317`) 实现了自动对账：
```python
reconciliation_check = {
    "calculated_available": total_deposit - total_freeze + total_unfreeze,
    "calculated_frozen": total_freeze - total_unfreeze - total_deduct,
    "calculated_total": total_deposit - total_deduct,
    "is_consistent": 比较计算值与实际值
}
```

### 4.3 重算验证
测试脚本输出显示：
```json
"reconciliation_check": {
    "calculated_available": 700.0,
    "calculated_frozen": 0.0,
    "calculated_total": 700.0,
    "actual_available": 700.0,
    "actual_frozen": 0.0,
    "actual_total": 700.0,
    "is_consistent": true
}
```

## 5. 复查要点清单

### 5.1 核心功能复查
- [ ] 充值后可用余额增加，总余额增加
- [ ] 冻结后可用余额减少，冻结余额增加，总余额不变
- [ ] 解冻后可用余额增加，冻结余额减少，总余额不变
- [ ] 扣划后冻结余额减少，总余额减少
- [ ] 重复冻结请求返回 `is_duplicate: true`
- [ ] 余额不足冻结返回 `INSUFFICIENT_BALANCE`
- [ ] 超额扣划返回 `EXCEED_FROZEN_AMOUNT`
- [ ] 争议关闭后再次操作返回 `DISPUTE_CLOSED`
- [ ] 对账检查 `is_consistent: true`

### 5.2 数据一致性复查
- [ ] 每条流水的 `available_balance_after` + `frozen_balance_after` = `total_balance_after`
- [ ] 所有流水可重算出账户当前余额
- [ ] 冻结记录的 `current_amount` 与账户 `frozen_balance` 对应
