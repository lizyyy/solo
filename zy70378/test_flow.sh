#!/bin/bash

BASE_URL="http://localhost:5001/api"
ACCOUNT_ID="acc_001"
BUSINESS_ORDER_1="order_20260513_001"
BUSINESS_ORDER_2="order_20260513_002"

echo "======================================"
echo "账户余额冻结 API 完整流程测试"
echo "======================================"
echo ""

echo "[1] 普通支付 - 账户充值 1000 元"
echo "--------------------------------------"
curl -s -X POST "${BASE_URL}/accounts/${ACCOUNT_ID}/deposit" \
  -H "Content-Type: application/json" \
  -d '{"amount": 1000}' | python3 -m json.tool
echo ""

echo "[2] 查询账户状态（充值后）"
echo "--------------------------------------"
curl -s -X GET "${BASE_URL}/accounts/${ACCOUNT_ID}" | python3 -m json.tool
echo ""

echo "[3] 争议冻结 - 冻结 500 元（业务单: ${BUSINESS_ORDER_1}）"
echo "--------------------------------------"
curl -s -X POST "${BASE_URL}/accounts/${ACCOUNT_ID}/freeze" \
  -H "Content-Type: application/json" \
  -d "{\"business_order_id\": \"${BUSINESS_ORDER_1}\", \"amount\": 500, \"reason\": \"用户投诉商品质量问题\"}" | python3 -m json.tool
echo ""

echo "[4] 查询账户状态（冻结后）"
echo "--------------------------------------"
curl -s -X GET "${BASE_URL}/accounts/${ACCOUNT_ID}" | python3 -m json.tool
echo ""

echo "[5] 部分解冻 - 解冻 200 元"
echo "--------------------------------------"
curl -s -X POST "${BASE_URL}/accounts/${ACCOUNT_ID}/unfreeze" \
  -H "Content-Type: application/json" \
  -d "{\"business_order_id\": \"${BUSINESS_ORDER_1}\", \"amount\": 200}" | python3 -m json.tool
echo ""

echo "[6] 查询账户状态（部分解冻后）"
echo "--------------------------------------"
curl -s -X GET "${BASE_URL}/accounts/${ACCOUNT_ID}" | python3 -m json.tool
echo ""

echo "[7] 重复请求 - 再次冻结同一业务单 ${BUSINESS_ORDER_1}"
echo "--------------------------------------"
curl -s -X POST "${BASE_URL}/accounts/${ACCOUNT_ID}/freeze" \
  -H "Content-Type: application/json" \
  -d "{\"business_order_id\": \"${BUSINESS_ORDER_1}\", \"amount\": 500, \"reason\": \"用户投诉商品质量问题\"}" | python3 -m json.tool
echo ""

echo "[8] 超额扣划测试 - 尝试扣划 400 元（当前冻结额应为 300）"
echo "--------------------------------------"
curl -s -X POST "${BASE_URL}/accounts/${ACCOUNT_ID}/deduct" \
  -H "Content-Type: application/json" \
  -d "{\"business_order_id\": \"${BUSINESS_ORDER_1}\", \"amount\": 400}" | python3 -m json.tool
echo ""

echo "[9] 正常扣划 - 扣划 300 元"
echo "--------------------------------------"
curl -s -X POST "${BASE_URL}/accounts/${ACCOUNT_ID}/deduct" \
  -H "Content-Type: application/json" \
  -d "{\"business_order_id\": \"${BUSINESS_ORDER_1}\", \"amount\": 300}" | python3 -m json.tool
echo ""

echo "[10] 查询账户状态（扣划后）"
echo "--------------------------------------"
curl -s -X GET "${BASE_URL}/accounts/${ACCOUNT_ID}" | python3 -m json.tool
echo ""

echo "[11] 争议关闭 - 关闭业务单 ${BUSINESS_ORDER_1}"
echo "--------------------------------------"
curl -s -X POST "${BASE_URL}/accounts/${ACCOUNT_ID}/disputes/${BUSINESS_ORDER_1}/close" | python3 -m json.tool
echo ""

echo "[12] 争议关闭后拦截测试 - 尝试操作已关闭的业务单"
echo "--------------------------------------"
curl -s -X POST "${BASE_URL}/accounts/${ACCOUNT_ID}/freeze" \
  -H "Content-Type: application/json" \
  -d "{\"business_order_id\": \"${BUSINESS_ORDER_1}\", \"amount\": 100}" | python3 -m json.tool
echo ""

echo "[13] 余额不足测试 - 尝试冻结 2000 元（当前可用余额 900）"
echo "--------------------------------------"
curl -s -X POST "${BASE_URL}/accounts/${ACCOUNT_ID}/freeze" \
  -H "Content-Type: application/json" \
  -d "{\"business_order_id\": \"${BUSINESS_ORDER_2}\", \"amount\": 2000}" | python3 -m json.tool
echo ""

echo "[14] 最终账户查询 - 完整流水和对账汇总"
echo "--------------------------------------"
curl -s -X GET "${BASE_URL}/accounts/${ACCOUNT_ID}" | python3 -m json.tool
echo ""

echo "======================================"
echo "测试完成！"
echo "======================================"
