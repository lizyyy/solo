#!/bin/bash

BASE_URL="http://localhost:8000"
TIMESTAMP=$(date +%s)

echo "=== 医院科研办数据访问申请系统 - API 示例 ==="
echo "基础URL: $BASE_URL"
echo ""

echo "=== 1. 健康检查 ==="
curl -s "$BASE_URL/health" | python3 -m json.tool
echo ""

echo "=== 2. 创建新申请（草稿状态） ==="
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/applications" \
  -H "Content-Type: application/json" \
  -d '{
    "applicant_id": 1,
    "applicant_name": "张三",
    "department": "心内科",
    "project_name": "冠心病危险因素分析研究",
    "project_description": "分析2020-2024年冠心病患者的临床数据，探究危险因素",
    "dataset_id": "CARDIO_001",
    "dataset_name": "心血管疾病患者数据集"
  }')
echo "$CREATE_RESPONSE" | python3 -m json.tool
APP_ID=$(echo "$CREATE_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
CURR_VERSION=$(echo "$CREATE_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['version'])")
echo "申请ID: $APP_ID, 当前版本: $CURR_VERSION"
echo ""

echo "=== 3. 更新申请 - 上传伦理批件ID ==="
UPDATE_RESPONSE=$(curl -s -X PUT "$BASE_URL/api/applications/$APP_ID?operator_id=1" \
  -H "Content-Type: application/json" \
  -d '{
    "ethics_approval_file_id": 1001
  }')
echo "$UPDATE_RESPONSE" | python3 -m json.tool
CURR_VERSION=$(echo "$UPDATE_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['version'])")
echo "当前版本: $CURR_VERSION"
echo ""

echo "=== 4. 提交伦理审核 ==="
SUBMIT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/applications/$APP_ID/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "operator_id": 1,
    "operator_name": "张三",
    "operator_role": "researcher",
    "reason": "申请材料已准备完毕，提交伦理审核",
    "idempotent_key": "submit_'$TIMESTAMP'",
    "current_version": '$CURR_VERSION'
  }')
echo "$SUBMIT_RESPONSE" | python3 -m json.tool
CURR_VERSION=$(echo "$SUBMIT_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['version'])")
echo "当前版本: $CURR_VERSION"
echo ""

echo "=== 5. 伦理审核通过 ==="
ETHICS_RESPONSE=$(curl -s -X POST "$BASE_URL/api/applications/$APP_ID/ethics-review" \
  -H "Content-Type: application/json" \
  -d '{
    "operator_id": 2,
    "operator_name": "王伦理",
    "operator_role": "ethics_committee",
    "approved": true,
    "reviewer_comments": "研究设计合理，伦理风险可控，同意通过",
    "idempotent_key": "ethics_pass_'$TIMESTAMP'",
    "current_version": '$CURR_VERSION'
  }')
echo "$ETHICS_RESPONSE" | python3 -m json.tool
CURR_VERSION=$(echo "$ETHICS_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['version'])")
echo "当前版本: $CURR_VERSION"
echo ""

echo "=== 6. 脱敏复核通过 ==="
DEID_RESPONSE=$(curl -s -X POST "$BASE_URL/api/applications/$APP_ID/deidentification-review" \
  -H "Content-Type: application/json" \
  -d '{
    "operator_id": 3,
    "operator_name": "钱数据",
    "operator_role": "data_manager",
    "passed": true,
    "deidentification_report_id": 2001,
    "reviewer_comments": "脱敏处理符合规范，已去除所有直接标识符",
    "idempotent_key": "deid_pass_'$TIMESTAMP'",
    "current_version": '$CURR_VERSION'
  }')
echo "$DEID_RESPONSE" | python3 -m json.tool
CURR_VERSION=$(echo "$DEID_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['version'])")
echo "当前版本: $CURR_VERSION"
echo ""

