#!/bin/bash

BASE_URL="http://localhost:3000/api"

echo "=========================================="
echo "保险理赔材料 API - 样例 curl 命令"
echo "=========================================="
echo ""

# ==========================================
# 1. 配置险种材料要求
# ==========================================
echo "=== 1. 配置险种和材料要求 ==="
echo ""

echo "# 创建医疗险"
MEDICAL_INSURANCE_ID=$(curl -s -X POST "$BASE_URL/insurance-types" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "个人住院医疗保险",
    "code": "MEDICAL",
    "description": "因疾病或意外住院产生的医疗费用保险",
    "max_payout": 500000
  }' | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")
echo "医疗险 ID: $MEDICAL_INSURANCE_ID"
echo ""

echo "# 配置医疗险材料要求"
curl -s -X POST "$BASE_URL/insurance-types/$MEDICAL_INSURANCE_ID/material-requirements" \
  -H "Content-Type: application/json" \
  -d '{
    "material_code": "IDENTITY_CARD",
    "material_name": "身份证",
    "is_required": 1,
    "validity_days": null,
    "description": "被保险人身份证正反面"
  }'
echo ""

curl -s -X POST "$BASE_URL/insurance-types/$MEDICAL_INSURANCE_ID/material-requirements" \
  -H "Content-Type: application/json" \
  -d '{
    "material_code": "POLICY",
    "material_name": "保险单",
    "is_required": 1,
    "validity_days": null,
    "description": "有效保险合同"
  }'
echo ""

curl -s -X POST "$BASE_URL/insurance-types/$MEDICAL_INSURANCE_ID/material-requirements" \
  -H "Content-Type: application/json" \
  -d '{
    "material_code": "MEDICAL_RECORD",
    "material_name": "住院病历",
    "is_required": 1,
    "validity_days": 180,
    "description": "住院完整病历（6个月内有效）"
  }'
echo ""

curl -s -X POST "$BASE_URL/insurance-types/$MEDICAL_INSURANCE_ID/material-requirements" \
  -H "Content-Type: application/json" \
  -d '{
    "material_code": "INVOICE",
    "material_name": "医疗费用发票",
    "is_required": 1,
    "validity_days": 365,
    "description": "住院费用原始发票（1年内有效）"
  }'
echo ""

curl -s -X POST "$BASE_URL/insurance-types/$MEDICAL_INSURANCE_ID/material-requirements" \
  -H "Content-Type: application/json" \
  -d '{
    "material_code": "COST_DETAIL",
    "material_name": "费用明细清单",
    "is_required": 1,
    "validity_days": 365,
    "description": "住院费用明细汇总"
  }'
echo ""

echo "# 创建意外险"
ACCIDENT_INSURANCE_ID=$(curl -s -X POST "$BASE_URL/insurance-types" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "个人意外伤害保险",
    "code": "ACCIDENT",
    "description": "因意外事故导致的身故、伤残或医疗费用保险",
    "max_payout": 100000
  }' | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")
echo "意外险 ID: $ACCIDENT_INSURANCE_ID"
echo ""

echo "# 配置意外险材料要求"
curl -s -X POST "$BASE_URL/insurance-types/$ACCIDENT_INSURANCE_ID/material-requirements" \
  -H "Content-Type: application/json" \
  -d '{
    "material_code": "IDENTITY_CARD",
    "material_name": "身份证",
    "is_required": 1,
    "validity_days": null,
    "description": "被保险人身份证正反面"
  }'
echo ""

curl -s -X POST "$BASE_URL/insurance-types/$ACCIDENT_INSURANCE_ID/material-requirements" \
  -H "Content-Type: application/json" \
  -d '{
    "material_code": "POLICY",
    "material_name": "保险单",
    "is_required": 1,
    "validity_days": null,
    "description": "有效保险合同"
  }'
echo ""

curl -s -X POST "$BASE_URL/insurance-types/$ACCIDENT_INSURANCE_ID/material-requirements" \
  -H "Content-Type: application/json" \
  -d '{
    "material_code": "ACCIDENT_PROOF",
    "material_name": "意外事故证明",
    "is_required": 1,
    "validity_days": 90,
    "description": "警方或相关部门出具的事故证明（3个月内有效）"
  }'
