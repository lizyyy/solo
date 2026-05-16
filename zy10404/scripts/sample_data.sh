#!/bin/bash

BASE_URL="http://localhost:8080/api/v1"

echo "========================================"
echo "  灰度指标回填 API - 样例数据脚本"
echo "========================================"
echo ""

echo "1. 检查服务健康状态..."
curl -s "$BASE_URL/health" | jq .
echo ""

echo "2. 创建灰度批次 (grayscale-2024-q1)..."
curl -s -X POST "$BASE_URL/batches" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": "grayscale-2024-q1",
    "batch_name": "2024 Q1 灰度发布批次",
    "description": "第一季度灰度发布，包含用户侧、服务侧多维度指标"
  }' | jq .
echo ""

echo "3. 创建指标时间窗口..."
curl -s -X POST "$BASE_URL/windows" \
  -H "Content-Type: application/json" \
  -d '{
    "window_id": "window-2024-01-01",
    "batch_id": "grayscale-2024-q1",
    "start_time": "2024-01-01T00:00:00Z",
    "end_time": "2024-01-31T23:59:59Z",
    "metric_types": ["QPS", "LATENCY", "ERROR_RATE", "SUCCESS_RATE"],
    "granularity": "5m"
  }' | jq .
echo ""

echo "4. 创建第一个回填任务 (修复日志缺失)..."
TASK1=$(curl -s -X POST "$BASE_URL/backfills" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": "grayscale-2024-q1",
    "window_id": "window-2024-01-01",
    "title": "修复 2024-01-01 至 2024-01-05 日志缺失指标",
    "description": "因日志采集服务故障，导致该时间段内服务监控指标缺失，需要从原始日志重新计算回填",
    "creator": "engineering@example.com",
    "raw_input": {
      "time_range": {
        "start": "2024-01-01T00:00:00Z",
        "end": "2024-01-05T23:59:59Z"
      },
      "affected_services": ["user-service", "order-service", "payment-service"],
      "data_source": "s3://logs-archive/2024/01/",
      "restore_strategy": "full_recompute"
    },
    "allow_overwrite": false,
    "gap_segments": [
      {
        "start_time": "2024-01-01T00:00:00Z",
        "end_time": "2024-01-05T23:59:59Z",
        "expected_count": 1500000,
        "actual_count": 0,
        "gap_percent": 100.0
      }
    ],
    "sources": [
      {
        "source_type": "LOG_REPLAY",
        "source_config": {
          "bucket": "logs-archive",
          "prefix": "2024/01/",
          "format": "json.gz"
        },
        "connection_info": "arn:aws:iam::123456789:role/log-reader"
      }
    ]
  }')
echo "$TASK1" | jq .
BACKFILL_ID1=$(echo "$TASK1" | jq -r .backfill_id)
echo ""

echo "5. 提交任务审核..."
curl -s -X POST "$BASE_URL/backfills/$BACKFILL_ID1/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "engineering@example.com",
    "comment": "数据范围已确认，请求审核"
  }' | jq .
echo ""

echo "6. 审核通过..."
curl -s -X POST "$BASE_URL/backfills/$BACKFILL_ID1/approve" \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "sre-manager@example.com",
    "comment": "审核通过，数据来源可靠，可以执行回填"
  }' | jq .
echo ""

echo "7. 开始处理回填..."
curl -s -X POST "$BASE_URL/backfills/$BACKFILL_ID1/start" \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "sre@example.com"
  }' | jq .
echo ""

echo "8. 模拟完成回填任务..."
curl -s -X POST "$BASE_URL/backfills/$BACKFILL_ID1/complete" \
  -H "Content-Type: application/json" \
  -d '{
    "success_records": 1485000,
    "failed_records": 15000,
    "result": {
      "summary": {
        "total_processed": 1500000,
        "success_rate": 99.0,
        "avg_latency_ms": 45,
        "p99_latency_ms": 120
      },
      "breakdown_by_service": {
        "user-service": {
          "success_count": 500000,
          "failed_count": 5000
        },
        "order-service": {
          "success_count": 485000,
          "failed_count": 8000
        },
        "payment-service": {
          "success_count": 500000,
          "failed_count": 2000
        }
      }
    }
  }' | jq .
echo ""

echo "9. 创建处理结果快照..."
curl -s -X POST "$BASE_URL/backfills/$BACKFILL_ID1/snapshots" \
  -H "Content-Type: application/json" \
  -d '{
    "snapshot_type": "FINAL_RESULT",
    "content": {
      "version": "1.0",
      "generated_at": "2024-02-10T10:00:00Z",
      "data": {
        "metrics": ["qps", "latency", "error_rate"],
        "records_count": 1500000
      }
    },
    "record_count": 1500000
  }' | jq .
echo ""

echo "10. 创建第二个回填任务 (待审核)..."
TASK2=$(curl -s -X POST "$BASE_URL/backfills" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": "grayscale-2024-q1",
    "window_id": "window-2024-01-01",
    "title": "补全 2024-01-10 部分时间段缺失指标",
    "description": "发现部分时间段内QPS指标异常偏低，需要重新计算验证",
    "creator": "data-team@example.com",
    "raw_input": {
      "time_range": {
        "start": "2024-01-10T08:00:00Z",
        "end": "2024-01-10T18:00:00Z"
      },
      "affected_metrics": ["QPS", "LATENCY"],
      "reason": "metric_calculation_bug"
    },
    "allow_overwrite": true
  }')
echo "$TASK2" | jq .
BACKFILL_ID2=$(echo "$TASK2" | jq -r .backfill_id)
echo ""

echo "11. 提交第二个任务审核..."
curl -s -X POST "$BASE_URL/backfills/$BACKFILL_ID2/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "data-team@example.com",
    "comment": "确认是计算bug导致的异常，请审核"
  }' | jq .
echo ""

echo "12. 查看所有回填任务列表..."
curl -s "$BASE_URL/backfills?batch_id=grayscale-2024-q1" | jq .
echo ""

echo "13. 查看第一个任务的完整详情（包含审核记录、缺口、来源、快照）..."
curl -s "$BASE_URL/backfills/$BACKFILL_ID1" | jq .
echo ""

echo "14. 导出第一个任务的完整数据 (JSON格式)..."
curl -s "$BASE_URL/backfills/$BACKFILL_ID1/export?format=json" | jq . > "export-$BACKFILL_ID1.json"
echo "已导出到文件: export-$BACKFILL_ID1.json"
echo ""

echo "15. 查看状态机流转规则..."
curl -s "$BASE_URL/status-transitions" | jq .
echo ""

echo "========================================"
echo "  样例数据创建完成！"
echo "========================================"
echo "第一个任务ID: $BACKFILL_ID1 (状态: COMPLETED)"
echo "第二个任务ID: $BACKFILL_ID2 (状态: PENDING_REVIEW)"
echo ""
echo "可以尝试以下操作:"
echo "- 拒绝第二个任务: curl -X POST $BASE_URL/backfills/$BACKFILL_ID2/reject ..."
echo "- 取消第二个任务: curl -X POST $BASE_URL/backfills/$BACKFILL_ID2/cancel ..."
echo "- 人工修正任务: curl -X POST $BASE_URL/backfills/$BACKFILL_ID1/correct ..."
echo "- 导出CSV: curl -O $BASE_URL/backfills/$BACKFILL_ID1/export?format=csv"
echo ""
