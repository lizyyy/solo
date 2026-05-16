#!/bin/bash

BASE_URL="http://localhost:8080/api/v1"

echo "========================================"
echo "隐私导出同意API 测试脚本"
echo "========================================"
echo ""

echo "1. 查询所有有效的同意版本"
curl -s "$BASE_URL/consent-versions/active" | python3 -m json.tool
echo ""

echo "2. 创建导出请求"
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/export-requests" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER001",
    "userName": "张三",
    "userEmail": "zhangsan@example.com",
    "userPhone": "13800138000",
    "consentVersionCode": "PRIVACY-V1.0",
    "consentSignature": "SIG_20240516_001",
    "createdBy": "admin",
    "originalInput": "{\"requestSource\":\"web\",\"userAgent\":\"Chrome/120\"}",
    "scopeItems": [
      {
        "category": "PROFILE_DATA",
        "fieldName": "姓名",
        "fieldDescription": "用户注册时填写的真实姓名",
        "isIncluded": true
      },
      {
        "category": "PROFILE_DATA",
        "fieldName": "性别",
        "fieldDescription": "用户性别",
        "isIncluded": true
      },
      {
        "category": "CONTACT_DATA",
        "fieldName": "电子邮箱",
        "fieldDescription": "联系用电子邮箱",
        "isIncluded": true
      },
      {
        "category": "CONTACT_DATA",
        "fieldName": "手机号码",
        "fieldDescription": "联系用手机号码",
        "isIncluded": true
      },
      {
        "category": "TRANSACTION_DATA",
        "fieldName": "订单记录",
        "fieldDescription": "历史交易订单信息",
        "isIncluded": true
      }
    ]
  }')

echo "$CREATE_RESPONSE" | python3 -m json.tool
echo ""

REQUEST_NO=$(echo "$CREATE_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['requestNo'])")
echo "生成的请求编号: $REQUEST_NO"
echo ""

echo "3. 查询导出请求详情"
curl -s "$BASE_URL/export-requests/$REQUEST_NO" | python3 -m json.tool
echo ""

echo "4. 查询审批节点"
curl -s "$BASE_URL/export-requests/$REQUEST_NO/approval-nodes" | python3 -m json.tool
echo ""

echo "5. 查询导出范围项"
curl -s "$BASE_URL/export-requests/$REQUEST_NO/scope-items" | python3 -m json.tool
echo ""

echo "6. 状态流转: DRAFT -> PENDING_CONSENT_VALIDATION"
curl -s -X POST "$BASE_URL/export-requests/$REQUEST_NO/transition" \
  -H "Content-Type: application/json" \
  -d '{
    "targetStatus": "PENDING_CONSENT_VALIDATION",
    "reason": "提交同意版本校验",
    "operator": "system",
    "processingConclusion": "请求数据完整，进入同意版本校验阶段"
  }' | python3 -m json.tool
echo ""

echo "7. 状态流转: PENDING_CONSENT_VALIDATION -> CONSENT_VALIDATED"
curl -s -X POST "$BASE_URL/export-requests/$REQUEST_NO/transition" \
  -H "Content-Type: application/json" \
  -d '{
    "targetStatus": "CONSENT_VALIDATED",
    "reason": "同意版本校验通过",
    "operator": "system",
    "processingConclusion": "PRIVACY-V1.0版本在有效期内，签名验证通过"
  }' | python3 -m json.tool
echo ""

echo "8. 状态流转: CONSENT_VALIDATED -> PENDING_LEGAL_APPROVAL"
curl -s -X POST "$BASE_URL/export-requests/$REQUEST_NO/transition" \
  -H "Content-Type: application/json" \
  -d '{
    "targetStatus": "PENDING_LEGAL_APPROVAL",
    "reason": "进入法务审批阶段",
    "operator": "system",
    "processingConclusion": "同意版本校验完成，进入法务审批"
  }' | python3 -m json.tool
echo ""

echo "9. 状态流转: PENDING_LEGAL_APPROVAL -> PENDING_SCOPE_VALIDATION"
curl -s -X POST "$BASE_URL/export-requests/$REQUEST_NO/transition" \
  -H "Content-Type: application/json" \
  -d '{
    "targetStatus": "PENDING_SCOPE_VALIDATION",
    "reason": "法务审批通过",
    "operator": "legal_officer_001",
    "processingConclusion": "导出范围符合《个人信息保护法》要求，审批通过"
  }' | python3 -m json.tool
