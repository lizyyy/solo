# 景区船票联程 API - 演示说明

## 一、系统概述

本API用于处理景区门票+船票联程销售业务，核心处理以下规则：
- 班次管理（船班库存、满员检测）
- 天气停航（影响船票、触发改签/退款）
- 改签（次数限制、可选班次）
- 部分退款（门票已用但船票停航的情况）
- 幂等性（重复回调/重复执行）
- 人工修正（留痕）

## 二、本地启动

### 1. 安装依赖
```bash
cd /Users/mac/pro/solo/workspaces/xy10563
npm install
```

### 2. 启动服务
```bash
npm start
```

服务启动后会自动初始化样例数据，并打印门票ID和船班ID。

服务地址: http://localhost:3000

## 三、造数说明

服务启动时自动创建以下样例数据：

### 门票
1. 千岛湖景区门票 - ¥150 - 库存100
2. 千岛湖景区门票(学生票) - ¥75 - 库存50

### 船班（今日+明日）
| 航线 | 班次 | 船名 | 容量 | 价格 |
|------|------|------|------|------|
| 码头A->中心岛 | 08:30 | 明珠号 | 50 | ¥60 |
| 码头A->中心岛 | 10:00 | 明珠号 | 50 | ¥60 |
| 码头A->中心岛 | 14:00 | 翡翠号 | 80 | ¥60 |
| 码头A->中心岛(明日) | 09:00 | 翡翠号 | 80 | ¥60 |
| 码头A->西南湖区 | 13:00 | 星耀号 | 100 | ¥80 |
| 码头A->中心岛 | 16:00 | 明珠号 | 50 | ¥60 |

## 四、核心业务规则

### 订单状态流转
```
pending (待支付) → confirmed (已确认) 
    → partially_validated (部分核销) 
    → completed (已完成)
或 → refunded (已全额退款) / partially_refunded (部分退款)
```

### 分段状态
- **ticket** (门票): pending / validated
- **ferry** (船票): pending / validated

### 改签规则
- 最多改签 2 次（可通过人工修正调整）
- 订单已完成(completed) 不可改签
- 只能改签至状态为 available 且未满员的船班

### 退款规则
- **full**: 全额退款，要求两段都未核销
- **partial_ferry**: 船票部分退款，要求船票未核销
- **suspension**: 停航退款，退船票金额

### 核销规则
- 船票核销时会检查船班是否停航
- 停航状态的船班无法核销

## 五、幂等性说明

使用 `X-Idempotency-Key` Header 实现幂等：
- 创建订单
- 核销
- 改签
- 退款

相同的 Idempotency-Key 重复调用，返回首次执行结果，不会重复处理。

## 六、主要演示路径

### 路径一：正常购票流程
```
1. 查询门票 → 2. 查询船班 → 3. 创建订单 → 
4. 查询订单(查看状态) → 5. 核销门票 → 
6. 核销船票 → 7. 查询历史 → 8. 查看报告
```

### 路径二：停航改签流程
```
1. 创建订单 → 2. 停航某船班 → 
3. 订单收到停航通知 → 4. 查询可改签班次 → 
5. 改签 → 6. 查询订单状态变化
```

### 路径三：门票已用 部分退款
```
1. 创建订单 → 2. 核销门票 → 
3. 船班停航 → 4. 尝试全额退款(失败) → 
5. 部分退款(仅船票) → 6. 查看退款明细
```

### 路径四：重复改签 + 幂等测试
```
1. 创建订单 → 2. 第一次改签 → 
3. 第二次改签 → 4. 第三次改签(失败，超过次数) → 
5. 人工修正增加改签次数 → 6. 再次改签成功 →
7. 重复调用改签(幂等测试)
```

## 七、失败路径示例

### 场景：停航后仍尝试核销船票
```
1. 创建订单 → 2. 船班停航 → 
3. 核销门票(成功) → 4. 核销船票(失败: 船班已停航)
```

### 场景：已核销的票尝试退款
```
1. 创建订单 → 2. 核销两段 → 
3. 尝试全额退款(失败: 订单已有部分核销)
```

### 场景：超过改签次数
```
1. 创建订单 → 2. 改签2次 → 
3. 第3次改签(失败: 改签次数已达上限)
```

## 八、curl 演示脚本

### 准备工作

先获取门票和船班ID：

```bash
# 获取门票列表
curl -s http://localhost:3000/api/tickets | python3 -m json.tool

# 获取船班列表
curl -s http://localhost:3001/api/ferry-classes | python3 -m json.tool
```

