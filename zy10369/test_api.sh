#!/bin/bash

BASE_URL="http://localhost:5000/api"

echo "=== 下游超时画像 API 测试脚本 ==="
echo ""

echo "1. 健康检查"
curl -s "$BASE_URL/health" | python -m json.tool
echo ""

echo "2. 生成演示数据 (20个样本)"
curl -s -X POST "$BASE_URL/demo/create-samples" \
  -H "Content-Type: application/json" \
  -d '{"count": 20, "api_name": "order_service"}' | python -m json.tool
echo ""

echo "3. 查看统计信息"
curl -s "$BASE_URL/stats" | python -m json.tool
echo ""

echo "4. 查看样本列表"
curl -s "$BASE_URL/samples?limit=5" | python -m json.tool
echo ""

echo "5. 取第一个样本进行后续操作"
FIRST_ID=$(curl -s "$BASE_URL/samples" | python -c "import sys,json; d=json.load(sys.stdin); print(d['samples'][0]['request_id'])" 2>/dev/null)
echo "第一个样本 ID: $FIRST_ID"
echo ""

if [ -n "$FIRST_ID" ]; then
    echo "6. 查看样本详情"
    curl -s "$BASE_URL/samples/$FIRST_ID" | python -m json.tool
    echo ""

    echo "7. 推进状态到 troubleshooting"
    curl -s -X POST "$BASE_URL/samples/$FIRST_ID/advance" \
      -H "Content-Type: application/json" \
      -d '{"status": "troubleshooting"}' | python -m json.tool
    echo ""

    echo "8. 添加排查备注"
    curl -s -X POST "$BASE_URL/samples/$FIRST_ID/notes" \
      -H "Content-Type: application/json" \
      -d '{"content": "发现数据库查询耗时过长，需要检查索引", "author": "engineer_zhang", "tags": ["database", "performance"]}' | python -m json.tool
    echo ""

    echo "9. 添加修复记录"
    curl -s -X POST "$BASE_URL/samples/$FIRST_ID/fixes" \
      -H "Content-Type: application/json" \
      -d '{"description": "为 order 表添加 user_id 索引", "fix_type": "database_index", "author": "dba_li", "effectiveness": "high"}' | python -m json.tool
    echo ""

    echo "10. 查看样本处理历史"
    curl -s "$BASE_URL/history?request_id=$FIRST_ID" | python -m json.tool
    echo ""
fi

echo "11. 导出超时画像"
curl -s "$BASE_URL/export/profile?api_name=order_service&format=summary" | python -m json.tool
echo ""

echo "12. 测试重复提交 (应该返回 409)"
if [ -n "$FIRST_ID" ]; then
    curl -s -X POST "$BASE_URL/samples" \
      -H "Content-Type: application/json" \
      -d "{\"request_id\": \"$FIRST_ID\", \"api_name\": \"test\", \"total_time_ms\": 100, \"segments\": []}"
    echo ""
fi

echo ""
echo "13. 触发异常演示 (validation)"
curl -s -X POST "$BASE_URL/demo/trigger-error" \
  -H "Content-Type: application/json" \
  -d '{"error_type": "validation"}' | python -m json.tool
echo ""

echo "14. 查看全局处理历史"
curl -s "$BASE_URL/history?limit=10" | python -m json.tool
echo ""

echo "=== 测试完成 ==="
