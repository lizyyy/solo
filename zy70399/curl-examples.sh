#!/bin/bash

BASE_URL="http://localhost:3000/api/v1"

echo "========================================"
echo "服务级降噪通知 API - curl 示例"
echo "========================================"
echo ""

echo "--- 1. 健康检查 ---"
curl -s "$BASE_URL/health" | python3 -m json.tool
echo ""

echo "--- 2. 注册服务 ---"
curl -s -X POST "$BASE_URL/services" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "order-service",
    "name": "订单服务",
    "description": "处理订单和支付"
  }' | python3 -m json.tool
echo ""

echo "--- 3. 配置租户降噪规则 ---"
curl -s -X POST "$BASE_URL/rules" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceId": "order-service",
    "tenantId": "tenant-alibaba",
    "silenceWindowMinutes": 30,
    "mergeSimilarEnabled": true,
    "mergeSimilarMinutes": 15,
    "upgradeThreshold": 3,
    "upgradeToSeverity": "critical",
    "highSeverityBypass": true,
    "notifyOnRecurrence": true,
    "sendSummaryAfterSilence": true
  }' | python3 -m json.tool
echo ""

echo "--- 4. 场景1: 普通重复通知被合并 ---"
echo ""
echo "    第1条通知（首次发送）:"
RESULT1=$(curl -s -X POST "$BASE_URL/notifications" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceId": "order-service",
    "serviceName": "订单服务",
    "tenantId": "tenant-alibaba",
    "severity": "warning",
    "messageKey": "db_connection_timeout",
    "title": "数据库连接超时",
    "message": "连接超时 5000ms"
  }')
echo "$RESULT1" | python3 -m json.tool
GROUP_ID=$(echo "$RESULT1" | python3 -c "import sys, json; print(json.load(sys.stdin)['groupId'])")
echo ""

echo "    第2条通知（静默窗口内，被压制）:"
curl -s -X POST "$BASE_URL/notifications" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceId": "order-service",
    "tenantId": "tenant-alibaba",
    "severity": "warning",
    "messageKey": "db_connection_timeout",
    "title": "数据库连接超时",
    "message": "连接超时 5000ms"
  }' | python3 -m json.tool
echo ""

echo "    第3条通知（静默窗口内，被压制）:"
curl -s -X POST "$BASE_URL/notifications" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceId": "order-service",
    "tenantId": "tenant-alibaba",
    "severity": "warning",
    "messageKey": "db_connection_timeout",
    "title": "数据库连接超时",
    "message": "连接超时 5000ms"
  }' | python3 -m json.tool
echo ""

echo "--- 5. 场景2: 严重通知立即发送（绕过静默） ---"
echo ""
echo "    发送 error 级别通知:"
curl -s -X POST "$BASE_URL/notifications" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceId": "order-service",
    "tenantId": "tenant-alibaba",
    "severity": "error",
    "messageKey": "payment_failed",
    "title": "支付失败",
    "message": "订单 12345 支付失败，金额 $99.99"
  }' | python3 -m json.tool
echo ""

echo "    发送 critical 级别通知:"
curl -s -X POST "$BASE_URL/notifications" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceId": "order-service",
    "tenantId": "tenant-alibaba",
    "severity": "critical",
    "messageKey": "service_down",
    "title": "服务不可用",
    "message": "订单服务实例全部宕机"
  }' | python3 -m json.tool
echo ""

echo "--- 6. 场景3: 租户连续失败升级 ---"
echo ""
echo "    先为另一个租户配置较低的升级阈值:"
curl -s -X POST "$BASE_URL/rules" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceId": "order-service",
    "tenantId": "tenant-tencent",
    "upgradeThreshold": 2,
    "upgradeToSeverity": "critical"
  }' | python3 -m json.tool
echo ""

echo "    第1条 warning（不升级）:"
curl -s -X POST "$BASE_URL/notifications" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceId": "order-service",
    "tenantId": "tenant-tencent",
    "severity": "warning",
    "messageKey": "retry_exhausted",
    "title": "重试耗尽",
    "message": "订单创建重试失败"
  }' | python3 -m json.tool
echo ""

echo "    第2条 warning（达到阈值，升级到 critical）:"
curl -s -X POST "$BASE_URL/notifications" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceId": "order-service",
    "tenantId": "tenant-tencent",
    "severity": "warning",
    "messageKey": "retry_exhausted",
    "title": "重试耗尽",
    "message": "订单创建重试失败"
  }' | python3 -m json.tool
echo ""

echo "--- 7. 场景4: 确认后复发（新证据恢复通知） ---"
echo ""
echo "    发送初始通知:"
RESULT2=$(curl -s -X POST "$BASE_URL/notifications" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceId": "order-service",
    "tenantId": "tenant-alibaba",
    "severity": "warning",
    "messageKey": "login_attempts",
    "title": "异常登录尝试",
    "message": "检测到多次登录失败"
  }')
echo "$RESULT2" | python3 -m json.tool
GROUP_ID2=$(echo "$RESULT2" | python3 -c "import sys, json; print(json.load(sys.stdin)['groupId'])")
echo ""

echo "    操作员确认通知:"
curl -s -X POST "$BASE_URL/notifications/$GROUP_ID2/confirm" \
  -H "Content-Type: application/json" \
  -d '{
    "confirmedBy": "operator-alice"
  }' | python3 -m json.tool
echo ""

echo "    复发但无新证据（被压制）:"
curl -s -X POST "$BASE_URL/notifications" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceId": "order-service",
    "tenantId": "tenant-alibaba",
    "severity": "warning",
    "messageKey": "login_attempts",
    "title": "异常登录尝试",
    "message": "检测到多次登录失败"
  }' | python3 -m json.tool
echo ""

echo "    复发但有新证据（重新通知）:"
curl -s -X POST "$BASE_URL/notifications" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceId": "order-service",
    "tenantId": "tenant-alibaba",
    "severity": "warning",
    "messageKey": "login_attempts",
    "title": "异常登录尝试",
    "message": "检测到多次登录失败",
    "evidence": {
      "suspiciousIPs": ["192.168.1.100", "10.0.0.50"],
      "attackType": "brute-force",
      "targetAccounts": ["admin", "root", "user1"]
    }
  }' | python3 -m json.tool
echo ""

echo "--- 8. 查询接口 ---"
echo ""
echo "    获取活跃通知组:"
curl -s "$BASE_URL/notifications/active?serviceId=order-service" | python3 -m json.tool
echo ""

echo "    获取通知组详情:"
curl -s "$BASE_URL/notifications/$GROUP_ID" | python3 -m json.tool
echo ""

echo "    获取发送历史:"
curl -s "$BASE_URL/history?serviceId=order-service" | python3 -m json.tool
echo ""

echo "--- 9. 降噪报告 ---"
echo ""
echo "    生成降噪报告（过去24小时）:"
curl -s "$BASE_URL/reports/noise-reduction?timeRangeMinutes=1440" | python3 -m json.tool
echo ""

echo "--- 10. 关闭通知 ---"
echo ""
echo "    关闭第一个通知组:"
curl -s -X POST "$BASE_URL/notifications/$GROUP_ID/close" \
  -H "Content-Type: application/json" \
  -d '{
    "closedBy": "operator-bob"
  }' | python3 -m json.tool
echo ""

echo "========================================"
echo "所有示例执行完毕"
echo "========================================"
