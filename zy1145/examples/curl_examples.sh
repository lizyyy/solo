#!/bin/bash

# BTC 充值确认和归集风控后端服务 - Curl 示例脚本

BASE_URL="http://localhost:8080/api/v1"

echo "=========================================="
echo "BTC 充值确认和归集风控后端服务"
echo "=========================================="
echo ""

# 健康检查
echo "1. 健康检查"
echo "------------------------------------------"
curl -s "${BASE_URL}/health"
echo ""
echo ""

# 2. 创建充值地址
echo "2. 创建充值地址 (用户 user_001)"
echo "------------------------------------------"
CREATE_ADDR_RESP=$(curl -s -X POST "${BASE_URL}/addresses" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_001",
    "request_id": "req_001"
  }')
echo "$CREATE_ADDR_RESP"
NEW_ADDR=$(echo "$CREATE_ADDR_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('address','') if d.get('code')=='0000' else '')")
echo ""
echo ""

# 3. 查询所有地址
echo "3. 查询所有充值地址"
echo "------------------------------------------"
curl -s "${BASE_URL}/addresses"
echo ""
echo ""

# 4. 查询用户地址
echo "4. 查询用户 user_001 的地址"
echo "------------------------------------------"
curl -s "${BASE_URL}/addresses/user/user_001"
echo ""
echo ""

# 5. 导入 mempool 交易 (0 确认，正常交易)
echo "5. 导入 mempool 交易 (0 确认，正常交易)"
echo "------------------------------------------"
curl -s -X POST "${BASE_URL}/transactions/import-mempool" \
  -H "Content-Type: application/json" \
  -d '{
    "tx_id": "tx_demo_001",
    "inputs": [
      {
        "tx_id": "prev_tx_001",
        "output_index": 0
      }
    ],
    "outputs": [
      {
        "address": "bc1quser001address00000000000000000000000",
        "amount": 100000000,
        "index": 0
      }
    ],
    "is_rbf": false,
    "fee": 2000
  }'
echo ""
echo ""

# 6. 导入 mempool 交易 (RBF 风险)
echo "6. 导入 mempool 交易 (RBF 风险)"
echo "------------------------------------------"
curl -s -X POST "${BASE_URL}/transactions/import-mempool" \
  -H "Content-Type: application/json" \
  -d '{
    "tx_id": "tx_demo_rbf_001",
    "inputs": [
      {
        "tx_id": "prev_tx_002",
        "output_index": 0
      }
    ],
    "outputs": [
      {
        "address": "bc1quser002address00000000000000000000000",
        "amount": 50000000,
        "index": 0
      }
    ],
    "is_rbf": true,
    "fee": 3000
  }'
echo ""
echo ""

# 7. 导入区块 (确认交易)
echo "7. 导入区块 (高度 800004)"
echo "------------------------------------------"
curl -s -X POST "${BASE_URL}/transactions/import-block" \
  -H "Content-Type: application/json" \
  -d '{
    "height": 800004,
    "hash": "00000000000000000000000000000000000000000000000000000000000005",
    "prev_hash": "00000000000000000000000000000000000000000000000000000000000004",
    "timestamp": "2024-01-01T12:00:00Z",
    "transactions": [
      {
        "tx_id": "tx_demo_confirmed_001",
        "inputs": [
          {
            "tx_id": "prev_tx_003",
            "output_index": 0
          }
        ],
        "outputs": [
          {
            "address": "bc1quser003address00000000000000000000000",
            "amount": 250000000,
            "index": 0
          }
        ],
        "is_rbf": false,
        "fee": 1500
      }
    ]
  }'
echo ""
echo ""

# 8. 导入多个区块来增加确认数
echo "8. 导入多个区块来增加确认数"
echo "------------------------------------------"
for i in {800005..800010}
do
  PREV_HASH=$(printf "0000000000000000000000000000000000000000000000000000000000000$((i-1))")
  CURR_HASH=$(printf "0000000000000000000000000000000000000000000000000000000000000${i}")
  
  echo "导入区块 $i..."
  curl -s -X POST "${BASE_URL}/transactions/import-block" \
    -H "Content-Type: application/json" \
    -d "{
      \"height\": $i,
      \"hash\": \"$CURR_HASH\",
      \"prev_hash\": \"$PREV_HASH\",
      \"timestamp\": \"2024-01-01T12:00:00Z\",
      \"transactions\": []
    }" > /dev/null 2>&1
  echo "  完成"
done
echo ""
echo ""

# 9. 查询交易状态
echo "9. 查询交易 tx_demo_001 状态"
echo "------------------------------------------"
curl -s "${BASE_URL}/transactions/tx_demo_001/status"
echo ""
echo ""

