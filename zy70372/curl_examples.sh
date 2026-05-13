#!/bin/bash

BASE_URL="http://localhost:3000/api"

echo "=========================================="
echo "Business Rules Sandbox API - Curl Examples"
echo "=========================================="
echo ""

echo "1. 健康检查"
echo "-----------"
curl -s "$BASE_URL/health" | python3 -m json.tool
echo ""
echo ""

echo "=========================================="
echo "场景一：优惠规则调整测试"
echo "=========================================="
echo ""

echo "1.1 创建旧版本规则（满100减10，满200减25）"
curl -s -X POST "$BASE_URL/rule-versions" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "v1.0-discount",
    "description": "旧版优惠规则",
    "createdBy": "operator_001",
    "rules": [
      {
        "ruleId": "discount_100",
        "ruleType": "discount_threshold",
        "ruleName": "满100减10",
        "description": "订单金额满100元减10元",
        "conditions": {
          "orderAmount": { "$gte": 100 }
        },
        "actions": {
          "discount": 10
        },
        "priority": 1,
        "isActive": true,
        "mutuallyExclusiveGroup": "discount_group"
      },
      {
        "ruleId": "discount_200",
        "ruleType": "discount_threshold",
        "ruleName": "满200减25",
        "description": "订单金额满200元减25元",
        "conditions": {
          "orderAmount": { "$gte": 200 }
        },
        "actions": {
          "discount": 25
        },
        "priority": 2,
        "isActive": true,
        "mutuallyExclusiveGroup": "discount_group"
      }
    ]
  }' | python3 -m json.tool
echo ""
echo ""

echo "1.2 创建新版本规则（满100减15，满200减30）"
curl -s -X POST "$BASE_URL/rule-versions" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "v2.0-discount",
    "description": "新版优惠规则 - 加大优惠力度",
    "createdBy": "operator_001",
    "rules": [
      {
        "ruleId": "discount_100_v2",
        "ruleType": "discount_threshold",
        "ruleName": "满100减15",
        "description": "订单金额满100元减15元",
        "conditions": {
          "orderAmount": { "$gte": 100 }
        },
        "actions": {
          "discount": 15
        },
        "priority": 1,
        "isActive": true,
        "mutuallyExclusiveGroup": "discount_group"
      },
      {
        "ruleId": "discount_200_v2",
        "ruleType": "discount_threshold",
        "ruleName": "满200减30",
        "description": "订单金额满200元减30元",
        "conditions": {
          "orderAmount": { "$gte": 200 }
        },
        "actions": {
          "discount": 30
        },
        "priority": 2,
        "isActive": true,
        "mutuallyExclusiveGroup": "discount_group"
      }
    ]
  }' | python3 -m json.tool
echo ""
echo ""

echo "1.3 导入历史样本数据"
curl -s -X POST "$BASE_URL/sample-sets" \
  -H "Content-Type: application/json" \
  -d '{
    "setId": "samples_discount_test",
    "name": "优惠规则测试样本",
    "description": "用于测试优惠规则调整的样本集",
    "createdBy": "operator_001",
    "samples": [
      {
        "sampleId": "s001",
        "userId": "user_1001",
        "userSegment": "general",
        "orderAmount": 99,
        "orderDate": "2024-01-15T10:00:00Z",
        "riskScore": 10,
        "membershipLevel": "basic"
      },
      {
        "sampleId": "s002",
        "userId": "user_1002",
        "userSegment": "general",
        "orderAmount": 150,
        "orderDate": "2024-01-15T11:00:00Z",
        "riskScore": 15,
        "membershipLevel": "basic"
      },
      {
        "sampleId": "s003",
        "userId": "user_1003",
        "userSegment": "vip",
        "orderAmount": 250,
        "orderDate": "2024-01-15T12:00:00Z",
        "riskScore": 5,
        "membershipLevel": "gold"
      },
      {
        "sampleId": "s004",
        "userId": "user_1004",
        "userSegment": "general",
        "orderAmount": 500,
        "orderDate": "2024-01-15T13:00:00Z",
        "riskScore": 20,
        "membershipLevel": "silver"
      }
    ]
  }' | python3 -m json.tool
