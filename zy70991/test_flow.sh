#!/bin/bash

BASE_URL="http://localhost:8000"
BATCH_NO="BATCH-TEST-$(date +%Y%m%d%H%M%S)"

echo "========================================"
echo "  短租房水电押金结算 API 完整测试流程"
echo "========================================"
echo "批次号: $BATCH_NO"
echo ""

echo "=== 步骤 1: 创建批次 ==="
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/batches" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_no": "'"$BATCH_NO"'",
    "operator": "张三",
    "property_id": "APT-BJ-001",
    "tenant_name": "李四",
    "deposit_amount": 5000.00
  }')
echo "$CREATE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$CREATE_RESPONSE"
echo ""

echo "=== 步骤 2: 上传原始材料 ==="
UPLOAD_RESPONSE=$(curl -s -X POST "$BASE_URL/api/batches/materials" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_no": "'"$BATCH_NO"'",
    "operator": "张三",
    "electricity": {
      "previous_reading": 1200.0,
      "current_reading": 1680.0,
      "usage_kwh": 480.0
    },
    "water": {
      "previous_reading": 85.0,
      "current_reading": 108.0,
      "usage_ton": 23.0
    },
    "damages": [
      {
        "item_name": "客厅吊灯",
        "damage_description": "灯罩破裂",
        "compensation_amount": 300.00,
        "photo_reference": "IMG_20240527_001.jpg"
      },
      {
        "item_name": "厨房水龙头",
        "damage_description": "漏水损坏",
        "compensation_amount": 150.00,
        "photo_reference": "IMG_20240527_002.jpg"
      }
    ],
    "refunds": [
      {
        "reason": "上期电费多扣",
        "amount": 80.00,
        "original_transaction_no": "TXN-20240401-001"
      }
    ]
  }')
echo "$UPLOAD_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$UPLOAD_RESPONSE"
echo ""

echo "=== 步骤 3: 触发拆分流程 ==="
SPLIT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/batches/split" \
  -H "Content-Type: application/json" \
  -d '{"batch_no": "'"$BATCH_NO"'"}')
echo "$SPLIT_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$SPLIT_RESPONSE"
echo ""

echo "=== 步骤 4: 生成结算报告 ==="
REPORT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/batches/$BATCH_NO/report")
echo "$REPORT_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$REPORT_RESPONSE"
echo ""

echo "=== 步骤 5: 下载报告 ==="
curl -s "$BASE_URL/api/batches/$BATCH_NO/report/download" -o "report_$BATCH_NO.txt"
echo "报告已保存到: report_$BATCH_NO.txt"
cat "report_$BATCH_NO.txt"
echo ""

echo "=== 步骤 6: 提取参考号并查询处理轨迹 ==="
ELEC_REF=$(echo "$SPLIT_RESPONSE" | python3 -c "
import json,sys
data = json.load(sys.stdin)
for d in data.get('details', []):
    if d.get('detail_type') == 'electricity':
        print(d.get('reference_no'))
" 2>/dev/null)

if [ -n "$ELEC_REF" ]; then
  echo "电费明细参考号: $ELEC_REF"
  echo "--- 电费明细处理轨迹 ---"
  TRACE_RESPONSE=$(curl -s "$BASE_URL/api/details/reference/$ELEC_REF/traces")
  echo "$TRACE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$TRACE_RESPONSE"
else
  echo "无法提取电费参考号"
fi
echo ""

echo "=== 步骤 7: 测试幂等性 - 重复提交相同材料 ==="
UPLOAD_RESPONSE2=$(curl -s -X POST "$BASE_URL/api/batches/materials" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_no": "'"$BATCH_NO"'",
    "operator": "张三",
    "electricity": {
      "previous_reading": 1200.0,
      "current_reading": 1680.0,
      "usage_kwh": 480.0
    },
    "water": {
      "previous_reading": 85.0,
      "current_reading": 108.0,
      "usage_ton": 23.0
    },
    "damages": [
      {
        "item_name": "客厅吊灯",
        "damage_description": "灯罩破裂",
        "compensation_amount": 300.00,
        "photo_reference": "IMG_20240527_001.jpg"
      },
      {
        "item_name": "厨房水龙头",
        "damage_description": "漏水损坏",
        "compensation_amount": 150.00,
        "photo_reference": "IMG_20240527_002.jpg"
      }
    ],
    "refunds": [
      {
        "reason": "上期电费多扣",
        "amount": 80.00,
        "original_transaction_no": "TXN-20240401-001"
      }
    ]
  }')
echo "$UPLOAD_RESPONSE2" | python3 -m json.tool 2>/dev/null || echo "$UPLOAD_RESPONSE2"

IS_DUP=$(echo "$UPLOAD_RESPONSE2" | python3 -c "
import json,sys
data = json.load(sys.stdin)
print(data.get('is_duplicate', 'N/A'))
" 2>/dev/null)
echo "是否重复: $IS_DUP"
echo ""

echo "=== 步骤 8: 测试幂等性 - 重复触发拆分 ==="
SPLIT_RESPONSE2=$(curl -s -X POST "$BASE_URL/api/batches/split" \
  -H "Content-Type: application/json" \
  -d '{"batch_no": "'"$BATCH_NO"'"}')
echo "$SPLIT_RESPONSE2" | python3 -m json.tool 2>/dev/null || echo "$SPLIT_RESPONSE2"

IS_DUP2=$(echo "$SPLIT_RESPONSE2" | python3 -c "
import json,sys
data = json.load(sys.stdin)
print(data.get('is_duplicate', 'N/A'))
" 2>/dev/null)
echo "是否重复拆分: $IS_DUP2"
echo ""

echo "========================================"
echo "  测试流程完成！"
echo "========================================"
echo "查看 API 文档: $BASE_URL/docs"
echo ""
