#!/bin/bash

BASE_URL="http://localhost:3000"

echo "========================================================="
echo "接口字段脱敏 API - Curl 示例脚本"
echo "========================================================="
echo ""

echo "【第一步】获取健康检查和 Mock 数据 ID"
echo "---------------------------------------------------------"
HEALTH_RESPONSE=$(curl -s "$BASE_URL/api/health")
echo "$HEALTH_RESPONSE" | python3 -m json.tool
echo ""

CUSTOMER_ID=$(echo "$HEALTH_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['mockData']['customer1Id'])")
ORDER_ID=$(echo "$HEALTH_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['mockData']['order1Id'])")
CUSTOMER_POLICY_ID=$(echo "$HEALTH_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['mockData']['customerPolicyId'])")
CUSTOMER_VERSION1_ID=$(echo "$HEALTH_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['mockData']['customerVersion1Id'])")

echo "提取的 ID:"
echo "  客户 ID: $CUSTOMER_ID"
echo "  订单 ID: $ORDER_ID"
echo "  客户策略 ID: $CUSTOMER_POLICY_ID"
echo "  客户策略 v1 ID: $CUSTOMER_VERSION1_ID"
echo ""

read -p "按 Enter 继续..."

echo ""
echo "========================================================="
echo "【示例 1】不同角色访问同一客户详情 - 不同字段脱敏规则"
echo "========================================================="
echo ""

echo "【1.1】客服角色访问客户详情"
echo "预期: 手机号后四位可见，邮箱部分脱敏，地址部分脱敏，余额隐藏"
echo "curl -s -H \"x-user-id: user_cs_001\" -H \"x-role: customer_service\" \"$BASE_URL/api/customers/$CUSTOMER_ID\""
echo "---------------------------------------------------------"
curl -s \
  -H "x-user-id: user_cs_001" \
  -H "x-role: customer_service" \
  "$BASE_URL/api/customers/$CUSTOMER_ID" | python3 -m json.tool
echo ""

read -p "按 Enter 继续..."

echo ""
echo "【1.2】财务角色访问同一客户详情"
echo "预期: 余额可见，邮箱隐藏，地址隐藏，手机号后四位可见"
echo "curl -s -H \"x-user-id: user_finance_001\" -H \"x-role: finance\" \"$BASE_URL/api/customers/$CUSTOMER_ID\""
echo "---------------------------------------------------------"
curl -s \
  -H "x-user-id: user_finance_001" \
  -H "x-role: finance" \
  "$BASE_URL/api/customers/$CUSTOMER_ID" | python3 -m json.tool
echo ""

read -p "按 Enter 继续..."

echo ""
echo "【1.3】外包审计角色访问同一客户详情"
echo "预期: 手机号隐藏，邮箱隐藏，地址全脱敏，余额隐藏"
echo "curl -s -H \"x-user-id: user_outsource_001\" -H \"x-role: outsourcing\" \"$BASE_URL/api/customers/$CUSTOMER_ID\""
echo "---------------------------------------------------------"
curl -s \
  -H "x-user-id: user_outsource_001" \
  -H "x-role: outsourcing" \
  "$BASE_URL/api/customers/$CUSTOMER_ID" | python3 -m json.tool
echo ""

read -p "按 Enter 继续..."

echo ""
echo "========================================================="
echo "【示例 2】例外授权 - 外包审计特殊授权查看联系方式"
echo "========================================================="
echo ""

echo "【2.1】先查看当前例外授权列表"
echo "curl -s \"$BASE_URL/api/exceptions\""
echo "---------------------------------------------------------"
curl -s "$BASE_URL/api/exceptions" | python3 -m json.tool
echo ""

read -p "按 Enter 继续..."

