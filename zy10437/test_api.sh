#!/bin/bash

BASE_URL="http://localhost:8080/api/v1"

echo "=== 配置漂移豁免 API 测试脚本 ==="
echo ""

echo "1. 健康检查"
curl -s "$BASE_URL/health" | head -5
echo ""
echo ""

echo "2. 创建配置漂移豁免 #1 - payment-service"
curl -s -X POST "$BASE_URL/drifts" \
  -H "Content-Type: application/json" \
  -d '{
    "service_name": "payment-service",
    "config_key": "db.connection_pool.max_size",
    "expected_value": "10",
    "actual_value": "20",
    "reason": "紧急扩容应对流量高峰，预计3天后恢复",
    "reporter": "devops@example.com",
    "exemption_expiry": "'$(date -v+3d +%Y-%m-%dT%H:%M:%SZ)'",
    "report_data": "{\"change_id\": \"CR-2024-0567\", \"risk_level\": \"medium\"}"
  }' | head -20
echo ""
echo ""

echo "3. 创建配置漂移豁免 #2 - user-service"
curl -s -X POST "$BASE_URL/drifts" \
  -H "Content-Type: application/json" \
  -d '{
    "service_name": "user-service",
    "config_key": "auth.token.expire_seconds",
    "expected_value": "3600",
    "actual_value": "7200",
    "reason": "临时延长登录态有效期，配合版本发布",
    "reporter": "backend@example.com",
    "exemption_expiry": "'$(date -v+7d +%Y-%m-%dT%H:%M:%SZ)'",
    "report_data": "{\"version\": \"v2.3.1\", \"release_date\": \"2024-05-20\"}"
  }' | head -20
echo ""
echo ""

echo "4. 创建配置漂移豁免 #3 - order-service (已过期豁免时间)"
curl -s -X POST "$BASE_URL/drifts" \
  -H "Content-Type: application/json" \
  -d '{
    "service_name": "order-service",
    "config_key": "log.level",
    "expected_value": "INFO",
    "actual_value": "DEBUG",
    "reason": "调试生产问题用",
    "reporter": "sre@example.com",
    "exemption_expiry": "'$(date -v-1d +%Y-%m-%dT%H:%M:%SZ)'",
    "report_data": "{\"issue_id\": \"ISSUE-1234\"}"
  }' | head -20
echo ""
echo ""

echo "5. 重复导入 #1 (验证幂等性)"
curl -s -X POST "$BASE_URL/drifts" \
  -H "Content-Type: application/json" \
  -d '{
    "service_name": "payment-service",
    "config_key": "db.connection_pool.max_size",
    "expected_value": "10",
    "actual_value": "20",
    "reason": "紧急扩容应对流量高峰",
    "reporter": "devops@example.com",
    "exemption_expiry": "'$(date -v+3d +%Y-%m-%dT%H:%M:%SZ)'"
  }' | head -15
echo ""
echo ""

echo "6. 查询所有漂移记录"
curl -s "$BASE_URL/drifts?page=1&page_size=10" | head -30
echo ""
echo ""

echo "7. 查询单个记录 (ID=1)"
curl -s "$BASE_URL/drifts/1" | head -25
echo ""
echo ""

echo "8. 批准 ID=1 的豁免申请"
curl -s -X POST "$BASE_URL/drifts/1/review" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "APPROVED",
    "reviewer": "admin@example.com",
    "review_comment": "情况属实，批准临时豁免"
  }' | head -20
echo ""
echo ""

echo "9. 拒绝 ID=3 的豁免申请"
curl -s -X POST "$BASE_URL/drifts/3/review" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "REJECTED",
    "reviewer": "admin@example.com",
    "review_comment": "豁免时间已过期，请重新申请"
  }' | head -20
echo ""
echo ""

echo "10. 查询状态为 APPROVED 的记录"
curl -s "$BASE_URL/drifts?status=APPROVED" | head -25
echo ""
echo ""

echo "11. 人工修正 ID=2"
curl -s -X POST "$BASE_URL/drifts/2/fix" \
  -H "Content-Type: application/json" \
  -d '{
    "new_expected_value": "7200",
    "new_actual_value": "7200",
    "fix_reason": "更新预期值以匹配实际配置，配置已标准化",
    "operator": "sre@example.com"
  }' | head -25
echo ""
echo ""

echo "12. 查看 ID=1 的操作历史"
curl -s "$BASE_URL/drifts/1/history"
echo ""
echo ""

echo "13. 检查并标记过期豁免"
curl -s -X POST "$BASE_URL/maintenance/check-expired"
echo ""
echo ""

echo "14. 导出所有记录"
curl -s "$BASE_URL/drifts/export" | head -30
echo ""
echo ""

echo "15. 按服务名查询 - payment-service"
curl -s "$BASE_URL/drifts?service_name=payment-service" | head -25
echo ""
echo ""

echo "16. 查询已补偿的记录"
curl -s "$BASE_URL/drifts?status=COMPENSATED" | head -25
echo ""
echo ""

echo "=== 测试完成 ==="
echo ""
echo "数据库文件: ./drift_exemption.db"
echo "重启服务后数据仍然保留"
