#!/usr/bin/env python3
import sys
from datetime import datetime, timedelta

sys.path.insert(0, '/Users/lzy/pro/solo/workspaces/zy71384')

from src.models.session import SessionLocal, init_db
from src.models.schemas import (
    DiagnosisRecordCreate, QueueMetricsCreate, ConsumerLogCreate,
    BatchDiagnosisRequest
)
from src.services.diagnosis_service import DiagnosisOrchestrationService
from src.models.enums import DiagnosisStatus


def generate_test_data(queue_name: str, scenario: str = "production_surge"):
    base_time = datetime.utcnow() - timedelta(hours=1)
    metrics = []
    logs = []

    if scenario == "production_surge":
        for i in range(60):
            timestamp = base_time + timedelta(minutes=i)
            prod_rate = 100 if i < 30 else 500
            cons_rate = 150
            backlog = 1000 + int(max(0, (prod_rate - cons_rate) * 60 * (i - 29) if i >= 30 else 0))

            metrics.append(QueueMetricsCreate(
                queue_name=queue_name,
                timestamp=timestamp,
                backlog_count=backlog,
                backlog_growth_rate=(prod_rate - cons_rate),
                production_rate=prod_rate,
                production_rate_avg_1h=120,
                production_rate_avg_24h=100,
                consumption_rate=cons_rate,
                consumption_rate_avg_1h=145,
                consumption_rate_avg_24h=150,
                dead_letter_count=50,
                dead_letter_increment=0,
                consumer_count=5,
                active_consumer_count=5
            ))

    elif scenario == "consumption_slow":
        for i in range(60):
            timestamp = base_time + timedelta(minutes=i)
            prod_rate = 200
            cons_rate = 200 if i < 20 else 80
            backlog = 1000 + int(max(0, (prod_rate - cons_rate) * 60 * (i - 19) if i >= 20 else 0))

            metrics.append(QueueMetricsCreate(
                queue_name=queue_name,
                timestamp=timestamp,
                backlog_count=backlog,
                backlog_growth_rate=(prod_rate - cons_rate),
                production_rate=prod_rate,
                production_rate_avg_1h=195,
                production_rate_avg_24h=200,
                consumption_rate=cons_rate,
                consumption_rate_avg_1h=180,
                consumption_rate_avg_24h=200,
                dead_letter_count=30,
                consumer_count=5,
                active_consumer_count=5
            ))

    elif scenario == "consumer_offline":
        for i in range(60):
            timestamp = base_time + timedelta(minutes=i)
            prod_rate = 200
            active_count = 5 if i < 30 else 2
            cons_rate = 200 if i < 30 else 80
            backlog = 1000 + int(max(0, (prod_rate - cons_rate) * 60 * (i - 29) if i >= 30 else 0))

            metrics.append(QueueMetricsCreate(
                queue_name=queue_name,
                timestamp=timestamp,
                backlog_count=backlog,
                backlog_growth_rate=(prod_rate - cons_rate),
                production_rate=prod_rate,
                production_rate_avg_1h=200,
                production_rate_avg_24h=200,
                consumption_rate=cons_rate,
                consumption_rate_avg_1h=180,
                consumption_rate_avg_24h=200,
                dead_letter_count=10,
                consumer_count=5,
                active_consumer_count=active_count
            ))

        for consumer_idx in range(5):
            for i in range(35 if consumer_idx >= 2 else 60):
                log_time = base_time + timedelta(minutes=i, seconds=30)
                logs.append(ConsumerLogCreate(
                    consumer_id=f"consumer-{consumer_idx}",
                    timestamp=log_time,
                    log_level="INFO",
                    message=f"Heartbeat from consumer-{consumer_idx}",
                    is_heartbeat=True,
                    is_error=False
                ))

            if consumer_idx >= 2:
                logs.append(ConsumerLogCreate(
                    consumer_id=f"consumer-{consumer_idx}",
                    timestamp=base_time + timedelta(minutes=34, seconds=45),
                    log_level="ERROR",
                    message=f"OutOfMemoryError: Java heap space",
                    is_heartbeat=False,
                    is_error=True
                ))

    elif scenario == "dead_letter_pileup":
        for i in range(60):
            timestamp = base_time + timedelta(minutes=i)
            prod_rate = 200
            cons_rate = 200
            dl_count = 100 + i * 50
            backlog = 1000 + dl_count

            metrics.append(QueueMetricsCreate(
                queue_name=queue_name,
                timestamp=timestamp,
                backlog_count=backlog,
                backlog_growth_rate=50 / 60,
                production_rate=prod_rate,
                production_rate_avg_1h=200,
                production_rate_avg_24h=200,
                consumption_rate=cons_rate,
                consumption_rate_avg_1h=200,
                consumption_rate_avg_24h=200,
                dead_letter_count=dl_count,
                dead_letter_increment=50,
                consumer_count=5,
                active_consumer_count=5
            ))

    elif scenario == "edge_cases":
        for i in range(60):
            timestamp = base_time + timedelta(minutes=i)
            if i in [15, 16, 17]:
                timestamp += timedelta(minutes=5)

            prod_rate = 200
            cons_rate = 150
            backlog = 1000 + (prod_rate - cons_rate) * 60 * i

            dl_inc = 25 if i % 2 == 0 else 0
            dl_count = 100 + sum(25 for j in range(i + 1) if j % 2 == 0)

            metrics.append(QueueMetricsCreate(
                queue_name=queue_name,
                timestamp=timestamp,
                backlog_count=backlog,
                backlog_growth_rate=(prod_rate - cons_rate),
                production_rate=prod_rate,
                production_rate_avg_1h=200,
                production_rate_avg_24h=200,
                consumption_rate=cons_rate,
                consumption_rate_avg_1h=180,
                consumption_rate_avg_24h=200,
                dead_letter_count=dl_count,
                dead_letter_increment=dl_inc,
                consumer_count=5,
                active_consumer_count=3
            ))

        for consumer_idx in range(3):
            for i in range(60):
                log_time = base_time + timedelta(minutes=i, seconds=30)
                logs.append(ConsumerLogCreate(
                    consumer_id=f"consumer-{consumer_idx}",
                    timestamp=log_time,
                    log_level="INFO",
                    message="Heartbeat",
                    is_heartbeat=True
                ))

    return metrics, logs


