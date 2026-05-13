#!/bin/bash

BASE_URL="http://localhost:8000/api/v1"

echo "=== 异常工单归因 API 完整流程测试"
echo "===================================="
echo ""

echo "1. 健康检查"
echo "------------"
curl -s "http://localhost:8000/health" | python3 -m json.tool
echo ""

echo "2. 创建归属规则"
echo "----------------"
curl -s -X POST "$BASE_URL/attribution-rules" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "数据库连接错误",
    "description": "匹配数据库连接超时或连接池耗尽错误",
    "error_code_pattern": "DB_500|CONN_.*",
    "api_path_pattern": "/api/.*",
    "keyword_pattern": "数据库|连接|超时|connection|connection pool",
    "root_cause_tag": "数据库问题",
    "assignee": "DBA团队",
    "priority": 100
  }' | python3 -m json.tool
echo ""

curl -s -X POST "$BASE_URL/attribution-rules" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "用户认证错误",
    "description": "匹配token失效或权限不足",
    "error_code_pattern": "AUTH_401|AUTH_403",
    "api_path_pattern": "/auth/.*",
    "keyword_pattern": "token|认证|权限|unauthorized|forbidden",
    "root_cause_tag": "认证问题",
    "assignee": "安全团队",
    "priority": 90
  }' | python3 -m json.tool
echo ""

echo "3. 查询所有规则"
echo "----------------"
curl -s "$BASE_URL/attribution-rules" | python3 -m json.tool
echo ""

TIMESTAMP=$(date +%s)
echo "4. 创建工单1"
echo "-----------"
curl -s -X POST "$BASE_URL/tickets" \
  -H "Content-Type: application/json" \
  -d '{
    "idempotency_key": "ticket-001-'${TIMESTAMP}'",
    "ticket_id": "TICKET-001",
    "title": "数据库连接超时",
    "description": "用户登录时数据库连接超时，无法获取用户信息",
    "error_code": "DB_500_CONN_TIMEOUT",
    "error_message": "Connection timeout after 30s",
    "api_path": "/api/auth/login",
    "severity": "high"
  }' | python3 -m json.tool
echo ""

echo "5. 创建工单2（相似工单）"
echo "-------------------------"
curl -s -X POST "$BASE_URL/tickets" \
  -H "Content-Type: application/json" \
  -d '{
    "idempotency_key": "ticket-002-'${TIMESTAMP}'",
    "ticket_id": "TICKET-002",
    "title": "数据库连接池耗尽",
    "description": "高并发情况下数据库连接池耗尽",
    "error_code": "DB_500_CONN_POOL_EXHAUSTED",
    "error_message": "Connection pool is exhausted",
    "api_path": "/api/auth/login",
    "severity": "critical"
  }' | python3 -m json.tool
echo ""

echo "6. 重复提交测试（幂等性）"
echo "--------------------------"
curl -s -X POST "$BASE_URL/tickets" \
  -H "Content-Type: application/json" \
  -d '{
    "idempotency_key": "ticket-001-'${TIMESTAMP}'",
    "ticket_id": "TICKET-001",
    "title": "数据库连接超时 - 重复",
    "description": "重复提交测试"
  }' | python3 -m json.tool
echo ""

echo "7. 查询所有工单"
echo "----------------"
curl -s "$BASE_URL/tickets" | python3 -m json.tool
echo ""

echo "8. 工单1规则匹配"
echo "------------------"
curl -s -X POST "$BASE_URL/tickets/1/match-rules" | python3 -m json.tool
echo ""

echo "9. 工单1查找相似"
echo "--------------------"
curl -s -X POST "$BASE_URL/tickets/1/find-similar?threshold=30" | python3 -m json.tool
echo ""

echo "10. 标注根因"
echo "------------"
curl -s -X POST "$BASE_URL/root-cause-labels" \
  -H "Content-Type: application/json" \
  -d '{
    "ticket_id": 1,
    "root_cause_category": "基础设施-数据库",
    "root_cause_detail": "连接池配置过小，高并发下连接耗尽",
    "confidence_score": 95,
    "tagged_by": "系统自动"
  }' | python3 -m json.tool
echo ""

echo "11. 派单"
echo "---------"
curl -s -X POST "$BASE_URL/dispatch-records" \
  -H "Content-Type: application/json" \
  -d '{
    "ticket_id": 1,
    "assignee": "张三",
    "dispatch_note": "请排查数据库连接池配置问题"
  }' | python3 -m json.tool
echo ""

echo "12. 状态流转"
echo "------------"
curl -s -X POST "$BASE_URL/status-transitions" \
  -H "Content-Type: application/json" \
  -d '{
    "ticket_id": 1,
    "target_status": "completed",
    "reason": "问题已修复",
    "changed_by": "李四"
  }' | python3 -m json.tool
echo ""

echo "13. 状态历史"
echo "--------------"
curl -s "$BASE_URL/tickets/1/status-history" | python3 -m json.tool
echo ""

echo "14. 归因报告"
echo "-------------"
curl -s "$BASE_URL/tickets/1/report" | python3 -m json.tool
echo ""

echo "15. 异常测试 - 查询不存在的工单"
echo "-------------------------------"
curl -s "$BASE_URL/tickets/999" | python3 -m json.tool
echo ""

echo ""
echo "=== 测试完成！"
echo "查看完整的归因报告导出（再次查询结果一致。"