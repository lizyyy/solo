#!/bin/bash

BASE_URL="http://localhost:3001"

echo "========================================"
echo "  客户数据删除 API 演示"
echo "========================================"
echo ""

echo "=== 场景一：完全删除（客户 C003 - 王五，数据都超过保留期）==="
echo ""

echo "1. 创建删除请求（身份验证通过）"
CREATE1=$(curl -s -X POST "$BASE_URL/api/deletion/requests" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "C003",
    "request_type": "full_deletion",
    "data_scope": "all_data",
    "verification_info": {
      "name": "王五",
      "email": "wangwu@example.com",
      "phone": "13800138003"
    }
  }')

echo "$CREATE1" | python3 -m json.tool 2>/dev/null || echo "$CREATE1"
echo ""

REQUEST_ID1=$(echo "$CREATE1" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "请求ID: $REQUEST_ID1"
echo ""

if [ -n "$REQUEST_ID1" ]; then
  echo "2. 扫描客户数据"
  SCAN1=$(curl -s "$BASE_URL/api/deletion/requests/$REQUEST_ID1/scan")
  echo "扫描到 $(echo $SCAN1 | grep -o '"scanned_count":[0-9]*' | cut -d':' -f2) 条记录"
  echo ""

  echo "3. 分析删除 eligibility"
  ANALYZE1=$(curl -s -X POST "$BASE_URL/api/deletion/requests/$REQUEST_ID1/analyze")
  DELETABLE=$(echo $ANALYZE1 | grep -o '"deletable":[0-9]*' | cut -d':' -f2)
  RETAINED=$(echo $ANALYZE1 | grep -o '"retained":[0-9]*' | cut -d':' -f2)
  echo "可删除: $DELETABLE, 保留: $RETAINED"
  echo ""

  echo "4. 执行删除"
  EXEC1=$(curl -s -X POST "$BASE_URL/api/deletion/requests/$REQUEST_ID1/execute")
  echo "$EXEC1" | python3 -m json.tool 2>/dev/null | head -20
  echo ""

  echo "5. 完成并生成证明"
  COMPLETE1=$(curl -s -X POST "$BASE_URL/api/deletion/requests/$REQUEST_ID1/complete")
  CERT_NUM1=$(echo "$COMPLETE1" | grep -o '"certificate_number":"[^"]*"' | cut -d'"' -f4)
  echo "证明编号: $CERT_NUM1"
  echo ""
fi

echo "=== 场景二：部分保留（客户 C001 - 张三，有订单在保留期内）==="
echo ""

echo "1. 创建删除请求"
CREATE2=$(curl -s -X POST "$BASE_URL/api/deletion/requests" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "C001",
    "request_type": "full_deletion",
    "data_scope": "all_data",
    "verification_info": {
      "name": "张三",
      "email": "zhangsan@example.com",
      "phone": "13800138001"
    }
  }')

echo "$CREATE2" | python3 -m json.tool 2>/dev/null || echo "$CREATE2"
echo ""

REQUEST_ID2=$(echo "$CREATE2" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "请求ID: $REQUEST_ID2"
echo ""

if [ -n "$REQUEST_ID2" ]; then
  echo "2. 扫描客户数据"
  SCAN2=$(curl -s "$BASE_URL/api/deletion/requests/$REQUEST_ID2/scan")
  SCAN_COUNT=$(echo $SCAN2 | grep -o '"scanned_count":[0-9]*' | cut -d':' -f2)
  echo "扫描到 $SCAN_COUNT 条记录"
  echo ""

  echo "3. 分析删除 eligibility（应该有部分数据因账务/合规原因保留）"
  ANALYZE2=$(curl -s -X POST "$BASE_URL/api/deletion/requests/$REQUEST_ID2/analyze")
  echo "分析结果摘要:"
  echo "$ANALYZE2" | python3 -c "
import json, sys
data = json.load(sys.stdin)
summary = data.get('summary', {})
print(f'  总计: {summary.get(\"total\", 0)} 条')
print(f'  可删除: {summary.get(\"deletable\", 0)} 条')
print(f'  保留: {summary.get(\"retained\", 0)} 条')
retained = summary.get('retainedByCategory', {})
for cat, count in retained.items():
    print(f'    - {cat}: {count} 条')
" 2>/dev/null
  echo ""

  echo "4. 执行删除"
  curl -s -X POST "$BASE_URL/api/deletion/requests/$REQUEST_ID2/execute" > /dev/null
  echo "删除执行完成"
  echo ""

  echo "5. 完成并生成证明"
  COMPLETE2=$(curl -s -X POST "$BASE_URL/api/deletion/requests/$REQUEST_ID2/complete")
  CERT_NUM2=$(echo "$COMPLETE2" | grep -o '"certificate_number":"[^"]*"' | cut -d'"' -f4)
  echo "证明编号: $CERT_NUM2"
  echo ""

  echo "6. 查询合规视角证明"
  echo "$COMPLETE2" | python3 -c "
import json, sys
data = json.load(sys.stdin)
compliance = data.get('compliance_view', {})
print('=== 合规视角证明 ===')
print(f'证明编号: {compliance.get(\"certificate_number\", \"\")}')
print(f'客户: {compliance.get(\"customer_name\", \"\")} ({compliance.get(\"customer_id\", \"\")})')
summary = compliance.get('summary', {})
print(f'处理记录: 总计 {summary.get(\"total_records\", 0)}, 删除 {summary.get(\"deleted\", 0)}, 保留 {summary.get(\"retained\", 0)}')
print()
retained = compliance.get('retained_records', {})
if retained:
    print('保留例外详情:')
    for category, items in retained.items():
        print(f'  [{category}]')
        for item in items[:3]:
            print(f'    - {item.get(\"data_type\", \"\")}: {item.get(\"reason\", \"\")}'[:100])
        if len(items) > 3:
            print(f'    ... 还有 {len(items)-3} 条')
" 2>/dev/null
  echo ""

  echo "7. 查询客户视角证明"
  echo "$COMPLETE2" | python3 -c "
import json, sys
data = json.load(sys.stdin)
customer = data.get('customer_view', {})
print('=== 客户视角证明 ===')
print(f'客户: {customer.get(\"customer_name\", \"\")}')
print(f'确认: {customer.get(\"confirmation\", \"\")}')
summary = customer.get('summary', {})
print(f'处理: 总计 {summary.get(\"records_processed\", 0)}, 删除 {summary.get(\"records_deleted\", 0)}, 保留 {summary.get(\"records_retained\", 0)}')
if customer.get('retained_records_notice'):
    print(f'保留说明: {customer.get(\"retained_records_notice\", \"\")}')
" 2>/dev/null
  echo ""
fi

echo "=== 场景三：身份验证失败（客户 C002 - 李四，验证信息错误）==="
echo ""

echo "创建删除请求（邮箱错误）"
curl -s -X POST "$BASE_URL/api/deletion/requests" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "C002",
    "request_type": "full_deletion",
    "data_scope": "all_data",
    "verification_info": {
      "name": "李四",
      "email": "wrong@example.com"
    }
  }' | python3 -m json.tool 2>/dev/null
echo ""

echo "=== 场景四：重复请求测试 ==="
echo ""

echo "再次创建 C001 的删除请求（应该失败）"
curl -s -X POST "$BASE_URL/api/deletion/requests" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "C001",
    "request_type": "full_deletion",
    "data_scope": "all_data",
    "verification_info": {
      "name": "张三",
      "email": "zhangsan@example.com"
    }
  }' | python3 -m json.tool 2>/dev/null
echo ""

echo "=== 合规仪表板查询 ==="
echo ""

curl -s "$BASE_URL/api/deletion/compliance/dashboard" | python3 -c "
import json, sys
data = json.load(sys.stdin)
stats = data.get('statistics', {})
print('=== 合规仪表板 ===')
print(f'总请求数: {stats.get(\"total\", 0)}')
print('状态分布:')
for status, count in stats.get('by_status', {}).items():
    print(f'  {status}: {count}')
print()
print('最近请求:')
for req in stats.get('recent_requests', [])[:3]:
    print(f'  ID: {req.get(\"id\", \"\")[:8]}...')
    print(f'    客户: {req.get(\"customer_name\", \"\")} ({req.get(\"customer_id\", \"\")})')
    print(f'    状态: {req.get(\"status\", \"\")}')
    summary = req.get('summary', {})
    print(f'    摘要: 删除 {summary.get(\"deletable\", 0)}, 保留 {summary.get(\"retained\", 0)}')
" 2>/dev/null

echo ""
echo "========================================"
echo "  演示完成"
echo "========================================"
