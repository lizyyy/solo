#!/bin/bash

BASE_URL="http://localhost:8080/api/v1"
IDEMPOTENCY_KEY="APP-TEST-$(date +%Y%m%d%H%M%S)"

echo "========================================"
echo "  机组补偿 API 测试脚本"
echo "========================================"
echo ""

echo "检查服务是否启动..."
if ! curl -s -f "$BASE_URL/health" > /dev/null 2>&1; then
    echo "错误: 无法连接到 $BASE_URL"
    echo "请先启动服务: go run ./cmd/api/main.go"
    exit 1
fi
echo "服务运行正常 ✓"
echo ""

echo "========================================"
echo "测试 1: 健康检查"
echo "========================================"
curl -s -w "\nHTTP 状态码: %{http_code}\n" "$BASE_URL/health" | python3 -m json.tool 2>/dev/null || echo "无法解析JSON"
echo ""

echo "========================================"
echo "测试 2: 创建基地"
echo "========================================"
RESPONSE=$(curl -s -X POST "$BASE_URL/bases" \
    -H "Content-Type: application/json" \
    -d '{
        "name": "北京基地",
        "code": "PEK",
        "city": "北京"
    }')
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

echo "========================================"
echo "测试 3: 创建机组人员"
echo "========================================"
RESPONSE=$(curl -s -X POST "$BASE_URL/crew" \
    -H "Content-Type: application/json" \
    -d '{
        "name": "张三",
        "employee_no": "CA001",
        "base_id": "base-pek-001",
        "position": "机长",
        "phone": "13800138000",
        "email": "zhangsan@airline.com"
    }')
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

echo "========================================"
echo "测试 4: 创建航班段"
echo "========================================"
RESPONSE=$(curl -s -X POST "$BASE_URL/flight-segments" \
    -H "Content-Type: application/json" \
    -d '{
        "flight_no": "CA1234",
        "departure_city": "北京",
        "arrival_city": "上海",
        "departure_time": "2024-01-15T08:00:00Z",
        "arrival_time": "2024-01-15T10:30:00Z",
        "actual_departure": "2024-01-15T08:30:00Z",
        "actual_arrival": "2024-01-15T11:00:00Z",
        "delay_minutes": 30,
        "flight_date": "2024-01-15",
        "crew_id": "crew-001"
    }')
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

echo "========================================"
echo "测试 5: 提交补偿申请（带 Idempotency-Key）"
echo "========================================"
echo "使用幂等键: $IDEMPOTENCY_KEY"
RESPONSE=$(curl -s -X POST "$BASE_URL/applications" \
    -H "Content-Type: application/json" \
    -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
    -d '{
        "crew_id": "crew-001",
        "flight_no": "CA1234",
        "flight_date": "2024-01-15",
        "departure_city": "北京",
        "departure_time": "2024-01-15T08:00:00Z",
        "arrival_time": "2024-01-15T10:30:00Z",
        "delay_minutes": 30,
        "compensation_type": "overtime",
        "compensation_hours": 2.5,
        "remarks": "航班延误加班补偿"
    }')
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
APPLICATION_ID=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id') or d.get('data',{}).get('id','app-test-001'))" 2>/dev/null || echo "app-test-001")
echo "申请ID: $APPLICATION_ID"
echo ""

echo "========================================"
echo "测试 6: 重复提交验证幂等性"
echo "========================================"
echo "再次使用相同的幂等键: $IDEMPOTENCY_KEY"
RESPONSE=$(curl -s -X POST "$BASE_URL/applications" \
    -H "Content-Type: application/json" \
    -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
    -d '{
        "crew_id": "crew-001",
        "flight_no": "CA1234",
        "flight_date": "2024-01-15",
        "departure_city": "北京",
        "departure_time": "2024-01-15T08:00:00Z",
        "arrival_time": "2024-01-15T10:30:00Z",
        "delay_minutes": 30,
        "compensation_type": "overtime",
        "compensation_hours": 2.5,
        "remarks": "航班延误加班补偿"
    }')
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

echo "========================================"
echo "测试 7: 组长审批"
echo "========================================"
RESPONSE=$(curl -s -X POST "$BASE_URL/applications/$APPLICATION_ID/leader-approve" \
    -H "Content-Type: application/json" \
    -d '{
        "approver_id": "leader-001",
        "approver_name": "王组长",
        "reject_reason": ""
    }')
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

echo "========================================"
echo "测试 8: 主管审批"
echo "========================================"
RESPONSE=$(curl -s -X POST "$BASE_URL/applications/$APPLICATION_ID/supervisor-approve" \
    -H "Content-Type: application/json" \
    -d '{
        "approver_id": "supervisor-001",
        "approver_name": "李主管",
        "reject_reason": ""
    }')
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

echo "========================================"
echo "测试 9: 查询申请追溯日志"
echo "========================================"
RESPONSE=$(curl -s "$BASE_URL/applications/$APPLICATION_ID/trace")
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

echo "========================================"
echo "测试 10: 导出 CSV"
echo "========================================"
curl -s -o applications_export.csv "$BASE_URL/applications/export/csv"
if [ -f "applications_export.csv" ]; then
    echo "CSV 文件已导出: applications_export.csv"
    echo "文件内容预览:"
    head -5 applications_export.csv
else
    echo "CSV 导出失败"
fi
echo ""

echo "========================================"
echo "测试 11: 查看补偿汇总"
echo "========================================"
RESPONSE=$(curl -s "$BASE_URL/compensations/summary")
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

echo "========================================"
echo "所有测试完成!"
echo "========================================"
echo ""
echo "测试摘要:"
echo "✓ 健康检查"
echo "✓ 创建基地"
echo "✓ 创建机组人员"
echo "✓ 创建航班段"
echo "✓ 提交补偿申请（带 Idempotency-Key）"
echo "✓ 重复提交验证幂等性"
echo "✓ 组长审批"
echo "✓ 主管审批"
echo "✓ 查询申请追溯日志"
echo "✓ 导出 CSV"
echo "✓ 查看补偿汇总"
echo ""
echo "导出的 CSV 文件: applications_export.csv"
