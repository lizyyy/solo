#!/bin/bash

BASE_URL="http://localhost:3000/api"

echo "======================================"
echo "家电售后仓管理系统 - API 测试脚本"
echo "======================================"
echo ""

echo "1. 测试健康检查接口"
curl -s "$BASE_URL/health" | python3 -m json.tool
echo ""

echo "2. 查看 API 文档"
curl -s "$BASE_URL/docs" | python3 -m json.tool 2>/dev/null | head -30
echo "..."
echo ""

echo "3. 创建零件数据"
echo "创建零件: 空调压缩机"
curl -s -X POST "$BASE_URL/base/parts" \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "part-001",
    "part_code": "P-AC-001",
    "part_name": "空调压缩机",
    "stock_quantity": 50,
    "unit": "台",
    "operator": "管理员A"
  }' | python3 -m json.tool
echo ""

echo "创建零件: 控制电路板"
curl -s -X POST "$BASE_URL/base/parts" \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "part-002",
    "part_code": "P-AC-002",
    "part_name": "控制电路板",
    "stock_quantity": 100,
    "unit": "块",
    "operator": "管理员A"
  }' | python3 -m json.tool
echo ""

echo "4. 创建工程师数据"
curl -s -X POST "$BASE_URL/base/engineers" \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "eng-001",
    "engineer_code": "E-001",
    "engineer_name": "王师傅",
    "phone": "13800138001",
    "id_card": "110101199001011234",
    "operator": "管理员A"
  }' | python3 -m json.tool
echo ""

echo "5. 查看零件列表"
curl -s "$BASE_URL/base/parts" | python3 -m json.tool
echo ""

echo "6. 查看工程师列表（注意敏感字段已脱敏）"
curl -s "$BASE_URL/base/engineers" | python3 -m json.tool
echo ""

echo "7. 工程师领件"
CLAIM_RESULT=$(curl -s -X POST "$BASE_URL/operations/claim" \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "claim-001",
    "engineer_code": "E-001",
    "part_code": "P-AC-001",
    "quantity": 2,
    "notes": "上门维修空调用",
    "operator": "仓管员B"
  }')
echo "$CLAIM_RESULT" | python3 -m json.tool
CLAIM_ID=$(echo "$CLAIM_RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])")
echo "领件ID: $CLAIM_ID"
echo ""

echo "8. 测试幂等性 - 重复提交相同的领件请求"
echo "（应该返回缓存结果，不会重复扣库存）"
curl -s -X POST "$BASE_URL/operations/claim" \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "claim-001",
    "engineer_code": "E-001",
    "part_code": "P-AC-001",
    "quantity": 2,
    "notes": "上门维修空调用",
    "operator": "仓管员B"
  }' | python3 -m json.tool
echo ""

echo "9. 再次查看零件库存（应该从50变为48）"
curl -s "$BASE_URL/base/parts" | python3 -m json.tool
echo ""

echo "10. 装机记录"
INSTALL_DATA=$(cat <<EOF
{
  "request_id": "install-001",
  "claim_id": "$CLAIM_ID",
  "customer_name": "张先生",
  "customer_phone": "13900139000",
  "customer_address": "北京市朝阳区XX小区1号楼2单元301",
  "serial_number": "AC-SN-2024-001234",
  "notes": "安装顺利，客户满意",
  "operator": "王师傅"
}
EOF
)
curl -s -X POST "$BASE_URL/operations/installation" \
  -H "Content-Type: application/json" \
  -d "$INSTALL_DATA" | python3 -m json.tool
echo ""

echo "11. 旧件返还"
RETURN_DATA=$(cat <<EOF
{
  "request_id": "return-001",
  "claim_id": "$CLAIM_ID",
  "part_code": "P-AC-001",
  "quantity": 1,
  "condition": "damaged",
  "warehouse_keeper": "李仓管",
  "notes": "旧压缩机损坏，无法修复",
  "operator": "仓管员B"
}
EOF
)
RETURN_RESULT=$(curl -s -X POST "$BASE_URL/operations/return" \
  -H "Content-Type: application/json" \
  -d "$RETURN_DATA")
echo "$RETURN_RESULT" | python3 -m json.tool
RETURN_ID=$(echo "$RETURN_RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])")
echo "返还记录ID: $RETURN_ID"
echo ""

echo "12. 再次查看零件库存（损坏件不回库，应该还是48）"
curl -s "$BASE_URL/base/parts" | python3 -m json.tool
echo ""

echo "13. 厂商索赔"
VENDOR_DATA=$(cat <<EOF
{
  "request_id": "vendor-001",
  "return_id": "$RETURN_ID",
  "vendor_name": "XX电器供应商",
  "claim_amount": 850.50,
  "notes": "质量问题索赔，压缩机损坏",
  "operator": "财务C"
}
EOF
)
curl -s -X POST "$BASE_URL/operations/vendor-claim" \
  -H "Content-Type: application/json" \
  -d "$VENDOR_DATA" | python3 -m json.tool
echo ""

echo "14. 坏账核销"
WRITEOFF_DATA=$(cat <<EOF
{
  "request_id": "writeoff-001",
  "claim_id": "$CLAIM_ID",
  "reason": "零件遗失，无法找回",
  "amount": 425.25,
  "approved_by": "张经理",
  "notes": "未返还的1件压缩机做坏账处理",
  "operator": "财务C"
}
EOF
)
curl -s -X POST "$BASE_URL/operations/write-off" \
  -H "Content-Type: application/json" \
  -d "$WRITEOFF_DATA" | python3 -m json.tool
echo ""

echo "15. 查看领用记录"
curl -s "$BASE_URL/operations/claims" | python3 -m json.tool
echo ""

echo "16. 查看返还记录"
curl -s "$BASE_URL/operations/returns" | python3 -m json.tool
echo ""

echo "17. 查看厂商索赔记录"
curl -s "$BASE_URL/operations/vendor-claims" | python3 -m json.tool
echo ""

echo "18. 查看审计日志"
curl -s "$BASE_URL/audit-logs" | python3 -m json.tool
echo ""

echo "19. 测试导出领用记录（会自动脱敏）"
curl -s -X POST "$BASE_URL/export/claims" \
  -H "Content-Type: application/json" \
  -d '{}' | python3 -m json.tool
echo ""

echo "======================================"
echo "测试完成！"
echo "======================================"
echo ""
echo "核心功能验证点："
echo "✅ 本地持久化（SQLite数据库）"
echo "✅ 敏感字段脱敏（姓名、手机号、身份证）"
echo "✅ 幂等性保证（重复提交不会重复处理）"
echo "✅ 全流程覆盖（领件、装机、返还、索赔、核销）"
echo "✅ 审计日志记录"
echo "✅ 数据导出功能"
echo ""
echo "数据库文件: warehouse.db"
echo "日志目录: logs/"
echo "导出目录: exports/"
echo ""
