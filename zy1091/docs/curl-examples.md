# Flatmate Manager API - curl 示例

本文档提供了常用 API 的 curl 示例，可以直接复制使用。

---

## 基础配置

```bash
# 基础 URL
BASE_URL="http://localhost:3000/api/v1"

# 用户 ID（用于模拟登录用户）
USER_ID_ADMIN=1    # 张三（管理员）
USER_ID_2=2         # 李四
USER_ID_3=3         # 王五
```

---

## 健康检查

```bash
# 检查服务是否正常运行
curl -X GET "${BASE_URL}/health" \
  -H "Content-Type: application/json"
```

---

## 室友管理

### 获取所有室友

```bash
curl -X GET "${BASE_URL}/flatmates" \
  -H "Content-Type: application/json"
```

### 获取所有室友（包含非活跃）

```bash
curl -X GET "${BASE_URL}/flatmates?include_inactive=true" \
  -H "Content-Type: application/json"
```

### 创建新室友

```bash
curl -X POST "${BASE_URL}/flatmates" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试室友",
    "email": "test@example.com",
    "phone": "13800138888",
    "is_admin": false
  }'
```

### 获取单个室友详情

```bash
curl -X GET "${BASE_URL}/flatmates/1" \
  -H "Content-Type: application/json"
```

### 更新室友信息

```bash
curl -X PUT "${BASE_URL}/flatmates/1" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "更新后的名字",
    "email": "updated@example.com"
  }'
```

---

## 账单管理

### 获取所有账单

```bash
curl -X GET "${BASE_URL}/bills" \
  -H "Content-Type: application/json"
```

### 获取待处理账单

```bash
curl -X GET "${BASE_URL}/bills?status=pending" \
  -H "Content-Type: application/json"
```

### 获取水电费账单

```bash
curl -X GET "${BASE_URL}/bills?category=utility" \
  -H "Content-Type: application/json"
```

---

## 创建账单 - 四种分摊方式

### 方式一：均摊

适用于水电费、房租等大家平摊的费用。

```bash
curl -X POST "${BASE_URL}/bills" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 1" \
  -d '{
    "title": "2024年1月水电费",
    "description": "包含电费、水费、燃气费",
    "category": "utility",
    "total_amount": 600.00,
    "split_type": "equal",
    "due_date": "2024-02-15"
  }'
```

### 方式二：按比例分摊

适用于有人用得多有人用得少的情况。

```bash
curl -X POST "${BASE_URL}/bills" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 1" \
  -d '{
    "title": "公共用品采购",
    "description": "卫生纸、洗洁精、洗衣液等",
    "category": "supplies",
    "total_amount": 150.00,
    "split_type": "ratio",
    "split_config": {
      "ratios": [
        { "flatmate_id": 1, "ratio": 0.4 },
        { "flatmate_id": 2, "ratio": 0.3 },
        { "flatmate_id": 3, "ratio": 0.3 }
      ]
    }
  }'
```

### 方式三：指定人员分摊

适用于只有部分人参与的费用（如网络费）。

```bash
curl -X POST "${BASE_URL}/bills" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 1" \
  -d '{
    "title": "2024年1月网络费",
    "description": "只有我和李四用网络，王五不用",
    "category": "service",
    "total_amount": 200.00,
    "split_type": "specific",
    "split_config": {
      "assignments": [
        { "flatmate_id": 1, "amount": 100 },
        { "flatmate_id": 2, "amount": 100 }
      ]
    }
  }'
```

### 方式四：垫付后报销

适用于有人先垫付，其他人后续转账的情况。

```bash
curl -X POST "${BASE_URL}/bills" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 1" \
  -d '{
    "title": "2024年1月房租",
    "description": "我先垫付，大家后续转钱给我",
    "category": "rent",
    "total_amount": 9000.00,
    "split_type": "advance",
    "advanced_by_id": 1,
    "due_date": "2024-01-15"
  }'
```

---

## 获取账单详情

### 获取单个账单详情

```bash
curl -X GET "${BASE_URL}/bills/1" \
  -H "Content-Type: application/json"
```

### 获取账单的分摊规则

```bash
curl -X GET "${BASE_URL}/bills/1/split-rules" \
  -H "Content-Type: application/json"
```

