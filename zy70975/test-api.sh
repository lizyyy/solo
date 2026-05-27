#!/bin/bash

BASE_URL="http://localhost:3000/api"
CURL_OPTS="--noproxy localhost"

echo "=============================================="
echo "社区活动名额候补 API 测试脚本"
echo "=============================================="
echo ""

echo "1. 健康检查..."
curl -s $CURL_OPTS "$BASE_URL/health" | python3 -m json.tool
echo ""
echo "----------------------------------------------"

echo ""
echo "2. 提交第一批材料（含亲子课和老人课报名）..."
RESPONSE=$(curl -s $CURL_OPTS -X POST "$BASE_URL/submissions" \
  -H "Content-Type: application/json" \
  -d '{
    "submitter": "张三",
    "community": "阳光社区",
    "applications": [
      {
        "applicant_name": "李明",
        "id_card": "110101199001011234",
        "phone": "13800138001",
        "activity_type": "parent_child",
        "relationship": "父子",
        "remark": "孩子5岁"
      },
      {
        "applicant_name": "王芳",
        "id_card": "110101195001015678",
        "phone": "13800138002",
        "activity_type": "elderly",
        "remark": "70岁，身体健康"
      }
    ]
  }')
echo "$RESPONSE" | python3 -m json.tool
SUBMISSION_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['submission']['id'])")
APP1_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['applications'][0]['id'])")
APP2_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['applications'][1]['id'])")
echo ""
echo "提交批次ID: $SUBMISSION_ID"
echo "申请1ID: $APP1_ID, 申请2ID: $APP2_ID"
echo "----------------------------------------------"

echo ""
echo "3. 重复提交同一批材料（应返回isDuplicate: true）..."
curl -s $CURL_OPTS -X POST "$BASE_URL/submissions" \
  -H "Content-Type: application/json" \
  -d '{
    "submitter": "张三",
    "community": "阳光社区",
    "applications": [
      {
        "applicant_name": "李明",
        "id_card": "110101199001011234",
        "phone": "13800138001",
        "activity_type": "parent_child",
        "relationship": "父子",
        "remark": "孩子5岁"
      },
      {
        "applicant_name": "王芳",
        "id_card": "110101195001015678",
        "phone": "13800138002",
        "activity_type": "elderly",
        "remark": "70岁，身体健康"
      }
    ]
  }' | python3 -m json.tool
echo ""
echo "----------------------------------------------"

echo ""
echo "3.1 关键测试：同提交人、同社区、同人数但申请人完全不同（应返回isDuplicate: false）..."
echo "（此测试验证修复后的哈希算法能正确区分不同申请人的材料）"
RESPONSE2=$(curl -s $CURL_OPTS -X POST "$BASE_URL/submissions" \
  -H "Content-Type: application/json" \
  -d '{
    "submitter": "张三",
    "community": "阳光社区",
    "applications": [
      {
        "applicant_name": "赵磊",
        "id_card": "110101198801019999",
        "phone": "13900139001",
        "activity_type": "parent_child",
        "relationship": "父女",
        "remark": "孩子6岁"
      },
      {
        "applicant_name": "孙丽华",
        "id_card": "110101195501018888",
        "phone": "13900139002",
        "activity_type": "elderly",
        "remark": "68岁，需轮椅"
      }
    ]
  }')
echo "$RESPONSE2" | python3 -m json.tool
IS_DUP=$(echo "$RESPONSE2" | python3 -c "import sys, json; print(json.load(sys.stdin)['isDuplicate'])")
if [ "$IS_DUP" = "False" ]; then
  echo "✓ 测试通过：不同申请人的材料未被判为重复"
else
  echo "✗ 测试失败：不同申请人的材料被错误判为重复！"
fi
echo "----------------------------------------------"

echo ""
echo "4. 审批通过第一个申请（亲子课）..."
curl -s $CURL_OPTS -X PUT "$BASE_URL/applications/$APP1_ID/status" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved",
    "operator": "李四",
    "reason": "材料齐全，符合条件",
    "remark": "已通知家长"
  }' | python3 -m json.tool
echo ""
echo "----------------------------------------------"

echo ""
echo "5. 取消第二个申请（老人课）..."
curl -s $CURL_OPTS -X PUT "$BASE_URL/applications/$APP2_ID/status" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "cancelled",
    "operator": "李四",
    "reason": "老人身体不适，主动取消"
  }' | python3 -m json.tool
echo ""
echo "----------------------------------------------"

echo ""
echo "6. 查看第一个申请的审计日志..."
curl -s $CURL_OPTS "$BASE_URL/applications/$APP1_ID/audit-logs" | python3 -m json.tool
echo ""
echo "----------------------------------------------"

echo ""
echo "7. 查看所有提交批次列表..."
curl -s $CURL_OPTS "$BASE_URL/submissions?page=1&page_size=10" | python3 -m json.tool
echo ""
echo "----------------------------------------------"

echo ""
echo "8. 查看单个批次详情..."
curl -s $CURL_OPTS "$BASE_URL/submissions/$SUBMISSION_ID" | python3 -m json.tool
echo ""
echo "----------------------------------------------"

echo ""
echo "9. 查看统计数据..."
curl -s $CURL_OPTS "$BASE_URL/statistics" | python3 -m json.tool
echo ""
echo "----------------------------------------------"

echo ""
echo "10. 导出JSON格式数据..."
curl -s $CURL_OPTS "$BASE_URL/export?format=json" | python3 -m json.tool
echo ""
echo "----------------------------------------------"

echo ""
echo "11. 导出CSV格式数据..."
curl -s $CURL_OPTS "$BASE_URL/export?format=csv"
echo ""
echo "----------------------------------------------"

echo ""
echo "=============================================="
echo "测试完成！"
echo "=============================================="
