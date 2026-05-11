#!/bin/bash

BASE_URL="http://localhost:3001/api"

echo "========= 采购合同履约 API 测试脚本 ========="
echo

echo "[场景 1] 设备采购 - 正常履约"
echo "========================================"
echo

echo "1. 创建设备采购合同"
DEVICE_CONTRACT=$(curl -s -X POST "$BASE_URL/contracts" \
  -H "Content-Type: application/json" \
  -d '{
    "contractNo": "EQ-2026-001",
    "supplier": "华信设备制造有限公司",
    "contractDate": "2026-05-01",
    "clauses": [
      {
        "name": "服务器采购",
        "product": "Dell R750 服务器",
        "quantity": 10,
        "unitPrice": 50000,
        "unit": "台",
        "deliveryDeadline": "2026-06-30"
      }
    ],
    "paymentTerms": [
      {"id": "PT-1", "name": "预付款", "percentage": 30},
      {"id": "PT-2", "name": "验收款", "percentage": 60},
      {"id": "PT-3", "name": "质保金", "percentage": 10}
    ]
  }')

DEVICE_CONTRACT_ID=$(echo "$DEVICE_CONTRACT" | jq -r '.data.id')
echo "合同ID: $DEVICE_CONTRACT_ID"
echo "合同详情:"
echo "$DEVICE_CONTRACT" | jq
echo

echo "2. 获取条款ID"
CLAUSE_ID=$(curl -s "$BASE_URL/contracts/$DEVICE_CONTRACT_ID" | jq -r '.data.contract.clauses[0].id')
echo "条款ID: $CLAUSE_ID"
echo

echo "3. 登记第一批交付 (5台)"
DELIVERY1=$(curl -s -X POST "$BASE_URL/contracts/$DEVICE_CONTRACT_ID/deliveries" \
  -H "Content-Type: application/json" \
  -d "{
    \"clauseId\": \"$CLAUSE_ID\",
    \"batchNo\": \"BATCH-001\",
    \"quantity\": 5,
    \"deliveredDate\": \"2026-05-10\",
    \"deliveryNote\": \"第一批5台服务器\"
  }")

DELIVERY1_ID=$(echo "$DELIVERY1" | jq -r '.data.id')
echo "交付批次ID: $DELIVERY1_ID"
echo "交付详情:"
echo "$DELIVERY1" | jq
echo

echo "4. 验收通过第一批 (5台全部通过)"
INSPECTION1=$(curl -s -X POST "$BASE_URL/contracts/$DEVICE_CONTRACT_ID/inspections" \
  -H "Content-Type: application/json" \
  -d "{
    \"deliveryId\": \"$DELIVERY1_ID\",
    \"status\": \"approved\",
    \"approvedQuantity\": 5,
    \"inspectedBy\": \"张工\",
    \"reason\": \"设备外观完好，配置符合要求\"
  }")
echo "验收结果:"
echo "$INSPECTION1" | jq
echo

echo "5. 登记第二批交付 (5台)"
DELIVERY2=$(curl -s -X POST "$BASE_URL/contracts/$DEVICE_CONTRACT_ID/deliveries" \
  -H "Content-Type: application/json" \
  -d "{
    \"clauseId\": \"$CLAUSE_ID\",
    \"batchNo\": \"BATCH-002\",
    \"quantity\": 5,
    \"deliveredDate\": \"2026-05-20\",
    \"deliveryNote\": \"第二批5台服务器\"
  }")

DELIVERY2_ID=$(echo "$DELIVERY2" | jq -r '.data.id')
echo "交付批次ID: $DELIVERY2_ID"
echo

echo "6. 验收通过第二批 (5台全部通过)"
INSPECTION2=$(curl -s -X POST "$BASE_URL/contracts/$DEVICE_CONTRACT_ID/inspections" \
  -H "Content-Type: application/json" \
  -d "{
    \"deliveryId\": \"$DELIVERY2_ID\",
    \"status\": \"approved\",
    \"approvedQuantity\": 5,
    \"inspectedBy\": \"张工\",
    \"reason\": \"验收合格\"
  }")
echo "验收结果:"
echo "$INSPECTION2" | jq
echo

echo "7. 查询合同状态（验收完成，无待验收批次）"
echo "=== 合同完成率、应付金额、待验收批次 ==="
curl -s "$BASE_URL/contracts/$DEVICE_CONTRACT_ID" | jq
echo

