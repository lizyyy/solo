# 内部服务配额 API - 补充说明

## 一、主要边界条件

### 1.1 时间边界
- **配额周期**: 按月计算（YYYY-MM 格式）
- **当前月份**: 系统默认使用当前 UTC 时间所在月份
- **扩容有效期**: 临时扩容有明确的 start_date 和 end_date，过期自动失效
- **借用期限**: 借用仅在申请的当月有效，跨月需要重新申请

### 1.2 数据边界
- **request_id 唯一性**: 每次调用上报必须携带唯一的 request_id，用于幂等性控制
- **团队 ID 校验**: 所有操作都需要校验 team_id 是否存在
- **服务 ID 校验**: 所有操作都需要校验 service_id 是否存在
- **配额值**: 配额值必须为非负整数
- **调用量**: 上报的调用量必须为正整数

### 1.3 业务规则边界
- **借用互斥**: 同一对团队（借入方-借出方）同一服务同一月份只能有一个借用申请
- **借出方余额检查**: 申请时和审批时都要检查借出方是否有足够的可用配额
- **不能自借**: borrower_id 不能等于 lender_id
- **审批状态限制**: 只有 pending 状态的申请可以审批
- **配额使用优先级**: base → expansion → borrowed

### 1.4 优先级边界
- **低优先级 (normal)**: 额度不足时直接冻结
- **高优先级 (high)**: 额度不足时记录风险，调用继续执行

---

## 二、一个失败路径

### 场景描述
**支付网关团队**尝试在**借用审批前**使用借用的配额

### 执行步骤
```
步骤 1: 支付网关团队 (ID=3) 向用户中心团队 (ID=4) 发起借用申请
        - 服务: 统一认证服务 (ID=1)
        - 借用金额: 10000
        - 状态: pending

步骤 2: 支付网关团队尝试使用 50000 额度
        - 支付网关团队自身配额: 40000
        - 申请使用: 50000
        - 期望: 应该被拒绝（借用未审批，额外额度不可用）

步骤 3: 审批借用申请
        - 状态变为 approved

步骤 4: 支付网关团队再次尝试使用
        - 自身配额 40000 + 借用 10000 = 50000
        - 可以正常使用
```

### 关键点验证
1. **步骤 2 的失败是预期行为**
   - 检查点: 借用状态必须是 'approved' 才计入可用额度
   - 代码位置: `app.py:51-56`
   ```python
   approved_borrows = BorrowRequest.query.filter(
       BorrowRequest.borrower_id == team_id,
       BorrowRequest.service_id == service_id,
       BorrowRequest.month == month,
       BorrowRequest.status == 'approved'  # 只有 approved 才算
   ).all()
   ```

2. **冻结记录应正确生成**
   - 检查点: 返回 403 状态码，创建 FrozenRecord
   - 代码位置: `app.py:295-316`

3. **审批后才能使用**
   - 检查点: 审批后调用 get_team_available_quota 应包含 borrowed 额度
   - 代码位置: `app.py:524-552` (approve_borrow)

### 预期结果
- 步骤 2 返回: `{'status': 'frozen', 'message': 'Call frozen: quota exceeded', 'available': 40000}`
- 步骤 4 返回: `{'status': 'normal', 'source': 'borrowed'}` 或混合

---

## 三、一次重复执行路径

### 场景描述
**交易平台团队**上报同一次调用量两次（网络重试场景）

### 执行步骤
```
步骤 1: 首次上报
        - team_id: 1 (交易平台团队)
        - service_id: 1 (统一认证服务)
        - request_id: req_dup_test_001
        - amount: 500
        - 结果: 成功，额度减少 500

步骤 2: 重复上报（相同 request_id）
        - 同样的参数再次调用
        - 结果: 返回已存在记录，is_duplicate: true

步骤 3: 验证额度
        - 检查剩余额度，确认只扣减了一次
```

### 关键点验证
1. **request_id 唯一索引**
   - 检查点: UsageRecord 表的 request_id 有唯一约束
   - 代码位置: `models.py:57`
   ```python
   request_id = db.Column(db.String(100), unique=True, nullable=False)
   ```