echo ""

echo "10. 状态流转: PENDING_SCOPE_VALIDATION -> SCOPE_VALIDATED"
curl -s -X POST "$BASE_URL/export-requests/$REQUEST_NO/transition" \
  -H "Content-Type: application/json" \
  -d '{
    "targetStatus": "SCOPE_VALIDATED",
    "reason": "导出范围校验通过",
    "operator": "system",
    "processingConclusion": "所有字段均为可读且在同意范围内"
  }' | python3 -m json.tool
echo ""

echo "11. 状态流转: SCOPE_VALIDATED -> READY_FOR_PACKAGING"
curl -s -X POST "$BASE_URL/export-requests/$REQUEST_NO/transition" \
  -H "Content-Type: application/json" \
  -d '{
    "targetStatus": "READY_FOR_PACKAGING",
    "reason": "准备打包",
    "operator": "system",
    "processingConclusion": "范围校验完成，创建打包任务"
  }' | python3 -m json.tool
echo ""

echo "12. 查询打包任务"
curl -s "$BASE_URL/export-requests/$REQUEST_NO/packaging-task" | python3 -m json.tool
echo ""

echo "13. 状态流转: READY_FOR_PACKAGING -> PACKAGING_IN_PROGRESS"
curl -s -X POST "$BASE_URL/export-requests/$REQUEST_NO/transition" \
  -H "Content-Type: application/json" \
  -d '{
    "targetStatus": "PACKAGING_IN_PROGRESS",
    "reason": "开始打包",
    "operator": "system",
    "processingConclusion": "打包程序启动"
  }' | python3 -m json.tool
echo ""

echo "14. 状态流转: PACKAGING_IN_PROGRESS -> PACKAGING_COMPLETED"
curl -s -X POST "$BASE_URL/export-requests/$REQUEST_NO/transition" \
  -H "Content-Type: application/json" \
  -d '{
    "targetStatus": "PACKAGING_COMPLETED",
    "reason": "打包完成",
    "operator": "system",
    "processingConclusion": "文件打包完成，共5个字段，大小2.3MB，MD5校验通过"
  }' | python3 -m json.tool
echo ""

echo "15. 状态流转: PACKAGING_COMPLETED -> READY_FOR_DELIVERY"
curl -s -X POST "$BASE_URL/export-requests/$REQUEST_NO/transition" \
  -H "Content-Type: application/json" \
  -d '{
    "targetStatus": "READY_FOR_DELIVERY",
    "reason": "准备交付",
    "operator": "system",
    "processingConclusion": "打包审核通过，创建交付记录"
  }' | python3 -m json.tool
echo ""

echo "16. 查询交付记录"
curl -s "$BASE_URL/export-requests/$REQUEST_NO/delivery-record" | python3 -m json.tool
echo ""

echo "17. 状态流转: READY_FOR_DELIVERY -> DELIVERY_IN_PROGRESS"
curl -s -X POST "$BASE_URL/export-requests/$REQUEST_NO/transition" \
  -H "Content-Type: application/json" \
  -d '{
    "targetStatus": "DELIVERY_IN_PROGRESS",
    "reason": "开始交付",
    "operator": "system",
    "processingConclusion": "发送下载链接邮件"
  }' | python3 -m json.tool
echo ""

echo "18. 状态流转: DELIVERY_IN_PROGRESS -> DELIVERED"
curl -s -X POST "$BASE_URL/export-requests/$REQUEST_NO/transition" \
  -H "Content-Type: application/json" \
  -d '{
    "targetStatus": "DELIVERED",
    "reason": "用户已接收",
    "operator": "system",
    "processingConclusion": "用户已点击下载链接，文件成功交付"
  }' | python3 -m json.tool
echo ""

echo "19. 状态流转: DELIVERED -> COMPLETED"
curl -s -X POST "$BASE_URL/export-requests/$REQUEST_NO/transition" \
  -H "Content-Type: application/json" \
  -d '{
    "targetStatus": "COMPLETED",
    "reason": "流程完成",
    "operator": "system",
    "processingConclusion": "个人数据导出流程圆满完成"
  }' | python3 -m json.tool
echo ""

echo "========================================"
echo "测试流程完成！"
echo "========================================"
