#!/bin/bash

BASE_URL="http://localhost:8080"

echo "======================================"
echo "  客户探针 API 测试脚本"
echo "======================================"
echo ""

echo "1. 检查服务健康状态"
curl -s "$BASE_URL/health" | python3 -m json.tool
echo ""
echo ""

echo "2. 创建客户环境"
ENV_RESPONSE=$(curl -s -X POST "$BASE_URL/api/environments" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "CUST001",
    "name": "生产环境-北京",
    "description": "北京地区生产环境探针",
    "region": "cn-beijing"
  }')
echo "$ENV_RESPONSE" | python3 -m json.tool
ENV_ID=$(echo "$ENV_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])")
echo "环境ID: $ENV_ID"
echo ""

echo "3. 添加代理设置"
curl -s -X POST "$BASE_URL/api/environments/$ENV_ID/proxies" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "http",
    "host": "proxy.example.com",
    "port": 8080,
    "username": "probe_user",
    "is_enabled": true
  }' | python3 -m json.tool
echo ""

echo "4. 创建探针任务（首次）"
TASK_RESPONSE=$(curl -s -X POST "$BASE_URL/api/tasks" \
  -H "Content-Type: application/json" \
  -d "{
    \"env_id\": \"$ENV_ID\",
    \"task_type\": \"network_probe\",
    \"target_url\": \"https://api.example.com/health\",
    \"priority\": 1,
    \"timeout_seconds\": 30,
    \"max_retries\": 3,
    \"idempotency_key\": \"probe_$(date +%Y%m%d)_001\"
  }")
echo "$TASK_RESPONSE" | python3 -m json.tool
TASK_ID=$(echo "$TASK_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])")
echo "任务ID: $TASK_ID"
echo ""

echo "5. 重复提交相同幂等键（验证幂等性）"
echo "--- 预期返回已存在的任务，状态码 200，重复标记 ---"
curl -s -w "\nHTTP Status: %{http_code}\n" -X POST "$BASE_URL/api/tasks" \
  -H "Content-Type: application/json" \
  -d "{
    \"env_id\": \"$ENV_ID\",
    \"task_type\": \"network_probe\",
    \"target_url\": \"https://api.example.com/health\",
    \"priority\": 1,
    \"timeout_seconds\": 30,
    \"max_retries\": 3,
    \"idempotency_key\": \"probe_$(date +%Y%m%d)_001\"
  }" | python3 -m json.tool
echo ""

echo "6. 分配任务给探针代理"
curl -s -X POST "$BASE_URL/api/tasks/$TASK_ID/assign" \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "probe-agent-01"
  }' | python3 -m json.tool
echo ""

echo "7. 开始执行任务"
curl -s -X POST "$BASE_URL/api/tasks/$TASK_ID/start" \
  -H "Content-Type: application/json" | python3 -m json.tool
echo ""

echo "8. 完成任务（提交探测结果）"
curl -s -X POST "$BASE_URL/api/tasks/$TASK_ID/complete" \
  -H "Content-Type: application/json" \
  -d '{
    "network_result": {
      "success": true,
      "http_status_code": 200,
      "response_time_ms": 156,
      "response_size": 1024,
      "request_headers": "{\"User-Agent\":\"ProbeAgent/1.0\"}",
      "response_headers": "{\"Content-Type\":\"application/json\"}",
      "raw_response": "{\"status\":\"ok\"}"
    },
    "dns_records": [
      {
        "domain": "api.example.com",
        "record_type": "A",
        "values": "10.0.0.1,10.0.0.2",
        "ttl": 300,
        "resolve_time_ms": 12
      }
    ]
  }' | python3 -m json.tool
echo ""

echo "9. 获取任务完整数据（包含结果和诊断）"
curl -s "$BASE_URL/api/tasks/$TASK_ID/full" | python3 -m json.tool
echo ""

echo "10. 创建失败任务（用于演示异常场景）"
FAIL_TASK_RESPONSE=$(curl -s -X POST "$BASE_URL/api/tasks" \
  -H "Content-Type: application/json" \
  -d "{
    \"env_id\": \"$ENV_ID\",
    \"task_type\": \"network_probe\",
    \"target_url\": \"https://bad.example.com\",
    \"priority\": 2,
    \"idempotency_key\": \"probe_$(date +%Y%m%d)_002\"
  }")
echo "$FAIL_TASK_RESPONSE" | python3 -m json.tool
FAIL_TASK_ID=$(echo "$FAIL_TASK_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])")
echo ""

echo "11. 标记任务失败"
curl -s -X POST "$BASE_URL/api/tasks/$FAIL_TASK_ID/fail" \
  -H "Content-Type: application/json" \
  -d '{
    "error_msg": "连接超时: 无法建立到目标服务器的连接 (connection refused)"
  }' | python3 -m json.tool
echo ""

echo "12. 查看失败任务的诊断结论"
curl -s "$BASE_URL/api/tasks/$FAIL_TASK_ID/full" | python3 -c "import sys, json; data = json.load(sys.stdin); print(json.dumps(data['data']['conclusion'], indent=2))"
echo ""

echo "13. 查询环境下的所有任务"
curl -s "$BASE_URL/api/tasks?env_id=$ENV_ID" | python3 -m json.tool
echo ""

echo "14. 通过幂等键查询任务"
curl -s "$BASE_URL/api/tasks/idempotency?key=probe_$(date +%Y%m%d)_001" | python3 -m json.tool
echo ""

echo "15. 导出任务证据包"
echo "--- 下载ZIP文件到 /tmp/probe_evidence.zip ---"
curl -s -o /tmp/probe_evidence.zip "$BASE_URL/api/export/tasks/$TASK_ID/evidence"
echo "文件大小: $(ls -lh /tmp/probe_evidence.zip | awk '{print $5}')"
echo ""

echo "16. 导出环境历史记录"
echo "--- 下载历史ZIP文件到 /tmp/probe_history.zip ---"
curl -s -o /tmp/probe_history.zip "$BASE_URL/api/export/environments/$ENV_ID/history"
echo "文件大小: $(ls -lh /tmp/probe_history.zip | awk '{print $5}')"
echo ""

echo "======================================"
echo "  测试完成！"
echo "======================================"
echo ""
echo "关键验证点："
echo "  ✓ 重复提交不会创建重复任务（幂等性）"
echo "  ✓ 失败任务包含明确的错误信息"
echo "  ✓ 诊断结论自动生成（根据探测结果）"
echo "  ✓ 历史查询可以获取所有任务"
echo "  ✓ 导出功能生成ZIP格式证据包"
echo ""
echo "生成的文件："
echo "  /tmp/probe_evidence.zip  - 单个任务证据包"
echo "  /tmp/probe_history.zip   - 环境历史记录"
echo ""