echo ""

curl -s -X POST "$BASE_URL/insurance-types/$ACCIDENT_INSURANCE_ID/material-requirements" \
  -H "Content-Type: application/json" \
  -d '{
    "material_code": "MEDICAL_RECORD",
    "material_name": "诊疗记录",
    "is_required": 1,
    "validity_days": 180,
    "description": "门诊或住院病历（6个月内有效）"
  }'
echo ""

# ==========================================
# 2. 创建医疗险理赔申请 - 正常流程
# ==========================================
echo ""
echo "=== 2. 医疗险理赔申请（正常流程） ==="
echo ""

echo "# 创建医疗险申请"
MEDICAL_CLAIM_ID=$(curl -s -X POST "$BASE_URL/claims" \
  -H "Content-Type: application/json" \
  -d "{
    \"insurance_type_id\": \"$MEDICAL_INSURANCE_ID\",
    \"policy_no\": \"POL-MED-2024-001\",
    \"claimant_name\": \"张三\",
    \"claimant_id_card\": \"110101199001011234\",
    \"incident_date\": \"2024-01-15\",
    \"claimed_amount\": 85000,
    \"notes\": \"急性阑尾炎住院治疗\"
  }" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")
echo "医疗险申请 ID: $MEDICAL_CLAIM_ID"
echo ""

echo "# 上传所有必需材料"
curl -s -X POST "$BASE_URL/claims/$MEDICAL_CLAIM_ID/materials" \
  -H "Content-Type: application/json" \
  -d '{
    "material_code": "IDENTITY_CARD",
    "file_path": "/uploads/identity_card.pdf",
    "notes": "身份证正反面扫描件"
  }'
echo ""

curl -s -X POST "$BASE_URL/claims/$MEDICAL_CLAIM_ID/materials" \
  -H "Content-Type: application/json" \
  -d '{
    "material_code": "POLICY",
    "file_path": "/uploads/policy.pdf",
    "notes": "保险合同扫描件"
  }'
echo ""

curl -s -X POST "$BASE_URL/claims/$MEDICAL_CLAIM_ID/materials" \
  -H "Content-Type: application/json" \
  -d '{
    "material_code": "MEDICAL_RECORD",
    "file_path": "/uploads/medical_record.pdf",
    "expiry_date": "2024-12-31",
    "notes": "2024年1月住院病历"
  }'
echo ""

curl -s -X POST "$BASE_URL/claims/$MEDICAL_CLAIM_ID/materials" \
  -H "Content-Type: application/json" \
  -d '{
    "material_code": "INVOICE",
    "file_path": "/uploads/invoice.pdf",
    "expiry_date": "2025-01-15",
    "notes": "住院费用发票，金额85000元"
  }'
echo ""

curl -s -X POST "$BASE_URL/claims/$MEDICAL_CLAIM_ID/materials" \
  -H "Content-Type: application/json" \
  -d '{
    "material_code": "COST_DETAIL",
    "file_path": "/uploads/cost_detail.xlsx",
    "expiry_date": "2025-01-15",
    "notes": "费用明细清单"
  }'
echo ""

echo "# 提交申请"
curl -s -X POST "$BASE_URL/claims/$MEDICAL_CLAIM_ID/submit" \
  -H "Content-Type: application/json" \
  -d '{}' | python3 -m json.tool
echo ""

echo "# 开始审核"
curl -s -X POST "$BASE_URL/claims/$MEDICAL_CLAIM_ID/start-review" \
  -H "Content-Type: application/json" \
  -d '{"reviewer": "理赔专员-王芳"}' | python3 -m json.tool
echo ""

echo "# 试算赔付金额"
curl -s -X POST "$BASE_URL/claims/$MEDICAL_CLAIM_ID/calculate-payout" \
  -H "Content-Type: application/json" \
  -d '{}' | python3 -m json.tool
echo ""

echo "# 审核通过"
curl -s -X POST "$BASE_URL/claims/$MEDICAL_CLAIM_ID/approve" \
  -H "Content-Type: application/json" \
  -d '{"reviewer": "理赔主管-李明"}' | python3 -m json.tool
echo ""

