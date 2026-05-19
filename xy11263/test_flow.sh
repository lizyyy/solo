#!/bin/bash

BASE_URL="http://localhost:8000"

echo "=== 隐患闭环管理系统测试流程 ==="
echo ""

echo "1. 导入 CSV 隐患数据..."
IMPORT_RESULT=$(curl -s -X POST "$BASE_URL/api/hazards/import" \
  -F "file=@test_hazards.csv")

echo "导入结果:"
echo "$IMPORT_RESULT" | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin), ensure_ascii=False, indent=2))"
echo ""

echo "2. 获取所有隐患列表..."
HAZARDS=$(curl -s "$BASE_URL/api/hazards")
echo "$HAZARDS" | python3 -c "import sys,json; data=json.load(sys.stdin); print(f'共 {len(data)} 条隐患:'); [print(f'  - {h[\"id\"][:8]}... | {h[\"location\"]} | {h[\"status\"]} | 逾期: {h[\"overdue\"][\"overdue\"]}') for h in data]"
echo ""

FIRST_HAZARD_ID=$(echo "$HAZARDS" | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['id'])")
echo "使用第一条隐患进行测试: $FIRST_HAZARD_ID"
echo ""

echo "3. 派发隐患给整改人..."
ASSIGN_RESULT=$(curl -s -X POST "$BASE_URL/api/hazards/assign" \
  -H "Content-Type: application/json" \
  -d "{\"hazard_id\": \"$FIRST_HAZARD_ID\", \"assignee\": \"张三\", \"assigned_by\": \"管理员\"}")
echo "派发结果:"
echo "$ASSIGN_RESULT" | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin), ensure_ascii=False, indent=2))"
echo ""

echo "4. 重复派发测试（幂等性）..."
ASSIGN_RESULT2=$(curl -s -X POST "$BASE_URL/api/hazards/assign" \
  -H "Content-Type: application/json" \
  -d "{\"hazard_id\": \"$FIRST_HAZARD_ID\", \"assignee\": \"张三\", \"assigned_by\": \"管理员\"}")
echo "重复派发结果:"
echo "$ASSIGN_RESULT2" | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin), ensure_ascii=False, indent=2))"
echo ""

echo "5. 提交整改（带照片）..."
RECTIFY_RESULT=$(curl -s -X POST "$BASE_URL/api/hazards/rectify" \
  -H "Content-Type: application/json" \
  -d "{\"hazard_id\": \"$FIRST_HAZARD_ID\", \"rectifier\": \"张三\", \"description\": \"已清理消防通道\", \"photos\": \"rect_photo1.jpg\"}")
echo "整改结果:"
echo "$RECTIFY_RESULT" | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin), ensure_ascii=False, indent=2))"
echo ""

echo "6. 复查通过（带照片应通过）..."
REVIEW_RESULT=$(curl -s -X POST "$BASE_URL/api/hazards/review" \
  -H "Content-Type: application/json" \
  -d "{\"hazard_id\": \"$FIRST_HAZARD_ID\", \"reviewer\": \"李四\", \"result\": \"通过\", \"comments\": \"整改合格\"}")
echo "复查结果:"
echo "$REVIEW_RESULT" | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin), ensure_ascii=False, indent=2))"
echo ""

SECOND_HAZARD_ID=$(echo "$HAZARDS" | python3 -c "import sys,json; print(json.load(sys.stdin)[1]['id'])")
echo "使用第二条隐患测试缺照片拦截: $SECOND_HAZARD_ID"
echo ""

echo "7. 派发第二条隐患..."
curl -s -X POST "$BASE_URL/api/hazards/assign" \
  -H "Content-Type: application/json" \
  -d "{\"hazard_id\": \"$SECOND_HAZARD_ID\", \"assignee\": \"王五\", \"assigned_by\": \"管理员\"}" > /dev/null
echo "派发完成"
echo ""

echo "8. 提交整改（不带照片）..."
curl -s -X POST "$BASE_URL/api/hazards/rectify" \
  -H "Content-Type: application/json" \
  -d "{\"hazard_id\": \"$SECOND_HAZARD_ID\", \"rectifier\": \"王五\", \"description\": \"已整改\"}" > /dev/null
echo "整改提交完成"
echo ""

echo "9. 复查通过（缺照片应被拦截）..."
REVIEW_RESULT2=$(curl -s -X POST "$BASE_URL/api/hazards/review" \
  -H "Content-Type: application/json" \
  -d "{\"hazard_id\": \"$SECOND_HAZARD_ID\", \"reviewer\": \"赵六\", \"result\": \"通过\", \"comments\": \"检查\"}")
echo "复查结果（缺照片应被拦截）:"
echo "$REVIEW_RESULT2" | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin), ensure_ascii=False, indent=2))"
echo ""

echo "10. 查看隐患详情..."
DETAIL=$(curl -s "$BASE_URL/api/hazards/$FIRST_HAZARD_ID")
echo "$DETAIL" | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin), ensure_ascii=False, indent=2))"
echo ""

echo "=== 测试完成 ==="
echo "查看完整隐患列表访问: $BASE_URL/api/hazards"
echo "API 文档访问: $BASE_URL/docs"