将返回的ID填入以下脚本中。

---

### 完整演示脚本

```bash
#!/bin/bash

BASE_URL="http://localhost:3000"

# ============================================
# 演示一：正常购票流程
# ============================================
echo "=== 演示一：正常购票流程 ==="
echo ""

# 1. 查询可用门票
echo "[1/8] 查询门票列表"
TICKETS=$(curl -s $BASE_URL/api/tickets)
echo "$TICKETS" | python3 -m json.tool
TICKET_ID=$(echo "$TICKETS" | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][0]['id'])")
echo "→ 使用门票ID: $TICKET_ID"
echo ""

# 2. 查询可用船班
echo "[2/8] 查询船班列表"
FERRYS=$(curl -s $BASE_URL/api/ferry-classes)
echo "$FERRYS" | python3 -m json.tool
FERRY_ID=$(echo "$FERRYS" | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][0]['id'])")
echo "→ 使用船班ID: $FERRY_ID"
echo ""

# 3. 创建订单（带幂等Key）
echo "[3/8] 创建订单"
ORDER_RESULT=$(curl -s -X POST $BASE_URL/api/orders \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: order-key-001" \
  -d "{
    \"ticketId\": \"$TICKET_ID\",
    \"ferryClassId\": \"$FERRY_ID\",
    \"passengerName\": \"张三\",
    \"passengerId\": \"330102199001011234\",
    \"operator\": \"online\"
  }")
echo "$ORDER_RESULT" | python3 -m json.tool
ORDER_ID=$(echo "$ORDER_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(d.get('id', d['id']))")
ORDER_NO=$(echo "$ORDER_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(d.get('orderNo', d['orderNo']))")
echo "→ 订单ID: $ORDER_ID"
echo "→ 订单号: $ORDER_NO"
echo ""

# 4. 重复创建订单（幂等测试）
echo "[4/8] 重复创建订单（幂等测试）"
curl -s -X POST $BASE_URL/api/orders \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: order-key-001" \
  -d "{
    \"ticketId\": \"$TICKET_ID\",
    \"ferryClassId\": \"$FERRY_ID\",
    \"passengerName\": \"张三\",
    \"passengerId\": \"330102199001011234\",
    \"operator\": \"online\"
  }" | python3 -m json.tool
echo ""

# 5. 查询订单详情
echo "[5/8] 查询订单详情"
curl -s $BASE_URL/api/orders/$ORDER_ID | python3 -m json.tool
echo ""

# 6. 核销门票
echo "[6/8] 核销门票"
curl -s -X POST $BASE_URL/api/orders/$ORDER_ID/validate \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: validate-ticket-001" \
  -d '{
    "segment": "ticket",
    "operator": "gate-staff-01"
  }' | python3 -m json.tool
echo ""

# 7. 核销船票
echo "[7/8] 核销船票"
curl -s -X POST $BASE_URL/api/orders/$ORDER_ID/validate \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: validate-ferry-001" \
  -d '{
    "segment": "ferry",
    "operator": "pier-staff-01"
  }' | python3 -m json.tool
echo ""

# 8. 查询订单历史
echo "[8/8] 查询订单历史"
curl -s $BASE_URL/api/orders/$ORDER_ID/history | python3 -m json.tool
echo ""

# ============================================
# 演示二：停航改签流程
# ============================================
echo "=== 演示二：停航改签流程 ==="
echo ""

# 1. 创建新订单
echo "[1/7] 创建新订单"
FERRY_ID2=$(echo "$FERRYS" | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][1]['id'])")
echo "→ 使用船班ID: $FERRY_ID2"

ORDER2_RESULT=$(curl -s -X POST $BASE_URL/api/orders \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: order-key-002" \
  -d "{
    \"ticketId\": \"$TICKET_ID\",
    \"ferryClassId\": \"$FERRY_ID2\",
    \"passengerName\": \"李四\",
    \"passengerId\": \"330102199002025678\",
    \"operator\": \"online\"
  }")
echo "$ORDER2_RESULT" | python3 -m json.tool
ORDER2_ID=$(echo "$ORDER2_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(d['id'])")
echo "→ 订单ID: $ORDER2_ID"
echo ""

# 2. 发布天气停航
echo "[2/7] 发布天气停航（船班 $FERRY_ID2）"
curl -s -X POST $BASE_URL/api/ferry-classes/$FERRY_ID2/suspend \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "受台风影响，海面风力达10级",
    "operator": "operations-manager"
  }' | python3 -m json.tool
echo ""

# 3. 查看订单是否有停航通知
echo "[3/7] 查看订单历史（包含停航通知）"
curl -s $BASE_URL/api/orders/$ORDER2_ID/history | python3 -m json.tool
echo ""

# 4. 查询可改签班次
echo "[4/7] 查询可改签班次"
REBOOK_OPTIONS=$(curl -s $BASE_URL/api/orders/$ORDER2_ID/rebook-options)
echo "$REBOOK_OPTIONS" | python3 -m json.tool
NEW_FERRY_ID=$(echo "$REBOOK_OPTIONS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data'][0]['id'] if d['success'] else 'NONE')")
echo "→ 可选船班ID: $NEW_FERRY_ID"
echo ""

# 5. 执行改签
echo "[5/7] 执行改签"
curl -s -X POST $BASE_URL/api/orders/$ORDER2_ID/rebook \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: rebook-key-001" \
  -d "{
    \"newFerryClassId\": \"$NEW_FERRY_ID\",
    \"reason\": \"天气原因，改签至 $NEW_FERRY_ID\",
    \"operator\": \"customer-service-01\"
  }" | python3 -m json.tool
echo ""

# 6. 验证改签后的订单状态
echo "[6/7] 验证改签后的订单状态"
curl -s $BASE_URL/api/orders/$ORDER2_ID | python3 -m json.tool
echo ""

# 7. 查看改签记录
echo "[7/7] 查看订单历史（包含改签记录）"
curl -s $BASE_URL/api/orders/$ORDER2_ID/history | python3 -m json.tool
echo ""

# ============================================
# 演示三：门票已用 部分退款
# ============================================
echo "=== 演示三：门票已用 部分退款 ==="
echo ""

# 1. 创建订单
echo "[1/7] 创建订单"
FERRY_ID3=$(echo "$FERRYS" | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][2]['id'])")
echo "→ 使用船班ID: $FERRY_ID3"

ORDER3_RESULT=$(curl -s -X POST $BASE_URL/api/orders \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: order-key-003" \
  -d "{
    \"ticketId\": \"$TICKET_ID\",
    \"ferryClassId\": \"$FERRY_ID3\",
    \"passengerName\": \"王五\",
    \"passengerId\": \"330102199003039012\",
    \"operator\": \"online\"
  }")
ORDER3_ID=$(echo "$ORDER3_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(d['id'])")
echo "→ 订单ID: $ORDER3_ID"
echo ""

# 2. 核销门票
echo "[2/7] 游客先进入景区，核销门票"
curl -s -X POST $BASE_URL/api/orders/$ORDER3_ID/validate \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: validate-ticket-003" \
  -d '{
    "segment": "ticket",
    "operator": "gate-staff-02"
  }' | python3 -m json.tool
echo ""

# 3. 船班停航
echo "[3/7] 突然发布停航通知"
curl -s -X POST $BASE_URL/api/ferry-classes/$FERRY_ID3/suspend \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "突降暴雨，能见度不足100米",
    "operator": "operations-manager"
  }' | python3 -m json.tool
echo ""

# 4. 尝试全额退款（应该失败）
echo "[4/7] 尝试全额退款（应该失败）"
curl -s -X POST $BASE_URL/api/orders/$ORDER3_ID/refund \
  -H "Content-Type: application/json" \
  -d '{
    "refundType": "full",
    "operator": "finance-01"
  }' | python3 -m json.tool
echo ""

# 5. 部分退款（仅船票）
echo "[5/7] 部分退款（仅船票）"
curl -s -X POST $BASE_URL/api/orders/$ORDER3_ID/refund \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: refund-key-003" \
  -d '{
    "refundType": "suspension",
    "operator": "finance-01"
  }' | python3 -m json.tool
echo ""

# 6. 查看退款明细
echo "[6/7] 查看订单详情（退款明细）"
curl -s $BASE_URL/api/orders/$ORDER3_ID | python3 -m json.tool
echo ""

# 7. 查看订单历史
echo "[7/7] 查看订单历史"
curl -s $BASE_URL/api/orders/$ORDER3_ID/history | python3 -m json.tool
echo ""

# ============================================
# 演示四：重复改签 + 人工修正
# ============================================
echo "=== 演示四：重复改签 + 人工修正 ==="
echo ""

# 1. 创建订单
echo "[1/9] 创建订单"
FERRY_ID4=$(echo "$FERRYS" | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][5]['id'])")
echo "→ 使用船班ID: $FERRY_ID4"

ORDER4_RESULT=$(curl -s -X POST $BASE_URL/api/orders \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: order-key-004" \
  -d "{
    \"ticketId\": \"$TICKET_ID\",
    \"ferryClassId\": \"$FERRY_ID4\",
    \"passengerName\": \"赵六\",
    \"passengerId\": \"330102199004043456\",
    \"operator\": \"online\"
  }")
ORDER4_ID=$(echo "$ORDER4_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(d['id'])")
echo "→ 订单ID: $ORDER4_ID"
echo ""

# 2. 第一次改签
echo "[2/9] 第一次改签"
FERRY_FOR_REBOOK1=$(echo "$FERRYS" | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][4]['id'])")
curl -s -X POST $BASE_URL/api/orders/$ORDER4_ID/rebook \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: rebook4-key-01" \
  -d "{
    \"newFerryClassId\": \"$FERRY_FOR_REBOOK1\",
    \"reason\": \"用户时间调整\",
    \"operator\": \"customer-service-01\"
  }" | python3 -m json.tool
echo ""

# 3. 第二次改签
echo "[3/9] 第二次改签"
curl -s -X POST $BASE_URL/api/orders/$ORDER4_ID/rebook \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: rebook4-key-02" \
  -d "{
    \"newFerryClassId\": \"$FERRY_ID4\",
    \"reason\": \"用户再次调整\",
    \"operator\": \"customer-service-01\"
  }" | python3 -m json.tool
echo ""

# 4. 第三次改签（应该失败）
echo "[4/9] 第三次改签（应该失败，超过2次上限）"
curl -s -X POST $BASE_URL/api/orders/$ORDER4_ID/rebook \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: rebook4-key-03" \
  -d "{
    \"newFerryClassId\": \"$FERRY_FOR_REBOOK1\",
    \"reason\": \"用户第三次调整\",
    \"operator\": \"customer-service-01\"
  }" | python3 -m json.tool
echo ""

# 5. 人工修正：增加改签次数
echo "[5/9] 人工修正：增加改签次数上限"
curl -s -X POST $BASE_URL/api/orders/$ORDER4_ID/manual-correct \
  -H "Content-Type: application/json" \
  -d '{
    "field": "maxRebookCount",
    "beforeValue": 2,
    "afterValue": 5,
    "operator": "supervisor-wang",
    "reason": "VIP客户特殊处理"
  }' | python3 -m json.tool
echo ""

# 6. 再次改签（应该成功）
echo "[6/9] 再次改签（应该成功）"
curl -s -X POST $BASE_URL/api/orders/$ORDER4_ID/rebook \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: rebook4-key-04" \
  -d "{
    \"newFerryClassId\": \"$FERRY_FOR_REBOOK1\",
    \"reason\": \"人工授权后改签\",
    \"operator\": \"customer-service-01\"
  }" | python3 -m json.tool
echo ""

# 7. 幂等测试：重复调用上次改签
echo "[7/9] 幂等测试：重复调用上次改签"
curl -s -X POST $BASE_URL/api/orders/$ORDER4_ID/rebook \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: rebook4-key-04" \
  -d "{
    \"newFerryClassId\": \"$FERRY_FOR_REBOOK1\",
    \"reason\": \"人工授权后改签\",
    \"operator\": \"customer-service-01\"
  }" | python3 -m json.tool
echo ""

# 8. 查看审计日志
echo "[8/9] 查看审计日志（订单 $ORDER4_ID）"
curl -s "$BASE_URL/api/audit-logs?recordId=$ORDER4_ID" | python3 -m json.tool
echo ""

# 9. 查看订单历史
echo "[9/9] 查看订单历史"
curl -s $BASE_URL/api/orders/$ORDER4_ID/history | python3 -m json.tool
echo ""

# ============================================
# 演示五：失败路径 - 停航后核销失败
# ============================================
echo "=== 演示五：失败路径 - 停航后核销失败 ==="
echo ""

# 1. 创建订单
echo "[1/4] 创建订单"
FERRY_ID5=$(echo "$FERRYS" | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][3]['id'])")

ORDER5_RESULT=$(curl -s -X POST $BASE_URL/api/orders \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: order-key-005" \
  -d "{
    \"ticketId\": \"$TICKET_ID\",
    \"ferryClassId\": \"$FERRY_ID5\",
    \"passengerName\": \"孙七\",
    \"passengerId\": \"330102199005057890\",
    \"operator\": \"online\"
  }")
ORDER5_ID=$(echo "$ORDER5_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(d['id'])")
echo "→ 订单ID: $ORDER5_ID"
echo ""

# 2. 船班停航
echo "[2/4] 船班停航"
curl -s -X POST $BASE_URL/api/ferry-classes/$FERRY_ID5/suspend \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "大雾天气",
    "operator": "operations-manager"
  }' | python3 -m json.tool
echo ""

# 3. 核销门票（应该成功）
echo "[3/4] 核销门票（应该成功）"
curl -s -X POST $BASE_URL/api/orders/$ORDER5_ID/validate \
  -H "Content-Type: application/json" \
  -d '{
    "segment": "ticket",
    "operator": "gate-staff-03"
  }' | python3 -m json.tool
echo ""

# 4. 核销船票（应该失败）
echo "[4/4] 核销船票（应该失败：船班已停航）"
curl -s -X POST $BASE_URL/api/orders/$ORDER5_ID/validate \
  -H "Content-Type: application/json" \
  -d '{
    "segment": "ferry",
    "operator": "pier-staff-02"
  }' | python3 -m json.tool
echo ""

# ============================================
# 演示六：运营报告导出
# ============================================
echo "=== 演示六：运营报告导出 ==="
echo ""

echo "生成运营报告"
curl -s $BASE_URL/api/report | python3 -m json.tool
echo ""

echo "=== 所有演示完成 ==="
echo ""
echo "提示：你可以查看以下接口验证数据完整性"
echo "  - 所有订单: curl $BASE_URL/api/orders  (需要自行实现列表接口)"
echo "  - 审计日志: curl $BASE_URL/api/audit-logs"
echo ""
```