echo "# 结案"
curl -s -X POST "$BASE_URL/claims/$MEDICAL_CLAIM_ID/close" \
  -H "Content-Type: application/json" \
  -d '{"reviewer": "理赔主管-李明"}' | python3 -m json.tool
echo ""

# ==========================================
# 3. 意外险理赔申请 - 缺材料补件流程
# ==========================================
echo ""
echo "=== 3. 意外险理赔申请（缺材料补件流程） ==="
echo ""

echo "# 创建意外险申请"
ACCIDENT_CLAIM_ID=$(curl -s -X POST "$BASE_URL/claims" \
  -H "Content-Type: application/json" \
  -d "{
    \"insurance_type_id\": \"$ACCIDENT_INSURANCE_ID\",
    \"policy_no\": \"POL-ACC-2024-002\",
    \"claimant_name\": \"李四\",
    \"claimant_id_card\": \"310101198505055678\",
    \"incident_date\": \"2024-02-20\",
    \"claimed_amount\": 25000,
    \"notes\": \"上班途中意外摔倒导致骨折\"
  }" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")
echo "意外险申请 ID: $ACCIDENT_CLAIM_ID"
echo ""

echo "# 只上传部分材料（缺少事故证明）"
curl -s -X POST "$BASE_URL/claims/$ACCIDENT_CLAIM_ID/materials" \
  -H "Content-Type: application/json" \
  -d '{
    "material_code": "IDENTITY_CARD",
    "file_path": "/uploads/accident/identity.pdf",
    "notes": "身份证"
  }'
echo ""

curl -s -X POST "$BASE_URL/claims/$ACCIDENT_CLAIM_ID/materials" \
  -H "Content-Type: application/json" \
  -d '{
    "material_code": "POLICY",
    "file_path": "/uploads/accident/policy.pdf",
    "notes": "保险单"
  }'
echo ""

curl -s -X POST "$BASE_URL/claims/$ACCIDENT_CLAIM_ID/materials" \
  -H "Content-Type: application/json" \
  -d '{
    "material_code": "MEDICAL_RECORD",
    "file_path": "/uploads/accident/record.pdf",
    "expiry_date": "2024-12-31",
    "notes": "骨折诊疗记录"
  }'
echo ""

echo "# 提交申请（会显示材料缺口）"
curl -s -X POST "$BASE_URL/claims/$ACCIDENT_CLAIM_ID/submit" \
  -H "Content-Type: application/json" \
  -d '{}' | python3 -m json.tool
echo ""

echo "# 开始审核（应该失败，因为缺少材料）"
curl -s -X POST "$BASE_URL/claims/$ACCIDENT_CLAIM_ID/start-review" \
  -H "Content-Type: application/json" \
  -d '{"reviewer": "理赔专员-王芳"}' | python3 -m json.tool
echo ""

echo "# 标记需要补件 - 事故证明"
curl -s -X POST "$BASE_URL/claims/$ACCIDENT_CLAIM_ID/request-supplement" \
  -H "Content-Type: application/json" \
  -d '{
    "material_codes": ["ACCIDENT_PROOF"],
    "reason": "请提供交警部门出具的交通事故责任认定书",
    "reviewer": "理赔专员-王芳"
  }' | python3 -m json.tool
echo ""

echo "# 客户补传事故证明"
curl -s -X POST "$BASE_URL/claims/$ACCIDENT_CLAIM_ID/materials" \
  -H "Content-Type: application/json" \
  -d '{
    "material_code": "ACCIDENT_PROOF",
    "file_path": "/uploads/accident/accident_proof.pdf",
    "expiry_date": "2024-12-31",
    "notes": "交警出具的事故责任认定书"
  }'
echo ""

echo "# 再次开始审核"
curl -s -X POST "$BASE_URL/claims/$ACCIDENT_CLAIM_ID/start-review" \
  -H "Content-Type: application/json" \
  -d '{"reviewer": "理赔专员-王芳"}' | python3 -m json.tool
echo ""

echo "# 审核通过并结案"
curl -s -X POST "$BASE_URL/claims/$ACCIDENT_CLAIM_ID/approve" \
  -H "Content-Type: application/json" \
  -d '{"reviewer": "理赔主管-李明"}' | python3 -m json.tool
echo ""