echo "8. 触发验收款付款节点"
PAYMENT1=$(curl -s -X POST "$BASE_URL/contracts/$DEVICE_CONTRACT_ID/payments" \
  -H "Content-Type: application/json" \
  -d "{
    \"paymentTermId\": \"PT-2\",
    \"triggerReason\": \"设备全部到货验收合格，触发60%验收款\",
    \"requestedBy\": \"李经理\"
  }")
echo "付款触发结果:"
echo "$PAYMENT1" | jq
echo

echo "9. 再次尝试触发同一付款节点（应该被拦截）"
echo "=== 测试付款节点重复触发拦截 ==="
DUPLICATE_PAYMENT=$(curl -s -X POST "$BASE_URL/contracts/$DEVICE_CONTRACT_ID/payments" \
  -H "Content-Type: application/json" \
  -d "{
    \"paymentTermId\": \"PT-2\",
    \"triggerReason\": \"重复触发测试\",
    \"requestedBy\": \"测试\"
  }")
echo "$DUPLICATE_PAYMENT" | jq
echo

echo "10. 查询合同详情（复核付款触发原因）"
echo "=== 付款节点详情复核 ==="
curl -s "$BASE_URL/contracts/$DEVICE_CONTRACT_ID" | jq '.data.payments'
echo

echo "[场景 2] 耗材采购 - 部分驳回和扣款"
echo "========================================"
echo

echo "1. 创建耗材采购合同"
CONSUMABLE_CONTRACT=$(curl -s -X POST "$BASE_URL/contracts" \
  -H "Content-Type: application/json" \
  -d '{
    "contractNo": "CS-2026-001",
    "supplier": "绿源耗材有限公司",
    "contractDate": "2026-05-05",
    "clauses": [
      {
        "name": "打印纸采购",
        "product": "A4 打印纸 70g",
        "quantity": 1000,
        "unitPrice": 20,
        "unit": "箱",
        "deliveryDeadline": "2026-05-15"
      }
    ],
    "paymentTerms": [
      {"id": "PT-1", "name": "验收款", "percentage": 100}
    ]
  }')

CONSUMABLE_CONTRACT_ID=$(echo "$CONSUMABLE_CONTRACT" | jq -r '.data.id')
echo "合同ID: $CONSUMABLE_CONTRACT_ID"
echo

echo "2. 获取条款ID"
CS_CLAUSE_ID=$(curl -s "$BASE_URL/contracts/$CONSUMABLE_CONTRACT_ID" | jq -r '.data.contract.clauses[0].id')
echo "条款ID: $CS_CLAUSE_ID"
echo

echo "3. 登记交付 (1000箱)"
DELIVERY=$(curl -s -X POST "$BASE_URL/contracts/$CONSUMABLE_CONTRACT_ID/deliveries" \
  -H "Content-Type: application/json" \
  -d "{
    \"clauseId\": \"$CS_CLAUSE_ID\",
    \"batchNo\": \"BATCH-CS-001\",
    \"quantity\": 1000,
    \"deliveredDate\": \"2026-05-10\",
    \"deliveryNote\": \"A4打印纸1000箱\"
  }")

DELIVERY_ID=$(echo "$DELIVERY" | jq -r '.data.id')
echo "交付批次ID: $DELIVERY_ID"
echo

echo "4. 部分驳回验收（950箱通过，50箱驳回，扣款5000元）"
PARTIAL_REJECT=$(curl -s -X POST "$BASE_URL/contracts/$CONSUMABLE_CONTRACT_ID/inspections" \
  -H "Content-Type: application/json" \
  -d "{
    \"deliveryId\": \"$DELIVERY_ID\",
    \"status\": \"rejected\",
    \"approvedQuantity\": 950,
    \"rejectedQuantity\": 50,
    \"inspectedBy\": \"王验收\",
    \"reason\": \"50箱外包装破损，纸张受潮\",
    \"deduction\": 5000
  }")
echo "部分驳回验收结果:"
echo "$PARTIAL_REJECT" | jq
echo

echo "5. 再次验收同一批次（应该被拦截，驳回批次重复计入）"
echo "=== 测试驳回批次重复计入拦截 ==="
DUPLICATE_INSPECTION=$(curl -s -X POST "$BASE_URL/contracts/$CONSUMABLE_CONTRACT_ID/inspections" \
  -H "Content-Type: application/json" \
  -d "{
    \"deliveryId\": \"$DELIVERY_ID\",
    \"status\": \"approved\",
    \"approvedQuantity\": 1000,
    \"inspectedBy\": \"测试\"
  }")
echo "$DUPLICATE_INSPECTION" | jq
echo