echo ""
echo ""

echo "1.4 创建沙盘运行"
DISCOUNT_RUN_RESPONSE=$(curl -s -X POST "$BASE_URL/sandbox-runs" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "优惠规则调整沙盘",
    "description": "测试优惠规则从满100减10调整为满100减15的影响",
    "oldRuleVersion": "v1.0-discount",
    "newRuleVersion": "v2.0-discount",
    "sampleSetId": "samples_discount_test",
    "createdBy": "operator_001"
  }')
echo "$DISCOUNT_RUN_RESPONSE" | python3 -m json.tool
DISCOUNT_RUN_ID=$(echo "$DISCOUNT_RUN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['runId'])")
echo "Run ID: $DISCOUNT_RUN_ID"
echo ""
echo ""

echo "1.5 启动沙盘运行"
curl -s -X POST "$BASE_URL/sandbox-runs/$DISCOUNT_RUN_ID/start" | python3 -m json.tool
echo ""
echo ""

sleep 2

echo "1.6 查看沙盘结果"
echo "查询 URL: $BASE_URL/sandbox-runs/$DISCOUNT_RUN_ID/results"
curl -s "$BASE_URL/sandbox-runs/$DISCOUNT_RUN_ID/results" | python3 -m json.tool
echo ""
echo ""

echo "=========================================="
echo "场景二：限购收紧测试（从每天5单改为3单）"
echo "=========================================="
echo ""

echo "2.1 创建旧版本限购规则（每天5单）"
curl -s -X POST "$BASE_URL/rule-versions" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "v1.0-purchase-limit",
    "description": "旧版限购规则",
    "createdBy": "operator_001",
    "rules": [
      {
        "ruleId": "daily_limit_5",
        "ruleType": "purchase_limit",
        "ruleName": "每日限购5单",
        "description": "用户每日最多购买5单",
        "conditions": {
          "purchaseHistory.dailyOrders": { "$gt": 5 }
        },
        "actions": {
          "block": true
        },
        "priority": 10,
        "isActive": true,
        "mutuallyExclusiveGroup": null
      }
    ]
  }' | python3 -m json.tool
echo ""
echo ""

echo "2.2 创建新版本限购规则（每天3单）"
curl -s -X POST "$BASE_URL/rule-versions" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "v2.0-purchase-limit",
    "description": "新版限购规则 - 收紧至3单",
    "createdBy": "operator_001",
    "rules": [
      {
        "ruleId": "daily_limit_3",
        "ruleType": "purchase_limit",
        "ruleName": "每日限购3单",
        "description": "用户每日最多购买3单",
        "conditions": {
          "purchaseHistory.dailyOrders": { "$gt": 3 }
        },
        "actions": {
          "block": true
        },
        "priority": 10,
        "isActive": true,
        "mutuallyExclusiveGroup": null
      }
    ]
  }' | python3 -m json.tool
echo ""
echo ""

