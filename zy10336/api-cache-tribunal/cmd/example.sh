#!/bin/bash
echo "=== API 响应缓存审判台 - 命令行示例 ==="
echo ""
echo "1. 创建缓存策略:"
curl -X POST http://localhost:8080/strategies \
  -H "Content-Type: application/json" \
  -d '{
    "path": "/api/users",
    "method": "GET",
    "ttl": 300000000000,
    "param_keys": ["user_id", "tenant_id"]
  }'
echo ""
echo ""
echo "2. 查看所有策略:"
curl http://localhost:8080/strategies
echo ""
echo ""
echo "3. 检查缓存 (首次应该未命中):"
curl -X POST http://localhost:8080/cache/check \
  -H "Content-Type: application/json" \
  -d '{
    "path": "/api/users",
    "method": "GET",
    "params": {"user_id": "123", "tenant_id": "456"}
  }'
echo ""
echo ""
echo "4. 创建缓存记录:"
STRATEGY_ID=$(curl -s http://localhost:8080/strategies | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
curl -X POST http://localhost:8080/cache/records \
  -H "Content-Type: application/json" \
  -d "{
    \"strategy_id\": \"$STRATEGY_ID\",
    \"params\": {\"user_id\": \"123\", \"tenant_id\": \"456\"},
    \"response\": {\"name\": \"John Doe\", \"email\": \"john@example.com\"}
  }"
echo ""
echo ""
echo "5. 激活缓存记录:"
RECORD_ID=$(curl -s http://localhost:8080/cache/records?strategy_id=$STRATEGY_ID | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
curl -X POST http://localhost:8080/cache/records/status \
  -H "Content-Type: application/json" \
  -d "{
    \"record_id\": \"$RECORD_ID\",
    \"status\": \"active\"
  }"
echo ""
echo ""
echo "6. 再次检查缓存 (应该命中):"
curl -X POST http://localhost:8080/cache/check \
  -H "Content-Type: application/json" \
  -d '{
    "path": "/api/users",
    "method": "GET",
    "params": {"user_id": "123", "tenant_id": "456"}
  }'
echo ""
echo ""
echo "7. 创建旁路规则:"
curl -X POST http://localhost:8080/cache/bypass \
  -H "Content-Type: application/json" \
  -d '{
    "path": "/api/users",
    "method": "GET",
    "params": {"user_id": "123", "tenant_id": "456"},
    "reason": "debugging",
    "operator": "admin",
    "duration": 60000000000
  }'
echo ""
echo ""
echo "8. 检查缓存 (应该被旁路):"
curl -X POST http://localhost:8080/cache/check \
  -H "Content-Type: application/json" \
  -d '{
    "path": "/api/users",
    "method": "GET",
    "params": {"user_id": "123", "tenant_id": "456"}
  }'
echo ""
echo ""
echo "=== 示例完成 ==="
