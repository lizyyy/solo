#!/bin/bash

BASE_URL="http://localhost:3000"
EXCHANGE_ID=""
TEST_PASSED=0
TEST_FAILED=0

generate_id() {
  echo "test-$(date +%s)-$RANDOM"
}

extract_data_json() {
  local json="$1"
  echo "$json" | awk -F'"data":' '{if (NF>1) print substr($0, index($0,"\"data\":")+7)}' | sed 's/,[^,]*$//' | sed 's/}$//' | sed 's/^[[:space:]]*//'
}

json_value() {
  local json="$1"
  local key="$2"
  
  local result
  result=$(echo "$json" | grep -o "\"${key}\"[[:space:]]*:[[:space:]]*[^,}\"]*" | head -1)
  
  if [ -z "$result" ]; then
    result=$(echo "$json" | grep -o "\"${key}\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | head -1)
  fi
  
  echo "$result" | sed 's/.*:[[:space:]]*//' | tr -d '"' | tr -d ',' | tr -d '}' | sed 's/^[[:space:]]*//'
}

get_response_body() {
  local response="$1"
  echo "$response" | sed '$d'
}

get_response_code() {
  local response="$1"
  echo "$response" | tail -1
}

print_header() {
  echo ""
  echo "========================================"
  echo "  $1"
  echo "========================================"
}

print_success() {
  echo "✅ PASS: $1"
  ((TEST_PASSED++))
}

print_fail() {
  echo "❌ FAIL: $1"
  ((TEST_FAILED++))
}

wait_for_server() {
  echo "等待服务器启动..."
  for i in {1..30}; do
    if curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/health" | grep -q "200"; then
      echo "服务器已就绪！"
      return 0
    fi
    sleep 0.5
  done
  echo "服务器启动超时"
  exit 1
}

test_health_check() {
  print_header "1. 健康检查"
  response=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/health")
  http_code=$(get_response_code "$response")
  body=$(get_response_body "$response")
  
  if [ "$http_code" = "200" ]; then
    print_success "健康检查通过"
    echo "响应: $body"
  else
    print_fail "健康检查失败: $http_code"
  fi
}

test_setup_inventory() {
  print_header "2. 初始化库存"
  
  response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/inventory/seed" \
    -H "Content-Type: application/json" \
    -d '{"sku": "SKU-NEW-001", "total_qty": 100}')
  http_code=$(get_response_code "$response")
  body=$(get_response_body "$response")
  
  if [ "$http_code" = "201" ]; then
    print_success "库存初始化成功"
  else
    print_fail "库存初始化失败: $http_code"
  fi
  echo "响应: $body"
  
  response=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/inventory/SKU-NEW-001")
  body=$(get_response_body "$response")
  echo "库存详情: $body"
}

test_create_exchange() {
  print_header "3. 创建换货单（幂等测试）"
  IDEM_KEY="create-$(generate_id)"
  
  response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/exchanges" \
    -H "Content-Type: application/json" \
    -H "X-Idempotency-Key: $IDEM_KEY" \
    -d '{
      "order_id": "ORD-2024-001",
      "original_sku": "SKU-OLD-001",
      "target_sku": "SKU-NEW-001",
      "original_qty": 1,
      "target_qty": 1,
      "reason": "商品尺码不合适"
    }')
  http_code=$(get_response_code "$response")
  body=$(get_response_body "$response")
  
  if [ "$http_code" = "201" ]; then
    EXCHANGE_ID=$(json_value "$body" "id")
    print_success "换货单创建成功: $EXCHANGE_ID"
  else
    print_fail "换货单创建失败: $http_code"
    echo "响应: $body"
    exit 1
  fi
  echo "响应: $body"
  
  print_header "3.1 重复创建（幂等测试）"
  response2=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/exchanges" \
    -H "Content-Type: application/json" \
    -H "X-Idempotency-Key: $IDEM_KEY" \
    -d '{
      "order_id": "ORD-2024-001",
      "original_sku": "SKU-OLD-001",
      "target_sku": "SKU-NEW-001",
      "original_qty": 1,
      "target_qty": 1,
      "reason": "商品尺码不合适"
    }')
  http_code2=$(get_response_code "$response2")
  body2=$(get_response_body "$response2")
  
  EXCHANGE_ID2=$(json_value "$body2" "id")
  IS_CACHE=$(echo "$body2" | grep -c "from_cache")
  
  if [ "$http_code2" = "200" ] && [ "$EXCHANGE_ID" = "$EXCHANGE_ID2" ] && [ "$IS_CACHE" -gt 0 ]; then
    print_success "幂等性验证通过 - 重复请求返回缓存结果"
  else
    print_fail "幂等性验证失败"
    echo "  - http_code: $http_code2"
    echo "  - exchange_id1: $EXCHANGE_ID"
    echo "  - exchange_id2: $EXCHANGE_ID2"
    echo "  - from_cache count: $IS_CACHE"
  fi
  echo "响应: $body2"
}

