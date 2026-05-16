#!/bin/bash

BASE_URL="http://localhost:8080/api/v1"

echo "========================================"
echo "异常场景测试脚本"
echo "========================================"
echo ""

echo "1. 创建导出请求"
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/export-requests" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER002",
    "userName": "李四",
    "userEmail": "lisi@example.com",
    "consentVersionCode": "PRIVACY-V1.0",
    "createdBy": "admin",
    "scopeItems": [
      {
        "category": "PROFILE_DATA",
        "fieldName": "姓名",
        "isIncluded": true
      }
    ]
  }')

echo "$CREATE_RESPONSE" | python3 -m json.tool
echo ""

REQUEST_NO=$(echo "$CREATE_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['requestNo'])")
echo "生成的请求编号: $REQUEST_NO"
echo ""

echo "2. 测试无效的状态转换: DRAFT 直接跳到 CONSENT_VALIDATED (应该失败)"
curl -s -X POST "$BASE_URL/export-requests/$REQUEST_NO/transition" \
  -H "Content-Type: application/json" \
  -d '{
    "targetStatus": "CONSENT_VALIDATED",
    "reason": "跳过中间状态",
    "operator": "system"
  }' | python3 -m json.tool
echo ""

echo "3. 先正常流转到 PENDING_CONSENT_VALIDATION"
curl -s -X POST "$BASE_URL/export-requests/$REQUEST_NO/transition" \
  -H "Content-Type: application/json" \
  -d '{
    "targetStatus": "PENDING_CONSENT_VALIDATION",
    "reason": "提交校验",
    "operator": "system"
  }' | python3 -m json.tool
echo ""

echo "4. 模拟校验失败: NEEDS_MANUAL_CORRECTION"
curl -s -X POST "$BASE_URL/export-requests/$REQUEST_NO/transition" \
  -H "Content-Type: application/json" \
  -d '{
    "targetStatus": "NEEDS_MANUAL_CORRECTION",
    "reason": "用户签名不匹配，需要人工核对",
    "operator": "system",
    "processingConclusion": "签名SIG_XXX与系统记录不匹配，可能存在冒用风险，需人工核实"
  }' | python3 -m json.tool
echo ""

echo "5. 查看当前状态（应该是 NEEDS_MANUAL_CORRECTION）"
curl -s "$BASE_URL/export-requests/$REQUEST_NO" | python3 -m json.tool
echo ""

echo "6. 尝试从未完成状态进行状态转换（应该失败）"
curl -s -X POST "$BASE_URL/export-requests/$REQUEST_NO/transition" \
  -H "Content-Type: application/json" \
  -d '{
    "targetStatus": "CONSENT_VALIDATED",
    "reason": "不合法的状态转换",
    "operator": "system"
  }' | python3 -m json.tool
echo ""

echo "7. 应用人工修正"
curl -s -X POST "$BASE_URL/export-requests/$REQUEST_NO/manual-correction" \
  -H "Content-Type: application/json" \
  -d '{
    "correctedBy": "compliance_officer_001",
    "correctionReason": "已电话联系用户核实身份，确认为本人申请",
    "newConsentVersionCode": "PRIVACY-V2.0",
    "updatedScopeItems": [
      {
        "category": "PROFILE_DATA",
        "fieldName": "姓名",
        "isIncluded": true
      },
      {
        "category": "PROFILE_DATA",
        "fieldName": "身份证号",
        "fieldDescription": "用户身份证号码（需脱敏）",
        "isIncluded": true
      },
      {
        "category": "BEHAVIOR_DATA",
        "fieldName": "浏览记录",
        "isIncluded": true
      }
    ],
    "processingConclusion": "人工审核通过：用户身份已核实，升级到V2.0同意版本，添加行为数据导出权限"
  }' | python3 -m json.tool
echo ""

echo "8. 查看修正后的状态（应该回到 DRAFT）"
curl -s "$BASE_URL/export-requests/$REQUEST_NO" | python3 -m json.tool
echo ""

echo "9. 查看修正后的导出范围项"
curl -s "$BASE_URL/export-requests/$REQUEST_NO/scope-items" | python3 -m json.tool
echo ""

echo "10. 查看审批节点的处理结果"
curl -s "$BASE_URL/export-requests/$REQUEST_NO/approval-nodes" | python3 -m json.tool
echo ""

echo "11. 测试参数校验失败 - 缺少必填字段"
curl -s -X POST "$BASE_URL/export-requests" \
  -H "Content-Type: application/json" \
  -d '{
    "userName": "王五",
    "consentVersionCode": "PRIVACY-V1.0"
  }' | python3 -m json.tool
echo ""

echo "12. 测试无效的同意版本编码"
curl -s -X POST "$BASE_URL/export-requests" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER003",
    "userName": "王五",
    "consentVersionCode": "INVALID-VERSION",
    "createdBy": "admin",
    "scopeItems": [
      {
        "category": "PROFILE_DATA",
        "fieldName": "姓名",
        "isIncluded": true
      }
    ]
  }' | python3 -m json.tool
echo ""

echo "========================================"
echo "异常场景测试完成！"
echo "========================================"