echo "2.3 导入限购测试样本"
curl -s -X POST "$BASE_URL/sample-sets" \
  -H "Content-Type: application/json" \
  -d '{
    "setId": "samples_purchase_limit_test",
    "name": "限购规则测试样本",
    "description": "用于测试限购规则调整的样本集",
    "createdBy": "operator_001",
    "samples": [
      {
        "sampleId": "p001",
        "userId": "user_2001",
        "userSegment": "general",
        "orderAmount": 100,
        "orderDate": "2024-01-15T10:00:00Z",
        "purchaseHistory": { "dailyOrders": 2 },
        "riskScore": 10,
        "membershipLevel": "basic"
      },
      {
        "sampleId": "p002",
        "userId": "user_2002",
        "userSegment": "general",
        "orderAmount": 200,
        "orderDate": "2024-01-15T11:00:00Z",
        "purchaseHistory": { "dailyOrders": 4 },
        "riskScore": 15,
        "membershipLevel": "basic"
      },
      {
        "sampleId": "p003",
        "userId": "user_2003",
        "userSegment": "vip",
        "orderAmount": 500,
        "orderDate": "2024-01-15T12:00:00Z",
        "purchaseHistory": { "dailyOrders": 6 },
        "riskScore": 5,
        "membershipLevel": "gold"
      },
      {
        "sampleId": "p004",
        "userId": "user_2004",
        "userSegment": "high_value",
        "orderAmount": 1000,
        "orderDate": "2024-01-15T13:00:00Z",
        "purchaseHistory": { "dailyOrders": 5 },
        "riskScore": 8,
        "membershipLevel": "platinum"
      },
      {
        "sampleId": "p005",
        "userId": "user_2005",
        "userSegment": "new_user",
        "orderAmount": 50,
        "orderDate": "2024-01-15T14:00:00Z",
        "purchaseHistory": { "dailyOrders": 1 },
        "riskScore": 25,
        "membershipLevel": "basic"
      }
    ]
  }' | python3 -m json.tool
echo ""
echo ""

echo "2.4 创建并运行限购沙盘"
PURCHASE_RUN_RESPONSE=$(curl -s -X POST "$BASE_URL/sandbox-runs" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "限购规则收紧沙盘",
    "description": "测试限购规则从每天5单收紧到3单的影响",
    "oldRuleVersion": "v1.0-purchase-limit",
    "newRuleVersion": "v2.0-purchase-limit",
    "sampleSetId": "samples_purchase_limit_test",
    "createdBy": "operator_001"
  }')
echo "$PURCHASE_RUN_RESPONSE" | python3 -m json.tool
PURCHASE_RUN_ID=$(echo "$PURCHASE_RUN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['runId'])")
echo "Run ID: $PURCHASE_RUN_ID"
echo ""

curl -s -X POST "$BASE_URL/sandbox-runs/$PURCHASE_RUN_ID/start" | python3 -m json.tool
echo ""

sleep 2

echo "2.5 查看限购沙盘结果"
curl -s "$BASE_URL/sandbox-runs/$PURCHASE_RUN_ID/results" | python3 -m json.tool
echo ""
echo ""

echo "=========================================="
echo "场景三：风控误伤测试"
echo "=========================================="
echo ""

echo "3.1 创建旧版风控规则（风险分>80拦截）"
curl -s -X POST "$BASE_URL/rule-versions" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "v1.0-risk-control",
    "description": "旧版风控规则",
    "createdBy": "operator_001",
    "rules": [
      {
        "ruleId": "risk_80",
        "ruleType": "risk_control",
        "ruleName": "高风险拦截",
        "description": "风险分大于80的订单拦截",
        "conditions": {
          "riskScore": { "$gt": 80 }
        },
        "actions": {
          "block": true
        },
        "priority": 100,
        "isActive": true,
        "mutuallyExclusiveGroup": null
      }
    ]
  }' | python3 -m json.tool
echo ""
echo ""

echo "3.2 创建新版风控规则（风险分>50拦截，更严格）"
curl -s -X POST "$BASE_URL/rule-versions" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "v2.0-risk-control",
    "description": "新版风控规则 - 更严格",
    "createdBy": "operator_001",
    "rules": [
      {
        "ruleId": "risk_50",
        "ruleType": "risk_control",
        "ruleName": "中等风险拦截",
        "description": "风险分大于50的订单拦截",
        "conditions": {
          "riskScore": { "$gt": 50 }
        },
        "actions": {
          "block": true
        },
        "priority": 100,
        "isActive": true,
        "mutuallyExclusiveGroup": null
      }
    ]
  }' | python3 -m json.tool
echo ""
echo ""