test_missing_idempotency_key() {
  print_header "4. 缺少幂等键测试"
  response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/exchanges" \
    -H "Content-Type: application/json" \
    -d '{"order_id": "ORD-TEST"}')
  http_code=$(get_response_code "$response")
  body=$(get_response_body "$response")
  
  error_code=$(json_value "$body" "code")
  if [ "$http_code" = "400" ] && [ "$error_code" = "1002" ]; then
    print_success "正确拒绝缺少幂等键的请求"
  else
    print_fail "错误处理不正确"
    echo "  - http_code: $http_code"
    echo "  - error_code: $error_code"
  fi
  echo "响应: $body"
}

test_state_transitions() {
  print_header "5. 完整状态流转测试"
  
  STEP1_KEY="submit-$(generate_id)"
  response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/exchanges/$EXCHANGE_ID/submit" \
    -H "X-Idempotency-Key: $STEP1_KEY")
  body=$(get_response_body "$response")
  status=$(json_value "$body" "status")
  if [ "$status" = "applied" ]; then
    print_success "Step 1: 提交申请成功 -> applied"
  else
    print_fail "Step 1 失败: $status"
  fi
  echo "当前状态: $status"
  
  STEP2_KEY="ship-$(generate_id)"
  response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/exchanges/$EXCHANGE_ID/ship-back" \
    -H "X-Idempotency-Key: $STEP2_KEY")
  body=$(get_response_body "$response")
  status=$(json_value "$body" "status")
  if [ "$status" = "shipped_back" ]; then
    print_success "Step 2: 商品寄回成功 -> shipped_back"
  else
    print_fail "Step 2 失败: $status"
  fi
  echo "当前状态: $status"
  
  STEP3_KEY="qc-$(generate_id)"
  response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/exchanges/$EXCHANGE_ID/qc-pass" \
    -H "X-Idempotency-Key: $STEP3_KEY")
  body=$(get_response_body "$response")
  status=$(json_value "$body" "status")
  if [ "$status" = "qc_passed" ]; then
    print_success "Step 3: 质检通过 -> qc_passed"
  else
    print_fail "Step 3 失败: $status"
  fi
  echo "当前状态: $status"
  
  STEP4_KEY="price-$(generate_id)"
  response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/exchanges/$EXCHANGE_ID/calculate-price" \
    -H "Content-Type: application/json" \
    -H "X-Idempotency-Key: $STEP4_KEY" \
    -d '{"price_diff": 5000}')
  body=$(get_response_body "$response")
  status=$(json_value "$body" "status")
  if [ "$status" = "need_payment" ]; then
    print_success "Step 4: 计算差价(+50元) -> need_payment"
  else
    print_fail "Step 4 失败: $status"
  fi
  echo "当前状态: $status"
  
  STEP5_KEY="pay-$(generate_id)"
  response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/exchanges/$EXCHANGE_ID/pay" \
    -H "Content-Type: application/json" \
    -H "X-Idempotency-Key: $STEP5_KEY" \
    -d '{"paid_amount": 5000}')
  body=$(get_response_body "$response")
  status=$(json_value "$body" "status")
  if [ "$status" = "paid" ]; then
    print_success "Step 5: 支付差价 -> paid"
  else
    print_fail "Step 5 失败: $status"
  fi
  echo "当前状态: $status"
  
  STEP6_KEY="reship-$(generate_id)"
  response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/exchanges/$EXCHANGE_ID/reship" \
    -H "X-Idempotency-Key: $STEP6_KEY")
  body=$(get_response_body "$response")
  status=$(json_value "$body" "status")
  if [ "$status" = "reshipping" ]; then
    print_success "Step 6: 开始重发(库存已占用) -> reshipping"
  else
    print_fail "Step 6 失败: $status"
  fi
  echo "当前状态: $status"
  
  print_header "5.1 检查库存占用"
  response=$(curl -s "$BASE_URL/api/inventory/SKU-NEW-001")
  echo "库存详情: $response"
  
  reserved=$(json_value "$response" "reserved_qty")
  available=$(json_value "$response" "available_qty")
  total=$(json_value "$response" "total_qty")
  echo "解析结果: total=$total, available=$available, reserved=$reserved"
  
  if [ "$reserved" = "1" ] && [ "$available" = "99" ]; then
    print_success "库存占用正确: reserved=1, available=99"
  else
    print_fail "库存占用不正确: reserved=$reserved, available=$available"
  fi
  
  STEP7_KEY="complete-$(generate_id)"
  response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/exchanges/$EXCHANGE_ID/complete" \
    -H "X-Idempotency-Key: $STEP7_KEY")
  body=$(get_response_body "$response")
  status=$(json_value "$body" "status")
  if [ "$status" = "completed" ]; then
    print_success "Step 7: 换货完成 -> completed"
  else
    print_fail "Step 7 失败: $status"
  fi
  echo "当前状态: $status"
}