2. **幂等性检查逻辑**
   - 检查点: 先查询是否已存在相同 request_id
   - 代码位置: `app.py:215-231`
   ```python
   existing = UsageRecord.query.filter_by(request_id=data['request_id']).first()
   if existing:
       return jsonify({
           'message': 'Duplicate request, returning existing record',
           'is_duplicate': True,
           'record': {...}
       }), 200  # 返回 200，不是 201
   ```

3. **额度只扣减一次**
   - 检查点: 重复上报不会进入后续的配额扣减逻辑
   - 验证方法:
     - 首次上报后: base.used = X
     - 重复上报后: base.used 仍然 = X

### 预期结果
- 步骤 1 返回 201 Created
- 步骤 2 返回 200 OK，is_duplicate: true
- 额度验证: 两次调用后，已用量只增加了 500

---

## 四、复查清单

### 4.1 边界条件复查
- [ ] 月度切换时，旧月份的借用和扩容是否正确处理？
- [ ] 扩容过期后，是否真的不再计入可用额度？
- [ ] 同一对团队同一服务同一月份是否只能有一个借用？
- [ ] 借出方在审批时余额不足，是否被拒绝？
- [ ] 高优先级调用是否真的不计入正常已用量？

### 4.2 失败路径复查
- [ ] 未审批的借用是否真的无法使用？
- [ ] 审批被拒绝的借用是否也无法使用？
- [ ] 冻结记录是否正确关联到 team、service、month？
- [ ] 超额时返回的 available 是否正确计算？

### 4.3 重复执行路径复查
- [ ] 相同 request_id 多次调用是否只扣减一次？
- [ ] 重复调用返回的状态码是 200 还是 201？
- [ ] 重复调用的响应中 is_duplicate 是否为 true？
- [ ] 如果并发两个相同 request_id 的请求，数据库唯一约束是否能兜底？

### 4.4 对账准确性复查
- [ ] base_quota 是否等于 Quota 表的 monthly_quota？
- [ ] base_used 是否等于 source='base' 且 status in ['normal', 'risk'] 的总和？
- [ ] expansion_total 是否只统计 status='approved' 的？
- [ ] borrowed 和 lent 是否成对出现（同一 borrow_id 两边都能看到）？
- [ ] discrepancy 是否正确计算？

---

## 五、数据模型关系图

```
Team (团队)
  ├── id
  ├── name
  └── description

Service (服务)
  ├── id
  ├── name
  └── description

Quota (月度配额)
  ├── team_id (FK)
  ├── service_id (FK)
  ├── monthly_quota
  └── month (YYYY-MM)

UsageRecord (调用记录)
  ├── team_id (FK)
  ├── service_id (FK)
  ├── request_id (唯一，幂等键)
  ├── amount
  ├── priority (normal/high)
  ├── status (normal/risk)
  ├── source (base/expansion/borrowed)
  ├── month
  ├── borrow_request_id (FK, nullable)
  └── expansion_request_id (FK, nullable)

RiskRecord (风险记录)
  ├── usage_record_id (FK)
  └── description

FrozenRecord (冻结记录)
  ├── team_id (FK)
  ├── service_id (FK)
  ├── request_id (唯一)
  ├── amount
  ├── reason
  └── month

BorrowRequest (借用申请)
  ├── borrower_id (FK)
  ├── lender_id (FK)
  ├── service_id (FK)
  ├── amount
  ├── month
  ├── status (pending/approved/rejected)
  ├── used_amount (实际使用量)
  ├── approved_at
  └── rejected_at

ExpansionRequest (扩容申请)
  ├── team_id (FK)
  ├── service_id (FK)
  ├── amount
  ├── start_date
  ├── end_date
  ├── status (pending/approved/rejected)
  ├── used_amount (实际使用量)
  ├── approved_at
  └── rejected_at

Reconciliation (月度对账)
  ├── team_id (FK)
  ├── service_id (FK)
  ├── month
  ├── base_quota/base_used/base_remaining
  ├── expansion_total/used/remaining
  ├── borrowed_total/used/remaining
  ├── lent_total/used/remaining
  ├── frozen_amount/count
  ├── overage_amount/risk_count
  ├── total_available/used/remaining
  └── discrepancy
```