### 获取账单的付款记录

```bash
curl -X GET "${BASE_URL}/bills/1/payments" \
  -H "Content-Type: application/json"
```

---

## 余额与对账单

### 获取整体余额汇总

```bash
curl -X GET "${BASE_URL}/bills/balance/summary" \
  -H "Content-Type: application/json"
```

### 获取室友对账单

```bash
# 获取张三的对账单
curl -X GET "${BASE_URL}/bills/statement/1" \
  -H "Content-Type: application/json"

# 获取张三的对账单（指定时间范围）
curl -X GET "${BASE_URL}/bills/statement/1?start_date=2024-01-01&end_date=2024-01-31" \
  -H "Content-Type: application/json"

# 获取张三的待支付账单
curl -X GET "${BASE_URL}/bills/statement/1?status=pending" \
  -H "Content-Type: application/json"
```

---

## 付款管理

### 记录付款（不使用积分）

```bash
curl -X POST "${BASE_URL}/payments" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 2" \
  -d '{
    "bill_id": 1,
    "split_rule_id": 2,
    "amount": 200.00,
    "use_points": false,
    "payment_method": "wechat",
    "receiver_id": 1,
    "transaction_id": "wx20240115123456",
    "notes": "微信转账给张三"
  }'
```

### 记录付款（使用积分抵扣）

```bash
curl -X POST "${BASE_URL}/payments" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 2" \
  -d '{
    "bill_id": 1,
    "split_rule_id": 2,
    "amount": 190.00,
    "use_points": true,
    "points_to_use": 100,
    "payment_method": "alipay",
    "receiver_id": 1,
    "notes": "使用100积分抵扣10元，支付宝转账190元"
  }'
```

### 获取我的付款记录

```bash
curl -X GET "${BASE_URL}/payments/my" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 1"
```

### 获取待我确认的付款

```bash
curl -X GET "${BASE_URL}/payments/to-confirm" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 1"
```

### 确认付款

```bash
curl -X POST "${BASE_URL}/payments/confirm" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 1" \
  -d '{
    "payment_id": 1
  }'
```

### 拒绝付款

```bash
curl -X POST "${BASE_URL}/payments/1/reject" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 1" \
  -d '{
    "rejection_reason": "金额不对，应该是150元不是200元"
  }'
```

---

## 家务任务管理

### 获取所有任务

```bash
curl -X GET "${BASE_URL}/chores" \
  -H "Content-Type: application/json"
```

### 获取即将到来的任务

```bash
curl -X GET "${BASE_URL}/chores/upcoming?days_ahead=7" \
  -H "Content-Type: application/json"
```

### 获取我的任务

```bash
curl -X GET "${BASE_URL}/chores/my" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 1"
```

### 创建单次任务

```bash
curl -X POST "${BASE_URL}/chores" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 1" \
  -d '{
    "title": "打扫客厅",
    "description": "包括扫地、拖地、擦桌子",
    "category": "cleaning",
    "assigned_to_id": 1,
    "points_reward": 15,
    "points_penalty": 8,
    "priority": "medium",
    "due_date": "2024-01-20T18:00:00",
    "is_recurring": false
  }'
```

### 创建周期性任务（每周）

```bash
curl -X POST "${BASE_URL}/chores" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 1" \
  -d '{
    "title": "倒垃圾",
    "description": "每周一、三、五倒垃圾",
    "category": "trash",
    "assigned_to_id": 1,
    "points_reward": 5,
    "points_penalty": 3,
    "priority": "low",
    "is_recurring": true,
    "recurrence_pattern": "weekly",
    "recurrence_days": ["Monday", "Wednesday", "Friday"]
  }'
```

### 完成任务

```bash
curl -X POST "${BASE_URL}/chores/1/complete" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 1" \
  -d '{
    "proof_image_url": "https://example.com/cleaned.jpg"
  }'
```

### 标记为爽约

```bash
curl -X POST "${BASE_URL}/chores/1/miss" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 1"
```

### 跳过任务

```bash
curl -X POST "${BASE_URL}/chores/1/skip" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 1" \
  -d '{
    "reason": "今天有事，明天再做"
  }'
```

### 检查过期任务

