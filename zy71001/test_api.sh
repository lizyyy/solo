#!/bin/bash

BASE_URL="http://localhost:8080"

echo "========================================"
echo "  Crew Compensation API 测试脚本"
echo "========================================"
echo ""

echo "检查服务是否启动..."
if ! curl -s -f "$BASE_URL" > /dev/null 2>&1; then
    echo "错误: 无法连接到 $BASE_URL"
    echo "请先启动服务: ./crew-api"
    exit 1
fi
echo "服务运行正常 ✓"
echo ""

echo "========================================"
echo "测试 1: 健康检查 (GET /)"
echo "========================================"
curl -s -o /dev/null -w "HTTP 状态码: %{http_code}\n" "$BASE_URL/"
echo ""

echo "========================================"
echo "测试 2: 获取基地列表 (GET /api/v1/bases)"
echo "========================================"
RESPONSE=$(curl -s "$BASE_URL/api/v1/bases")
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

echo "========================================"
echo "测试 3: 获取机组人员列表 (GET /api/v1/crew)"
echo "========================================"
RESPONSE=$(curl -s "$BASE_URL/api/v1/crew")
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

echo "========================================"
echo "测试 4: 获取补偿申请列表 (GET /api/v1/applications)"
echo "========================================"
RESPONSE=$(curl -s "$BASE_URL/api/v1/applications")
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

echo "========================================"
echo "测试 5: 获取补偿记录列表 (GET /api/v1/compensations)"
echo "========================================"
RESPONSE=$(curl -s "$BASE_URL/api/v1/compensations")
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

echo "========================================"
echo "测试完成!"
echo "========================================"
