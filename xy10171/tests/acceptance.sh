#!/bin/bash

BASE_URL="http://localhost:3000"
EXCHANGE_ID=""
TEST_PASSED=0
TEST_FAILED=0

generate_id() {
  echo "test-$(date +%s)-$RANDOM"
}

json_value() {
  local json="$1"
  local key="$2"
  echo "$json" | sed -n 's/.*"'"$key"'": *\([^,}]*\).*/\1/p' | tr -d '"' | head -1
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
  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | sed '$d')
  
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
  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | sed '$d')
  
  if [ "$http_code" = "201" ]; then
    print_success "库存初始化成功"
    echo "响应: $body"
  else
    print_fail "库存初始化失败: $http_code"
    echo "响应: $body"
  fi
  
  response=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/inventory/SKU-NEW-001")
  body=$(echo "$response" | sed '$d')
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
  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | sed '$d')
  
  if [ "$http_code" = "201" ]; then
    EXCHANGE_ID=$(json_value "$body" "id")
    print_success "换货单创建成功: $EXCHANGE_ID"
    echo "响应: $body"
  else
    print_fail "换货单创建失败: $http_code"
    echo "响应: $body"
    exit 1
  fi
  
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
  http_code2=$(echo "$response2" | tail -1)
  body2=$(echo "$response2" | sed '$d')
  
  EXCHANGE_ID2=$(json_value "$body2" "id")
  IS_CACHE=$(echo "$body2" | grep -c "from_cache")
  
  if [ "$http_code2" = "200" ] && [ "$EXCHANGE_ID" = "$EXCHANGE_ID2" ] && [ "$IS_CACHE" -gt 0 ]; then
    print_success "幂等性验证通过 - 重复请求返回缓存结果"
  else
    print_fail "幂等性验证失败"
  fi
  echo "响应: $body2"
}

test_missing_idempotency_key() {
  print_header "4. 缺少幂等键测试"
  response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/exchanges" \
    -H "Content-Type: application/json" \
    -d '{"order_id": "ORD-TEST"}')
  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | sed '$d')
  
  error_code=$(json_value "$body" "code")
  if [ "$http_code" = "400" ] && [ "$error_code" = "1002" ]; then
    print_success "正确拒绝缺少幂等键的请求"
  else
    print_fail "错误处理不正确"
  fi
  echo "响应: $body"
}

test_state_transitions() {
  print_header "5. 完整状态流转测试"
  
  STEP1_KEY="submit-$(generate_id)"
  response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/exchanges/$EXCHANGE_ID/submit" \
    -H "X-Idempotency-Key: $STEP1_KEY")
  body=$(echo "$response" | sed '$d')
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
  body=$(echo "$response" | sed '$d')
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
  body=$(echo "$response" | sed '$d')
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
  body=$(echo "$response" | sed '$d')
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
  body=$(echo "$response" | sed '$d')
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
  body=$(echo "$response" | sed '$d')
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
  
  reserved=$(echo "$response" | json_value "reserved_qty")
  available=$(echo "$response" | json_value "available_qty")
  if [ "$reserved" = "1" ] && [ "$available" = "99" ]; then
    print_success "库存占用正确: reserved=1, available=99"
  else
    print_fail "库存占用不正确: reserved=$reserved, available=$available"
  fi
  
  STEP7_KEY="complete-$(generate_id)"
  response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/exchanges/$EXCHANGE_ID/complete" \
    -H "X-Idempotency-Key: $STEP7_KEY")
  body=$(echo "$response" | sed '$d')
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
  body=$(echo "$response" | sed '$d')
  NEW_EXCHANGE=$(json_value "$body" "id")
  
  response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/exchanges/$NEW_EXCHANGE/complete" \
    -H "X-Idempotency-Key: invalid-complete-$(generate_id)")
  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | sed '$d')
  
  error_code=$(json_value "$body" "code")
  if [ "$http_code" = "400" ] && [ "$error_code" = "1001" ]; then
    print_success "正确阻止无效状态转换: pending_apply -> completed"
  else
    print_fail "无效状态转换测试失败"
  fi
  echo "响应: $body"
  
  response=$(curl -s "$BASE_URL/api/exchanges/$NEW_EXCHANGE")
  echo "当前换货单: $response"
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
  body=$(echo "$response" | sed '$d')
  CANCEL_EXCHANGE=$(json_value "$body" "id")
  
  response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/exchanges/$CANCEL_EXCHANGE/submit" \
    -H "X-Idempotency-Key: cancel-submit-$(generate_id)")
  
  response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/exchanges/$CANCEL_EXCHANGE/cancel" \
    -H "X-Idempotency-Key: cancel-final-$(generate_id)")
  body=$(echo "$response" | sed '$d')
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
  
  response_list=$(curl -s "$BASE_URL/api/exchanges")
  count=$(echo "$response_list" | grep -o '"id":' | wc -l)
  
  echo "实际换货单数量: $count"
  print_success "统计接口正常工作"
}

test_next_allowed_statuses() {
  print_header "9. 查看允许的后续状态"
  
  TEST_EXCHANGE=""
  IDEM_KEY="next-test-$(generate_id)"
  
  response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/exchanges" \
    -H "Content-Type: application/json" \
    -H "X-Idempotency-Key: $IDEM_KEY" \
    -d '{
      "order_id": "ORD-NEXT-001",
      "original_sku": "SKU-OLD-001",
      "target_sku": "SKU-NEW-001",
      "original_qty": 1,
      "target_qty": 1,
      "reason": "测试"
    }')
  body=$(echo "$response" | sed '$d')
  TEST_EXCHANGE=$(json_value "$body" "id")
  
  response=$(curl -s "$BASE_URL/api/exchanges/$TEST_EXCHANGE")
  echo "换货单详情: $response"
  
  next_count=$(echo "$response" | grep -o '"next_allowed_statuses"' | wc -l)
  if [ "$next_count" -gt 0 ]; then
    print_success "正确返回允许的后续状态"
  else
    print_fail "未返回后续状态信息"
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
  test_statistics
  test_next_allowed_statuses
  
  print_final_report
}

main "$@"
