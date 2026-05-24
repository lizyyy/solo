#!/bin/bash
CURL_OPTS="--noproxy 127.0.0.1 -s"
BASE="http://127.0.0.1:8080/api/v1"
TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo "=== 核心链路测试 ==="
echo ""

echo "1. 创建超限湿度采样"
curl $CURL_OPTS -X POST "$BASE/samples" -H "Content-Type: application/json" \
  -d "{\"request_id\":\"CORE-001\",\"area_code\":\"A-01\",\"humidity\":75.0,\"sampled_at\":\"$TS\",\"sampled_by\":\"张三\"}"
echo ""
echo ""

echo "2. 启动通风"
curl $CURL_OPTS -X POST "$BASE/ventilations/start" -H "Content-Type: application/json" \
  -d "{\"request_id\":\"VENT-001\",\"sample_id\":1,\"operator\":\"李四\",\"started_at\":\"$TS\",\"remark\":\"测试\"}"
echo ""
echo ""

echo "3. 完成通风"
END_TS=$(date -u -v+30M +"%Y-%m-%dT%H:%M:%SZ")
curl $CURL_OPTS -X POST "$BASE/ventilations/complete" -H "Content-Type: application/json" \
  -d "{\"ventilation_id\":1,\"ended_at\":\"$END_TS\",\"after_humidity\":58.0}"
echo ""
echo ""

echo "4. 复核通风"
curl $CURL_OPTS -X POST "$BASE/reviews" -H "Content-Type: application/json" \
  -d "{\"resource_type\":\"ventilation\",\"resource_id\":1,\"reviewed_by\":\"主管\"}"
echo ""
echo ""

echo "5. 复核采样"
curl $CURL_OPTS -X POST "$BASE/reviews" -H "Content-Type: application/json" \
  -d "{\"resource_type\":\"sample\",\"resource_id\":1,\"reviewed_by\":\"主管\"}"
echo ""
echo ""

echo "6. 批次转仓（部分转仓）"
curl $CURL_OPTS -X POST "$BASE/transfers" -H "Content-Type: application/json" \
  -d "{\"request_id\":\"TRANSFER-001\",\"batch_no\":\"FH202405001\",\"to_area_code\":\"A-02\",\"quantity\":200,\"operator\":\"王五\",\"transferred_at\":\"$TS\",\"remark\":\"测试转仓\"}"
echo ""
echo ""

echo "7. 复核转仓"
curl $CURL_OPTS -X POST "$BASE/reviews" -H "Content-Type: application/json" \
  -d "{\"resource_type\":\"transfer\",\"resource_id\":1,\"reviewed_by\":\"主管\"}"
echo ""
echo ""

echo "8. 批次追踪"
curl $CURL_OPTS "$BASE/batches/FH202405001/trace"
echo ""
echo ""

echo "=== 核心链路测试完成 ==="