## 九、关键数据字段说明

### 订单分段状态
```json
"segments": {
  "ticket": { "status": "validated", "validatedAt": "2025-05-12T08:30:00Z" },
  "ferry": { "status": "pending", "validatedAt": null }
}
```

### 订单状态说明
| 状态 | 说明 |
|------|------|
| pending | 待支付 |
| confirmed | 已支付确认 |
| partially_validated | 部分核销（仅门票或仅船票） |
| completed | 已完成（两段都核销） |
| refunded | 已全额退款 |
| partially_refunded | 部分退款（门票已用，船票退款） |

### 审计日志结构
```json
{
  "action": "MANUAL_CORRECTION",
  "module": "Order",
  "recordId": "订单ID",
  "before": { "maxRebookCount": 2 },
  "after": { "maxRebookCount": 5 },
  "operator": "supervisor-wang",
  "reason": "VIP客户特殊处理",
  "timestamp": "2025-05-12T09:00:00Z"
}
```

### 运营报告统计
```json
{
  "totalOrders": 10,
  "orderStatusBreakdown": {
    "completed": 3,
    "partially_refunded": 2,
    "confirmed": 5
  },
  "segmentStatusBreakdown": {
    "ticket": { "pending": 5, "validated": 5 },
    "ferry": { "pending": 7, "validated": 3 }
  },
  "totalRevenue": 1260,
  "totalRefundAmount": 180,
  "refundCount": 2,
  "rebookingCount": 4,
  "suspendedFerries": 3
}
```

## 十、快速验证 Checklist

执行完所有演示后，验证以下结果：

- [ ] 订单一：状态为 completed，两段都已核销
- [ ] 订单二：状态为 confirmed，rebookCount = 1，已改签至新船班
- [ ] 订单三：状态为 partially_refunded，门票已用，船票已退款
- [ ] 订单四：状态为 confirmed，rebookCount = 3，maxRebookCount = 5（人工修正过）
- [ ] 订单五：状态为 partially_validated，门票已用，船票核销失败
- [ ] 审计日志：包含 MANUAL_CORRECTION 记录
- [ ] 运营报告：refundCount >= 2，rebookingCount >= 4
- [ ] 所有船班：被停航的船班 status = suspended

---

**业务闭环验证要点：**

1. **分段状态独立**：门票和船票状态各自独立，一个已用不影响另一个的退款判断
2. **停航自动通知**：船班停航后，关联订单的历史记录中会有停航通知
3. **退款规则正确**：门票已用时只能退船票，不能全额退款
4. **改签次数限制**：超过2次改签失败，人工修正后可继续
5. **幂等性有效**：相同的 Idempotency-Key 重复调用不产生重复操作
6. **人工修正留痕**：所有修正都有前后差异、操作者、原因的完整记录
