# 酒店布草报损 API - Curl 示例

## 启动服务

```bash
npm install
npm run seed  # 插入种子数据
npm start     # 启动服务 (http://localhost:3002)
```

---

## 1. 建布草批次

### 正常创建
```bash
curl -X POST http://localhost:3002/api/batches \
  -H "Content-Type: application/json" \
  -d '{
    "batch_no": "BATCH-SHEET-20240201",
    "linen_type": "床单",
    "total_quantity": 50,
    "received_date": "2024-02-01"
  }'
```

### 重复批次号 (应返回错误)
```bash
curl -X POST http://localhost:3002/api/batches \
  -H "Content-Type: application/json" \
  -d '{
    "batch_no": "BATCH-SHEET-20240101",
    "linen_type": "床单",
    "total_quantity": 100,
    "received_date": "2024-02-01"
  }'
```

---

## 2. 发往洗涤

### 正常发送
```bash
curl -X POST http://localhost:3002/api/wash/send \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": 1,
    "send_quantity": 20,
    "send_date": "2024-02-01",
    "wash_factory": "洁净洗涤厂"
  }'
```

### 超量发送 (应返回错误)
```bash
curl -X POST http://localhost:3002/api/wash/send \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": 1,
    "send_quantity": 999,
    "send_date": "2024-02-01",
    "wash_factory": "洁净洗涤厂"
  }'
```

---

## 3. 洗回入库

### 正常洗回 (假设洗涤记录ID存在)
```bash
curl -X POST http://localhost:3002/api/wash/return \
  -H "Content-Type: application/json" \
  -d '{
    "wash_record_id": 4,
    "return_quantity": 20,
    "return_date": "2024-02-03"
  }'
```

### 重复洗回 (应返回错误)
```bash
curl -X POST http://localhost:3002/api/wash/return \
  -H "Content-Type: application/json" \
  -d '{
    "wash_record_id": 1,
    "return_quantity": 50,
    "return_date": "2024-02-03"
  }'
```

---

## 4. 客房领用

### 正常领用
```bash
curl -X POST http://localhost:3002/api/usage \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": 3,
    "room_no": "3001",
    "quantity": 5,
    "usage_date": "2024-02-01"
  }'
```

### 洗涤未回再次领用 (应返回错误 - 需先创建未洗回的洗涤记录)
```bash
# 先创建未洗回的洗涤
curl -X POST http://localhost:3002/api/wash/send \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": 3,
    "send_quantity": 10,
    "send_date": "2024-02-02",
    "wash_factory": "洁净洗涤厂"
  }'

# 尝试领用 (应失败)
curl -X POST http://localhost:3002/api/usage \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": 3,
    "room_no": "3002",
    "quantity": 5,
    "usage_date": "2024-02-02"
  }'
```

---

## 5. 报损申请

### 客损报损
```bash
curl -X POST http://localhost:3002/api/loss/apply \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": 2,
    "quantity": 2,
    "loss_type": "客损",
    "reason": "客人将毛巾带走",
    "apply_date": "2024-02-05",
    "room_no": "1005"
  }'
```

### 仓库盘亏
```bash
curl -X POST http://localhost:3002/api/loss/apply \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": 1,
    "quantity": 2,
    "loss_type": "仓库盘亏",
    "reason": "盘点发现库存短少",
    "apply_date": "2024-02-28"
  }'
```

### 超量报损 (应返回错误)
```bash
curl -X POST http://localhost:3002/api/loss/apply \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": 1,
    "quantity": 999,
    "loss_type": "仓库盘亏",
    "reason": "超量测试",
    "apply_date": "2024-02-28"
  }'
```

---

## 6. 赔付确认

### 正常确认
```bash
curl -X POST http://localhost:3002/api/loss/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "loss_record_id": 4,
    "compensate_amount": 80.00
  }'
```

---

## 7. 关闭报损记录

### 非客损直接关闭 (成功)
```bash
curl -X POST http://localhost:3002/api/loss/close \
  -H "Content-Type: application/json" \
  -d '{
    "loss_record_id": 4
  }'
```