```bash
curl -X POST "${BASE_URL}/chores/check-overdue" \
  -H "Content-Type: application/json"
```

---

## 争议处理

### 创建账单争议

```bash
curl -X POST "${BASE_URL}/disputes" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 2" \
  -d '{
    "dispute_type": "bill",
    "bill_id": 1,
    "title": "水电费金额有疑问",
    "description": "我觉得这个月的水电费太高了，可能有人私用了大功率电器。请查看电费单明细。",
    "priority": "high",
    "proposed_solution": "希望能查看电费单，按实际使用情况重新分摊。"
  }'
```

### 创建付款争议

```bash
curl -X POST "${BASE_URL}/disputes" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 1" \
  -d '{
    "dispute_type": "payment",
    "payment_id": 2,
    "title": "房租付款金额不对",
    "description": "李四说他转了3000元给我，但我只收到了2900元，可能是转账手续费的问题。",
    "priority": "medium"
  }'
```

### 创建家务争议

```bash
curl -X POST "${BASE_URL}/disputes" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 2" \
  -d '{
    "dispute_type": "chore",
    "task_id": 4,
    "title": "不应该扣我积分",
    "description": "我那天生病了，所以没打扫卫生间，但我第二天补做了。不应该扣我积分。",
    "priority": "low"
  }'
```

### 获取我的争议单

```bash
curl -X GET "${BASE_URL}/disputes/my" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 2"
```

### 获取分配给我的争议单（管理员）

```bash
curl -X GET "${BASE_URL}/disputes/assigned" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 1"
```

### 获取争议统计

```bash
curl -X GET "${BASE_URL}/disputes/stats" \
  -H "Content-Type: application/json"
```

### 解决争议单（管理员）

#### 解决家务争议 - 返还积分

```bash
curl -X POST "${BASE_URL}/disputes/3/resolve" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 1" \
  -d '{
    "resolution": "已核实，李四确实第二天补做了。已返还扣除的8积分。",
    "requires_balance_recalculation": true,
    "mark_as_completed": true
  }'
```

#### 解决账单争议 - 重新分摊

```bash
curl -X POST "${BASE_URL}/disputes/1/resolve" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 1" \
  -d '{
    "resolution": "按实际使用重新分摊，确认王五使用较少。",
    "requires_balance_recalculation": true,
    "new_split_rules": [
      { "flatmate_id": 1, "amount": 250 },
      { "flatmate_id": 2, "amount": 250 },
      { "flatmate_id": 3, "amount": 100 }
    ]
  }'
```

#### 解决付款争议 - 拒绝付款

```bash
curl -X POST "${BASE_URL}/disputes/2/resolve" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 1" \
  -d '{
    "resolution": "确认金额有误，拒绝该付款。请李四重新转账正确金额。",
    "requires_balance_recalculation": true,
    "reject_payment": true,
    "rejection_reason": "转账金额与约定不符"
  }'
```

---

## 通知管理

### 获取我的通知

```bash
curl -X GET "${BASE_URL}/notifications" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 1"
```

### 获取未读通知

```bash
curl -X GET "${BASE_URL}/notifications?is_read=false" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 1"
```

### 获取通知摘要

```bash
curl -X GET "${BASE_URL}/notifications/summary" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 1"
```

### 标记为已读

```bash
curl -X POST "${BASE_URL}/notifications/1/mark-read" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 1"
```

### 全部标记为已读

```bash
curl -X POST "${BASE_URL}/notifications/mark-all-read" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 1"
```

---

## 数据导出

### JSON 完整导出

```bash
# 导出所有数据
curl -X GET "${BASE_URL}/export/json" \
  -H "Content-Type: application/json"

# 导出指定时间范围
curl -X GET "${BASE_URL}/export/json?start_date=2024-01-01&end_date=2024-01-31" \
  -H "Content-Type: application/json"

# 只导出账单和付款
curl -X GET "${BASE_URL}/export/json?include_bills=true&include_payments=true&include_flatmates=false&include_chores=false" \
  -H "Content-Type: application/json"
```

### Markdown 导出

