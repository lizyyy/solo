#!/bin/bash

BASE_URL="http://localhost:3000/api"

echo "========================================"
echo "  账号批量停用API - 测试脚本"
echo "========================================"
echo ""

echo "1. 查看支持的系统列表"
echo "------------------------"
curl -s "$BASE_URL/systems" | python3 -m json.tool
echo ""
echo ""

echo "2. 创建停用任务"
echo "------------------------"
TASK_RESPONSE=$(curl -s -X POST "$BASE_URL/tasks" \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": "E001234",
    "employeeName": "张三",
    "requestedBy": "李四",
    "systems": ["AD", "EMAIL", "VPN", "CRM", "HR", "GIT"],
    "accountMap": {
      "AD": "zhangsan",
      "EMAIL": "zhangsan@company.com"
    }
  }')

echo "$TASK_RESPONSE" | python3 -m json.tool
TASK_ID=$(echo "$TASK_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])")
echo ""
echo "任务ID: $TASK_ID"
echo ""

echo "3. 启动任务"
echo "------------------------"
curl -s -X POST "$BASE_URL/tasks/$TASK_ID/start" \
  -H "Content-Type: application/json" \
  -d '{"actor": "自动化脚本"}' | python3 -m json.tool
echo ""
echo ""

echo "4. 获取任务详情（查看待处理的系统）"
echo "------------------------"
TASK_DETAIL=$(curl -s "$BASE_URL/tasks/$TASK_ID")
echo "$TASK_DETAIL" | python3 -m json.tool
echo ""

ITEM_IDS=$(echo "$TASK_DETAIL" | python3 -c "
import sys, json
items = json.load(sys.stdin)['data']['items']
for item in items:
    print(item['id'])
")

echo "5. 逐个处理系统（模拟批量处理）"
echo "------------------------"
count=1
for item_id in $ITEM_IDS; do
    echo "  处理系统 $count: $item_id"
    curl -s -X POST "$BASE_URL/tasks/$TASK_ID/items/$item_id/process" \
      -H "Content-Type: application/json" \
      -d '{"actor": "自动化脚本"}' > /dev/null 2>&1
    count=$((count + 1))
    sleep 0.2
done
echo "  批量处理完成!"
echo ""

echo "6. 查看处理后的任务详情"
echo "------------------------"
curl -s "$BASE_URL/tasks/$TASK_ID" | python3 -m json.tool
echo ""
echo ""

echo "7. 查找失败的系统并演示重试"
echo "------------------------"
FAILED_ITEMS=$(curl -s "$BASE_URL/tasks/$TASK_ID" | python3 -c "
import sys, json
items = json.load(sys.stdin)['data']['items']
for item in items:
    if item['status'] == 'FAILED':
        print(item['id'])
")

if [ -n "$FAILED_ITEMS" ]; then
    echo "  发现失败的系统，进行重试..."
    for item_id in $FAILED_ITEMS; do
        echo "  重试: $item_id"
        curl -s -X POST "$BASE_URL/tasks/$TASK_ID/items/$item_id/retry" \
          -H "Content-Type: application/json" \
          -d '{"actor": "管理员"}' > /dev/null 2>&1
        sleep 0.2
    done
else
    echo "  没有失败的系统，跳过重试演示"
fi
echo ""

echo "8. 查看审计日志"
echo "------------------------"
curl -s "$BASE_URL/tasks/$TASK_ID/audit" | python3 -m json.tool
echo ""
echo ""

echo "9. 导出JSON格式报告"
echo "------------------------"
curl -s "$BASE_URL/tasks/$TASK_ID/report" | python3 -m json.tool
echo ""
echo ""

echo "10. 导出CSV格式报告"
echo "------------------------"
curl -s "$BASE_URL/tasks/$TASK_ID/report?format=csv" -o "report-$TASK_ID.csv"
echo "  CSV报告已保存到: report-$TASK_ID.csv"
echo ""

echo "11. 演示人工修正"
echo "------------------------"
REMAINING_FAILED=$(curl -s "$BASE_URL/tasks/$TASK_ID" | python3 -c "
import sys, json
items = json.load(sys.stdin)['data']['items']
for item in items:
    if item['status'] == 'FAILED':
        print(item['id'])
")

if [ -n "$REMAINING_FAILED" ]; then
    for item_id in $REMAINING_FAILED; do
        echo "  人工修正: $item_id"
        curl -s -X POST "$BASE_URL/tasks/$TASK_ID/items/$item_id/manual" \
          -H "Content-Type: application/json" \
          -d '{
            "actor": "管理员",
            "correctionNote": "已登录系统后台手动停用账号",
            "markAsSuccess": true
          }' | python3 -m json.tool
        break
    done
else
    echo "  没有需要人工修正的系统"
fi
echo ""

echo "========================================"
echo "  测试完成！"
echo "========================================"
echo "常用curl命令参考:"
echo ""
echo "  # 创建任务"
echo "  curl -X POST http://localhost:3000/api/tasks \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"employeeId\": \"E001234\", \"systems\": [\"AD\", \"EMAIL\"]}'"
echo ""
echo "  # 查询任务"
echo "  curl http://localhost:3000/api/tasks/$TASK_ID"
echo ""
echo "  # 导出报告"
echo "  curl http://localhost:3000/api/tasks/$TASK_ID/report?format=csv -o report.csv"
echo ""
