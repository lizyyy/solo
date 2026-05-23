#!/bin/bash

BASE_URL="http://localhost:3000/api"
USER_HEADER="x-username: manager1"

echo "=========================================="
echo "民宿保洁排班权限追责台账服务 - API测试"
echo "=========================================="
echo ""

echo "【1/15】检查服务健康状态"
curl -s -H "$USER_HEADER" "$BASE_URL/health" | python3 -m json.tool
echo ""
echo "------------------------------------------"

echo "【2/15】导入订单日历（模拟备用表错误数据）"
curl -s -X POST -H "$USER_HEADER" -H "Content-Type: application/json" -d '{
  "merge_strategy": "append",
  "orders": [
    {
      "order_no": "ORD20240523001",
      "room_no": "101",
      "guest_name": "张三",
      "guest_phone": "13800138001",
      "check_in_date": "2024-05-23",
      "check_out_date": "2024-05-25",
      "linen_change_required": 1,
      "cleaning_type": "full",
      "is_extended": 0
    },
    {
      "order_no": "ORD20240523002",
      "room_no": "102",
      "guest_name": "李四",
      "guest_phone": "13800138002",
      "check_in_date": "2024-05-23",
      "check_out_date": "2024-05-24",
      "linen_change_required": 1,
      "cleaning_type": "full",
      "is_extended": 0
    },
    {
      "order_no": "ORD20240523003",
      "room_no": "101",
      "guest_name": "王五",
      "guest_phone": "13800138003",
      "check_in_date": "2024-05-25",
      "check_out_date": "2024-05-27",
      "linen_change_required": 0,
      "cleaning_type": "simple",
      "is_extended": 1
    }
  ]
}' "$BASE_URL/orders/import" | python3 -m json.tool
echo ""
echo "------------------------------------------"

echo "【3/15】查看订单列表"
curl -s -H "$USER_HEADER" "$BASE_URL/orders?limit=10" | python3 -m json.tool
echo ""
echo "------------------------------------------"

echo "【4/15】导入保洁群消息"
curl -s -X POST -H "$USER_HEADER" -H "Content-Type: application/json" -d '{
  "merge_strategy": "append",
  "messages": [
    {
      "message_id": "MSG001",
      "room_no": "101",
      "cleaner_name": "王阿姨",
      "cleaner_phone": "13900139001",
      "message_type": "report",
      "content": "101房间已打扫完毕，布草已更换",
      "send_time": "2024-05-23 14:30:00",
      "sender_name": "王阿姨"
    },
    {
      "message_id": "MSG002",
      "room_no": "102",
      "cleaner_name": "李阿姨",
      "cleaner_phone": "13900139002",
      "message_type": "issue",
      "content": "102房间门锁有问题，需要维修",
      "send_time": "2024-05-23 15:00:00",
      "sender_name": "李阿姨"
    }
  ]
}' "$BASE_URL/messages/import" | python3 -m json.tool
echo ""
echo "------------------------------------------"

echo "【5/15】导入维修备注"
curl -s -X POST -H "$USER_HEADER" -H "Content-Type: application/json" -d '{
  "notes": [
    {
      "room_no": "102",
      "issue_type": "lock",
      "description": "房门锁无法正常关闭，需要更换锁芯",
      "reporter": "李阿姨",
      "report_time": "2024-05-23 15:00:00",
      "priority": "high"
    },
    {
      "room_no": "101",
      "issue_type": "light",
      "description": "卫生间灯泡闪烁",
      "reporter": "张店长",
      "report_time": "2024-05-23 16:00:00",
      "priority": "normal"
    }
  ]
}' "$BASE_URL/maintenance/import" | python3 -m json.tool
echo ""
echo "------------------------------------------"

echo "【6/15】查看订单冲突检测"
curl -s -H "$USER_HEADER" "$BASE_URL/conflicts/orders" | python3 -m json.tool
echo ""
echo "------------------------------------------"

echo "【7/15】获取第一个订单ID，用于后续测试"
FIRST_ORDER_ID=$(curl -s -H "$USER_HEADER" "$BASE_URL/orders?limit=1" | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][0]['id'])")
echo "订单ID: $FIRST_ORDER_ID"
echo ""
echo "------------------------------------------"

echo "【8/15】修改订单（模拟修正错误数据）"
curl -s -X PUT -H "$USER_HEADER" -H "Content-Type: application/json" -d '{
  "cleaning_time": "09:00-11:00",
  "change_reason": "修正保洁时间安排"
}' "$BASE_URL/orders/$FIRST_ORDER_ID" | python3 -m json.tool
echo ""
echo "------------------------------------------"

echo "【9/15】查看订单变更历史"
curl -s -H "$USER_HEADER" "$BASE_URL/orders/$FIRST_ORDER_ID/history" | python3 -m json.tool
echo ""
echo "------------------------------------------"

echo "【10/15】提交订单审核"
curl -s -X POST -H "$USER_HEADER" -H "Content-Type: application/json" -d "{
  \"table_name\": \"order_calendars\",
  \"record_id\": \"$FIRST_ORDER_ID\",
  \"remark\": \"订单信息已核对无误\"
}" "$BASE_URL/workflow/submit" | python3 -m json.tool
echo ""
echo "------------------------------------------"

echo "【11/15】二次确认订单"
curl -s -X POST -H "$USER_HEADER" -H "Content-Type: application/json" -d "{
  \"table_name\": \"order_calendars\",
  \"record_id\": \"$FIRST_ORDER_ID\",
  \"remark\": \"已二次确认保洁安排\"
}" "$BASE_URL/workflow/confirm" | python3 -m json.tool
echo ""
echo "------------------------------------------"

echo "【12/15】查看工作流历史"
curl -s -H "$USER_HEADER" "$BASE_URL/orders/$FIRST_ORDER_ID/workflow" | python3 -m json.tool
echo ""
echo "------------------------------------------"

echo "【13/15】查看失败任务清单"
curl -s -H "$USER_HEADER" "$BASE_URL/tasks/failed" | python3 -m json.tool
echo ""
echo "------------------------------------------"

echo "【14/15】查看批次列表"
curl -s -H "$USER_HEADER" "$BASE_URL/batches" | python3 -m json.tool
echo ""
echo "------------------------------------------"

echo "【15/15】生成店长报告（角色视图）"
curl -s -H "$USER_HEADER" "$BASE_URL/report" | python3 -m json.tool
echo ""
echo "------------------------------------------"

echo ""
echo "=========================================="
echo "测试完成！"
echo "=========================================="
echo ""
echo "其他可用命令："
echo "  导出订单CSV: curl -s -X POST -H \"$USER_HEADER\" $BASE_URL/export/orders"
echo "  查看审计日志: curl -s -H \"$USER_HEADER\" $BASE_URL/audit/history"
echo "  查看所有用户: curl -s -H \"$USER_HEADER\" $BASE_URL/users"
echo ""
