#!/bin/bash

BASE_URL="http://localhost:8000/api"

echo "========================================"
echo "     城市照明报修API 演示脚本"
echo "========================================"
echo ""

echo "1. 创建灯杆数据"
echo "----------------------------------------"
curl -s -X POST "$BASE_URL/lamp-poles/" \
  -H "Content-Type: application/json" \
  -d '{
    "pole_code": "LP-001",
    "latitude": 31.2304,
    "longitude": 121.4737,
    "address": "上海市黄浦区南京东路1号"
  }' | python3 -m json.tool
echo ""

curl -s -X POST "$BASE_URL/lamp-poles/" \
  -H "Content-Type: application/json" \
  -d '{
    "pole_code": "LP-002",
    "latitude": 31.2306,
    "longitude": 121.4740,
    "address": "上海市黄浦区南京东路2号"
  }' | python3 -m json.tool
echo ""
echo "✓ 创建了2盏灯杆"
echo ""

echo "2. 创建备件库存"
echo "----------------------------------------"
curl -s -X POST "$BASE_URL/spare-parts/" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "part_code=SP-LED-001&name=LED灯泡&quantity=2&unit=个&threshold=5" | python3 -m json.tool
echo ""

curl -s -X POST "$BASE_URL/spare-parts/" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "part_code=SP-CABLE-001&name=电缆线&quantity=10&unit=米&threshold=5" | python3 -m json.tool
echo ""
echo "✓ 创建了2种备件 (LED灯泡库存只有2个，用于演示备件不足场景)"
echo ""

echo "3. 第一次报修 (市民热线)"
echo "----------------------------------------"
REPORT1=$(curl -s -X POST "$BASE_URL/reports/" \
  -H "Content-Type: application/json" \
  -d '{
    "pole_code": "LP-001",
    "source": "市民热线-12345",
    "description": "路灯不亮，晚上漆黑一片",
    "reporter_name": "张三",
    "reporter_phone": "13800138001"
  }')
echo "$REPORT1" | python3 -m json.tool
REPORT1_ID=$(echo "$REPORT1" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")
echo ""
echo "✓ 创建报修单 #1，ID: $REPORT1_ID"
echo ""

echo "4. 第二次报修 (网格员APP - 重复报修，应该被合并)"
echo "----------------------------------------"
REPORT2=$(curl -s -X POST "$BASE_URL/reports/" \
  -H "Content-Type: application/json" \
  -d '{
    "pole_code": "LP-001",
    "source": "网格员APP",
    "description": "LED灯损坏，需要更换",
    "reporter_name": "李四",
    "reporter_phone": "13800138002"
  }')
echo "$REPORT2" | python3 -m json.tool
REPORT2_ID=$(echo "$REPORT2" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")
echo ""
echo "✓ 创建报修单 #2，ID: $REPORT2_ID"
echo "⚠️  注意: 状态为 'merged'，已自动合并到第一个报修单!"
echo ""

echo "5. 第三次报修 (微信公众号 - 位置相近但不同灯杆，不合并)"
echo "----------------------------------------"
REPORT3=$(curl -s -X POST "$BASE_URL/reports/" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 31.2305,
    "longitude": 121.4738,
    "source": "微信公众号",
    "description": "灯杆闪烁，可能接触不良",
    "reporter_name": "王五",
    "reporter_phone": "13800138003"
  }')
echo "$REPORT3" | python3 -m json.tool
REPORT3_ID=$(echo "$REPORT3" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")
echo ""
echo "✓ 创建报修单 #3，ID: $REPORT3_ID"
echo "ℹ️  注意: 通过经纬度自动匹配到附近灯杆 LP-001/LP-002"
echo ""

echo "6. 查看所有报修单列表 (显示未关闭原因)"
echo "----------------------------------------"
curl -s "$BASE_URL/reports/" | python3 -m json.tool
echo ""
echo "ℹ️  说明:"
echo "  - 报修单 #1: 已提交，待处理"
echo "  - 报修单 #2: 已合并到工单 #1"
echo "  - 报修单 #3: 已提交，待处理"
echo ""

echo "7. 派工给维修团队"
echo "----------------------------------------"
curl -s -X POST "$BASE_URL/dispatches/" \
  -H "Content-Type: application/json" \
  -d "{
    \"report_id\": $REPORT1_ID,
    \"worker_name\": \"赵师傅\",
    \"worker_phone\": \"13900139001\",
    \"team\": \"维修一组\",
    \"scheduled_time\": \"2024-01-15T09:00:00\",
    \"remarks\": \"请尽快处理\"
  }" | python3 -m json.tool
echo ""
echo "✓ 已派工，工单状态变为 'dispatched'"
echo ""

echo "8. 查看报修单 #1 的历史记录"
echo "----------------------------------------"
curl -s "$BASE_URL/reports/$REPORT1_ID/history" | python3 -m json.tool
echo ""

echo "9. 施工反馈 - 演示备件不足场景"
echo "----------------------------------------"
SPARE1_ID=$(curl -s "$BASE_URL/spare-parts/" | python3 -c "import sys, json; print([x['id'] for x in json.load(sys.stdin) if x['part_code']=='SP-LED-001'][0])")
echo "尝试使用 5 个 LED灯泡 (库存只有2个)..."
curl -s -X POST "$BASE_URL/construction-feedback/" \
  -H "Content-Type: application/json" \
  -d "{
    \"report_id\": $REPORT1_ID,
    \"result\": \"in_progress\",
    \"description\": \"现场检查，需要更换LED灯泡\",
    \"worker_signature\": \"赵师傅\",
    \"spare_usages\": [{\"spare_part_id\": $SPARE1_ID, \"quantity\": 5}]
  }" | python3 -m json.tool
echo ""
echo "⚠️  触发备件不足，状态变为 'spare_shortage'"
echo ""

echo "10. 查看未关闭原因"
echo "----------------------------------------"
curl -s "$BASE_URL/reports/$REPORT1_ID" | python3 -c "import sys, json; d=json.load(sys.stdin); print(f'工单状态: {d[\"status\"]}'); print(f'未关闭原因: {d[\"not_closed_reason\"]}')"
echo ""

echo "11. 重新派工 (备件补货后)"
echo "----------------------------------------"
curl -s -X POST "$BASE_URL/reports/$REPORT1_ID/redispatch?reason=备件已补货" | python3 -m json.tool
echo ""

echo "12. 再次派工"
echo "----------------------------------------"
curl -s -X POST "$BASE_URL/dispatches/" \
  -H "Content-Type: application/json" \
  -d "{
    \"report_id\": $REPORT1_ID,
    \"worker_name\": \"赵师傅\",
    \"worker_phone\": \"13900139001\",
    \"team\": \"维修一组\",
    \"scheduled_time\": \"2024-01-16T09:00:00\",
    \"remarks\": \"备件已到，继续处理\"
  }" | python3 -m json.tool