curl -s -X POST "$BASE_URL/claims/$ACCIDENT_CLAIM_ID/close" \
  -H "Content-Type: application/json" \
  -d '{"reviewer": "理赔主管-李明"}' | python3 -m json.tool
echo ""

# ==========================================
# 4. 医疗险理赔申请 - 赔付超限
# ==========================================
echo ""
echo "=== 4. 医疗险理赔申请（赔付超限） ==="
echo ""

echo "# 创建高金额医疗险申请"
HIGH_CLAIM_ID=$(curl -s -X POST "$BASE_URL/claims" \
  -H "Content-Type: application/json" \
  -d "{
    \"insurance_type_id\": \"$MEDICAL_INSURANCE_ID\",
    \"policy_no\": \"POL-MED-2024-003\",
    \"claimant_name\": \"王五\",
    \"claimant_id_card\": \"440101197808089012\",
    \"incident_date\": \"2024-03-10\",
    \"claimed_amount\": 600000,
    \"notes\": \"重大手术住院治疗（实际花费65万）\"
  }" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")
echo "高金额申请 ID: $HIGH_CLAIM_ID"
echo ""

echo "# 上传所有材料"
for code in IDENTITY_CARD POLICY MEDICAL_RECORD INVOICE COST_DETAIL; do
  curl -s -X POST "$BASE_URL/claims/$HIGH_CLAIM_ID/materials" \
    -H "Content-Type: application/json" \
    -d "{
      \"material_code\": \"$code\",
      \"file_path\": \"/uploads/high/$code.pdf\",
      \"expiry_date\": \"2024-12-31\"
    }"
  echo ""
done

echo "# 试算赔付金额（会显示超过限额）"
curl -s -X POST "$BASE_URL/claims/$HIGH_CLAIM_ID/calculate-payout" \
  -H "Content-Type: application/json" \
  -d '{}' | python3 -m json.tool
echo ""

echo "# 提交并审核通过"
curl -s -X POST "$BASE_URL/claims/$HIGH_CLAIM_ID/submit" \
  -H "Content-Type: application/json" \
  -d '{}' > /dev/null

curl -s -X POST "$BASE_URL/claims/$HIGH_CLAIM_ID/start-review" \
  -H "Content-Type: application/json" \
  -d '{"reviewer": "理赔专员-王芳"}' > /dev/null

echo "# 审核通过（实际赔付按最高限额50万）"
curl -s -X POST "$BASE_URL/claims/$HIGH_CLAIM_ID/approve" \
  -H "Content-Type: application/json" \
  -d '{
    "reviewer": "理赔主管-李明",
    "approved_amount": 600000
  }' | python3 -m json.tool
echo ""

# ==========================================
# 5. 业务规则校验测试
# ==========================================
echo ""
echo "=== 5. 业务规则校验测试 ==="
echo ""

echo "# 测试：已结案的申请不能再补件"
curl -s -X POST "$BASE_URL/claims/$MEDICAL_CLAIM_ID/materials" \
  -H "Content-Type: application/json" \
  -d '{
    "material_code": "OTHER",
    "file_path": "/uploads/extra.pdf"
  }' | python3 -m json.tool
echo ""

echo "# 测试：审核中不能修改核心信息"
REVIEW_CLAIM_ID=$(curl -s -X POST "$BASE_URL/claims" \
  -H "Content-Type: application/json" \
  -d "{
    \"insurance_type_id\": \"$MEDICAL_INSURANCE_ID\",
    \"policy_no\": \"POL-MED-TEST-001\",
    \"claimant_name\": \"测试用户\",
    \"claimant_id_card\": \"123456199001011234\",
    \"incident_date\": \"2024-01-01\",
    \"claimed_amount\": 10000
  }" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")

for code in IDENTITY_CARD POLICY MEDICAL_RECORD INVOICE COST_DETAIL; do
  curl -s -X POST "$BASE_URL/claims/$REVIEW_CLAIM_ID/materials" \
    -H "Content-Type: application/json" \
    -d "{
      \"material_code\": \"$code\",
      \"file_path\": \"/uploads/test/$code.pdf\",
      \"expiry_date\": \"2024-12-31\"
    }"
done