def run_test():
    init_db()
    db = SessionLocal()

    try:
        print("=" * 70)
        print("测试消息队列积压诊断后端")
        print("=" * 70)

        scenarios = [
            ("production_surge", "生产暴涨"),
            ("consumption_slow", "消费变慢"),
            ("consumer_offline", "消费者掉线"),
            ("dead_letter_pileup", "死信堆积"),
            ("edge_cases", "边缘情况测试")
        ]

        for scenario, desc in scenarios:
            print(f"\n{'=' * 70}")
            print(f"测试场景: {desc} ({scenario})")
            print("=" * 70)

            queue_name = f"test_queue_{scenario}"
            metrics, logs = generate_test_data(queue_name, scenario)

            request = BatchDiagnosisRequest(
                queue_name=queue_name,
                start_time=datetime.utcnow() - timedelta(hours=1),
                end_time=datetime.utcnow(),
                metrics=metrics,
                consumer_logs=logs if logs else None
            )

            record = DiagnosisOrchestrationService.batch_diagnosis(db, request)

            print(f"✓ 诊断ID: {record.id}")
            print(f"✓ 队列名称: {record.queue_name}")
            print(f"✓ 状态: {record.status if isinstance(record.status, str) else record.status.value}")
            alert_level_val = record.alert_level
            print(f"✓ 告警级别: {alert_level_val if isinstance(alert_level_val, str) else (alert_level_val.value if alert_level_val else 'N/A')}")
            primary_cause_val = record.primary_cause
            print(f"✓ 主要原因: {primary_cause_val if isinstance(primary_cause_val, str) else (primary_cause_val.value if primary_cause_val else 'N/A')}")
            print(f"✓ 综合评分: {record.overall_score:.2f}" if record.overall_score else "✓ 综合评分: N/A")
            print(f"✓ 指标数量: {len(record.metrics)}")
            print(f"✓ 日志数量: {len(record.consumer_logs)}")
            print(f"✓ 边缘情况检测: {len(record.edge_cases)} 项")

            if record.edge_cases:
                for i, ec in enumerate(record.edge_cases, 1):
                    ec_type = ec.edge_case_type if isinstance(ec.edge_case_type, str) else ec.edge_case_type.value
                    print(f"\n  边缘情况 [{i}]: {ec_type}")
                    print(f"    置信度: {ec.confidence * 100:.1f}%")
                    hint_lines = ec.human_readable_hint.split('\n')[:3]
                    for line in hint_lines:
                        print(f"    {line}")

            explained = DiagnosisOrchestrationService.get_explainable_diagnosis(
                db, record.id
            )

            print(f"\n✓ 评分项数量: {len(explained.score_breakdown)}")
            for i, score in enumerate(explained.score_breakdown[:5], 1):
                print(f"  [{i}] {score.metric_name}: {score.value:.2f}")
                print(f"      {score.explanation[:100]}...")

            print(f"\n✓ 处理建议数量: {len(explained.processing_suggestions)}")
            for i, sug in enumerate(explained.processing_suggestions[:3], 1):
                print(f"  [{i}] [{sug.priority.upper()}] {sug.action}")
                print(f"      {sug.rationale[:80]}...")

            if scenario == "consumer_offline":
                export_result = DiagnosisOrchestrationService.export_diagnosis(
                    db, record.id, "excel", include_raw_data=True
                )
                print(f"\n✓ 报告导出: {export_result.get('file_path', export_result.get('format'))}")

        print("\n" + "=" * 70)
        print("测试完成！所有场景诊断成功。")
        print("=" * 70)

        list_records, total = DiagnosisOrchestrationService.list_diagnoses(db)
        print(f"\n系统中共有 {total} 条诊断记录")
        for rec in list_records[:3]:
            status_val = rec.status if isinstance(rec.status, str) else rec.status.value
            alert_val = rec.alert_level if isinstance(rec.alert_level, str) else (rec.alert_level.value if rec.alert_level else 'N/A')
            print(f"  - #{rec.id} {rec.queue_name}: {status_val} ({alert_val})")

    finally:
        db.close()


if __name__ == "__main__":
    run_test()
