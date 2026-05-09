#!/bin/bash

BASE_URL="http://localhost:3000"
BARCODE="TEST-$(date +%Y%m%d%H%M%S)"
REQUEST_ID_PREFIX="REQ-$(date +%s)"

echo "========================================"
echo " 实验样本流转 API 验收测试脚本"
echo " 样本条码: $BARCODE"
echo "========================================"

echo -e "\n[1/12] 健康检查"
curl -s "$BASE_URL/health" | python3 -m json.tool

echo -e "\n[2/12] 创建样本"
curl -s -X POST "$BASE_URL/api/samples" \
  -H "Content-Type: application/json" \
  -d "{\"barcode\": \"$BARCODE\", \"handler\": \"张三\"}" | python3 -m json.tool

echo -e "\n[3/12] 重复创建同一条码（幂等测试）"
curl -s -X POST "$BASE_URL/api/samples" \
  -H "Content-Type: application/json" \
  -d "{\"barcode\": \"$BARCODE\", \"handler\": \"张三\"}" | python3 -m json.tool

echo -e "\n[4/12] 执行采集步骤"
curl -s -X POST "$BASE_URL/api/samples/collect" \
  -H "Content-Type: application/json" \
  -H "X-Request-ID: ${REQUEST_ID_PREFIX}-COLLECT" \
  -d "{\"barcode\": \"$BARCODE\", \"handler\": \"李四\", \"detail\": {\"location\": \"采集点A\"}}" | python3 -m json.tool

echo -e "\n[5/12] 重复采集（幂等测试）"
curl -s -X POST "$BASE_URL/api/samples/collect" \
  -H "Content-Type: application/json" \
  -H "X-Request-ID: ${REQUEST_ID_PREFIX}-COLLECT" \
  -d "{\"barcode\": \"$BARCODE\", \"handler\": \"李四\"}" | python3 -m json.tool

sleep 1

echo -e "\n[6/12] 执行离心步骤"
curl -s -X POST "$BASE_URL/api/samples/centrifuge" \
  -H "Content-Type: application/json" \
  -H "X-Request-ID: ${REQUEST_ID_PREFIX}-CENTRIFUGE" \
  -d "{\"barcode\": \"$BARCODE\", \"handler\": \"王五\", \"detail\": {\"speed\": 3000, \"duration\": 10}}" | python3 -m json.tool

sleep 1

echo -e "\n[7/12] 执行上机步骤"
curl -s -X POST "$BASE_URL/api/samples/test" \
  -H "Content-Type: application/json" \
  -H "X-Request-ID: ${REQUEST_ID_PREFIX}-TEST" \
  -d "{\"barcode\": \"$BARCODE\", \"handler\": \"赵六\", \"detail\": {\"machine\": \"MACHINE-01\"}}" | python3 -m json.tool

sleep 1

echo -e "\n[8/12] 执行复核步骤"
curl -s -X POST "$BASE_URL/api/samples/review" \
  -H "Content-Type: application/json" \
  -H "X-Request-ID: ${REQUEST_ID_PREFIX}-REVIEW" \
  -d "{\"barcode\": \"$BARCODE\", \"handler\": \"钱七\", \"detail\": {\"result\": \"正常\"}}" | python3 -m json.tool

echo -e "\n[9/12] 查询样本详情"
curl -s "$BASE_URL/api/samples/$BARCODE" | python3 -m json.tool

echo -e "\n[10/12] 查询审计日志"
curl -s "$BASE_URL/api/audits?barcode=$BARCODE" | python3 -m json.tool

echo -e "\n[11/12] 查询统计数据"
curl -s "$BASE_URL/api/statistics" | python3 -m json.tool

# 测试异常流程
BARCODE_EXCEPTION="EXCEPT-$(date +%Y%m%d%H%M%S)"
echo -e "\n========================================"
echo " 异常流程测试"
echo " 异常样本条码: $BARCODE_EXCEPTION"
echo "========================================"

echo -e "\n[12/12] 创建异常样本"
curl -s -X POST "$BASE_URL/api/samples" \
  -H "Content-Type: application/json" \
  -d "{\"barcode\": \"$BARCODE_EXCEPTION\", \"handler\": \"测试员\"}" | python3 -m json.tool

echo -e "\n[13/12] 执行采集"
curl -s -X POST "$BASE_URL/api/samples/collect" \
  -H "Content-Type: application/json" \
  -H "X-Request-ID: EXCEPT-REQ-COLLECT" \
  -d "{\"barcode\": \"$BARCODE_EXCEPTION\", \"handler\": \"测试员\"}" | python3 -m json.tool

echo -e "\n[14/12] 上报异常"
curl -s -X POST "$BASE_URL/api/samples/exception" \
  -H "Content-Type: application/json" \
  -d "{\"barcode\": \"$BARCODE_EXCEPTION\", \"reason\": \"样本溶血，需要重新采集\", \"handler\": \"质控员\"}" | python3 -m json.tool

echo -e "\n[15/12] 异常状态下执行离心（应该失败）"
curl -s -X POST "$BASE_URL/api/samples/centrifuge" \
  -H "Content-Type: application/json" \
  -H "X-Request-ID: EXCEPT-REQ-CENTRIFUGE" \
  -d "{\"barcode\": \"$BARCODE_EXCEPTION\", \"handler\": \"测试员\"}" | python3 -m json.tool

echo -e "\n[16/12] 解决异常，返回采集状态"
curl -s -X POST "$BASE_URL/api/samples/exception/resolve" \
  -H "Content-Type: application/json" \
  -d "{\"barcode\": \"$BARCODE_EXCEPTION\", \"targetStep\": \"CENTRIFUGE\", \"handler\": \"质控员\", \"detail\": {\"remark\": \"已重新采集\"}}" | python3 -m json.tool

echo -e "\n[17/12] 重新执行离心"
curl -s -X POST "$BASE_URL/api/samples/centrifuge" \
  -H "Content-Type: application/json" \
  -H "X-Request-ID: EXCEPT-REQ-CENTRIFUGE-2" \
  -d "{\"barcode\": \"$BARCODE_EXCEPTION\", \"handler\": \"测试员\"}" | python3 -m json.tool

echo -e "\n[18/12] 最终样本详情"
curl -s "$BASE_URL/api/samples/$BARCODE_EXCEPTION" | python3 -m json.tool

echo -e "\n========================================"
echo " 测试完成！"
echo "========================================"
echo "API 文档: $BASE_URL/api-docs"
