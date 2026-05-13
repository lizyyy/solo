#!/bin/bash

BASE_URL="http://localhost:3000/api/v1"

echo "=========================================="
echo "服务退役依赖 API - CURL 示例"
echo "=========================================="
echo ""

echo "=== 1. 健康检查 ==="
curl -s "${BASE_URL}/../health"
echo ""
echo ""

echo "=== 2. 场景一：创建可退役服务申请 ==="
APP1=$(curl -s -X POST "${BASE_URL}/applications" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceName": "legacy-order-service-v1",
    "serviceVersion": "1.0.0",
    "description": "订单服务老版本，计划退役",
    "planedRetirementDate": "2026-06-01T00:00:00.000Z",
    "createdBy": "admin@company.com"
  }')
echo "$APP1"
APP1_ID=$(echo "$APP1" | node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync('/dev/stdin','utf8'));console.log(d.id)")
echo "应用ID: $APP1_ID"
echo ""

echo "=== 为可退役服务导入历史数据（31天前的调用，不影响退役） ==="
curl -s -X POST "${BASE_URL}/applications/${APP1_ID}/call-logs" \
  -H "Content-Type: application/json" \
  -d '[{
    "callerService": "shopping-cart",
    "calledEndpoint": "/api/v1/orders/create",
    "callTime": "2026-04-10T10:00:00.000Z",
    "requestCount": 150,
    "successRate": 0.99
  }]'
echo ""
echo ""

echo "=== 导入已完成的任务 ==="
curl -s -X POST "${BASE_URL}/applications/${APP1_ID}/tasks" \
  -H "Content-Type: application/json" \
  -d '[{
    "taskName": "订单服务迁移至v2",
    "taskType": "FEATURE",
    "isCritical": true,
    "migrationStatus": "COMPLETED",
    "responsiblePerson": "张三"
  }]'
echo ""
echo ""

echo "=== 导入已关闭的告警 ==="
curl -s -X POST "${BASE_URL}/applications/${APP1_ID}/alerts" \
  -H "Content-Type: application/json" \
  -d '[{
    "alertName": "高延迟告警",
    "alertType": "PERFORMANCE",
    "severity": "MEDIUM",
    "status": "RESOLVED",
    "responsiblePerson": "李四"
  }]'
echo ""
echo ""

echo "=== 导入文档链接 ==="
curl -s -X POST "${BASE_URL}/applications/${APP1_ID}/documents" \
  -H "Content-Type: application/json" \
  -d '[{
    "linkName": "迁移方案文档",
    "linkUrl": "https://wiki.company.com/docs/migration-order-v2",
    "documentType": "MIGRATION_PLAN"
  }]'
echo ""
echo ""

echo "=== 添加负责人并确认 ==="
CONFS1=$(curl -s -X POST "${BASE_URL}/applications/${APP1_ID}/confirmations" \
  -H "Content-Type: application/json" \
  -d '[{
    "personName": "王五",
    "personEmail": "wangwu@company.com",
    "role": "SERVICE_OWNER"
  }]')
echo "$CONFS1"
CONF1_ID=$(echo "$CONFS1" | node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync('/dev/stdin','utf8'));console.log(d.confirmations[0].id)")
echo "确认ID: $CONF1_ID"

curl -s -X POST "${BASE_URL}/applications/${APP1_ID}/confirmations/${CONF1_ID}/confirm"
echo ""
echo ""

echo "=== 查询可退役服务（应返回无阻断项，可以退役） ==="
curl -s "${BASE_URL}/applications/${APP1_ID}"
echo ""
echo ""

echo "=== 2. 场景二：创建仍有调用的服务 ==="
APP2=$(curl -s -X POST "${BASE_URL}/applications" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceName": "legacy-user-auth",
    "serviceVersion": "1.0.0",
    "description": "用户认证服务，仍有调用",
    "planedRetirementDate": "2026-05-20T00:00:00.000Z",
    "createdBy": "admin@company.com"
  }')
echo "$APP2"
APP2_ID=$(echo "$APP2" | node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync('/dev/stdin','utf8'));console.log(d.id)")
echo "应用ID: $APP2_ID"
echo ""

echo "=== 导入最近3天的调用日志 ==="
curl -s -X POST "${BASE_URL}/applications/${APP2_ID}/call-logs" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "callerService": "gateway-api",
      "calledEndpoint": "/auth/login",
      "callTime": "2026-05-11T08:30:00.000Z",
      "requestCount": 2500,
      "successRate": 0.98,
      "averageLatency": 120
    },
    {
      "callerService": "mobile-app",
      "calledEndpoint": "/auth/verify",
      "callTime": "2026-05-12T14:20:00.000Z",
      "requestCount": 800,
      "successRate": 0.95,
      "averageLatency": 200
    },
    {
      "callerService": "gateway-api",
      "calledEndpoint": "/auth/token",
      "callTime": "2026-05-13T09:15:00.000Z",
      "requestCount": 1200,
      "successRate": 0.97,
      "averageLatency": 80
    }
  ]'
