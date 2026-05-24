#!/bin/bash

BASE_URL="http://localhost:8080/api/v1"

echo "=== 实验室试剂解冻 API 测试样例 ==="
echo ""

echo "=== 测试 1: 正常解冻流程 ==="
echo "解冻试剂 DMSO-2024-001"
curl -s -X POST "$BASE_URL/reagents/thaw" \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "thaw-001",
    "batch_no": "DMSO-2024-001",
    "reagent_type": "DMSO",
    "thawed_by": "zhangsan",
    "project": "细胞培养A"
  }' | python3 -m json.tool
echo ""

echo "=== 测试 2: 幂等性测试 - 重复解冻请求 ==="
echo "使用相同 request_id 再次请求（应返回重复请求错误或已有数据）"
curl -s -X POST "$BASE_URL/reagents/thaw" \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "thaw-001",
    "batch_no": "DMSO-2024-001",
    "reagent_type": "DMSO",
    "thawed_by": "zhangsan",
    "project": "细胞培养A"
  }' | python3 -m json.tool
echo ""

echo "=== 测试 3: 正常领用流程 ==="
echo "领用试剂 DMSO-2024-001 用于项目A"
curl -s -X POST "$BASE_URL/reagents/use" \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "use-001",
    "batch_no": "DMSO-2024-001",
    "used_by": "lisi",
    "project": "细胞培养A",
    "volume": "10ml",
    "notes": "传代使用"
  }' | python3 -m json.tool
echo ""

echo "=== 测试 4: 同瓶多项目共享 ==="
echo "同一试剂用于项目B"
curl -s -X POST "$BASE_URL/reagents/use" \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "use-002",
    "batch_no": "DMSO-2024-001",
    "used_by": "wangwu",
    "project": "细胞冻存B",
    "volume": "5ml",
    "notes": "冻存细胞使用"
  }' | python3 -m json.tool
echo ""

echo "=== 测试 5: 查询共享项目列表 ==="
curl -s "$BASE_URL/reagents/DMSO-2024-001/projects" | python3 -m json.tool
echo ""

echo "=== 测试 6: 缺少必填材料 ==="
echo "缺少 batch_no"
curl -s -X POST "$BASE_URL/reagents/use" \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "use-003",
    "used_by": "lisi",
    "project": "细胞培养A"
  }' | python3 -m json.tool
echo ""

echo "=== 测试 7: 领用不存在的试剂 ==="
curl -s -X POST "$BASE_URL/reagents/use" \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "use-004",
    "batch_no": "NOT-EXIST-001",
    "used_by": "lisi",
    "project": "细胞培养A"
  }' | python3 -m json.tool
echo ""

echo "=== 测试 8: 创建处理单并判定流程 ==="
echo "创建解冻异常处理单（需要复核）"
curl -s -X POST "$BASE_URL/orders" \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "order-001",
    "batch_no": "DMSO-2024-001",
    "type": "THAW_EXCEPTION",
    "created_by": "zhangsan",
    "needs_review": true
  }' | python3 -m json.tool
echo ""

echo "=== 测试 8a: NEEDS_REVIEW 错误码验证 - 对需要复核的处理单尝试 approve ==="
ORDER_NO=$(curl -s "$BASE_URL/orders" | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][0]['order_no'])")
echo "处理单号: $ORDER_NO"
curl -s -X POST "$BASE_URL/orders/judgment" \
  -H "Content-Type: application/json" \
  -d "{
    \"request_id\": \"judgment-001\",
    \"order_no\": \"$ORDER_NO\",
    \"judgment\": \"approve\",
    \"judged_by\": \"lisi\",
    \"notes\": \"第一次判定，应该返回 NEEDS_REVIEW\"
  }" | python3 -m json.tool
echo ""

echo "=== 测试 8b: 第一次判定 - 要求补证（不会触发 NEEDS_REVIEW） ==="
curl -s -X POST "$BASE_URL/orders/judgment" \
  -H "Content-Type: application/json" \
  -d "{
    \"request_id\": \"judgment-002\",
    \"order_no\": \"$ORDER_NO\",
    \"judgment\": \"supplement\",
    \"judged_by\": \"lisi\",
    \"notes\": \"请提供解冻时间照片\"
  }" | python3 -m json.tool
echo ""

echo "=== 测试 8c: 第二次判定 - 驳回 ==="
curl -s -X POST "$BASE_URL/orders/judgment" \
  -H "Content-Type: application/json" \
  -d "{
    \"request_id\": \"judgment-003\",
    \"order_no\": \"$ORDER_NO\",
    \"judgment\": \"reject\",
    \"judged_by\": \"wangwu\",
    \"notes\": \"材料不符合要求\"
  }" | python3 -m json.tool
echo ""

