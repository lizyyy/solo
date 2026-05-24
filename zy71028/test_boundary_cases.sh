#!/bin/bash

BASE_URL="http://localhost:8080/api/v1"

echo "=========================================="
echo "长者送餐安访 API 边界测试脚本"
echo "=========================================="

echo ""
echo "=== 测试 1: 创建基础数据 ==="
echo ""

echo "创建老人档案 1 (张奶奶)..."
ELDERLY1=$(curl -s -X POST "$BASE_URL/elderly" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "张奶奶",
    "phone": "13800138001",
    "address": "幸福小区1号楼101室",
    "health_note": "高血压，需低盐饮食",
    "contact_name": "李女士（女儿）",
    "contact_phone": "13900139001"
  }')
echo "$ELDERLY1"
ELDERLY1_ID=$(echo "$ELDERLY1" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
echo "老人1 ID: $ELDERLY1_ID"

echo ""
echo "创建老人档案 2 (王爷爷)..."
ELDERLY2=$(curl -s -X POST "$BASE_URL/elderly" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "王爷爷",
    "phone": "13800138002",
    "address": "幸福小区2号楼202室",
    "health_note": "糖尿病",
    "contact_name": "王先生（儿子）",
    "contact_phone": "13900139002"
  }')
echo "$ELDERLY2"
ELDERLY2_ID=$(echo "$ELDERLY2" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
echo "老人2 ID: $ELDERLY2_ID"

echo ""
echo "创建志愿者..."
VOLUNTEER=$(curl -s -X POST "$BASE_URL/volunteers" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "小李",
    "phone": "13700137001",
    "area": "幸福小区"
  }')
echo "$VOLUNTEER"
VOLUNTEER_ID=$(echo "$VOLUNTEER" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
echo "志愿者 ID: $VOLUNTEER_ID"

echo ""
echo "=== 测试 2: 停餐拦截功能 ==="
echo ""

TODAY=$(date +%Y-%m-%d)
echo "今天日期: $TODAY"

echo "为张奶奶创建停餐申请..."
SUSPENSION=$(curl -s -X POST "$BASE_URL/suspensions" \
  -H "Content-Type: application/json" \
  -d "{
    \"elderly_id\": \"$ELDERLY1_ID\",
    \"start_date\": \"$TODAY\",
    \"end_date\": \"$TODAY\",
    \"reason\": \"去女儿家住几天\",
    \"requested_by\": \"管理员\"
  }")
echo "$SUSPENSION"
SUSPENSION_ID=$(echo "$SUSPENSION" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
echo "停餐申请 ID: $SUSPENSION_ID"

echo ""
echo "审批停餐申请..."
curl -s -X POST "$BASE_URL/suspensions/$SUSPENSION_ID/approve" \
  -H "Content-Type: application/json" \
  -d '{"reviewed_by": "主管"}'

echo ""
echo "尝试为已停餐的张奶奶创建送餐路线（应该被拦截）..."
curl -s -X POST "$BASE_URL/routes" \
  -H "Content-Type: application/json" \
  -d "{
    \"request_id\": \"REQ-001-SUSPENDED\",
    \"elderly_id\": \"$ELDERLY1_ID\",
    \"date\": \"$TODAY\",
    \"notes\": \"午餐配送\"
  }"

echo ""
echo "=== 测试 3: 重复派单幂等性 ==="
echo ""

echo "为王爷爷创建送餐路线..."
curl -s -X POST "$BASE_URL/routes" \
  -H "Content-Type: application/json" \
  -d "{
    \"request_id\": \"REQ-002-NORMAL\",
    \"elderly_id\": \"$ELDERLY2_ID\",
    \"date\": \"$TODAY\",
    \"notes\": \"午餐配送\"
  }"

echo ""
echo "使用相同 request_id 重复创建（应该返回已有记录）..."
curl -s -X POST "$BASE_URL/routes" \
  -H "Content-Type: application/json" \
  -d "{
    \"request_id\": \"REQ-002-NORMAL\",
    \"elderly_id\": \"$ELDERLY2_ID\",
    \"date\": \"$TODAY\",
    \"notes\": \"午餐配送\"
  }"

echo ""
echo "使用不同 request_id 但同老人同日期（应该返回已有记录）..."
curl -s -X POST "$BASE_URL/routes" \
  -H "Content-Type: application/json" \
  -d "{
    \"request_id\": \"REQ-003-DUPLICATE-DATE\",
    \"elderly_id\": \"$ELDERLY2_ID\",
    \"date\": \"$TODAY\",
    \"notes\": \"午餐配送\"
  }"