### 客损未确认赔付 (应返回错误 - 需要先创建未确认的客损)
```bash
# 先创建未确认的客损
curl -X POST http://localhost:3002/api/loss/apply \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": 2,
    "quantity": 1,
    "loss_type": "客损",
    "reason": "客人损坏未赔偿",
    "apply_date": "2024-02-10",
    "room_no": "2001"
  }'

# 直接关闭 (应失败)
curl -X POST http://localhost:3002/api/loss/close \
  -H "Content-Type: application/json" \
  -d '{
    "loss_record_id": 6
  }'

# 先确认赔付
curl -X POST http://localhost:3002/api/loss/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "loss_record_id": 6,
    "compensate_amount": 50.00
  }'

# 再关闭 (成功)
curl -X POST http://localhost:3002/api/loss/close \
  -H "Content-Type: application/json" \
  -d '{
    "loss_record_id": 6
  }'
```

---

## 8. 统计接口 (洗涤厂 & 客房部 统一口径)

```bash
curl http://localhost:3002/api/stats
```

**响应示例:**
```json
{
  "inventory": [
    {
      "linen_type": "床单",
      "total_stock": 97,
      "in_stock": 87,
      "in_wash": 0,
      "in_use": 10,
      "available": 87,
      "total_loss": 3,
      "loss_rate": "3.00%",
      "total_compensate": 0
    },
    {
      "linen_type": "毛巾",
      "total_stock": 95,
      "in_stock": 95,
      "in_wash": 0,
      "in_use": 0,
      "available": 95,
      "total_loss": 5,
      "loss_rate": "5.00%",
      "total_compensate": 0
    },
    {
      "linen_type": "浴袍",
      "total_stock": 47,
      "in_stock": 48,
      "in_wash": 0,
      "in_use": 2,
      "available": 48,
      "total_loss": 1,
      "loss_rate": "2.08%",
      "total_compensate": 150.00
    }
  ],
  "pending_losses": [
    {
      "id": 4,
      "linen_type": "床单",
      "quantity": 3,
      "loss_type": "仓库盘亏",
      "reason": "月末盘点发现库存短少3件",
      "status": "pending",
      "compensate_confirmed": "no"
    }
  ]
}
```

**统计口径说明:**
- `total_stock`: 系统当前总库存
- `in_stock`: 仓库在库 (可领用)
- `in_wash`: 洗涤中 (洗涤厂应确认)
- `in_use`: 客房在用
- `available` = `in_stock` (当前可直接领用数量)
- 洗涤厂 & 客房部 看到的 `in_wash` 数量完全一致

---

## 9. 查询接口

### 查询所有批次
```bash
curl http://localhost:3002/api/batches
```

### 查询洗涤记录
```bash
curl http://localhost:3002/api/wash-records
```

### 查询报损记录
```bash
curl http://localhost:3002/api/loss-records
```

---

## 快速测试脚本

一次性运行所有测试场景:

```bash
echo "=== 1. 查看当前库存 ==="
curl -s http://localhost:3002/api/stats | python3 -m json.tool

echo -e "\n=== 2. 正常流转: 床单20件发洗涤 -> 洗回20件 -> 领用10件 ==="
# 发洗涤
WASH_ID=$(curl -s -X POST http://localhost:3002/api/wash/send \
  -H "Content-Type: application/json" \
  -d '{"batch_id":1,"send_quantity":20,"send_date":"2024-02-01","wash_factory":"洁净洗涤厂"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "  洗涤记录ID: $WASH_ID"

# 洗回
curl -s -X POST http://localhost:3002/api/wash/return \
  -H "Content-Type: application/json" \
  -d "{\"wash_record_id\":$WASH_ID,\"return_quantity\":20,\"return_date\":\"2024-02-03\"}" | python3 -m json.tool

# 领用
curl -s -X POST http://localhost:3002/api/usage \
  -H "Content-Type: application/json" \
  -d '{"batch_id":1,"room_no":"5001","quantity":10,"usage_date":"2024-02-04"}' | python3 -m json.tool

echo -e "\n=== 3. 洗涤短回: 毛巾30件发洗涤 -> 洗回28件 (短少2件) ==="
WASH_ID2=$(curl -s -X POST http://localhost:3002/api/wash/send \
  -H "Content-Type: application/json" \
  -d '{"batch_id":2,"send_quantity":30,"send_date":"2024-02-01","wash_factory":"洁净洗涤厂"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

curl -s -X POST http://localhost:3002/api/wash/return \
  -H "Content-Type: application/json" \
  -d "{\"wash_record_id\":$WASH_ID2,\"return_quantity\":28,\"return_date\":\"2024-02-03\"}" | python3 -m json.tool

echo -e "\n=== 4. 查看最终统计 ==="
curl -s http://localhost:3002/api/stats | python3 -m json.tool
```