echo "3.3 导入风控测试样本（包含正常用户和风险用户）"
curl -s -X POST "$BASE_URL/sample-sets" \
  -H "Content-Type: application/json" \
  -d '{
    "setId": "samples_risk_test",
    "name": "风控规则测试样本",
    "description": "用于测试风控规则调整的样本集，包含误伤场景",
    "createdBy": "operator_001",
    "samples": [
      {
        "sampleId": "r001",
        "userId": "user_3001",
        "userSegment": "general",
        "orderAmount": 100,
        "orderDate": "2024-01-15T10:00:00Z",
        "riskScore": 10,
        "membershipLevel": "basic",
        "metadata": { "isRealUser": true }
      },
      {
        "sampleId": "r002",
        "userId": "user_3002",
        "userSegment": "general",
        "orderAmount": 500,
        "orderDate": "2024-01-15T11:00:00Z",
        "riskScore": 45,
        "membershipLevel": "silver",
        "metadata": { "isRealUser": true }
      },
      {
        "sampleId": "r003",
        "userId": "user_3003",
        "userSegment": "general",
        "orderAmount": 1000,
        "orderDate": "2024-01-15T12:00:00Z",
        "riskScore": 60,
        "membershipLevel": "basic",
        "metadata": { "isRealUser": true, "abnormalBehavior": false }
      },
      {
        "sampleId": "r004",
        "userId": "user_3004",
        "userSegment": "risky",
        "orderAmount": 200,
        "orderDate": "2024-01-15T13:00:00Z",
        "riskScore": 85,
        "membershipLevel": "basic",
        "metadata": { "isRealUser": false, "isBot": true }
      },
      {
        "sampleId": "r005",
        "userId": "user_3005",
        "userSegment": "vip",
        "orderAmount": 2000,
        "orderDate": "2024-01-15T14:00:00Z",
        "riskScore": 55,
        "membershipLevel": "gold",
        "metadata": { "isRealUser": true, "highValueCustomer": true }
      }
    ]
  }' | python3 -m json.tool
echo ""
echo ""

echo "3.4 创建并运行风控沙盘"
RISK_RUN_RESPONSE=$(curl -s -X POST "$BASE_URL/sandbox-runs" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "风控规则调整沙盘",
    "description": "测试风控规则从风险分>80调整为>50的误伤情况",
    "oldRuleVersion": "v1.0-risk-control",
    "newRuleVersion": "v2.0-risk-control",
    "sampleSetId": "samples_risk_test",
    "createdBy": "operator_001"
  }')
echo "$RISK_RUN_RESPONSE" | python3 -m json.tool
RISK_RUN_ID=$(echo "$RISK_RUN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['runId'])")
echo "Run ID: $RISK_RUN_ID"
echo ""

curl -s -X POST "$BASE_URL/sandbox-runs/$RISK_RUN_ID/start" | python3 -m json.tool
echo ""

sleep 2

echo "3.5 查看风控沙盘结果（重点关注误伤样本）"
curl -s "$BASE_URL/sandbox-runs/$RISK_RUN_ID/results" | python3 -m json.tool
echo ""
echo ""

echo "=========================================="
echo "场景四：规则冲突检测"
echo "=========================================="
echo ""

echo "4.1 创建包含冲突规则的版本"
curl -s -X POST "$BASE_URL/rule-versions" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "v1.0-conflict-test",
    "description": "包含互斥规则冲突的版本",
    "createdBy": "operator_001",
    "rules": [
      {
        "ruleId": "new_user_discount",
        "ruleType": "discount_threshold",
        "ruleName": "新用户专享9折",
        "description": "新用户享受9折优惠",
        "conditions": {
          "userSegment": "new_user",
          "orderAmount": { "$gte": 1 }
        },
        "actions": {
          "discount": 0.1
        },
        "priority": 5,
        "isActive": true,
        "mutuallyExclusiveGroup": "new_user_benefits"
      },
      {
        "ruleId": "new_user_coupon",
        "ruleType": "membership_benefit",
        "ruleName": "新用户优惠券",
        "description": "新用户获得优惠券",
        "conditions": {
          "userSegment": "new_user",
          "orderAmount": { "$gte": 1 }
        },
        "actions": {
          "benefits": { "coupon": true }
        },
        "priority": 1,
        "isActive": true,
        "mutuallyExclusiveGroup": "new_user_benefits"
      },
      {
        "ruleId": "vip_discount",
        "ruleType": "discount_threshold",
        "ruleName": "VIP专享8折",
        "description": "VIP用户享受8折优惠",
        "conditions": {
          "membershipLevel": { "$in": ["gold", "platinum"] }
        },
        "actions": {
          "discount": 0.2
        },
        "priority": 10,
        "isActive": true,
        "mutuallyExclusiveGroup": null
      }
    ]
  }' | python3 -m json.tool