echo "=== 测试 8d: 查看判定历史记录 - 验证记录了每次判定 ==="
curl -s "$BASE_URL/orders/$ORDER_NO" | python3 -c "import sys,json; data=json.load(sys.stdin); print('判定历史记录数:', len(data['data']['judgment_history'])); [print(f\"  - {h['judged_at'][:19]} {h['judged_by']}: {h['judgment']} - {h['notes']}\") for h in data['data']['judgment_history']]"
echo ""

echo "=== 测试 8e: NEEDS_REVIEW 错误码验证 - 查询需要复核的处理单 ==="
echo "创建一个新的需要复核的处理单"
curl -s -X POST "$BASE_URL/orders" \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "order-002",
    "batch_no": "DMSO-2024-001",
    "type": "USAGE_EXCEPTION",
    "created_by": "zhangsan",
    "needs_review": true
  }' > /dev/null
NEW_ORDER_NO=$(curl -s "$BASE_URL/orders" | python3 -c "import sys,json; print([o['order_no'] for o in json.load(sys.stdin)['data'] if o['status']=='needs_review'][0])")
echo "新处理单号: $NEW_ORDER_NO"
echo "查询该处理单（应返回 NEEDS_REVIEW 错误码）:"
curl -s "$BASE_URL/orders/$NEW_ORDER_NO" | python3 -m json.tool
echo ""

echo "=== 测试 8f: 状态不允许补证验证（NEEDS_REVIEW 错误码） ==="
echo "对正常状态的处理单尝试补证:"
curl -s -X POST "$BASE_URL/orders/supplement" \
  -H "Content-Type: application/json" \
  -d "{
    \"request_id\": \"supplement-001\",
    \"order_no\": \"$NEW_ORDER_NO\",
    \"evidence\": \"解冻照片.jpg\",
    \"submitted_by\": \"zhangsan\"
  }" | python3 -m json.tool
echo ""

echo "=== 测试 9: 查看所有试剂状态 ==="
curl -s "$BASE_URL/reagents" | python3 -m json.tool
echo ""

echo "=== 测试 10: 查看试剂详情和领用记录 ==="
curl -s "$BASE_URL/reagents/DMSO-2024-001" | python3 -m json.tool
echo ""

echo "=== 测试 11: 废弃试剂 ==="
echo "先解冻一个新试剂"
curl -s -X POST "$BASE_URL/reagents/thaw" \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "thaw-002",
    "batch_no": "TRYPSIN-2024-001",
    "reagent_type": "胰酶",
    "thawed_by": "zhangsan",
    "project": "细胞培养A"
  }' | python3 -m json.tool
echo ""

echo "然后废弃该试剂"
curl -s -X POST "$BASE_URL/reagents/discard" \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "discard-001",
    "batch_no": "TRYPSIN-2024-001",
    "discarded_by": "zhangsan",
    "reason": "发现污染"
  }' | python3 -m json.tool
echo ""

echo "=== 测试 12: 废弃拦截 - 尝试领用已废弃试剂 ==="
curl -s -X POST "$BASE_URL/reagents/use" \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "use-005",
    "batch_no": "TRYPSIN-2024-001",
    "used_by": "lisi",
    "project": "细胞培养A",
    "volume": "10ml"
  }' | python3 -m json.tool
echo ""

echo "=== 测试 13: 废弃拦截 - 尝试解冻已废弃试剂 ==="
curl -s -X POST "$BASE_URL/reagents/thaw" \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "thaw-003",
    "batch_no": "TRYPSIN-2024-001",
    "reagent_type": "胰酶",
    "thawed_by": "zhangsan",
    "project": "细胞培养A"
  }' | python3 -m json.tool
echo ""

echo "=== 测试 14: 导出 JSON 报告 ==="
curl -s "$BASE_URL/reports/export/json" > report.json
echo "报告已保存到 report.json"
echo ""

echo "=== 测试 15: 导出 CSV 报告 ==="
curl -s "$BASE_URL/reports/export/csv" > report.csv
echo "报告已保存到 report.csv"
echo ""

echo "=== 测试 16: 幂等性验证 - 同一领用请求重复调用 ==="
echo "第一次调用"
curl -s -X POST "$BASE_URL/reagents/use" \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "use-idempotent-001",
    "batch_no": "DMSO-2024-001",
    "used_by": "test",
    "project": "测试项目",
    "volume": "1ml"
  }' | python3 -m json.tool
echo ""

echo "第二次调用（相同 request_id，应返回重复请求或已有数据）"
curl -s -X POST "$BASE_URL/reagents/use" \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "use-idempotent-001",
    "batch_no": "DMSO-2024-001",
    "used_by": "test",
    "project": "测试项目",
    "volume": "1ml"
  }' | python3 -m json.tool
echo ""

echo "=== 所有测试完成 ==="
echo "请检查 report.json 和 report.csv 文件"
