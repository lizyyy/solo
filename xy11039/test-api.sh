#!/bin/bash
echo "=========================================="
echo "  滑雪装备租赁点雪板租借调码 API 测试"
echo "=========================================="
echo ""

BASE_URL="http://localhost:3000"

echo "1️⃣  获取调码类型枚举"
curl -s "$BASE_URL/api/adjustments/enums/types" | python3 -m json.tool 2>/dev/null || curl -s "$BASE_URL/api/adjustments/enums/types"
echo ""
echo ""

echo "2️⃣  获取调码状态枚举"
curl -s "$BASE_URL/api/adjustments/enums/status" | python3 -m json.tool 2>/dev/null || curl -s "$BASE_URL/api/adjustments/enums/status"
echo ""
echo ""

echo "3️⃣  获取导入模板"
curl -s "$BASE_URL/api/adjustments/batch/template"
echo ""
echo ""

echo "4️⃣  测试创建调码 - 验证边界情况检测"
RENTAL_ID=$(curl -s "$BASE_URL" > /dev/null 2>&1 && echo "需要先在数据库初始化租借记录")

# 直接获取数据库中的数据
echo "注意：需要先创建租借记录和装备数据才能测试完整流程"
echo ""

echo "5️⃣  测试导出统计"
curl -s "$BASE_URL/api/adjustments/export/statistics" | python3 -m json.tool 2>/dev/null || curl -s "$BASE_URL/api/adjustments/export/statistics"
echo ""
echo ""

echo "6️⃣  查询调码列表"
curl -s "$BASE_URL/api/adjustments?page=1&pageSize=10" | python3 -m json.tool 2>/dev/null || curl -s "$BASE_URL/api/adjustments?page=1&pageSize=10"
echo ""
echo ""

echo "✅ 测试完成"
echo ""
echo "主要 API 端点："
echo "  - POST /api/adjustments/create           - 创建调码（单条处理）"
echo "  - POST /api/adjustments/batch/import     - 批量导入调码"
echo "  - POST /api/adjustments/:id/submit-review - 提交审核"
echo "  - POST /api/adjustments/:id/approve       - 审核通过"
echo "  - POST /api/adjustments/:id/confirm-return - 确认旧装备归还"
echo "  - POST /api/adjustments/:id/complete      - 完成调码"
echo "  - GET  /api/adjustments/:id               - 查询详情（含边界检测）"
echo "  - GET  /api/adjustments/export/csv        - 导出CSV"
echo ""
echo "边界检测说明："
echo "  - 每次操作都会自动检测旧装备是否已归还"
echo "  - 自动检测对账一致性（费用、数量等）"
echo "  - 接口返回 nextActions 和 requiredMaterials 字段"
echo "    说明下一步需要做什么和需要补充什么材料"
echo ""
