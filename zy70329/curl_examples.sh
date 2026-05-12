#!/bin/bash

BASE_URL="http://localhost:3000"

echo "=== 多渠道告警去重 API - Curl 示例 ==="
echo ""
echo "服务启动: npm start"
echo "数据库: alerts.db (SQLite)"
echo ""

echo "1. 查看当前配置"
echo "curl -X GET $BASE_URL/api/config"
echo ""

echo "2. CPU 告警 (来自监控系统)"
echo 'curl -X POST $BASE_URL/api/alerts \
  -H "Content-Type: application/json" \
  -d '{
    "source": "prometheus",
    "source_alert_id": "alert-001",
    "title": "CPU 使用率过高",
    "description": "order-service CPU 使用率达到 95%",
    "service": "order-service",
    "metric": "cpu_usage",
    "severity": "high"
  }''
echo ""

echo "3. 相同 CPU 告警重复 (将合并到同一事件，通知节流)"
echo 'curl -X POST $BASE_URL/api/alerts \
  -H "Content-Type: application/json" \
  -d '{
    "source": "prometheus",
    "source_alert_id": "alert-002",
    "title": "CPU 使用率过高",
    "description": "order-service CPU 使用率达到 98%",
    "service": "order-service",
    "metric": "cpu_usage",
    "severity": "high"
  }''
echo ""

echo "4. 同一服务不同指标 (内存告警) - 默认不合并"
echo 'curl -X POST $BASE_URL/api/alerts \
  -H "Content-Type: application/json" \
  -d '{
    "source": "prometheus",
    "source_alert_id": "alert-003",
    "title": "内存使用率过高",
    "description": "order-service 内存使用率达到 90%",
    "service": "order-service",
    "metric": "memory_usage",
    "severity": "medium"
  }''
echo ""

echo "5. 错误日志 (来自 ELK/日志平台)"
echo 'curl -X POST $BASE_URL/api/alerts \
  -H "Content-Type: application/json" \
  -d '{
    "source": "logstash",
    "source_alert_id": "log-001",
    "title": "数据库连接超时",
    "description": "order-service 连接 postgres 超时",
    "service": "order-service",
    "metric": "db_connection_timeout",
    "severity": "critical"
  }''
echo ""

echo "6. 用户投诉 (来自客服系统) - 增加影响人数"
echo 'curl -X POST $BASE_URL/api/alerts \
  -H "Content-Type: application/json" \
  -d '{
    "source": "customer-service",
    "source_alert_id": "ticket-001",
    "title": "用户无法下单",
    "description": "用户反馈订单页面无法提交",
    "service": "order-service",
    "metric": "user_feedback",
    "severity": "high",
    "affected_user_id": "user-1001",
    "affected_user_name": "张三"
  }''
echo ""

echo "7. 另一个用户投诉同一问题 - 影响人数增加到 2"
echo 'curl -X POST $BASE_URL/api/alerts \
  -H "Content-Type: application/json" \
  -d '{
    "source": "customer-service",
    "source_alert_id": "ticket-002",
    "title": "用户无法下单",
    "description": "另一个用户也反馈无法下单",
    "service": "order-service",
    "metric": "user_feedback",
    "severity": "high",
    "affected_user_id": "user-1002",
    "affected_user_name": "李四"
  }''
echo ""

echo "8. 同一用户重复投诉 - 影响人数不变"
echo 'curl -X POST $BASE_URL/api/alerts \
  -H "Content-Type: application/json" \
  -d '{
    "source": "customer-service",
    "source_alert_id": "ticket-003",
    "title": "用户无法下单",
    "description": "用户-1001再次反馈",
    "service": "order-service",
    "metric": "user_feedback",
    "severity": "high",
    "affected_user_id": "user-1001",
    "affected_user_name": "张三"
  }''
echo ""

echo "9. 确认事件"
echo 'curl -X POST $BASE_URL/api/events/<EVENT_ID>/acknowledge \
  -H "Content-Type: application/json" \
  -d '{
    "assignee": "oncall-engineer-01"
  }''
echo ""

echo "10. 确认后新证据进来 - 自动升级"
echo 'curl -X POST $BASE_URL/api/alerts \
  -H "Content-Type: application/json" \
  -d '{
    "source": "prometheus",
    "source_alert_id": "alert-004",
    "title": "CPU 使用率持续过高",
    "description": "order-service CPU 持续 100% 超过 10 分钟",
    "service": "order-service",
    "metric": "cpu_usage",
    "severity": "critical"
  }''
echo ""

echo "11. 手动升级事件"
echo 'curl -X POST $BASE_URL/api/events/<EVENT_ID>/escalate \
  -H "Content-Type: application/json" \
  -d '{
    "assignee": "senior-engineer-01",
    "reason": "影响范围扩大，需要高级工程师介入"
  }''
echo ""

echo "12. 关闭事件"
echo 'curl -X POST $BASE_URL/api/events/<EVENT_ID>/close \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "CPU 已恢复正常，重启实例后稳定",
    "actor": "oncall-engineer-01"
  }''
echo ""

echo "13. 关闭后短时间复发 (30 分钟内) - 复用同一事件"
echo 'curl -X POST $BASE_URL/api/alerts \
  -H "Content-Type: application/json" \
  -d '{
    "source": "prometheus",
    "source_alert_id": "alert-005",
    "title": "CPU 使用率再次过高",
    "description": "order-service CPU 再次达到 95%",
    "service": "order-service",
    "metric": "cpu_usage",
    "severity": "high"
  }''
echo ""

echo "14. 列出所有事件"
echo "curl -X GET $BASE_URL/api/events"
echo ""

echo "15. 列出特定状态的事件 (open/acknowledged/escalated/closed)"
echo "curl -X GET '$BASE_URL/api/events?status=open'"
echo ""

echo "16. 查询事件详情 (主事件 + 关联告警 + 通知历史 + 时间线)"
echo "curl -X GET $BASE_URL/api/events/<EVENT_ID>"
echo ""

echo "=== 使用说明 ==="
echo "1. 先启动服务: npm start"
echo "2. 按顺序执行上面的 curl 命令来测试各种场景"
echo "3. 注意将 <EVENT_ID> 替换为实际返回的事件 ID"
echo ""
echo "=== 核心规则说明 ==="
echo "- 指纹计算: service + source (+ metric, + affected_user_id)"
echo "- 合并策略: 相同服务不同指标默认不合并"
echo "- 影响人数: 同一用户多次反馈不重复计数"
echo "- 通知节流: 15 分钟内同一事件只通知一次"
echo "- 确认后新证据: 自动升级并重新通知"
echo "- 复发复用: 30 分钟内复用同一事件"