echo ""

echo "13. 施工反馈 - 使用正确数量的备件并完成"
echo "----------------------------------------"
curl -s -X POST "$BASE_URL/construction-feedback/" \
  -H "Content-Type: application/json" \
  -d "{
    \"report_id\": $REPORT1_ID,
    \"result\": \"success\",
    \"description\": \"更换LED灯泡2个，测试正常亮灯\",
    \"worker_signature\": \"赵师傅\",
    \"spare_usages\": [{\"spare_part_id\": $SPARE1_ID, \"quantity\": 2}]
  }" | python3 -m json.tool
echo ""
echo "✓ 施工完成，工单关闭!"
echo ""

echo "14. 查看最终工单状态"
echo "----------------------------------------"
curl -s "$BASE_URL/reports/$REPORT1_ID" | python3 -m json.tool
echo ""

echo "15. 查看合并工单 #2 的状态 (自动跟随主单)"
echo "----------------------------------------"
curl -s "$BASE_URL/reports/$REPORT2_ID" | python3 -c "import sys, json; d=json.load(sys.stdin); print(f'工单 #{d[\"id\"]} 状态: {d[\"status\"]}'); print(f'未关闭原因: {d[\"not_closed_reason\"]}')"
echo ""

echo "16. 关闭后继续收到上报测试"
echo "----------------------------------------"
echo "再次提交 LP-001 的报修 (原工单已关闭，应创建新工单)..."
REPORT4=$(curl -s -X POST "$BASE_URL/reports/" \
  -H "Content-Type: application/json" \
  -d '{
    "pole_code": "LP-001",
    "source": "市民热线-12345",
    "description": "灯又不亮了，刚修好又坏了",
    "reporter_name": "张三",
    "reporter_phone": "13800138001"
  }')
echo "$REPORT4" | python3 -m json.tool
echo ""
echo "ℹ️  说明: 原工单已关闭，创建了新的报修单，没有合并!"
echo ""

echo "========================================"
echo "     演示完成!"
echo "========================================"
echo ""
echo "API 文档: http://localhost:8000/docs"
echo "数据库文件: street_light.db (SQLite)"
echo ""
