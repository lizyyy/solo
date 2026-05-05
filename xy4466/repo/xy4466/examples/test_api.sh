#!/bin/bash

# 义齿加工管理系统API测试脚本
# 运行前请确保服务器已启动: python run.py

BASE_URL="http://localhost:5000"
EXAMPLES_DIR="./examples"

echo "=========================================="
echo "义齿加工管理系统 API 测试流程"
echo "=========================================="
echo ""

# 1. 测试API是否可用
echo "1. 测试API是否可用..."
curl -s "$BASE_URL/" | python3 -m json.tool
echo ""
echo "------------------------------------------"
echo ""

# 2. 导入口扫订单CSV
echo "2. 导入口扫订单CSV..."
curl -s -X POST \
  -F "file=@$EXAMPLES_DIR/cases.csv" \
  "$BASE_URL/api/cases/import" | python3 -m json.tool
echo ""
echo "------------------------------------------"
echo ""

# 3. 导入3D打印批次JSON
echo "3. 导入3D打印批次JSON..."
curl -s -X POST \
  -H "Content-Type: application/json" \
  -d @$EXAMPLES_DIR/batches.json \
  "$BASE_URL/api/batches/import" | python3 -m json.tool
echo ""
echo "------------------------------------------"
echo ""

# 4. 导入烧结炉温度日志JSON
echo "4. 导入烧结炉温度日志JSON..."
curl -s -X POST \
  -H "Content-Type: application/json" \
  -d @$EXAMPLES_DIR/sintering_logs.json \
  "$BASE_URL/api/sintering/import" | python3 -m json.tool
echo ""
echo "------------------------------------------"
echo ""

# 5. 导入快递取件表JSON
echo "5. 导入快递取件表JSON..."
curl -s -X POST \
  -H "Content-Type: application/json" \
  -d @$EXAMPLES_DIR/express_pickups.json \
  "$BASE_URL/api/express/import" | python3 -m json.tool
echo ""
echo "------------------------------------------"
echo ""

# 6. 更新病例质检状态
echo "6. 更新病例质检状态..."
echo "   - 病例DL20240001: 完成所有质检"
curl -s -X PUT \
  -H "Content-Type: application/json" \
  -d '{"shape_check": true, "color_match": true, "fit_test": true}' \
  "$BASE_URL/api/cases/1" | python3 -m json.tool
echo ""

echo "   - 病例DL20240002: 完成部分质检"
curl -s -X PUT \
  -H "Content-Type: application/json" \
  -d '{"shape_check": true, "color_match": true, "fit_test": false}' \
  "$BASE_URL/api/cases/2" | python3 -m json.tool
echo ""
echo "------------------------------------------"
echo ""

# 7. 手动触发风险计算
echo "7. 手动触发风险计算..."
curl -s -X POST "$BASE_URL/api/risk/calculate" | python3 -m json.tool
echo ""
echo "------------------------------------------"
echo ""

# 8. 查询所有病例
echo "8. 查询所有病例列表..."
curl -s "$BASE_URL/api/cases" | python3 -m json.tool
echo ""
echo "------------------------------------------"
echo ""

# 9. 查询高风险病例
echo "9. 查询高风险病例 (阈值: 40)..."
curl -s "$BASE_URL/api/risk/high-risk?threshold=40" | python3 -m json.tool
echo ""
echo "------------------------------------------"
echo ""

# 10. 获取风险统计摘要
echo "10. 获取风险统计摘要..."
curl -s "$BASE_URL/api/risk/summary" | python3 -m json.tool
echo ""
echo "------------------------------------------"
echo ""

# 11. 人工复核病例
echo "11. 人工复核病例 (病例ID: 3)..."
curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "case_id": 3,
    "reviewer": "张技师",
    "new_status": "hold",
    "notes": "烧结温度偏低，需要进一步检查确认质量",
    "risk_override": true
  }' \
  "$BASE_URL/api/reviews" | python3 -m json.tool
echo ""
echo "------------------------------------------"
echo ""

# 12. 导出Markdown交接单
echo "12. 导出Markdown交接单 (保存为 handover.md)..."
curl -s "$BASE_URL/api/export/markdown" > handover.md
echo "   交接单已保存到 handover.md"
echo ""
echo "------------------------------------------"
echo ""

# 13. 导出JSON审计包
echo "13. 导出JSON审计包 (保存为 audit.json)..."
curl -s "$BASE_URL/api/export/json" > audit.json
echo "   审计包已保存到 audit.json"
echo ""
echo "------------------------------------------"
echo ""

# 14. 查询病例复核记录
echo "14. 查询病例复核记录 (病例ID: 3)..."
curl -s "$BASE_URL/api/cases/3/reviews" | python3 -m json.tool
echo ""
echo "------------------------------------------"
echo ""

echo "=========================================="
echo "API测试流程完成！"
echo "=========================================="
echo ""
echo "生成的文件:"
echo "  - handover.md: Markdown格式交接单"
echo "  - audit.json: JSON格式审计包"
echo ""
echo "其他可用API:"
echo "  - GET /api/cases?status=ready: 查询可发货病例"
echo "  - GET /api/cases?status=rework: 查询需返工病例"
echo "  - GET /api/batches: 查询所有批次"
echo "  - GET /api/sintering: 查询所有烧结日志"
echo "  - GET /api/express: 查询所有快递取件"
echo "  - GET /api/reviews: 查询所有复核记录"
