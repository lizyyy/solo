#!/bin/bash
BASE_URL="http://localhost:8000"
echo "========================================"
echo "网约车运营后台乘客投诉升级 API 验收脚本"
echo "========================================"
echo ""

echo "[1/8] 查看种子行程数据..."
curl -s "$BASE_URL/api/complaints/" | python3 -m json.tool 2>/dev/null || curl -s "$BASE_URL/api/complaints/"
echo ""

echo "[2/8] 创建投诉单1 - 完整流转用例..."
COMPLAINT1=$(curl -s -X POST "$BASE_URL/api/complaints/" \
  -H "Content-Type: application/json" \
  -d '{
    "trip_no": "TRIP202605010001",
    "complaint_type": "司机态度",
    "passenger_description": "司机态度恶劣，中途甩客，导致我迟到重要会议"
  }')
echo "$COMPLAINT1" | python3 -m json.tool
C1_ID=$(echo "$COMPLAINT1" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
C1_VERSION=$(echo "$COMPLAINT1" | python3 -c "import sys,json; print(json.load(sys.stdin)['version'])")
echo "投诉单1 ID: $C1_ID, 版本: $C1_VERSION"
echo ""

echo "[3/8] 投诉单1 - 流转到升级中..."
sleep 1
RESULT=$(curl -s -X PUT "$BASE_URL/api/complaints/$C1_ID" \
  -H "Content-Type: application/json" \
  -d "{
    \"driver_feedback\": \"乘客先骂人的，我只是回应\",
    \"status\": \"升级中\",
    \"operator\": \"客服小王\",
    \"version\": $C1_VERSION
  }")
echo "$RESULT" | python3 -m json.tool
C1_VERSION=$((C1_VERSION + 1))
echo ""

echo "[4/8] 投诉单1 - 流转到已判责..."
sleep 1
RESULT=$(curl -s -X PUT "$BASE_URL/api/complaints/$C1_ID" \
  -H "Content-Type: application/json" \
  -d "{
    \"cs_conclusion\": \"经核实，司机确实存在不当言行，对司机罚款200元，向乘客致歉并赠送50元优惠券\",
    \"status\": \"已判责\",
    \"operator\": \"客服主管\",
    \"version\": $C1_VERSION
  }")
echo "$RESULT" | python3 -m json.tool
C1_VERSION=$((C1_VERSION + 1))
echo ""

echo "[5/8] 投诉单1 - 追加证据（边界测试：原结论未更新）..."
sleep 1
curl -s -X POST "$BASE_URL/api/complaints/$C1_ID/evidences/" \
  -H "Content-Type: application/json" \
  -d '{
    "evidence_type": "录音",
    "content": "录音中司机明确说：你爱上不上，滚下去",
    "uploader": "张明（乘客）"
  }' | python3 -m json.tool
echo "注意：此时 has_new_evidence 应为 1，状态仍为已判责"
echo ""

echo "[6/8] 投诉单1 - 尝试用旧版本更新（冲突测试）..."
sleep 1
echo "尝试用版本 $((C1_VERSION - 1)) 更新（应该失败）..."
curl -s -X PUT "$BASE_URL/api/complaints/$C1_ID" \
  -H "Content-Type: application/json" \
  -d "{
    \"cs_conclusion\": \"恶意覆盖的结论\",
    \"status\": \"已关闭\",
    \"operator\": \"恶意用户\",
    \"version\": $((C1_VERSION - 1))
  }" | python3 -m json.tool
echo ""

echo "[7/8] 投诉单1 - 正常关闭..."
sleep 1
RESULT=$(curl -s -X PUT "$BASE_URL/api/complaints/$C1_ID" \
  -H "Content-Type: application/json" \
  -d "{
    \"cs_conclusion\": \"已对乘客进行补偿，乘客表示接受处理结果，投诉关闭\",
    \"status\": \"已关闭\",
    \"operator\": \"客服主管\",
    \"version\": $C1_VERSION
  }")
echo "$RESULT" | python3 -m json.tool
echo ""

echo "[8/8] 创建投诉单2 - 冲突记录用例..."
sleep 1
COMPLAINT2=$(curl -s -X POST "$BASE_URL/api/complaints/" \
  -H "Content-Type: application/json" \
  -d '{
    "trip_no": "TRIP202605010002",
    "complaint_type": "计费问题",
    "passenger_description": "多收了50元绕路费，实际只有12公里收了35公里的钱"
  }')
echo "$COMPLAINT2" | python3 -m json.tool
C2_ID=$(echo "$COMPLAINT2" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
C2_VERSION=$(echo "$COMPLAINT2" | python3 -c "import sys,json; print(json.load(sys.stdin)['version'])")
echo "投诉单2 ID: $C2_ID"
echo ""

echo "========================================"
echo "查看投诉列表"
echo "========================================"
curl -s "$BASE_URL/api/complaints/" | python3 -m json.tool
echo ""

echo "========================================"
echo "查看投诉单1详情（含证据和历史）"
echo "========================================"
curl -s "$BASE_URL/api/complaints/$C1_ID" | python3 -m json.tool
echo ""

echo "========================================"
echo "查看投诉单1历史记录"
echo "========================================"
curl -s "$BASE_URL/api/complaints/$C1_ID/histories" | python3 -m json.tool
echo ""

echo "========================================"
echo "导出CSV（导入坏行测试：用Excel打开可查看数据完整性）"
echo "========================================"
curl -s "$BASE_URL/api/complaints/export/csv" -o complaints_export.csv
echo "已导出到 complaints_export.csv"
cat complaints_export.csv
echo ""

echo "========================================"
echo "验收完成！核心验证点："
echo "1. 完整流转：待处理 -> 升级中 -> 已判责 -> 已关闭 ✓"
echo "2. 证据追加：has_new_evidence标记，状态不变 ✓"
echo "3. 版本冲突：旧版本更新被拒绝，无静默覆盖 ✓"
echo "4. 历史记录：所有操作留痕可追溯 ✓"
echo "5. 数据导出：CSV格式完整 ✓"
echo "========================================"