test_invalid_transition() {
  print_header "6. 无效状态转换测试"
  
  NEW_EXCHANGE=""
  IDEM_KEY="invalid-test-$(generate_id)"
  
  response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/exchanges" \
    -H "Content-Type: application/json" \
    -H "X-Idempotency-Key: $IDEM_KEY" \
    -d '{
      "order_id": "ORD-INVALID-001",
      "original_sku": "SKU-OLD-001",
      "target_sku": "SKU-NEW-001",
      "original_qty": 1,
      "target_qty": 1,
      "reason": "测试"
    }')
  body=$(get_response_body "$response")
  NEW_EXCHANGE=$(json_value "$body" "id")
  
  response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/exchanges/$NEW_EXCHANGE/complete" \
    -H "X-Idempotency-Key: invalid-complete-$(generate_id)")
  http_code=$(get_response_code "$response")
  body=$(get_response_body "$response")
  
  error_code=$(json_value "$body" "code")
  if [ "$http_code" = "400" ] && [ "$error_code" = "1001" ]; then
    print_success "正确阻止无效状态转换: pending_apply -> completed"
  else
    print_fail "无效状态转换测试失败"
    echo "  - http_code: $http_code"
    echo "  - error_code: $error_code"
  fi
  echo "响应: $body"
  
  exchange_response=$(curl -s "$BASE_URL/api/exchanges/$NEW_EXCHANGE")
  exchange_status=$(json_value "$exchange_response" "status")
  if [ "$exchange_status" = "pending_apply" ]; then
    print_success "无效转换后状态保持不变: pending_apply"
  else
    print_fail "无效转换后状态被修改: $exchange_status"
  fi
  echo "当前换货单: $exchange_response"
}

test_cancel_flow() {
  print_header "7. 取消流程测试"
  
  CANCEL_EXCHANGE=""
  IDEM_KEY="cancel-test-$(generate_id)"
  
  response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/exchanges" \
    -H "Content-Type: application/json" \
    -H "X-Idempotency-Key: $IDEM_KEY" \
    -d '{
      "order_id": "ORD-CANCEL-001",
      "original_sku": "SKU-OLD-001",
      "target_sku": "SKU-NEW-001",
      "original_qty": 1,
      "target_qty": 1,
      "reason": "测试取消"
    }')
  body=$(get_response_body "$response")
  CANCEL_EXCHANGE=$(json_value "$body" "id")
  
  response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/exchanges/$CANCEL_EXCHANGE/submit" \
    -H "X-Idempotency-Key: cancel-submit-$(generate_id)")
  
  response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/exchanges/$CANCEL_EXCHANGE/cancel" \
    -H "X-Idempotency-Key: cancel-final-$(generate_id)")
  body=$(get_response_body "$response")
  status=$(json_value "$body" "status")
  
  if [ "$status" = "cancelled" ]; then
    print_success "取消流程成功 -> cancelled"
  else
    print_fail "取消流程失败: $status"
  fi
  echo "响应: $body"
}