echo ""
echo ""

echo "4.2 创建无冲突的基础版本"
curl -s -X POST "$BASE_URL/rule-versions" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "v1.0-baseline",
    "description": "无冲突的基础版本",
    "createdBy": "operator_001",
    "rules": [
      {
        "ruleId": "basic_rule",
        "ruleType": "discount_threshold",
        "ruleName": "基础规则",
        "description": "基础规则",
        "conditions": {
          "orderAmount": { "$gte": 1 }
        },
        "actions": {
          "discount": 0
        },
        "priority": 1,
        "isActive": true,
        "mutuallyExclusiveGroup": null
      }
    ]
  }' | python3 -m json.tool
echo ""
echo ""

echo "4.3 导入冲突测试样本"
curl -s -X POST "$BASE_URL/sample-sets" \
  -H "Content-Type: application/json" \
  -d '{
    "setId": "samples_conflict_test",
    "name": "冲突规则测试样本",
    "description": "用于测试规则冲突检测的样本集",
    "createdBy": "operator_001",
    "samples": [
      {
        "sampleId": "c001",
        "userId": "user_4001",
        "userSegment": "new_user",
        "orderAmount": 100,
        "orderDate": "2024-01-15T10:00:00Z",
        "riskScore": 10,
        "membershipLevel": "basic"
      },
      {
        "sampleId": "c002",
        "userId": "user_4002",
        "userSegment": "vip",
        "orderAmount": 500,
        "orderDate": "2024-01-15T11:00:00Z",
        "riskScore": 5,
        "membershipLevel": "gold"
      },
      {
        "sampleId": "c003",
        "userId": "user_4003",
        "userSegment": "new_user",
        "orderAmount": 200,
        "orderDate": "2024-01-15T12:00:00Z",
        "riskScore": 15,
        "membershipLevel": "silver"
      }
    ]
  }' | python3 -m json.tool
echo ""
echo ""

echo "4.4 创建并运行冲突检测沙盘"
CONFLICT_RUN_RESPONSE=$(curl -s -X POST "$BASE_URL/sandbox-runs" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "规则冲突检测沙盘",
    "description": "测试互斥规则组中的冲突",
    "oldRuleVersion": "v1.0-baseline",
    "newRuleVersion": "v1.0-conflict-test",
    "sampleSetId": "samples_conflict_test",
    "createdBy": "operator_001"
  }')
echo "$CONFLICT_RUN_RESPONSE" | python3 -m json.tool
CONFLICT_RUN_ID=$(echo "$CONFLICT_RUN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['runId'])")
echo "Run ID: $CONFLICT_RUN_ID"
echo ""

curl -s -X POST "$BASE_URL/sandbox-runs/$CONFLICT_RUN_ID/start" | python3 -m json.tool
echo ""

sleep 2

echo "4.5 查看冲突检测结果"
echo "重点查看 isConflicting 和 conflictReason 字段"
curl -s "$BASE_URL/sandbox-runs/$CONFLICT_RUN_ID/results" | python3 -m json.tool
echo ""
echo ""

echo "=========================================="
echo "场景五：边界测试"
echo "=========================================="
echo ""