```bash
# 导出汇总报告
curl -X GET "${BASE_URL}/export/markdown" \
  -H "Content-Type: application/json"

# 导出特定室友的对账单
curl -X GET "${BASE_URL}/export/markdown?flatmate_id=1" \
  -H "Content-Type: application/json"

# 只导出摘要
curl -X GET "${BASE_URL}/export/markdown?summary_only=true" \
  -H "Content-Type: application/json"
```

### 余额汇总导出

```bash
# JSON 格式
curl -X GET "${BASE_URL}/export/balance/json" \
  -H "Content-Type: application/json"

# Markdown 格式（适合打印）
curl -X GET "${BASE_URL}/export/balance/markdown" \
  -H "Content-Type: application/json"
```

### 个人对账单导出

```bash
# JSON 格式
curl -X GET "${BASE_URL}/export/statement/1/json" \
  -H "Content-Type: application/json"

# Markdown 格式
curl -X GET "${BASE_URL}/export/statement/1/markdown" \
  -H "Content-Type: application/json"
```

---

## 完整业务流程示例

### 流程一：创建账单 -> 付款 -> 确认

```bash
# 1. 管理员创建账单（均摊）
echo "=== 步骤1：创建账单 ==="
BILL_RESPONSE=$(curl -s -X POST "${BASE_URL}/bills" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 1" \
  -d '{
    "title": "测试账单-完整流程",
    "description": "用于测试完整付款流程",
    "category": "utility",
    "total_amount": 300.00,
    "split_type": "equal"
  }')

BILL_ID=$(echo $BILL_RESPONSE | grep -o '"id":[0-9]*' | head -1 | grep -o '[0-9]*')
echo "账单创建成功，ID: $BILL_ID"

# 2. 查看分摊规则
echo ""
echo "=== 步骤2：查看分摊规则 ==="
curl -X GET "${BASE_URL}/bills/${BILL_ID}/split-rules" \
  -H "Content-Type: application/json"

# 3. 李四记录付款
echo ""
echo "=== 步骤3：李四记录付款 ==="
PAYMENT_RESPONSE=$(curl -s -X POST "${BASE_URL}/payments" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 2" \
  -d "{
    \"bill_id\": ${BILL_ID},
    \"amount\": 100.00,
    \"payment_method\": \"wechat\",
    \"receiver_id\": 1
  }")

PAYMENT_ID=$(echo $PAYMENT_RESPONSE | grep -o '"id":[0-9]*' | head -1 | grep -o '[0-9]*')
echo "付款记录创建成功，ID: $PAYMENT_ID"

# 4. 张三查看待确认付款
echo ""
echo "=== 步骤4：张三查看待确认付款 ==="
curl -X GET "${BASE_URL}/payments/to-confirm" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 1"

# 5. 张三确认付款
echo ""
echo "=== 步骤5：张三确认付款 ==="
curl -X POST "${BASE_URL}/payments/confirm" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 1" \
  -d "{
    \"payment_id\": ${PAYMENT_ID}
  }"

# 6. 查看账单状态
echo ""
echo "=== 步骤6：查看账单状态 ==="
curl -X GET "${BASE_URL}/bills/${BILL_ID}" \
  -H "Content-Type: application/json"
```

### 流程二：发起争议 -> 管理员解决

```bash
# 1. 李四发起账单争议
echo "=== 步骤1：李四发起争议 ==="
DISPUTE_RESPONSE=$(curl -s -X POST "${BASE_URL}/disputes" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 2" \
  -d "{
    \"dispute_type\": \"bill\",
    \"bill_id\": 1,
    \"title\": \"水电费金额有疑问\",
    \"description\": \"我觉得这个月的水电费太高了，可能有人私用了大功率电器。\",
    \"priority\": \"high\"
  }")

DISPUTE_ID=$(echo $DISPUTE_RESPONSE | grep -o '"id":[0-9]*' | head -1 | grep -o '[0-9]*')
echo "争议单创建成功，ID: $DISPUTE_ID"

# 2. 管理员查看待处理争议
echo ""
echo "=== 步骤2：管理员查看待处理争议 ==="
curl -X GET "${BASE_URL}/disputes/assigned" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 1"

# 3. 管理员解决争议
echo ""
echo "=== 步骤3：管理员解决争议 ==="
curl -X POST "${BASE_URL}/disputes/${DISPUTE_ID}/resolve" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 1" \
  -d '{
    "resolution": "已核实，确认金额无误。该月确实天气较冷，空调使用较多。",
    "requires_balance_recalculation": false
  }'
```