echo ""
echo "【2.2】有例外授权的外包用户访问客户详情"
echo "预期: 手机号和邮箱因例外授权可见，其他字段按外包角色规则"
echo "curl -s -H \"x-user-id: user_outsourcing_special\" -H \"x-role: outsourcing\" \"$BASE_URL/api/customers/$CUSTOMER_ID\""
echo "---------------------------------------------------------"
curl -s \
  -H "x-user-id: user_outsourcing_special" \
  -H "x-role: outsourcing" \
  "$BASE_URL/api/customers/$CUSTOMER_ID" | python3 -m json.tool
echo ""

read -p "按 Enter 继续..."

echo ""
echo "【2.3】例外授权已过期的外包用户访问客户详情"
echo "预期: 例外授权不生效，按外包角色规则脱敏"
echo "curl -s -H \"x-user-id: user_outsourcing_expired\" -H \"x-role: outsourcing\" \"$BASE_URL/api/customers/$CUSTOMER_ID\""
echo "---------------------------------------------------------"
curl -s \
  -H "x-user-id: user_outsourcing_expired" \
  -H "x-role: outsourcing" \
  "$BASE_URL/api/customers/$CUSTOMER_ID" | python3 -m json.tool
echo ""

read -p "按 Enter 继续..."

echo ""
echo "========================================================="
echo "【示例 3】策略更新 - 创建新版本并发布"
echo "========================================================="
echo ""

echo "【3.1】查看当前客户策略版本列表"
echo "curl -s \"$BASE_URL/api/policies/$CUSTOMER_POLICY_ID/versions\""
echo "---------------------------------------------------------"
curl -s "$BASE_URL/api/policies/$CUSTOMER_POLICY_ID/versions" | python3 -m json.tool
echo ""

read -p "按 Enter 继续..."

echo ""
echo "【3.2】创建策略版本 2（修改规则：财务可以看到备注，客服不能看邮箱）"
echo "curl -s -X POST -H \"Content-Type: application/json\" -d '{\"fieldRules\":{...}}' \"$BASE_URL/api/policies/$CUSTOMER_POLICY_ID/versions\""
echo "---------------------------------------------------------"
VERSION2_RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "fieldRules": {
      "customer_service": {
        "id": { "visible": true },
        "name": { "visible": true },
        "phone": { "visible": true, "mask": "last4" },
        "email": { "visible": false },
        "address": { "visible": true, "mask": "partial" },
        "balance": { "visible": false },
        "notes": { "visible": false },
        "createdAt": { "visible": true }
      },
      "finance": {
        "id": { "visible": true },
        "name": { "visible": true },
        "phone": { "visible": true, "mask": "last4" },
        "email": { "visible": false },
        "address": { "visible": false },
        "balance": { "visible": true },
        "notes": { "visible": true },
        "createdAt": { "visible": true }
      },
      "outsourcing": {
        "id": { "visible": true },
        "name": { "visible": true },
        "phone": { "visible": false },
        "email": { "visible": false },
        "address": { "visible": true, "mask": "full" },
        "balance": { "visible": false },
        "notes": { "visible": false },
        "createdAt": { "visible": true }
      }
    }
  }' \
  "$BASE_URL/api/policies/$CUSTOMER_POLICY_ID/versions")
echo "$VERSION2_RESPONSE" | python3 -m json.tool
echo ""

VERSION2_ID=$(echo "$VERSION2_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")
echo "新版本 ID: $VERSION2_ID"
echo ""

read -p "按 Enter 继续..."

echo ""
echo "【3.3】对比版本 1 和版本 2 的差异"
echo "curl -s \"$BASE_URL/api/policies/compare/$CUSTOMER_VERSION1_ID/$VERSION2_ID\""
echo "---------------------------------------------------------"
curl -s "$BASE_URL/api/policies/compare/$CUSTOMER_VERSION1_ID/$VERSION2_ID" | python3 -m json.tool
echo ""

read -p "按 Enter 继续..."

echo ""
echo "【3.4】发布策略版本 2"
echo "curl -s -X POST \"$BASE_URL/api/policies/$CUSTOMER_POLICY_ID/versions/2/publish\""
echo "---------------------------------------------------------"
curl -s -X POST "$BASE_URL/api/policies/$CUSTOMER_POLICY_ID/versions/2/publish" | python3 -m json.tool
echo ""

