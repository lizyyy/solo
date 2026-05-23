#!/bin/bash
set -e

BASE_URL="http://localhost:8000"

echo "=== 民宿保洁排班重试补偿队列 API 测试 ==="
echo ""

echo "1. 获取Token (管理员账号)"
ADMIN_TOKEN=$(curl -s -X POST "$BASE_URL/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=admin123" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
echo "   Token: ${ADMIN_TOKEN:0:20}..."
echo ""

echo "2. 获取Token (录入员账号)"
ENTRY_TOKEN=$(curl -s -X POST "$BASE_URL/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=entry&password=entry123" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
echo "   Token: ${ENTRY_TOKEN:0:20}..."
echo ""

echo "3. 录入员提交 - 订单日历记录"
echo "   POST /records (来源: order_calendar)"
RECORD1=$(curl -s -X POST "$BASE_URL/records" \
  -H "Authorization: Bearer $ENTRY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "order_calendar",
    "source_id": "ORD20240115001",
    "room_no": "101",
    "guest_name": "张三",
    "checkin_date": "2024-01-15T14:00:00",
    "checkout_date": "2024-01-18T12:00:00",
    "cleaning_type": "daily",
    "is_continuous_stay": true,
    "linen_change": true,
    "price": 388.00,
    "content": "连住3天，第2天换布草"
  }')
echo "   返回记录ID:" $(echo $RECORD1 | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo ""

echo "4. 录入员提交 - 保洁群消息"
echo "   POST /records (来源: cleaning_group)"
RECORD2=$(curl -s -X POST "$BASE_URL/records" \
  -H "Authorization: Bearer $ENTRY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "cleaning_group",
    "source_id": "WX20240115_0830",
    "room_no": "102",
    "guest_name": "李四",
    "temp_checkout": true,
    "content": "客人临时退房，需要加急保洁"
  }')
echo "   返回记录ID:" $(echo $RECORD2 | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo ""

echo "5. 录入员提交 - 维修备注"
echo "   POST /records (来源: maintenance_note)"
RECORD3=$(curl -s -X POST "$BASE_URL/records" \
  -H "Authorization: Bearer $ENTRY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "maintenance_note",
    "source_id": "FIX20240115001",
    "room_no": "103",
    "content": "空调维修后需要深度清洁"
  }')
echo "   返回记录ID:" $(echo $RECORD3 | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo ""

echo "6. 录入员提交 - 手工改价表 (故意设置负价格测试验证失败)"
echo "   POST /records (来源: manual_price)"
RECORD4=$(curl -s -X POST "$BASE_URL/records" \
  -H "Authorization: Bearer $ENTRY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "manual_price",
    "room_no": "104",
    "price": -50.00,
    "content": "手工改价"
  }')
echo "   返回is_valid:" $(echo $RECORD4 | python3 -c "import sys,json; print(json.load(sys.stdin)['is_valid'])")
echo "   验证错误:" $(echo $RECORD4 | python3 -c "import sys,json; print(json.load(sys.stdin).get('validation_errors',''))")
echo ""

RECORD_ID1=$(echo $RECORD1 | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
RECORD_ID2=$(echo $RECORD2 | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
RECORD_ID3=$(echo $RECORD3 | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

echo "7. 复核员更新状态为失败并标记分类"
echo "   PUT /records/$RECORD_ID1/status"
curl -s -X PUT "$BASE_URL/records/$RECORD_ID1/status" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "failed",
    "comment": "连住换布草冲突：退房保洁与续住布草更换时间重叠",
    "retry_category": "linen_change"
  }' | python3 -c "import sys,json; d=json.load(sys.stdin); print('   新状态:', d['status']); print('   重试分类:', d['retry_category'])"
echo ""

echo "8. 将失败记录加入重试队列"
echo "   POST /records/$RECORD_ID1/retry"
RETRY1=$(curl -s -X POST "$BASE_URL/records/$RECORD_ID1/retry" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}')
echo "   重试ID:" $(echo $RETRY1 | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "   重试次数:" $(echo $RETRY1 | python3 -c "import sys,json; print(json.load(sys.stdin)['retry_number'])")
echo ""

echo "9. 查看失败记录清单"
echo "   GET /records/failed"
curl -s -X GET "$BASE_URL/records/failed" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -c "import sys,json; items=json.load(sys.stdin); print('   失败记录数:', len(items)); [print(f'   - 记录#{i[\"id\"]}: {i[\"status\"]} - {i[\"last_error\"] or i[\"validation_errors\"] or \"无\"}') for i in items]"
echo ""

echo "10. 人工审核记录"
echo "    POST /records/$RECORD_ID2/review"
curl -s -X POST "$BASE_URL/records/$RECORD_ID2/review" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "comment": "已核实：客人确已提前退房，可以安排保洁",
    "approve": true,
    "retry_category": "temp_checkout"
  }' | python3 -c "import sys,json; d=json.load(sys.stdin); print('   审核后状态:', d['status']); print('   审核备注:', d['review_comment'])"
echo ""

echo "11. 补偿入账"
echo "    POST /records/$RECORD_ID3/compensate"
curl -s -X POST "$BASE_URL/records/$RECORD_ID3/compensate" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 150.00,
    "reason": "维修延误导致保洁加班费"
  }' | python3 -c "import sys,json; d=json.load(sys.stdin); print('   补偿金额:', d['amount']); print('   状态:', d['status'])"
echo ""

echo "12. 关闭记录"
echo "    POST /records/$RECORD_ID3/close"
curl -s -X POST "$BASE_URL/records/$RECORD_ID3/close?comment=已完成补偿结算" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print('   最终状态:', d['status'])"
echo ""

echo "13. 查看报表汇总"
echo "    GET /reports/summary"
curl -s -X GET "$BASE_URL/reports/summary" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print('   总记录数:', d['total_records']); print('   成功:', d['success_count'], '失败:', d['failed_count'], '待处理:', d['pending_count']); print('   重试中:', d['retrying_count'], '死信:', d['dead_letter_count'], '已补偿:', d['compensated_count'])"
echo ""

echo "14. 店长视图 - 管理看板"
echo "    GET /reports/manager-dashboard"
curl -s -X GET "$BASE_URL/reports/manager-dashboard" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print('   重试分类统计:'); [print(f'     - {c[\"category\"]}: {c[\"count']}条, 成功率: {c[\"success_rate\"]*100:.1f}%') for c in d['retry_categories']]; print('   死信记录数:', len(d['dead_letter_records'])); print('   待重试记录数:', len(d['pending_retry_records']))"
echo ""

echo "15. 导出失败记录CSV"
echo "    GET /reports/export-failed"
curl -s -X GET "$BASE_URL/reports/export-failed" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -o failed_records.csv
echo "    已保存到 failed_records.csv"
echo ""

echo "16. 查看单条记录的完整操作轨迹"
echo "    GET /logs/record/$RECORD_ID1"
curl -s -X GET "$BASE_URL/logs/record/$RECORD_ID1" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -c "import sys,json; logs=json.load(sys.stdin); [print(f'   [{l[\"created_at\"][11:19]}] {l[\"action\"]}: {l[\"old_status\"] or \"-\"} -> {l[\"new_status\"] or \"-\"} | {l[\"comment\"] or \"\"}') for l in logs]"
echo ""

echo "17. 测试权限控制 - 只读用户尝试创建记录（应该失败）"
VIEWER_TOKEN=$(curl -s -X POST "$BASE_URL/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=viewer&password=view123" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
RESULT=$(curl -s -X POST "$BASE_URL/records" \
  -H "Authorization: Bearer $VIEWER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"source": "order_calendar", "room_no": "999"}')
echo "    结果:" $(echo $RESULT | python3 -c "import sys,json; print(json.load(sys.stdin).get('detail','未知错误'))")
echo ""

echo "18. 查看记录详情（含重试历史和补偿记录）"
echo "    GET /records/$RECORD_ID1"
curl -s -X GET "$BASE_URL/records/$RECORD_ID1" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print('   记录编号:', d['record_no']); print('   来源:', d['source']); print('   状态:', d['status']); print('   重试次数:', d['retry_count']); print('   操作日志数:', len(d['operations'])); print('   重试队列数:', len(d['retries']))"
echo ""

echo "=== 测试完成 ==="
echo ""
echo "下一步验证操作："
echo "1. 查看失败清单: cat failed_records.csv"
echo "2. 重启服务: ./start.sh"
echo "3. 重启后验证数据持久化:"
echo "   curl -s -H \"Authorization: Bearer $ADMIN_TOKEN\" $BASE_URL/records/$RECORD_ID1 | python3 -m json.tool"
echo "4. 再次导出验证: curl -s -H \"Authorization: Bearer $ADMIN_TOKEN\" $BASE_URL/reports/export-failed"