### 流程三：完成家务 -> 获得积分 -> 抵扣账单

```bash
# 1. 创建家务任务
echo "=== 步骤1：创建家务任务 ==="
TASK_RESPONSE=$(curl -s -X POST "${BASE_URL}/chores" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 1" \
  -d '{
    "title": "测试任务-积分获取",
    "description": "测试完成任务获取积分",
    "category": "cleaning",
    "assigned_to_id": 2,
    "points_reward": 50,
    "points_penalty": 25
  }')

TASK_ID=$(echo $TASK_RESPONSE | grep -o '"id":[0-9]*' | head -1 | grep -o '[0-9]*')
echo "任务创建成功，ID: $TASK_ID"

# 2. 李四完成任务
echo ""
echo "=== 步骤2：李四完成任务 ==="
curl -X POST "${BASE_URL}/chores/${TASK_ID}/complete" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 2"

# 3. 查看李四的积分
echo ""
echo "=== 步骤3：查看李四的积分 ==="
curl -X GET "${BASE_URL}/flatmates/2" \
  -H "Content-Type: application/json"

# 4. 李四使用积分抵扣账单
echo ""
echo "=== 步骤4：李四使用积分抵扣账单 ==="
curl -X POST "${BASE_URL}/payments" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 2" \
  -d '{
    "bill_id": 1,
    "amount": 90.00,
    "use_points": true,
    "points_to_use": 100,
    "payment_method": "wechat",
    "receiver_id": 1,
    "notes": "使用100积分抵扣10元，实际转账90元"
  }'
```

---

## 异常流程示例

### 示例一：创建账单时输入错误

```bash
# 尝试创建没有 title 的账单
curl -X POST "${BASE_URL}/bills" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 1" \
  -d '{
    "total_amount": 100.00,
    "split_type": "equal"
  }'

# 预期响应：400 错误，提示缺少 title
```

### 示例二：付款金额超限

```bash
# 尝试支付超过应付金额
curl -X POST "${BASE_URL}/payments" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 2" \
  -d '{
    "bill_id": 1,
    "amount": 9999.00,
    "payment_method": "wechat"
  }'

# 预期响应：400 错误，提示金额超限
```

### 示例三：确认已确认的付款

```bash
# 先确认一次
curl -X POST "${BASE_URL}/payments/confirm" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 1" \
  -d '{
    "payment_id": 1
  }'

# 再次确认同一个付款
curl -X POST "${BASE_URL}/payments/confirm" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 1" \
  -d '{
    "payment_id": 1
  }'

# 预期响应：400 错误，提示付款已确认
```

### 示例四：非管理员尝试解决争议

```bash
# 李四（非管理员）尝试解决争议
curl -X POST "${BASE_URL}/disputes/1/resolve" \
  -H "Content-Type: application/json" \
  -H "x-user-id: 2" \
  -d '{
    "resolution": "我自己解决了",
    "requires_balance_recalculation": false
  }'

# 预期响应：403 错误，提示无权限
```

---

## 使用提示

1. **用户身份模拟**：通过 `x-user-id` 请求头模拟当前登录用户
   - `x-user-id: 1` - 张三（管理员）
   - `x-user-id: 2` - 李四（普通用户）
   - `x-user-id: 3` - 王五（普通用户）

2. **时间格式**：使用 ISO 8601 格式，如 `2024-01-15` 或 `2024-01-15T18:00:00`

3. **金额格式**：使用两位小数，如 `100.00`

4. **日期范围**：`start_date` 和 `end_date` 是包含关系

5. **分页参数**：
   - `limit`: 每页数量（默认 20）
   - `offset`: 偏移量（默认 0）

---

## 保存响应到文件

```bash
# 保存 JSON 响应
curl -X GET "${BASE_URL}/export/json" -o export.json

# 保存 Markdown 响应
curl -X GET "${BASE_URL}/export/markdown" -o report.md

# 保存余额汇总（可打印）
curl -X GET "${BASE_URL}/export/balance/markdown" -o balance-summary.md
```