curl -s -X POST "$BASE_URL/claims/$REVIEW_CLAIM_ID/submit" -H "Content-Type: application/json" -d '{}' > /dev/null
curl -s -X POST "$BASE_URL/claims/$REVIEW_CLAIM_ID/start-review" \
  -H "Content-Type: application/json" \
  -d '{"reviewer": "测试专员"}' > /dev/null

echo "尝试修改审核中的申请核心信息..."
curl -s -X PUT "$BASE_URL/claims/$REVIEW_CLAIM_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "claimed_amount": 50000
  }' | python3 -m json.tool
echo ""

echo "# 测试：同一材料不能重复提交"
NEW_CLAIM_ID=$(curl -s -X POST "$BASE_URL/claims" \
  -H "Content-Type: application/json" \
  -d "{
    \"insurance_type_id\": \"$MEDICAL_INSURANCE_ID\",
    \"policy_no\": \"POL-MED-TEST-002\",
    \"claimant_name\": \"测试用户2\",
    \"claimant_id_card\": \"123456199001011235\",
    \"incident_date\": \"2024-01-01\",
    \"claimed_amount\": 10000
  }" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")

curl -s -X POST "$BASE_URL/claims/$NEW_CLAIM_ID/materials" \
  -H "Content-Type: application/json" \
  -d '{
    "material_code": "IDENTITY_CARD",
    "file_path": "/uploads/duplicate/id.pdf"
  }' > /dev/null

echo "尝试重复提交同一材料..."
curl -s -X POST "$BASE_URL/claims/$NEW_CLAIM_ID/materials" \
  -H "Content-Type: application/json" \
  -d '{
    "material_code": "IDENTITY_CARD",
    "file_path": "/uploads/duplicate/id2.pdf"
  }' | python3 -m json.tool
echo ""

echo "# 测试：材料过期检查"
EXPIRED_CLAIM_ID=$(curl -s -X POST "$BASE_URL/claims" \
  -H "Content-Type: application/json" \
  -d "{
    \"insurance_type_id\": \"$MEDICAL_INSURANCE_ID\",
    \"policy_no\": \"POL-MED-TEST-003\",
    \"claimant_name\": \"测试用户3\",
    \"claimant_id_card\": \"123456199001011236\",
    \"incident_date\": \"2024-01-01\",
    \"claimed_amount\": 10000
  }" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")

echo "尝试提交过期材料..."
curl -s -X POST "$BASE_URL/claims/$EXPIRED_CLAIM_ID/materials" \
  -H "Content-Type: application/json" \
  -d '{
    "material_code": "MEDICAL_RECORD",
    "file_path": "/uploads/expired/record.pdf",
    "expiry_date": "2020-01-01",
    "notes": "已过期的病历"
  }' | python3 -m json.tool
echo ""

echo "# 测试：险种不匹配"
echo "尝试为医疗险申请提交意外险专用材料..."
curl -s -X POST "$BASE_URL/claims/$NEW_CLAIM_ID/materials" \
  -H "Content-Type: application/json" \
  -d '{
    "material_code": "ACCIDENT_PROOF",
    "file_path": "/uploads/mismatch/proof.pdf"
  }' | python3 -m json.tool
echo ""

# ==========================================
# 6. 查询接口
# ==========================================
echo ""
echo "=== 6. 查询接口 ==="
echo ""

echo "# 查询所有申请（含缺口、阶段、预计赔付、处理耗时）"
curl -s -X GET "$BASE_URL/claims" | python3 -m json.tool
echo ""

echo "# 查询单个申请详情"
curl -s -X GET "$BASE_URL/claims/$ACCIDENT_CLAIM_ID" | python3 -m json.tool
echo ""

echo "# 分开查询：补件通知"
curl -s -X GET "$BASE_URL/claims/$ACCIDENT_CLAIM_ID/supplement-notifications" | python3 -m json.tool
echo ""

echo "# 分开查询：审核意见"
curl -s -X GET "$BASE_URL/claims/$ACCIDENT_CLAIM_ID/review-actions" | python3 -m json.tool
echo ""

echo "# 查询险种材料要求"
curl -s -X GET "$BASE_URL/insurance-types/$MEDICAL_INSURANCE_ID/material-requirements" | python3 -m json.tool
echo ""

echo "=========================================="
echo "所有样例执行完成"
echo "=========================================="