echo "6. 查询合同详情（查看完成率、扣款原因）"
echo "=== 合同完成率、应付金额、扣款原因 ==="
curl -s "$BASE_URL/contracts/$CONSUMABLE_CONTRACT_ID" | jq '.data.stats'
echo

echo "7. 触发付款"
CS_PAYMENT=$(curl -s -X POST "$BASE_URL/contracts/$CONSUMABLE_CONTRACT_ID/payments" \
  -H "Content-Type: application/json" \
  -d "{
    \"paymentTermId\": \"PT-1\",
    \"triggerReason\": \"耗材验收完成，扣减50箱破损款\",
    \"requestedBy\": \"刘经理\"
  }")
echo "付款触发结果:"
echo "$CS_PAYMENT" | jq
echo

echo "[场景 3] 延期扣款和付款暂缓"
echo "========================================"
echo

echo "1. 创建新合同测试延期扣款"
LATE_CONTRACT=$(curl -s -X POST "$BASE_URL/contracts" \
  -H "Content-Type: application/json" \
  -d '{
    "contractNo": "LT-2026-001",
    "supplier": "准时达科技有限公司",
    "contractDate": "2026-05-01",
    "clauses": [
      {
        "name": "办公电脑",
        "product": "ThinkPad X1 Carbon",
        "quantity": 20,
        "unitPrice": 10000,
        "unit": "台",
        "deliveryDeadline": "2026-05-10"
      }
    ],
    "paymentTerms": [
      {"id": "PT-1", "name": "验收款", "percentage": 100}
    ]
  }')

LATE_CONTRACT_ID=$(echo "$LATE_CONTRACT" | jq -r '.data.id')
echo "合同ID: $LATE_CONTRACT_ID"
echo

echo "2. 获取条款ID"
LT_CLAUSE_ID=$(curl -s "$BASE_URL/contracts/$LATE_CONTRACT_ID" | jq -r '.data.contract.clauses[0].id')
echo "条款ID: $LT_CLAUSE_ID"
echo

echo "3. 登记交付 (延期交付)"
LT_DELIVERY=$(curl -s -X POST "$BASE_URL/contracts/$LATE_CONTRACT_ID/deliveries" \
  -H "Content-Type: application/json" \
  -d "{
    \"clauseId\": \"$LT_CLAUSE_ID\",
    \"batchNo\": \"BATCH-LT-001\",
    \"quantity\": 20,
    \"deliveredDate\": \"2026-05-20\",
    \"deliveryNote\": \"电脑20台（延期10天）\"
  }")

LT_DELIVERY_ID=$(echo "$LT_DELIVERY" | jq -r '.data.id')
echo "交付批次ID: $LT_DELIVERY_ID"
echo

echo "4. 验收通过但因延期扣款"
LATE_INSPECTION=$(curl -s -X POST "$BASE_URL/contracts/$LATE_CONTRACT_ID/inspections" \
  -H "Content-Type: application/json" \
  -d "{
    \"deliveryId\": \"$LT_DELIVERY_ID\",
    \"status\": \"approved\",
    \"approvedQuantity\": 20,
    \"inspectedBy\": \"赵验收\",
    \"reason\": \"延期10天交付，按合同约定扣除违约金\",
    \"deduction\": 2000
  }")
echo "延期扣款验收结果:"
echo "$LATE_INSPECTION" | jq
echo

echo "5. 查询合同详情（查看延期扣款）"
echo "=== 扣款原因详情 ==="
curl -s "$BASE_URL/contracts/$LATE_CONTRACT_ID" | jq '.data.stats.deductionReasons'
echo

echo "6. 触发付款"
LT_PAYMENT=$(curl -s -X POST "$BASE_URL/contracts/$LATE_CONTRACT_ID/payments" \
  -H "Content-Type: application/json" \
  -d "{
    \"paymentTermId\": \"PT-1\",
    \"triggerReason\": \"电脑验收完成，扣除延期违约金\",
    \"requestedBy\": \"孙经理\"
  }")

LT_PAYMENT_ID=$(echo "$LT_PAYMENT" | jq -r '.data.id')
echo "付款ID: $LT_PAYMENT_ID"
echo "付款详情:"
echo "$LT_PAYMENT" | jq
echo

echo "7. 暂缓付款（财务审批中）"
echo "=== 付款暂缓操作 ==="
SUSPEND_RESULT=$(curl -s -X POST "$BASE_URL/contracts/$LATE_CONTRACT_ID/payments/$LT_PAYMENT_ID/suspend" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "财务发现发票信息有误，暂缓付款，待供应商补开发票",
    "suspendedBy": "财务-周会计"
  }')