echo ""
echo ""

echo "=== 导入已完成任务、已关闭告警、文档 ==="
curl -s -X POST "${BASE_URL}/applications/${APP2_ID}/tasks" \
  -H "Content-Type: application/json" \
  -d '[{"taskName":"迁移至OAuth2","taskType":"FEATURE","isCritical":true,"migrationStatus":"COMPLETED","responsiblePerson":"赵六"}]'
echo ""

curl -s -X POST "${BASE_URL}/applications/${APP2_ID}/alerts" \
  -H "Content-Type: application/json" \
  -d '[{"alertName":"认证失败率过高","alertType":"ERROR","severity":"HIGH","status":"RESOLVED","responsiblePerson":"赵六"}]'
echo ""

curl -s -X POST "${BASE_URL}/applications/${APP2_ID}/documents" \
  -H "Content-Type: application/json" \
  -d '[{"linkName":"认证迁移指南","linkUrl":"https://wiki.company.com/docs/auth-migration","documentType":"MIGRATION_PLAN"}]'
echo ""

CONFS2=$(curl -s -X POST "${BASE_URL}/applications/${APP2_ID}/confirmations" \
  -H "Content-Type: application/json" \
  -d '[{"personName":"赵六","personEmail":"zhaoliu@company.com","role":"SERVICE_OWNER"}]')
CONF2_ID=$(echo "$CONFS2" | node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync('/dev/stdin','utf8'));console.log(d.confirmations[0].id)")
curl -s -X POST "${BASE_URL}/applications/${APP2_ID}/confirmations/${CONF2_ID}/confirm"
echo ""
echo ""

echo "=== 查询仍有调用的服务（应返回阻断项：RECENT_CALLS） ==="
curl -s "${BASE_URL}/applications/${APP2_ID}"
echo ""
echo ""

echo "=== 3. 场景三：创建任务未迁移的服务 ==="
APP3=$(curl -s -X POST "${BASE_URL}/applications" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceName": "legacy-payment-gateway",
    "serviceVersion": "1.0.0",
    "description": "支付网关服务，关键任务未迁移",
    "planedRetirementDate": "2026-05-25T00:00:00.000Z",
    "createdBy": "admin@company.com"
  }')
echo "$APP3"
APP3_ID=$(echo "$APP3" | node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync('/dev/stdin','utf8'));console.log(d.id)")
echo "应用ID: $APP3_ID"
echo ""

echo "=== 导入未完成的关键任务 ==="
curl -s -X POST "${BASE_URL}/applications/${APP3_ID}/tasks" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "taskName": "支付宝支付迁移至新网关",
      "taskType": "PAYMENT",
      "cronExpression": "0 */30 * * * *",
      "isCritical": true,
      "migrationStatus": "IN_PROGRESS",
      "responsiblePerson": "钱七",
      "targetService": "new-payment-gateway"
    },
    {
      "taskName": "微信支付定时对账任务",
      "taskType": "SCHEDULED_JOB",
      "cronExpression": "0 0 2 * * *",
      "isCritical": true,
      "migrationStatus": "PENDING",
      "responsiblePerson": "钱七",
      "targetService": ""
    }
  ]'
echo ""
echo ""

echo "=== 导入历史调用（35天前，无影响） ==="
curl -s -X POST "${BASE_URL}/applications/${APP3_ID}/call-logs" \
  -H "Content-Type: application/json" \
  -d '[{
    "callerService": "checkout-page",
    "calledEndpoint": "/payments/alipay/create",
    "callTime": "2026-04-05T10:00:00.000Z",
    "requestCount": 500,
    "successRate": 0.99
  }]'
echo ""

echo "=== 导入告警和文档 ==="
curl -s -X POST "${BASE_URL}/applications/${APP3_ID}/alerts" \
  -H "Content-Type: application/json" \
  -d '[{"alertName":"支付超时告警","alertType":"TIMEOUT","severity":"HIGH","status":"RESOLVED","responsiblePerson":"钱七"}]'
echo ""

curl -s -X POST "${BASE_URL}/applications/${APP3_ID}/documents" \
  -H "Content-Type: application/json" \
  -d '[{"linkName":"支付网关迁移方案","linkUrl":"https://wiki.company.com/docs/payment-migration","documentType":"MIGRATION_PLAN"}]'
