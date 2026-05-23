#!/bin/bash
echo "=== 护理站排班API测试 ==="

# 读取测试数据
SERVICE_ORDERS=$(cat testdata/service_orders.csv)
NURSE_CALENDAR=$(cat testdata/nurse_calendar.json 2>/dev/null || echo "[]")
ELDER_PROFILES=$(cat testdata/elder_profiles.csv 2>/dev/null || echo "老人编号,姓名,年龄,性别,地址,所在区域,健康等级,所需护理项目
E001,王爷爷,78,男,北京市东城区XX路1号,东城区,三级,基础护理、血压监测
E002,李奶奶,82,女,北京市东城区XX路2号,东城区,四级,压疮护理、糖尿病护理")

echo "正在调用API..."
echo ""

# 发送请求
curl -s -X POST http://localhost:8080/api/upload \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
    --arg so "$SERVICE_ORDERS" \
    --arg nc "$NURSE_CALENDAR" \
    --arg ep "$ELDER_PROFILES" \
    '{ServiceOrders: $so, NurseCalendar: $nc, ElderProfiles: $ep}')" | python3 -m json.tool

echo ""
echo "=== 测试完成 ==="
