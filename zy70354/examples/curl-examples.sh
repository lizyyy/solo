#!/bin/bash

BASE_URL="http://localhost:3000"

echo "=========================================="
echo "分库分表路由 API - curl 示例脚本"
echo "=========================================="
echo ""

echo "1. 健康检查"
echo "------------------------------------------"
curl -s "$BASE_URL/api/health" | json_pp
echo ""

echo "=========================================="
echo "2. 新订单写入 - 租户 10002（月度分片规则，非迁移状态）"
echo "------------------------------------------"
curl -s -X POST "$BASE_URL/api/route/write" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "10002",
    "orderId": "ORD-2026-001",
    "orderNo": "NO-2026-0001",
    "createdAt": "2026-02-15T10:30:00Z",
    "amount": 999.00,
    "status": "pending",
    "userId": "USR-001"
  }' | json_pp
echo ""

echo "=========================================="
echo "3. 历史订单查询 - 按时间戳路由到历史分片"
echo "------------------------------------------"
curl -s -X POST "$BASE_URL/api/route/query" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "10002",
    "orderId": "ORD-2025-001",
    "createdAt": "2025-02-15T10:30:00Z"
  }' | json_pp
echo ""

echo "=========================================="
echo "4. 迁移中双读 - 租户 10001（正在迁移，双读策略）"
echo "------------------------------------------"
curl -s -X POST "$BASE_URL/api/route/query" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "10001",
    "orderId": "ORD-MIGRATING-001",
    "createdAt": "2025-04-01T10:30:00Z"
  }' | json_pp
echo ""

echo "=========================================="
echo "5. 跨月查询计划 - 查询 2025 Q1 到 Q2 的订单（6个月范围）"
echo "------------------------------------------"
curl -s -X POST "$BASE_URL/api/query/plan" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "10002",
    "fromDate": "2025-01-01T00:00:00Z",
    "toDate": "2025-06-30T23:59:59Z"
  }' | json_pp
echo ""

echo "=========================================="
echo "6. 路由冲突检测 - 双读冲突解决"
echo "------------------------------------------"
curl -s -X POST "$BASE_URL/api/dualread/resolve" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "10001",
    "oldData": {
      "orderId": "ORD-CONFLICT-001",
      "status": "paid",
      "amount": 100.00,
      "updatedAt": "2025-04-01T10:00:00Z"
    },
    "newData": {
      "orderId": "ORD-CONFLICT-001",
      "status": "shipped",
      "amount": 100.00,
      "updatedAt": "2025-04-01T11:00:00Z"
    }
  }' | json_pp
echo ""

echo "=========================================="
echo "7. 补偿写入 - 创建补偿请求（模拟双写失败场景）"
echo "------------------------------------------"
curl -s -X POST "$BASE_URL/api/compensation/create" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORD-COMPENSATION-001",
    "tenantId": "10001",
    "failedShardId": "tenant_10001_old",
    "originalWriteTimestamp": "2025-04-15T10:30:00Z",
    "operation": "update",
    "data": {
      "orderId": "ORD-COMPENSATION-001",
      "status": "shipped",
      "amount": 299.00,
      "updatedAt": "2025-04-15T10:30:00Z"
    }
  }' | json_pp
echo ""

echo "=========================================="
echo "8. 查看待处理的补偿请求"
echo "------------------------------------------"
curl -s "$BASE_URL/api/compensation/pending/10001" | json_pp
echo ""

echo "=========================================="
echo "9. 处理补偿请求"
echo "------------------------------------------"
curl -s -X POST "$BASE_URL/api/compensation/process" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORD-COMPENSATION-001",
    "tenantId": "10001",
    "failedShardId": "tenant_10001_old"
  }' | json_pp
echo ""

echo "=========================================="
echo "10. 路由解释 - 获取详细的路由决策分析"
echo "------------------------------------------"
curl -s -X POST "$BASE_URL/api/route/explain" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "10001",
    "orderId": "ORD-EXPLAIN-001",
    "createdAt": "2025-04-01T10:30:00Z",
    "operation": "write"
  }' | json_pp
echo ""

echo "=========================================="
echo "11. 查看租户配置"
echo "------------------------------------------"
curl -s "$BASE_URL/api/config/tenant/10001" | json_pp
echo ""

echo "=========================================="
echo "12. 重复写入检测 - 存在待处理补偿时的写入"
echo "------------------------------------------"
curl -s -X POST "$BASE_URL/api/compensation/create" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORD-DUPLICATE-001",
    "tenantId": "10001",
    "failedShardId": "tenant_10001_old",
    "originalWriteTimestamp": "2025-04-16T10:00:00Z",
    "operation": "insert",
    "data": {
      "orderId": "ORD-DUPLICATE-001",
      "status": "created"
    }
  }' > /dev/null

curl -s -X POST "$BASE_URL/api/route/write" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "10001",
    "orderId": "ORD-DUPLICATE-001",
    "createdAt": "2025-04-16T10:00:00Z"
  }' | json_pp
echo ""

echo "=========================================="
echo "13. 查看所有分片配置"
echo "------------------------------------------"
curl -s "$BASE_URL/api/config/shards" | json_pp
echo ""

echo "=========================================="
echo "14. 查看近期审计记录"
echo "------------------------------------------"
curl -s "$BASE_URL/api/audit/recent?limit=10" | json_pp
echo ""

echo ""
echo "=========================================="
echo "所有 curl 示例执行完成"
echo "=========================================="