test_statistics() {
  print_header "8. 统计数据一致性检查"
  
  response=$(curl -s "$BASE_URL/api/exchanges/stats")
  echo "统计数据: $response"
  
  total_from_stats=$(json_value "$response" "total")
  echo "统计接口total: $total_from_stats"
  
  response_list=$(curl -s "$BASE_URL/api/exchanges")
  count=$(echo "$response_list" | grep -o '"id":' | wc -l)
  
  echo "实际换货单数量: $count"
  
  if [ -n "$total_from_stats" ] && [ "$total_from_stats" = "$count" ]; then
    print_success "统计数据一致: total=$count"
  else
    print_fail "统计数据不一致: stats_total=$total_from_stats, actual_count=$count"
  fi
}

test_zero_price_diff() {
  print_header "9. 零差价流程测试"
  
  ZERO_EXCHANGE=""
  IDEM_KEY="zero-test-$(generate_id)"
  
  response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/exchanges" \
    -H "Content-Type: application/json" \
    -H "X-Idempotency-Key: $IDEM_KEY" \
    -d '{
      "order_id": "ORD-ZERO-001",
      "original_sku": "SKU-OLD-002",
      "target_sku": "SKU-NEW-001",
      "original_qty": 1,
      "target_qty": 1,
      "reason": "零差价测试"
    }')
  body=$(get_response_body "$response")
  ZERO_EXCHANGE=$(json_value "$body" "id")
  echo "创建换货单: $ZERO_EXCHANGE"
  
  curl -s -o /dev/null -X POST "$BASE_URL/api/exchanges/$ZERO_EXCHANGE/submit" \
    -H "X-Idempotency-Key: zero-submit-$(generate_id)"
  
  curl -s -o /dev/null -X POST "$BASE_URL/api/exchanges/$ZERO_EXCHANGE/ship-back" \
    -H "X-Idempotency-Key: zero-ship-$(generate_id)"
  
  curl -s -o /dev/null -X POST "$BASE_URL/api/exchanges/$ZERO_EXCHANGE/qc-pass" \
    -H "X-Idempotency-Key: zero-qc-$(generate_id)"
  
  inv_before=$(curl -s "$BASE_URL/api/inventory/SKU-NEW-001")
  avail_before=$(json_value "$inv_before" "available_qty")
  echo "计算差价前可用库存: $avail_before"
  
  response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/exchanges/$ZERO_EXCHANGE/calculate-price" \
    -H "Content-Type: application/json" \
    -H "X-Idempotency-Key: zero-price-$(generate_id)" \
    -d '{"price_diff": 0}')
  body=$(get_response_body "$response")
  status=$(json_value "$body" "status")
  
  if [ "$status" = "reshipping" ]; then
    print_success "零差价直接进入 reshipping"
  else
    print_fail "零差价状态不正确: $status"
  fi
  
  inv_after=$(curl -s "$BASE_URL/api/inventory/SKU-NEW-001")
  avail_after=$(json_value "$inv_after" "available_qty")
  reserved_after=$(json_value "$inv_after" "reserved_qty")
  echo "计算差价后: available=$avail_after, reserved=$reserved_after"
  
  expected_avail=$((avail_before - 1))
  if [ "$avail_after" = "$expected_avail" ] && [ "$reserved_after" = "1" ]; then
    print_success "零差价也正确占用了库存"
  else
    print_fail "零差价库存占用不正确: available=$avail_after (expected $expected_avail), reserved=$reserved_after (expected 1)"
  fi
}

print_final_report() {
  print_header "测试完成"
  echo "✅ 通过: $TEST_PASSED"
  echo "❌ 失败: $TEST_FAILED"
  echo ""
  if [ $TEST_FAILED -eq 0 ]; then
    echo "🎉 所有测试通过！"
    exit 0
  else
    echo "⚠️  有 $TEST_FAILED 个测试失败"
    exit 1
  fi
}

main() {
  echo "售后换货状态机 API 验收测试"
  echo "================================"
  echo ""
  
  wait_for_server
  
  test_health_check
  test_setup_inventory
  test_create_exchange
  test_missing_idempotency_key
  test_state_transitions
  test_invalid_transition
  test_cancel_flow
  test_zero_price_diff
  test_statistics
  
  print_final_report
}

main "$@"
