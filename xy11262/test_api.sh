#!/bin/bash

BASE_URL="http://localhost:8000/api/v1"

echo "========================================"
echo "  隐患闭环管理系统 - API测试脚本"
echo "========================================"
echo ""

echo "1. 检查服务健康状态..."
curl -s "$BASE_URL/health" | python3 -m json.tool
echo ""

echo "2. 导入正常隐患数据..."
curl -s -X POST "$BASE_URL/import/hazards?filename=sample_hazards_normal.csv" | python3 -m json.tool
echo ""

echo "3. 导入包含错误的隐患数据（测试坏记录功能）..."
curl -s -X POST "$BASE_URL/import/hazards?filename=sample_hazards_with_errors.csv" | python3 -m json.tool
echo ""

echo "4. 查看导入历史..."
curl -s "$BASE_URL/import/history" | python3 -m json.tool
echo ""

echo "5. 查看导入ID=2的坏记录..."
curl -s "$BASE_URL/import/2/bad-records" | python3 -m json.tool
echo ""

echo "6. 获取所有隐患列表..."
curl -s "$BASE_URL/hazards" | python3 -m json.tool
echo ""

echo "7. 导入照片索引..."
curl -s -X POST "$BASE_URL/import/photos?filename=sample_photos.json" | python3 -m json.tool
echo ""

echo "8. 分配隐患ID=1给责任人..."
curl -s -X POST "$BASE_URL/hazards/1/assign?responsible_person=李工&responsible_phone=13800138009" | python3 -m json.tool
echo ""

echo "9. 隐患ID=1开始整改..."
curl -s -X POST "$BASE_URL/hazards/1/start-rectification" | python3 -m json.tool
echo ""

echo "10. 隐患ID=1完成整改..."
curl -s -X POST "$BASE_URL/hazards/1/complete-rectification" \
  -H "Content-Type: application/json" \
  -d '{"rectifier": "张施工", "action_taken": "已清理通道杂物，疏通消防通道"}' | python3 -m json.tool
echo ""

echo "11. 隐患ID=1复查通过..."
curl -s -X POST "$BASE_URL/hazards/1/review" \
  -H "Content-Type: application/json" \
  -d '{"reviewer": "王审核", "result": "pass", "comments": "整改达标，通道已畅通"}' | python3 -m json.tool
echo ""

echo "12. 导入复查记录..."
curl -s -X POST "$BASE_URL/import/reviews?filename=sample_reviews.csv" | python3 -m json.tool
echo ""

echo "13. 获取统计摘要..."
curl -s "$BASE_URL/stats/summary" | python3 -m json.tool
echo ""

echo "14. 导出隐患CSV..."
curl -s -X POST "$BASE_URL/export/hazards/csv" | python3 -m json.tool
echo ""

echo "15. 获取流程摘要（隐患ID=1）..."
curl -s "$BASE_URL/hazards/1/workflow" | python3 -m json.tool
echo ""

echo "========================================"
echo "  测试完成！"
echo "========================================"
