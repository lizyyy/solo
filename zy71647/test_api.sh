#!/bin/bash

BASE_URL="http://localhost:8000"

echo "=============================================="
echo "矿池收益分配试算系统 - API测试脚本"
echo "=============================================="
echo ""

echo "=== 1. 检查系统状态 ==="
curl -s "$BASE_URL/" | python3 -m json.tool
echo ""

echo "=== 2. 获取演示数据（顺利流程） ==="
curl -s "$BASE_URL/demo/normal" | python3 -m json.tool > /tmp/normal_data.json
echo "演示数据已保存到 /tmp/normal_data.json"
echo ""

echo "=== 3. 执行收益分配（顺利流程） ==="
echo "这是3个矿工正常挖矿的场景，无异常"
curl -s -X POST "$BASE_URL/allocate" \
  -H "Content-Type: application/json" \
  -d "$(cat /tmp/normal_data.json | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin)['data']))")" \
  | python3 -m json.tool > /tmp/normal_report.json
echo "分配报告已保存到 /tmp/normal_report.json"
REPORT_ID=$(cat /tmp/normal_report.json | python3 -c "import sys,json; print(json.load(sys.stdin)['report_id'])")
echo "报告ID: $REPORT_ID"
echo ""

echo "=== 4. 查看分配报告摘要 ==="
python3 << 'EOF'
import json
with open('/tmp/normal_report.json') as f:
    r = json.load(f)
print(f"报告ID: {r['report_id']}")
print(f"矿工总数: {r['total_miners']}")
print(f"有效矿工: {r['valid_miners']}")
print(f"总算力: {r['total_hashrate']:.2f} MH/s")
print(f"总奖励: {r['total_reward']:.6f}")
print(f"总手续费: {r['total_fees']:.6f}")
print(f"矿池手续费: {r['pool_fee_amount']:.6f} ({r['pool_fee_ratio']*100:.1f}%)")
print(f"可分配金额: {r['allocatable_amount']:.6f}")
print("\n矿工分配明细:")
for a in r['allocations']:
    print(f"  {a['miner_id']}: {a['total_allocation']:.6f} (算力: {a['effective_hashrate']:.1f}, 在线率: {a['online_ratio']*100:.1f}%)")
if r['global_issues']:
    print(f"\n全局问题: {len(r['global_issues'])} 个")
    for issue in r['global_issues']:
        print(f"  - [{issue['severity']}] {issue['message']}")
else:
    print("\n全局问题: 无")
EOF
echo ""

echo "=== 5. 获取演示数据（边界情况） ==="
echo "包含低在线率、重复算力的场景"
curl -s "$BASE_URL/demo/boundary" | python3 -m json.tool > /tmp/boundary_data.json
curl -s -X POST "$BASE_URL/allocate" \
  -H "Content-Type: application/json" \
  -d "$(cat /tmp/boundary_data.json | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin)['data']))")" \
  | python3 -m json.tool > /tmp/boundary_report.json
BOUNDARY_REPORT_ID=$(cat /tmp/boundary_report.json | python3 -c "import sys,json; print(json.load(sys.stdin)['report_id'])")
echo "边界情况报告ID: $BOUNDARY_REPORT_ID"

python3 << 'EOF'
import json
with open('/tmp/boundary_report.json') as f:
    r = json.load(f)
print(f"\n边界情况分析:")
print(f"有效矿工: {r['valid_miners']}/{r['total_miners']}")
for a in r['allocations']:
    issue_count = len(a['issues'])
    status = "⚠️" if issue_count > 0 else "✓"
    print(f"  {status} {a['miner_id']}: 分配 {a['total_allocation']:.6f}, 问题数: {issue_count}")
    for issue in a['issues']:
        print(f"     - [{issue['severity']}] {issue['message']}")
print(f"\n全局问题: {len(r['global_issues'])} 个")
for issue in r['global_issues']:
    print(f"  - [{issue['severity']}] {issue['message']}")
EOF
echo ""

echo "=== 6. 获取演示数据（异常案例） ==="
echo "包含无效钱包、负手续费、未知矿工的现实场景"
curl -s "$BASE_URL/demo/exception" | python3 -m json.tool > /tmp/exception_data.json
curl -s -X POST "$BASE_URL/allocate" \
  -H "Content-Type: application/json" \
  -d "$(cat /tmp/exception_data.json | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin)['data']))")" \
  | python3 -m json.tool > /tmp/exception_report.json
EXCEPTION_REPORT_ID=$(cat /tmp/exception_report.json | python3 -c "import sys,json; print(json.load(sys.stdin)['report_id'])")
echo "异常案例报告ID: $EXCEPTION_REPORT_ID"

python3 << 'EOF'
import json
with open('/tmp/exception_report.json') as f:
    r = json.load(f)
print(f"\n异常案例分析:")
print(f"有效矿工: {r['valid_miners']}/{r['total_miners']}")
for a in r['allocations']:
    issue_count = len(a['issues'])
    status = "❌" if not a['wallet_valid'] else ("⚠️" if issue_count > 0 else "✓")
    wallet_status = "有效" if a['wallet_valid'] else "无效"
    print(f"  {status} {a['miner_id']}: 钱包{wallet_status}, 分配 {a['total_allocation']:.6f}")
    for issue in a['issues']:
        print(f"     - [{issue['severity']}] {issue['message']}")
print(f"\n全局问题: {len(r['global_issues'])} 个")
for issue in r['global_issues']:
    miner = f" (矿工: {issue['miner_id']})" if issue['miner_id'] else ""
    print(f"  - [{issue['severity']}] {issue['message']}{miner}")
EOF
echo ""

echo "=== 7. 导出CSV报告 ==="
curl -s "$BASE_URL/report/$REPORT_ID/csv" -o /tmp/report.csv
echo "CSV报告已保存到 /tmp/report.csv"
echo "前30行内容预览:"
head -30 /tmp/report.csv
echo ""

echo "=== 8. 钱包地址校验工具 ==="
echo "验证合法ETH地址:"
curl -s -X POST "$BASE_URL/validate-wallet?address=0x742d35Cc6634C0532925a3b844Bc9e7595f5bB12&wallet_type=ETH" | python3 -m json.tool
echo ""
echo "验证非法BTC地址:"
curl -s -X POST "$BASE_URL/validate-wallet?address=12345&wallet_type=BTC" | python3 -m json.tool
echo ""

echo "=== 9. 差额解释功能 ==="
echo "模拟用户预期0.5 ETH，但实际获得较少的情况"
ACTUAL_AMOUNT=$(cat /tmp/normal_report.json | python3 -c "import sys,json; r=json.load(sys.stdin); print([a['total_allocation'] for a in r['allocations'] if a['miner_id']=='miner_001'][0])")
echo "miner_001 实际获得: $ACTUAL_AMOUNT"

curl -s -X POST "$BASE_URL/explain-diff" \
  -H "Content-Type: application/json" \
  -d "{\"expected_amount\": 0.8, \"actual_amount\": $ACTUAL_AMOUNT, \"miner_id\": \"miner_001\", \"report_id\": \"$REPORT_ID\"}" \
  | python3 -m json.tool

echo ""
echo "=============================================="
echo "测试完成！报告ID汇总:"
echo "  顺利流程: $REPORT_ID"
echo "  边界情况: $BOUNDARY_REPORT_ID"
echo "  异常案例: $EXCEPTION_REPORT_ID"
echo ""
echo "查看报告: curl $BASE_URL/report/{报告ID}"
echo "导出CSV:  curl $BASE_URL/report/{报告ID}/csv"
echo "=============================================="
