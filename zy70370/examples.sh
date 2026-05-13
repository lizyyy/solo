#!/bin/bash

BASE_URL="http://localhost:8000"

echo "=== 服务目录健康 API - Curl 示例 ==="
echo ""

echo "1. 检查 API 健康状态"
echo "   curl -X GET $BASE_URL/health"
echo ""

echo "2. 新增服务 - user-service"
curl -X POST "$BASE_URL/services" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "user-service",
    "description": "用户认证和管理服务",
    "owner": {
      "name": "张三",
      "email": "zhangsan@example.com",
      "is_active": true,
      "department": "用户中心"
    },
    "repository_url": "https://github.com/example/user-service",
    "environment": "production",
    "health_check_endpoint": "/health",
    "max_allowed_failures": 3,
    "tags": ["core", "auth"]
  }'
echo ""
echo ""

echo "3. 新增服务 - order-service（依赖 user-service）"
curl -X POST "$BASE_URL/services" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "order-service",
    "description": "订单管理服务",
    "owner": {
      "name": "李四",
      "email": "lisi@example.com",
      "is_active": true,
      "department": "交易中心"
    },
    "repository_url": "https://github.com/example/order-service",
    "environment": "production",
    "health_check_endpoint": "/actuator/health",
    "max_allowed_failures": 3,
    "tags": ["transaction"]
  }'
echo ""
echo ""

echo "4. 新增服务 - payment-service（依赖 order-service）"
curl -X POST "$BASE_URL/services" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "payment-service",
    "description": "支付服务",
    "owner": {
      "name": "王五",
      "email": "wangwu@example.com",
      "is_active": true,
      "department": "交易中心"
    },
    "repository_url": "https://github.com/example/payment-service",
    "environment": "production",
    "health_check_endpoint": "/health",
    "max_allowed_failures": 3,
    "tags": ["transaction", "payment"]
  }'
echo ""
echo ""

echo "5. 建立依赖关系 - order-service 依赖 user-service"
curl -X POST "$BASE_URL/services/order-service/dependencies?dependency_name=user-service"
echo ""
echo ""

echo "6. 建立依赖关系 - payment-service 依赖 order-service"
curl -X POST "$BASE_URL/services/payment-service/dependencies?dependency_name=order-service"
echo ""
echo ""

echo "7. 获取 user-service 详情"
echo "   curl -X GET $BASE_URL/services/user-service"
echo ""

echo "8. 查看所有服务"
echo "   curl -X GET $BASE_URL/services"
echo ""

echo "9. 报告健康检查失败 - user-service"
USER_SERVICE_ID=$(curl -s "$BASE_URL/services/user-service" | python3 -c "import sys, json; print(json.load(sys.stdin)['service_id'])")
echo "   User Service ID: $USER_SERVICE_ID"
echo ""

curl -X POST "$BASE_URL/health-check" \
  -H "Content-Type: application/json" \
  -d "{
    \"service_id\": \"$USER_SERVICE_ID\",
    \"status\": \"unhealthy\",
    \"details\": \"数据库连接超时\"
  }"
echo ""
echo ""

echo "10. 连续健康检查失败 3 次（触发自动标记为弃用）"
for i in 1 2 3; do
  echo "    第 $i 次健康检查失败..."
  curl -s -X POST "$BASE_URL/health-check" \
    -H "Content-Type: application/json" \
    -d "{
      \"service_id\": \"$USER_SERVICE_ID\",
      \"status\": \"unhealthy\",
      \"details\": \"数据库连接超时\"
    }" > /dev/null
done
echo ""
echo ""

echo "11. 检查 user-service 状态（应该已自动标记为 deprecated）"
curl -s "$BASE_URL/services/user-service" | python3 -m json.tool
echo ""

echo "12. 负责人变更 - 张三离职，重新分配负责人"
curl -X PUT "$BASE_URL/services/user-service" \
  -H "Content-Type: application/json" \
  -d '{
    "owner": {
      "name": "赵六",
      "email": "zhaoliu@example.com",
      "is_active": true,
      "department": "用户中心"
    }
  }'
echo ""
echo ""

echo "13. 模拟旧负责人状态异常"
curl -X PUT "$BASE_URL/services/user-service" \
  -H "Content-Type: application/json" \
  -d '{
    "owner": {
      "name": "张三",
      "email": "zhangsan@example.com",
      "is_active": false,
      "department": "用户中心"
    }
  }'
echo ""
echo ""

echo "14. 申请下线 - payment-service 设置下线计划"
PAYMENT_SERVICE_ID=$(curl -s "$BASE_URL/services/payment-service" | python3 -c "import sys, json; print(json.load(sys.stdin)['service_id'])")
echo "    Payment Service ID: $PAYMENT_SERVICE_ID"
echo ""

curl -X PUT "$BASE_URL/services/payment-service" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "pending_deletion",
    "deprecation_date": "2026-05-13",
    "deletion_date": "2026-06-13"
  }'
echo ""
echo ""

echo "15. 检查下线风险 - payment-service 仍被依赖时的风险"
curl -s "$BASE_URL/services/payment-service/health" | python3 -m json.tool
echo ""

echo "16. 查看服务目录完整度报告"
curl -s "$BASE_URL/dashboard/completeness" | python3 -m json.tool
echo ""

echo "17. 查看所有风险"
curl -s "$BASE_URL/dashboard/risks" | python3 -m json.tool
echo ""

echo "18. 查看依赖拓扑"
curl -s "$BASE_URL/dashboard/topology" | python3 -m json.tool
echo ""

echo "19. 查看 user-service 的详细健康报告"
curl -s "$BASE_URL/services/user-service/health" | python3 -m json.tool
echo ""

echo "20. 尝试删除仍被依赖的服务（应该失败）"
curl -X DELETE "$BASE_URL/services/order-service"
echo ""
echo ""

echo "21. 移除依赖关系后删除"
curl -X DELETE "$BASE_URL/services/payment-service/dependencies/order-service"
echo ""
curl -X DELETE "$BASE_URL/services/order-service/dependencies/user-service"
echo ""
curl -X DELETE "$BASE_URL/services/payment-service"
echo ""
echo ""

echo "=== 示例执行完成 ==="
