#!/bin/bash

BASE_URL="http://localhost:5001"

echo "=== 1. 健康检查 ==="
curl -X GET "$BASE_URL/health"
echo -e "\n"

echo "=== 2. 创建实验 (普通A/B测试) ==="
curl -X POST "$BASE_URL/experiments" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "price_page_v1",
    "name": "价格页实验V1",
    "description": "测试不同价格策略对转化率的影响",
    "traffic_ratio": 50,
    "groups": [
      {"name": "control", "ratio": 50},
      {"name": "treatment", "ratio": 50}
    ]
  }'
echo -e "\n"

echo "=== 3. 创建互斥实验 (同一互斥组) ==="
curl -X POST "$BASE_URL/experiments" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "price_page_v2",
    "name": "价格页实验V2",
    "description": "与V1互斥的另一个价格页实验",
    "traffic_ratio": 50,
    "mutex_group": "price_page_mutex",
    "groups": [
      {"name": "control", "ratio": 50},
      {"name": "premium", "ratio": 50}
    ]
  }'
echo -e "\n"

echo "=== 4. 创建另一个互斥实验 (同一互斥组) ==="
curl -X POST "$BASE_URL/experiments" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "price_page_v3",
    "name": "价格页实验V3",
    "description": "与V1、V2互斥的第三个价格页实验",
    "traffic_ratio": 50,
    "mutex_group": "price_page_mutex",
    "groups": [
      {"name": "A", "ratio": 33},
      {"name": "B", "ratio": 33},
      {"name": "C", "ratio": 34}
    ]
  }'
echo -e "\n"

echo "=== 5. 启动实验V1 ==="
curl -X POST "$BASE_URL/experiments/price_page_v1/start"
echo -e "\n"

echo "=== 6. 启动实验V2 (互斥组) ==="
curl -X POST "$BASE_URL/experiments/price_page_v2/start"
echo -e "\n"

echo "=== 7. 用户分桶 - 普通分桶 (user_001) ==="
curl -X POST "$BASE_URL/experiments/price_page_v1/assign" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user_001"}'
echo -e "\n"

echo "=== 8. 用户分桶 - 同一用户再次请求 (应该返回相同分组) ==="
curl -X POST "$BASE_URL/experiments/price_page_v1/assign" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user_001"}'
echo -e "\n"

echo "=== 9. 用户分桶 - 互斥冲突 (user_001请求V2) ==="
curl -X POST "$BASE_URL/experiments/price_page_v2/assign" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user_001"}'
echo -e "\n"

echo "=== 10. 用户分桶 - 另一个用户 (user_002) ==="
curl -X POST "$BASE_URL/experiments/price_page_v1/assign" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user_002"}'
echo -e "\n"

echo "=== 11. 流量比例调整 - 从50%调到80% ==="
curl -X PUT "$BASE_URL/experiments/price_page_v1/traffic" \
  -H "Content-Type: application/json" \
  -d '{"traffic_ratio": 80}'
echo -e "\n"

echo "=== 12. 用户分桶 - 老用户user_001 (应该保持原有分组) ==="
curl -X POST "$BASE_URL/experiments/price_page_v1/assign" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user_001"}'
echo -e "\n"

echo "=== 13. 用户分桶 - 新用户user_003 (80%流量) ==="
curl -X POST "$BASE_URL/experiments/price_page_v1/assign" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user_003"}'
echo -e "\n"

echo "=== 14. 指标上报 - user_001的conversion ==="
curl -X POST "$BASE_URL/experiments/price_page_v1/metrics" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_001",
    "metric_name": "conversion",
    "metric_value": 1
  }'
echo -e "\n"

echo "=== 15. 指标上报 - 重复上报 (应该幂等) ==="
curl -X POST "$BASE_URL/experiments/price_page_v1/metrics" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_001",
    "metric_name": "conversion",
    "metric_value": 999
  }'
echo -e "\n"

echo "=== 16. 指标上报 - user_002的conversion ==="
curl -X POST "$BASE_URL/experiments/price_page_v1/metrics" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_002",
    "metric_name": "conversion",
    "metric_value": 0
  }'
echo -e "\n"

echo "=== 17. 指标上报 - user_003的revenue ==="
curl -X POST "$BASE_URL/experiments/price_page_v1/metrics" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_003",
    "metric_name": "revenue",
    "metric_value": 99.99
  }'
echo -e "\n"

echo "=== 18. 暂停实验 ==="
curl -X POST "$BASE_URL/experiments/price_page_v1/pause"
echo -e "\n"

echo "=== 19. 恢复实验 ==="
curl -X POST "$BASE_URL/experiments/price_page_v1/resume"
echo -e "\n"

echo "=== 20. 实验结果查询 (提前停止前) ==="
curl -X GET "$BASE_URL/experiments/price_page_v1/results"
echo -e "\n"

echo "=== 21. 提前停止实验 ==="
curl -X POST "$BASE_URL/experiments/price_page_v1/stop" \
  -H "Content-Type: application/json" \
  -d '{"early_stop": true}'
echo -e "\n"

echo "=== 22. 停止后新用户分桶 (应该不分配) ==="
curl -X POST "$BASE_URL/experiments/price_page_v1/assign" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user_999"}'
echo -e "\n"

echo "=== 23. 停止后历史用户查询 (应该返回原有分组) ==="
curl -X POST "$BASE_URL/experiments/price_page_v1/assign" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user_001"}'
echo -e "\n"

echo "=== 24. 实验结果查询 (停止后) ==="
curl -X GET "$BASE_URL/experiments/price_page_v1/results"
echo -e "\n"

echo "=== 25. 列出所有实验 ==="
curl -X GET "$BASE_URL/experiments"
echo -e "\n"

echo "=== 完成 ==="