echo ""

CONFS3=$(curl -s -X POST "${BASE_URL}/applications/${APP3_ID}/confirmations" \
  -H "Content-Type: application/json" \
  -d '[{"personName":"钱七","personEmail":"qianqi@company.com","role":"SERVICE_OWNER"}]')
CONF3_ID=$(echo "$CONFS3" | node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync('/dev/stdin','utf8'));console.log(d.confirmations[0].id)")
curl -s -X POST "${BASE_URL}/applications/${APP3_ID}/confirmations/${CONF3_ID}/confirm"
echo ""
echo ""

echo "=== 查询任务未迁移服务（应返回阻断项：CRITICAL_TASKS_NOT_MIGRATED） ==="
curl -s "${BASE_URL}/applications/${APP3_ID}"
echo ""
echo ""

echo "=== 4. 场景四：负责人未确认的服务 ==="
APP4=$(curl -s -X POST "${BASE_URL}/applications" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceName": "legacy-notification-svc",
    "serviceVersion": "1.0.0",
    "description": "通知服务，负责人未确认",
    "planedRetirementDate": "2026-05-30T00:00:00.000Z",
    "createdBy": "admin@company.com"
  }')
echo "$APP4"
APP4_ID=$(echo "$APP4" | node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync('/dev/stdin','utf8'));console.log(d.id)")
echo "应用ID: $APP4_ID"
echo ""

echo "=== 导入历史数据（无调用、任务已完成、告警已关闭） ==="
curl -s -X POST "${BASE_URL}/applications/${APP4_ID}/call-logs" \
  -H "Content-Type: application/json" \
  -d '[{
    "callerService": "user-portal",
    "calledEndpoint": "/notifications/email",
    "callTime": "2026-04-01T10:00:00.000Z",
    "requestCount": 100,
    "successRate": 0.99
  }]'
echo ""

curl -s -X POST "${BASE_URL}/applications/${APP4_ID}/tasks" \
  -H "Content-Type: application/json" \
  -d '[{"taskName":"通知系统迁移","taskType":"FEATURE","isCritical":true,"migrationStatus":"COMPLETED","responsiblePerson":"孙八"}]'
echo ""

curl -s -X POST "${BASE_URL}/applications/${APP4_ID}/alerts" \
  -H "Content-Type: application/json" \
  -d '[{"alertName":"通知发送失败","alertType":"ERROR","severity":"MEDIUM","status":"RESOLVED","responsiblePerson":"孙八"}]'
echo ""

curl -s -X POST "${BASE_URL}/applications/${APP4_ID}/documents" \
  -H "Content-Type: application/json" \
  -d '[{"linkName":"通知服务迁移指南","linkUrl":"https://wiki.company.com/docs/notification-migration","documentType":"MIGRATION_PLAN"}]'
echo ""

echo "=== 添加负责人但不确认 ==="
curl -s -X POST "${BASE_URL}/applications/${APP4_ID}/confirmations" \
  -H "Content-Type: application/json" \
  -d '[{
    "personName": "孙八",
    "personEmail": "sunba@company.com",
    "role": "SERVICE_OWNER"
  }]'
echo ""
echo ""

echo "=== 查询未确认服务（应返回阻断项：CONFIRMATIONS_PENDING） ==="
curl -s "${BASE_URL}/applications/${APP4_ID}"
echo ""
echo ""

echo "=== 5. 场景五：关闭可退役服务并查看归档报告 ==="
echo "=== 尝试关闭可退役服务 ==="
curl -s -X POST "${BASE_URL}/applications/${APP1_ID}/close"
echo ""
echo ""

echo "=== 查询已关闭服务的归档报告 ==="
curl -s "${BASE_URL}/applications/${APP1_ID}/reports"
echo ""
echo ""

echo "=== 查看最新报告（应为归档报告） ==="
curl -s "${BASE_URL}/applications/${APP1_ID}/reports/latest"
echo ""
echo ""

echo "=== 再次查询已退役服务 ==="
curl -s "${BASE_URL}/applications/${APP1_ID}"
echo ""
echo ""

echo "=== 6. 场景六：尝试关闭有阻断项的服务（应失败） ==="
echo "=== 尝试关闭仍有调用的服务 ==="
curl -s -X POST "${BASE_URL}/applications/${APP2_ID}/close"
echo ""
echo ""

echo "=== 7. 查询所有应用列表 ==="
curl -s "${BASE_URL}/applications"
echo ""
echo ""

echo "=========================================="
echo "示例执行完成"
echo "=========================================="