# 10. 查询地址余额
echo "10. 查询地址余额"
echo "------------------------------------------"
curl -s "${BASE_URL}/utxo/balance/bc1quser001address00000000000000000000000"
echo ""
echo ""

# 11. 查询用户余额
echo "11. 查询用户 user_001 所有地址余额"
echo "------------------------------------------"
curl -s "${BASE_URL}/utxo/user/user_001/balances"
echo ""
echo ""

# 12. 查询地址 UTXO 明细
echo "12. 查询地址 UTXO 明细"
echo "------------------------------------------"
curl -s "${BASE_URL}/utxo/address/bc1quser001address00000000000000000000000"
echo ""
echo ""

# 13. 查询所有可花费 UTXO
echo "13. 查询所有可花费 UTXO"
echo "------------------------------------------"
curl -s "${BASE_URL}/utxo/spendable"
echo ""
echo ""

# 14. 估算手续费
echo "14. 估算手续费 (3 输入, 2 输出)"
echo "------------------------------------------"
curl -s "${BASE_URL}/risk/estimate-fee?input_count=3&output_count=2"
echo ""
echo ""

# 15. 创建归集计划
echo "15. 创建归集计划"
echo "------------------------------------------"
CREATE_PLAN_RESP=$(curl -s -X POST "${BASE_URL}/collection" \
  -H "Content-Type: application/json" \
  -d '{
    "target_amount": 100000000,
    "hot_wallet_address": "bc1qhotwalletaddress000000000000000000000000",
    "cold_wallet_address": "bc1qcoldwalletaddress00000000000000000000000",
    "user_id": "admin_001",
    "collect_all": false
  }')
echo "$CREATE_PLAN_RESP"
PLAN_ID=$(echo "$CREATE_PLAN_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('plan_id','') if d.get('code')=='0000' else '')")
echo ""
echo ""

# 16. 查询归集计划
echo "16. 查询归集计划"
echo "------------------------------------------"
if [ -n "$PLAN_ID" ]; then
  curl -s "${BASE_URL}/collection/$PLAN_ID"
else
  echo "跳过，需要先成功创建归集计划"
fi
echo ""
echo ""

# 17. 查询所有归集计划
echo "17. 查询所有归集计划"
echo "------------------------------------------"
curl -s "${BASE_URL}/collection"
echo ""
echo ""

# 18. 标记可疑交易
echo "18. 标记交易 tx_demo_rbf_001 为可疑"
echo "------------------------------------------"
curl -s -X POST "${BASE_URL}/transactions/tx_demo_rbf_001/suspicious" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "检测到 RBF 风险，需要进一步审核",
    "user_id": "risk_officer_001"
  }'
echo ""
echo ""

# 19. 查询可疑 UTXO
echo "19. 查询可疑 UTXO"
echo "------------------------------------------"
curl -s "${BASE_URL}/utxo/suspicious"
echo ""
echo ""

# 20. 生成审计报告
echo "20. 生成审计报告"
echo "------------------------------------------"
curl -s "${BASE_URL}/audit/report"
echo ""
echo ""

# 21. 导出审计报告 CSV
echo "21. 导出审计报告 CSV"
echo "------------------------------------------"
curl -s -o audit_report.csv "${BASE_URL}/audit/report/csv"
echo "报告已保存到 audit_report.csv"
echo ""
echo ""

# 22. 查询审计日志
echo "22. 查询审计日志"
echo "------------------------------------------"
curl -s "${BASE_URL}/audit/logs?limit=10"
echo ""
echo ""

# 23. 查询风险配置
echo "23. 查询风险配置"
echo "------------------------------------------"
curl -s "${BASE_URL}/risk/config"
echo ""
echo ""

# 24. UTXO 汇总
echo "24. UTXO 汇总"
echo "------------------------------------------"
curl -s "${BASE_URL}/utxo/summary"
echo ""
echo ""

echo "=========================================="
echo "示例脚本执行完成！"
echo "=========================================="
echo ""
echo "错误码说明："
echo "  0000 - 成功"
echo "  1001 - 请求参数无效"
echo "  1002 - 幂等请求冲突"
echo "  1003 - 资源不存在"
echo "  1004 - 资源冲突"
echo "  2001 - 0 确认入账已禁用"
echo "  2002 - 检测到 RBF 风险"
echo "  2003 - 检测到双花风险"
echo "  2004 - 确认数不足"
echo "  2005 - 链重组回滚"
echo "  2006 - Dust 输出被过滤"
echo "  2007 - 手续费不足"
echo "  2008 - 热钱包限额超限"
echo "  2009 - 冷钱包限额不足"
echo "  2013 - 需要人工审核"
echo "  3001 - 数据库错误"
echo "  3003 - 内部错误"