echo "$SUSPEND_RESULT" | jq
echo

echo "[场景 4] 超量交付拦截测试"
echo "========================================"
echo

echo "1. 创建设备合同"
OVER_CONTRACT=$(curl -s -X POST "$BASE_URL/contracts" \
  -H "Content-Type: application/json" \
  -d '{
    "contractNo": "OV-2026-001",
    "supplier": "测试设备公司",
    "contractDate": "2026-05-01",
    "clauses": [
      {
        "name": "测试设备",
        "product": "测试仪",
        "quantity": 5,
        "unitPrice": 1000,
        "unit": "台"
      }
    ],
    "paymentTerms": [
      {"id": "PT-1", "name": "验收款", "percentage": 100}
    ]
  }')

OVER_CONTRACT_ID=$(echo "$OVER_CONTRACT" | jq -r '.data.id')
echo "合同ID: $OVER_CONTRACT_ID"
echo

echo "2. 获取条款ID"
OVER_CLAUSE_ID=$(curl -s "$BASE_URL/contracts/$OVER_CONTRACT_ID" | jq -r '.data.contract.clauses[0].id')
echo "条款ID: $OVER_CLAUSE_ID"
echo

echo "3. 登记交付3台（正常）"
curl -s -X POST "$BASE_URL/contracts/$OVER_CONTRACT_ID/deliveries" \
  -H "Content-Type: application/json" \
  -d "{
    \"clauseId\": \"$OVER_CLAUSE_ID\",
    \"batchNo\": \"BATCH-OV-001\",
    \"quantity\": 3
  }" | jq
echo

echo "4. 再登记交付3台（超过合同5台，应该被拦截）"
echo "=== 测试超量交付拦截 ==="
curl -s -X POST "$BASE_URL/contracts/$OVER_CONTRACT_ID/deliveries" \
  -H "Content-Type: application/json" \
  -d "{
    \"clauseId\": \"$OVER_CLAUSE_ID\",
    \"batchNo\": \"BATCH-OV-002\",
    \"quantity\": 3
  }" | jq
echo

echo "[场景 5] 未验收付款拦截测试"
echo "========================================"
echo

echo "1. 创建设备合同"
UNINSPECTED_CONTRACT=$(curl -s -X POST "$BASE_URL/contracts" \
  -H "Content-Type: application/json" \
  -d '{
    "contractNo": "UN-2026-001",
    "supplier": "测试公司",
    "contractDate": "2026-05-01",
    "clauses": [
      {
        "name": "测试产品",
        "product": "产品A",
        "quantity": 10,
        "unitPrice": 100,
        "unit": "个"
      }
    ],
    "paymentTerms": [
      {"id": "PT-1", "name": "验收款", "percentage": 100}
    ]
  }')

UNINSPECTED_CONTRACT_ID=$(echo "$UNINSPECTED_CONTRACT" | jq -r '.data.id')
echo "合同ID: $UNINSPECTED_CONTRACT_ID"
echo

echo "2. 获取条款ID"
UN_CLAUSE_ID=$(curl -s "$BASE_URL/contracts/$UNINSPECTED_CONTRACT_ID" | jq -r '.data.contract.clauses[0].id')
echo "条款ID: $UN_CLAUSE_ID"
echo

echo "3. 登记交付10个（不验收）"
curl -s -X POST "$BASE_URL/contracts/$UNINSPECTED_CONTRACT_ID/deliveries" \
  -H "Content-Type: application/json" \
  -d "{
    \"clauseId\": \"$UN_CLAUSE_ID\",
    \"batchNo\": \"BATCH-UN-001\",
    \"quantity\": 10
  }" | jq
echo

echo "4. 查询待验收批次"
echo "=== 待验收批次列表 ==="
curl -s "$BASE_URL/contracts/$UNINSPECTED_CONTRACT_ID" | jq '.data.stats.pendingInspections'
echo

echo "5. 尝试触发付款（存在待验收批次，应该被拦截）"
echo "=== 测试未验收付款拦截 ==="
curl -s -X POST "$BASE_URL/contracts/$UNINSPECTED_CONTRACT_ID/payments" \
  -H "Content-Type: application/json" \
  -d "{
    \"paymentTermId\": \"PT-1\",
    \"triggerReason\": \"测试未验收付款拦截\",
    \"requestedBy\": \"测试\"
  }" | jq
echo

echo "========= 合同列表查询 ========="
echo
curl -s "$BASE_URL/contracts" | jq
echo

echo "========= 测试完成 ========="
