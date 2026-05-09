# 赔付案件分摊 API - CURL 示例

## 基础信息
- Base URL: `http://localhost:3000`
- Content-Type: `application/json`

---

## 1. 健康检查

```bash
curl http://localhost:3000/health
```

---

## 2. 案件管理

### 2.1 创建案件

```bash
curl -X POST http://localhost:3000/api/claims \
  -H "Content-Type: application/json" \
  -d '{
    "caseNumber": "CLAIM-DEMO-001",
    "totalAmount": 10000.00,
    "description": "商品破损赔付案件",
    "operator": "user_zhang",
    "requestId": "req-create-001"
  }'
```

**响应示例:**
```json
{
  "success": true,
  "code": "CREATED",
  "data": {
    "id": "uuid-here",
    "caseNumber": "CLAIM-DEMO-001",
    "totalAmount": "10000.00",
    "status": "PENDING",
    "currentVersion": 1,
    "currentAllocation": {
      "version": 1,
      "merchantRatio": 0,
      "warehouseRatio": 0,
      "deliveryRatio": 0,
      "merchantAmount": 0,
      "warehouseAmount": 0,
      "deliveryAmount": 0
    }
  }
}
```

### 2.2 查询案件详情

```bash
curl http://localhost:3000/api/claims/{claim_id}
```

### 2.3 分页查询案件列表

```bash
curl "http://localhost:3000/api/claims?page=1&pageSize=10"
```

### 2.4 按状态筛选

```bash
curl "http://localhost:3000/api/claims?status=REVIEWING"
```

---

## 3. 责任比例与金额分摊

### 3.1 更新责任比例（触发金额自动分摊）

```bash
curl -X POST http://localhost:3000/api/claims/{claim_id}/ratios \
  -H "Content-Type: application/json" \
  -d '{
    "merchantRatio": 0.5,
    "warehouseRatio": 0.3,
    "deliveryRatio": 0.2,
    "operator": "user_li",
    "requestId": "req-ratio-001"
  }'
```

**说明:**
- 比例值范围: 0.0 - 1.0
- 三个比例之和必须等于 1.0 (允许 ±0.0001 的误差)
- 每次更新会自动创建新版本
- 系统会自动计算各责任方的分摊金额

---

## 4. 案件状态流转

### 4.1 标记为已分摊

```bash
curl -X POST http://localhost:3000/api/claims/{claim_id}/allocate \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "user_wang",
    "requestId": "req-allocate-001"
  }'
```

### 4.2 确认分摊结果

```bash
curl -X POST http://localhost:3000/api/claims/{claim_id}/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "manager_01",
    "requestId": "req-confirm-001"
  }'
```

### 4.3 标记为已付款

```bash
curl -X POST http://localhost:3000/api/claims/{claim_id}/pay \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "finance_01",
    "requestId": "req-pay-001"
  }'
```

### 4.4 取消案件

```bash
curl -X POST http://localhost:3000/api/claims/{claim_id}/cancel \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "user_zhang",
    "reason": "客户撤销投诉",
    "requestId": "req-cancel-001"
  }'
```

---

## 5. 版本历史与回滚

### 5.1 查看版本历史

```bash
curl http://localhost:3000/api/claims/{claim_id}/versions
```

### 5.2 回滚到历史版本

```bash
curl -X POST http://localhost:3000/api/claims/{claim_id}/rollback \
  -H "Content-Type: application/json" \
  -d '{
    "targetVersion": 2,
    "operator": "manager_01",
    "requestId": "req-rollback-001"
  }'
```

---

## 6. 审计日志

### 6.1 查看操作历史

```bash
curl http://localhost:3000/api/claims/{claim_id}/audit-logs
```

---

## 7. 完整流程示例

```bash
#!/bin/bash

BASE_URL="http://localhost:3000"

echo "=== 1. 创建案件 ==="
CREATE_RESP=$(curl -s -X POST $BASE_URL/api/claims \
  -H "Content-Type: application/json" \
  -d '{
    "caseNumber": "DEMO-FLOW-001",
    "totalAmount": 15000.00,
    "description": "电子设备运输损坏赔付",
    "operator": "user_zhang"
  }')
echo $CREATE_RESP
CLAIM_ID=$(echo $CREATE_RESP | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "案件ID: $CLAIM_ID"

echo ""
echo "=== 2. 设置责任比例: 商家40% 仓库35% 配送25% ==="
curl -s -X POST $BASE_URL/api/claims/$CLAIM_ID/ratios \
  -H "Content-Type: application/json" \
  -d '{
    "merchantRatio": 0.40,
    "warehouseRatio": 0.35,
    "deliveryRatio": 0.25,
    "operator": "user_li"
  }'

echo ""
echo "=== 3. 修改比例: 商家调整为50% ==="
curl -s -X POST $BASE_URL/api/claims/$CLAIM_ID/ratios \
  -H "Content-Type: application/json" \
  -d '{
    "merchantRatio": 0.50,
    "warehouseRatio": 0.30,
    "deliveryRatio": 0.20,
    "operator": "user_wang"
  }'

echo ""
echo "=== 4. 分摊确认 ==="
curl -s -X POST $BASE_URL/api/claims/$CLAIM_ID/allocate \
  -H "Content-Type: application/json" \
  -d '{"operator": "manager_01"}'

echo ""
echo "=== 5. 查看版本历史 ==="
curl -s $BASE_URL/api/claims/$CLAIM_ID/versions

echo ""
echo "=== 6. 回滚到版本2 ==="
curl -s -X POST $BASE_URL/api/claims/$CLAIM_ID/rollback \
  -H "Content-Type: application/json" \
  -d '{
    "targetVersion": 2,
    "operator": "manager_01"
  }'

echo ""
echo "=== 7. 确认最终分摊 ==="
curl -s -X POST $BASE_URL/api/claims/$CLAIM_ID/confirm \
  -H "Content-Type: application/json" \
  -d '{"operator": "manager_02"}'

echo ""
echo "=== 8. 标记付款完成 ==="
curl -s -X POST $BASE_URL/api/claims/$CLAIM_ID/pay \
  -H "Content-Type: application/json" \
  -d '{"operator": "finance_01"}'

echo ""
echo "=== 9. 查看审计日志 ==="
curl -s $BASE_URL/api/claims/$CLAIM_ID/audit-logs
```