echo ""
echo "=== 测试 4: 路线状态机 ==="
echo ""

ROUTE_ID=$(curl -s "$BASE_URL/routes/request/REQ-002-NORMAL" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
echo "路线 ID: $ROUTE_ID"

echo ""
echo "分配志愿者..."
curl -s -X POST "$BASE_URL/routes/$ROUTE_ID/assign" \
  -H "Content-Type: application/json" \
  -d "{\"volunteer_id\": \"$VOLUNTEER_ID\"}"

echo ""
echo "开始派送..."
curl -s -X POST "$BASE_URL/routes/$ROUTE_ID/start"

echo ""
echo "=== 测试 5: 安访结果与升级 ==="
echo ""

echo "创建正常安访记录..."
curl -s -X POST "$BASE_URL/visits" \
  -H "Content-Type: application/json" \
  -d "{
    \"route_id\": \"$ROUTE_ID\",
    \"result\": \"normal\",
    \"evidence_url\": \"http://example.com/photo1.jpg\",
    \"notes\": \"老人状态良好，用餐愉快\"
  }"

echo ""
echo "完成配送..."
curl -s -X POST "$BASE_URL/routes/$ROUTE_ID/complete"

echo ""
echo "为张奶奶创建另一条路线（明日）测试异常安访..."
TOMORROW=$(date -v+1d +%Y-%m-%d)
echo "明天日期: $TOMORROW"

curl -s -X POST "$BASE_URL/routes" \
  -H "Content-Type: application/json" \
  -d "{
    \"request_id\": \"REQ-004-ABNORMAL\",
    \"elderly_id\": \"$ELDERLY1_ID\",
    \"date\": \"$TOMORROW\",
    \"notes\": \"午餐配送\"
  }"

ROUTE2_ID=$(curl -s "$BASE_URL/routes/request/REQ-004-ABNORMAL" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
echo "路线2 ID: $ROUTE2_ID"

curl -s -X POST "$BASE_URL/routes/$ROUTE2_ID/assign" \
  -H "Content-Type: application/json" \
  -d "{\"volunteer_id\": \"$VOLUNTEER_ID\"}"

curl -s -X POST "$BASE_URL/routes/$ROUTE2_ID/start"

echo ""
echo "创建异常安访记录（敲门无人，应该触发待跟进）..."
curl -s -X POST "$BASE_URL/visits" \
  -H "Content-Type: application/json" \
  -d "{
    \"route_id\": \"$ROUTE2_ID\",
    \"result\": \"no_answer\",
    \"evidence_url\": \"http://example.com/photo2.jpg\",
    \"notes\": \"敲门10分钟无人应答\"
  }"

echo ""
echo "=== 测试 6: 查看待跟进列表 ==="
echo ""
curl -s "$BASE_URL/visits/pending-followups"

echo ""
echo "=== 测试 7: 生成并导出报告 ==="
echo ""

echo "生成今日报告..."
curl -s -X POST "$BASE_URL/reports/$TODAY/generate"

echo ""
echo "获取报告..."
curl -s "$BASE_URL/reports/$TODAY"

echo ""
echo "导出 Excel 报告到 report_$TODAY.xlsx..."
curl -s "$BASE_URL/reports/$TODAY/export" -o "report_$TODAY.xlsx"
echo "文件已保存: report_$TODAY.xlsx"

echo ""
echo "=== 测试 8: 错误类型验证 ==="
echo ""

echo "测试缺少字段..."
curl -s -X POST "$BASE_URL/elderly" \
  -H "Content-Type: application/json" \
  -d '{"name": "测试"}'

echo ""
echo "测试状态不允许（直接完成未开始的路线）..."
curl -s -X POST "$BASE_URL/routes/$ROUTE2_ID/complete"

echo ""
echo "=========================================="
echo "边界测试完成！"
echo "=========================================="