read -p "按 Enter 继续..."

echo ""
echo "【3.5】策略更新后，财务角色再次访问客户详情"
echo "预期: 现在可以看到 notes 字段（策略 v2 新规则）"
echo "curl -s -H \"x-user-id: user_finance_002\" -H \"x-role: finance\" \"$BASE_URL/api/customers/$CUSTOMER_ID\""
echo "---------------------------------------------------------"
curl -s \
  -H "x-user-id: user_finance_002" \
  -H "x-role: finance" \
  "$BASE_URL/api/customers/$CUSTOMER_ID" | python3 -m json.tool
echo ""

read -p "按 Enter 继续..."

echo ""
echo "【3.6】策略更新后，客服角色再次访问客户详情"
echo "预期: 邮箱现在被隐藏（策略 v2 新规则）"
echo "curl -s -H \"x-user-id: user_cs_002\" -H \"x-role: customer_service\" \"$BASE_URL/api/customers/$CUSTOMER_ID\""
echo "---------------------------------------------------------"
curl -s \
  -H "x-user-id: user_cs_002" \
  -H "x-role: customer_service" \
  "$BASE_URL/api/customers/$CUSTOMER_ID" | python3 -m json.tool
echo ""

read -p "按 Enter 继续..."

echo ""
echo "========================================================="
echo "【示例 4】违规访问被拒"
echo "========================================================="
echo ""

echo "【4.1】缺少认证头的访问（401）"
echo "curl -s \"$BASE_URL/api/customers/$CUSTOMER_ID\""
echo "---------------------------------------------------------"
curl -s "$BASE_URL/api/customers/$CUSTOMER_ID" | python3 -m json.tool
echo ""

read -p "按 Enter 继续..."

echo ""
echo "【4.2】访问不存在的资源（404）"
echo "curl -s -H \"x-user-id: user_cs_003\" -H \"x-role: customer_service\" \"$BASE_URL/api/customers/nonexistent\""
echo "---------------------------------------------------------"
curl -s \
  -H "x-user-id: user_cs_003" \
  -H "x-role: customer_service" \
  "$BASE_URL/api/customers/nonexistent" | python3 -m json.tool
echo ""

read -p "按 Enter 继续..."

echo ""
echo "========================================================="
echo "【示例 5】审计记录查询"
echo "========================================================="
echo ""

echo "【5.1】查询所有审计记录"
echo "curl -s \"$BASE_URL/api/audit\""
echo "---------------------------------------------------------"
curl -s "$BASE_URL/api/audit" | python3 -m json.tool
echo ""

read -p "按 Enter 继续..."

echo ""
echo "【5.2】查询特定资源的访问记录（按资源 ID）"
echo "curl -s \"$BASE_URL/api/audit/by-resource/customer/$CUSTOMER_ID\""
echo "---------------------------------------------------------"
curl -s "$BASE_URL/api/audit/by-resource/customer/$CUSTOMER_ID" | python3 -m json.tool
echo ""

read -p "按 Enter 继续..."

echo ""
echo "【5.3】查询使用策略版本 1 的访问记录"
echo "curl -s \"$BASE_URL/api/audit/by-policy-version/$CUSTOMER_VERSION1_ID\""
echo "---------------------------------------------------------"
curl -s "$BASE_URL/api/audit/by-policy-version/$CUSTOMER_VERSION1_ID" | python3 -m json.tool
echo ""

read -p "按 Enter 继续..."

echo ""
echo "【5.4】查询失败的访问记录"
echo "curl -s \"$BASE_URL/api/audit?success=false\""
echo "---------------------------------------------------------"
curl -s "$BASE_URL/api/audit?success=false" | python3 -m json.tool
echo ""

echo ""
echo "========================================================="
echo "脚本执行完毕！"
echo "========================================================="
