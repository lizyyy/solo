#!/bin/bash

BASE_URL="http://localhost:8080/api/log-retention-freeze"

echo "=== 日志留存冻结API测试脚本 ==="
echo ""

echo "1. 创建冻结申请 - 普通审计(自动生效)"
curl -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "TEST-REQ-001",
    "logTopic": "business-order-log",
    "startTime": "2024-01-01T00:00:00",
    "endTime": "2024-06-30T23:59:59",
    "freezeReason": "AUDIT_INVESTIGATION",
    "freezeReasonDetail": "Q2季度财务审计",
    "applicant": "audit-001",
    "releaseCondition": "审计报告发布后释放"
  }'
echo ""
echo ""

echo "2. 创建冻结申请 - 涉及投诉(进入待复核)"
curl -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "TEST-REQ-002",
    "logTopic": "user-payment-log",
    "startTime": "2024-04-01T00:00:00",
    "endTime": "2024-04-30T23:59:59",
    "freezeReason": "COMPLAINT_INVOLVEMENT",
    "freezeReasonDetail": "用户投诉订单金额异常，交易号: ORDER-20240415-008",
    "applicant": "complaint-dept",
    "releaseCondition": "投诉处理完成且双方确认无异议"
  }'
echo ""
echo ""

echo "3. 查询冻结记录列表"
curl -X POST "$BASE_URL/query" \
  -H "Content-Type: application/json" \
  -d '{
    "pageNum": 0,
    "pageSize": 10
  }'
echo ""
echo ""

echo "4. 根据请求ID查询"
curl -X GET "$BASE_URL/request/TEST-REQ-001"
echo ""
echo ""

echo "5. 查询合并后的时间范围"
curl -X GET "$BASE_URL/merged-time-range?logTopic=user-operation-log"
echo ""
echo ""

echo "6. 待复核状态 -> 审核通过"
echo "   注意: 需要先获取正确的ID值"
# curl -X PUT "$BASE_URL/2/status" \
#   -H "Content-Type: application/json" \
#   -d '{
#     "operator": "audit-manager",
#     "targetStatus": "ACTIVE",
#     "reviewComment": "投诉情况属实，同意冻结",
#     "operationRemark": "经理审核通过"
#   }'
echo ""

echo "7. 生成留存报告"
# curl -X POST "$BASE_URL/1/report"
echo ""

echo "8. 导出数据"
curl -X POST "$BASE_URL/export" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "ACTIVE"
  }'
echo ""
echo ""

echo "9. 人工修正"
# curl -X PUT "$BASE_URL/1/manual-correct" \
#   -H "Content-Type: application/json" \
#   -d '{
#     "operator": "admin",
#     "endTime": "2024-07-31T23:59:59",
#     "processingConclusion": "延长冻结时间一个月",
#     "correctionReason": "审计工作延期"
#   }'
echo ""

echo "10. 幂等性测试 - 重复提交相同requestId"
curl -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "TEST-REQ-001",
    "logTopic": "business-order-log",
    "startTime": "2024-01-01T00:00:00",
    "endTime": "2024-06-30T23:59:59",
    "freezeReason": "AUDIT_INVESTIGATION",
    "applicant": "audit-001"
  }'
echo ""
echo ""

echo "=== 测试完成 ==="
echo ""
echo "H2数据库控制台: http://localhost:8080/h2-console"
echo "JDBC URL: jdbc:h2:file:./data/logretention"
echo "用户名: sa"
echo "密码: (空)"