echo "=== 7. 开放下载 ==="
AVAILABLE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/applications/$APP_ID/make-available" \
  -H "Content-Type: application/json" \
  -d '{
    "operator_id": 3,
    "operator_name": "钱数据",
    "operator_role": "data_manager",
    "download_url": "https://internal.hospital/data/download/CARDIO_001_'$TIMESTAMP'.zip",
    "download_expiry_days": 7,
    "idempotent_key": "available_'$TIMESTAMP'",
    "current_version": '$CURR_VERSION'
  }')
echo "$AVAILABLE_RESPONSE" | python3 -m json.tool
echo ""

echo "=== 8. 查看申请详情 ==="
curl -s "$BASE_URL/api/applications/$APP_ID" | python3 -m json.tool
echo ""

echo "=== 9. 查看审计日志 ==="
curl -s "$BASE_URL/api/applications/$APP_ID/audit-logs" | python3 -m json.tool
echo ""

echo "=== 10. 异常示例 - 撤销申请 ==="
echo "先创建另一个申请进行撤销演示..."
APP2_RESPONSE=$(curl -s -X POST "$BASE_URL/api/applications" \
  -H "Content-Type: application/json" \
  -d '{
    "applicant_id": 1,
    "applicant_name": "张三",
    "project_name": "待撤销测试项目",
    "dataset_id": "TEST_002",
    "dataset_name": "测试数据集2"
  }')
APP2_ID=$(echo "$APP2_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
APP2_VERSION=$(echo "$APP2_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['version'])")

echo "撤销申请 ID: $APP2_ID"
REVOKE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/applications/$APP2_ID/revoke" \
  -H "Content-Type: application/json" \
  -d '{
    "operator_id": 1,
    "operator_name": "张三",
    "operator_role": "researcher",
    "reason": "项目变更，申请撤销",
    "idempotent_key": "revoke_'$TIMESTAMP'",
    "current_version": '$APP2_VERSION'
  }')
echo "$REVOKE_RESPONSE" | python3 -m json.tool
echo ""

echo "=== 11. 异常示例 - 终态后无法操作 ==="
echo "尝试对已撤销申请进行操作..."
curl -s -X POST "$BASE_URL/api/applications/$APP2_ID/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "operator_id": 1,
    "operator_name": "张三",
    "operator_role": "researcher",
    "idempotent_key": "submit_fail_'$TIMESTAMP'",
    "current_version": 2
  }' | python3 -m json.tool
echo ""

echo "=== 12. 异常示例 - 权限不足 ==="
echo "创建一个新申请并尝试用研究员角色进行伦理审核..."
APP3_RESPONSE=$(curl -s -X POST "$BASE_URL/api/applications" \
  -H "Content-Type: application/json" \
  -d '{
    "applicant_id": 1,
    "applicant_name": "张三",
    "project_name": "权限测试项目",
    "dataset_id": "TEST_003",
    "dataset_name": "测试数据集3"
  }')
APP3_ID=$(echo "$APP3_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
curl -s -X PUT "$BASE_URL/api/applications/$APP3_ID?operator_id=1" \
  -H "Content-Type: application/json" \
  -d '{"ethics_approval_file_id": 1002}' > /dev/null
SUBMIT3_RESPONSE=$(curl -s -X POST "$BASE_URL/api/applications/$APP3_ID/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "operator_id": 1,
    "operator_name": "张三",
    "operator_role": "researcher",
    "idempotent_key": "submit_perm_'$TIMESTAMP'",
    "current_version": 2
  }')

echo "研究员尝试进行伦理审核（应该失败）..."
curl -s -X POST "$BASE_URL/api/applications/$APP3_ID/ethics-review" \
  -H "Content-Type: application/json" \
  -d '{
    "operator_id": 1,
    "operator_name": "张三",
    "operator_role": "researcher",
    "approved": true,
    "idempotent_key": "ethics_perm_fail_'$TIMESTAMP'",
    "current_version": 3
  }' | python3 -m json.tool
echo ""

echo "=== 13. 获取所有申请列表 ==="
curl -s "$BASE_URL/api/applications?limit=10" | python3 -m json.tool
echo ""

echo "=== 示例执行完成 ==="
