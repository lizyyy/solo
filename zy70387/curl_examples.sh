#!/bin/bash

BASE_URL="http://localhost:8000/api/v1"

echo "=== 任务日志采样 API - curl 示例 ==="
echo ""

echo "=== 1. 创建采样规则 ==="
echo ""

echo "--- 创建默认规则（普通租户，采样率 10%）---"
curl -X POST "$BASE_URL/rules" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "default_rule",
    "description": "默认规则：普通租户数据同步任务",
    "task_type": "data_sync",
    "is_vip_tenant": false,
    "sample_rate": 0.1,
    "dedup_enabled": true,
    "dedup_window_seconds": 300,
    "context_window_before": 3,
    "context_window_after": 1,
    "retention_days": 7,
    "priority": 10,
    "is_active": true
  }'
echo ""
echo ""

echo "--- 创建 VIP 租户规则（采样率 80%）---"
curl -X POST "$BASE_URL/rules" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "vip_tenant_rule",
    "description": "VIP 租户规则：更高采样率",
    "tenant_id": "tenant_vip_001",
    "is_vip_tenant": true,
    "sample_rate": 0.8,
    "dedup_enabled": true,
    "dedup_window_seconds": 300,
    "context_window_before": 5,
    "context_window_after": 2,
    "retention_days": 30,
    "priority": 100,
    "is_active": true
  }'
echo ""
echo ""

echo "--- 创建高优先级任务规则（采样率 50%）---"
curl -X POST "$BASE_URL/rules" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "payment_task_rule",
    "description": "支付任务：更高采样率",
    "task_type": "payment",
    "sample_rate": 0.5,
    "retention_days": 14,
    "priority": 50,
    "is_active": true
  }'
echo ""
echo ""

echo "=== 2. 查看所有规则 ==="
curl "$BASE_URL/rules"
echo ""
echo ""

echo "=== 3. 普通成功日志采样示例 ==="
echo ""

echo "--- 普通租户成功日志（采样率 10%，可能被丢弃）---"
for i in {1..5}; do
  echo "尝试写入第 $i 条成功日志:"
  curl -X POST "$BASE_URL/logs" \
    -H "Content-Type: application/json" \
    -d "{
      \"task_id\": \"task_normal_$(date +%s)\",
      \"tenant_id\": \"tenant_normal_001\",
      \"task_type\": \"data_sync\",
      \"log_level\": \"INFO\",
      \"message\": \"数据同步成功，处理记录数：$((RANDOM % 1000))\",
      \"is_success\": true,
      \"is_failure\": false
    }"
  echo ""
  sleep 0.5
done
echo ""

echo "=== 4. 失败日志全量保留示例 ==="
echo ""

echo "--- 先写入几条成功日志作为上下文 ---"
TASK_ID="task_failure_demo_$(date +%s)"
for i in {1..3}; do
  curl -X POST "$BASE_URL/logs" \
    -H "Content-Type: application/json" \
    -d "{
      \"task_id\": \"$TASK_ID\",
      \"tenant_id\": \"tenant_normal_001\",
      \"task_type\": \"data_sync\",
      \"log_level\": \"INFO\",
      \"message\": \"步骤 $i：准备数据中...\",
      \"is_success\": true,
      \"is_failure\": false
    }"
  echo ""
  sleep 0.3
done

echo ""
echo "--- 写入失败日志（全量保留）---"
curl -X POST "$BASE_URL/logs" \
  -H "Content-Type: application/json" \
  -d "{
    \"task_id\": \"$TASK_ID\",
    \"tenant_id\": \"tenant_normal_001\",
    \"task_type\": \"data_sync\",
    \"log_level\": \"ERROR\",
    \"message\": \"数据库连接超时：Connection refused\",
    \"is_success\": false,
    \"is_failure\": true
  }"
echo ""
echo ""

echo "--- 写入失败后的上下文日志 ---"
curl -X POST "$BASE_URL/logs" \
  -H "Content-Type: application/json" \
  -d "{
    \"task_id\": \"$TASK_ID\",
    \"tenant_id\": \"tenant_normal_001\",
    \"task_type\": \"data_sync\",
    \"log_level\": \"INFO\",
    \"message\": \"尝试重新连接...\",
    \"is_success\": true,
    \"is_failure\": false
  }"
echo ""
echo ""

echo "=== 5. VIP 租户高采样示例 ==="
echo ""

echo "--- VIP 租户成功日志（采样率 80%，大概率保留）---"
for i in {1..3}; do
  echo "VIP 租户写入第 $i 条日志:"
  curl -X POST "$BASE_URL/logs" \
    -H "Content-Type: application/json" \
    -d "{
      \"task_id\": \"task_vip_$(date +%s)_$i\",
      \"tenant_id\": \"tenant_vip_001\",
      \"task_type\": \"data_sync\",
      \"log_level\": \"INFO\",
      \"message\": \"VIP 数据同步：批次 $((RANDOM % 100))\",
      \"is_success\": true,
      \"is_failure\": false
    }"
  echo ""
  sleep 0.3
done
echo ""

echo "=== 6. 查看已保存的日志 ==="
echo ""

echo "--- 所有失败日志 ---"
curl "$BASE_URL/logs?is_failure=true"
echo ""
echo ""

echo "--- VIP 租户日志 ---"
curl "$BASE_URL/logs?tenant_id=tenant_vip_001"
echo ""
echo ""

echo "=== 7. 查询报告 ==="
echo ""

echo "--- 获取采样报告 ---"
curl "$BASE_URL/reports"
echo ""
echo ""

echo "=== 8. 过期日志清理 ==="
echo ""

echo "--- 查看清理概要 ---"
curl "$BASE_URL/cleanup/summary"
echo ""
echo ""

echo "--- 试运行清理（dry_run=true，不实际删除）---"
curl -X POST "$BASE_URL/cleanup?dry_run=true"
echo ""
echo ""

echo "=== 9. 重复日志去重示例 ==="
echo ""

echo "--- 写入第一条日志 ---"
curl -X POST "$BASE_URL/logs" \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "task_dedup_demo",
    "tenant_id": "tenant_normal_001",
    "task_type": "data_sync",
    "log_level": "WARN",
    "message": "内存使用超过80%",
    "is_success": true,
    "is_failure": false
  }'
echo ""

echo "--- 写入相同内容日志（在去重窗口内，应该被丢弃）---"
curl -X POST "$BASE_URL/logs" \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "task_dedup_demo",
    "tenant_id": "tenant_normal_001",
    "task_type": "data_sync",
    "log_level": "WARN",
    "message": "内存使用超过80%",
    "is_success": true,
    "is_failure": false
  }'
echo ""
echo ""

echo "=== 10. 规则调整示例（只影响新日志）==="
echo ""

echo "--- 先看当前规则 ---"
curl "$BASE_URL/rules?only_active=true"
echo ""
echo ""

echo "--- 更新默认规则采样率为 20% ---"
curl -X PUT "$BASE_URL/rules/1" \
  -H "Content-Type: application/json" \
  -d '{
    "sample_rate": 0.2
  }'
echo ""
echo ""

echo "--- 新日志将使用新规则 ---"
curl -X POST "$BASE_URL/logs" \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "task_after_rule_change",
    "tenant_id": "tenant_normal_001",
    "task_type": "data_sync",
    "log_level": "INFO",
    "message": "规则更新后的日志",
    "is_success": true,
    "is_failure": false
  }'
echo ""
echo ""

echo "=== 示例完成 ==="