echo "5.1 测试规则版本重复创建（应该失败）"
curl -s -X POST "$BASE_URL/rule-versions" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "v1.0-discount",
    "description": "尝试重复创建",
    "createdBy": "operator_001",
    "rules": [
      {
        "ruleId": "test_rule",
        "ruleType": "discount_threshold",
        "ruleName": "测试规则",
        "conditions": { "orderAmount": { "$gte": 100 } },
        "actions": { "discount": 10 },
        "priority": 1,
        "isActive": true
      }
    ]
  }' | python3 -m json.tool
echo ""
echo ""

echo "5.2 测试样本集为空时创建沙盘（应该失败）"
curl -s -X POST "$BASE_URL/sample-sets" \
  -H "Content-Type: application/json" \
  -d '{
    "setId": "empty_samples",
    "name": "空样本集",
    "createdBy": "operator_001",
    "samples": []
  }' | python3 -m json.tool
echo ""
echo ""

echo "5.3 测试沙盘运行中修改规则（应该失败）"
echo "先创建一个沙盘并启动..."
BOUNDARY_RUN_RESPONSE=$(curl -s -X POST "$BASE_URL/sandbox-runs" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "边界测试沙盘",
    "description": "测试运行中修改规则的边界",
    "oldRuleVersion": "v1.0-discount",
    "newRuleVersion": "v2.0-discount",
    "sampleSetId": "samples_discount_test",
    "createdBy": "operator_001"
  }')
BOUNDARY_RUN_ID=$(echo "$BOUNDARY_RUN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['runId'])")
echo "Run ID: $BOUNDARY_RUN_ID"

curl -s -X POST "$BASE_URL/sandbox-runs/$BOUNDARY_RUN_ID/start" > /dev/null

sleep 1

echo "尝试修改正在使用的规则版本..."
curl -s -X PUT "$BASE_URL/rule-versions/v1.0-discount" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "尝试在沙盘运行中修改"
  }' | python3 -m json.tool
echo ""
echo ""

echo "5.4 导出报告（JSON格式）"
echo "导出限购规则调整报告..."
curl -s "$BASE_URL/sandbox-runs/$PURCHASE_RUN_ID/export?format=json" > /tmp/sandbox_report.json
echo "报告已保存到 /tmp/sandbox_report.json"
echo ""
echo ""

echo "5.5 导出报告（CSV格式）"
echo "导出风控规则调整报告..."
curl -s "$BASE_URL/sandbox-runs/$RISK_RUN_ID/export?format=csv" > /tmp/sandbox_report.csv
echo "报告已保存到 /tmp/sandbox_report.csv"
echo ""
echo ""

echo "=========================================="
echo "总结"
echo "=========================================="
echo "所有示例场景已完成！"
echo ""
echo "创建的规则版本："
echo "  - v1.0-discount (旧版优惠规则)"
echo "  - v2.0-discount (新版优惠规则)"
echo "  - v1.0-purchase-limit (旧版限购规则)"
echo "  - v2.0-purchase-limit (新版限购规则)"
echo "  - v1.0-risk-control (旧版风控规则)"
echo "  - v2.0-risk-control (新版风控规则)"
echo "  - v1.0-conflict-test (冲突规则版本)"
echo "  - v1.0-baseline (基础版本)"
echo ""
echo "创建的样本集："
echo "  - samples_discount_test"
echo "  - samples_purchase_limit_test"
echo "  - samples_risk_test"
echo "  - samples_conflict_test"
echo ""
echo "关键沙盘运行ID："
echo "  - 优惠规则调整: $DISCOUNT_RUN_ID"
echo "  - 限购规则收紧: $PURCHASE_RUN_ID"
echo "  - 风控规则调整: $RISK_RUN_ID"
echo "  - 冲突检测: $CONFLICT_RUN_ID"
echo ""
echo "请使用以下命令查看详细结果："
echo "  curl $BASE_URL/sandbox-runs/<run_id>/results | python3 -m json.tool"
echo ""
