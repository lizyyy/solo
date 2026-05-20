import sys
from datetime import datetime, timedelta

sys.path.insert(0, 'app')

from database import SessionLocal
from models import AnomalyRecord, DeviceMetric, AnomalyRule, IdempotentRequest


def init_test_data():
    db = SessionLocal()

    try:
        rule1 = AnomalyRule(
            rule_name="CPU 使用率过高",
            rule_type="threshold",
            metric_name="cpu_usage",
            threshold_max=80.0,
            severity="high",
            enabled=True,
            description="当 CPU 使用率超过 80% 时触发告警"
        )
        rule2 = AnomalyRule(
            rule_name="内存使用率过高",
            rule_type="threshold",
            metric_name="memory_usage",
            threshold_max=90.0,
            severity="critical",
            enabled=True,
            description="当内存使用率超过 90% 时触发告警"
        )
        db.add(rule1)
        db.add(rule2)
        db.commit()
        db.refresh(rule1)
        db.refresh(rule2)

        device_ids = ["server-001", "server-002", "server-003", "edge-001", "edge-002"]
        metric_names = ["cpu_usage", "memory_usage", "disk_io", "network_latency", "temperature"]

        for i in range(30):
            for device_id in device_ids:
                for metric_name in metric_names[:2]:
                    metric = DeviceMetric(
                        device_id=device_id,
                        metric_name=metric_name,
                        metric_value=70.0 + (i % 30),
                        unit="%",
                        previous_value=60.0 + (i % 25),
                        timestamp=datetime.utcnow() - timedelta(hours=i)
                    )
                    db.add(metric)
        db.commit()

        anomalies_data = [
            {"title": "CPU 使用率异常升高", "device": "server-001", "severity": "high", "status": "pending", "current": 95.5, "previous": 45.2},
            {"title": "内存使用率持续过高", "device": "server-001", "severity": "critical", "status": "confirmed", "current": 92.3, "previous": 68.1},
            {"title": "CPU 使用率波动异常", "device": "server-002", "severity": "medium", "status": "ignored", "current": 78.4, "previous": 72.1},
            {"title": "网络延迟异常", "device": "edge-001", "severity": "high", "status": "ticketed", "current": 450.0, "previous": 80.0},
            {"title": "磁盘 IO 异常", "device": "server-003", "severity": "medium", "status": "recovered", "current": 120.5, "previous": 850.3},
            {"title": "温度告警", "device": "edge-002", "severity": "low", "status": "closed", "current": 45.2, "previous": 42.1},
            {"title": "CPU 使用率突增", "device": "server-001", "severity": "critical", "status": "pending", "current": 99.1, "previous": 40.5},
            {"title": "内存泄漏检测", "device": "server-002", "severity": "high", "status": "pending", "current": 98.7, "previous": 55.3},
        ]

        for i, data in enumerate(anomalies_data):
            anomaly = AnomalyRecord(
                anomaly_idempotency_key=f"test-anomaly-{i:03d}",
                device_id=data["device"],
                rule_id=rule1.id if "CPU" in data["title"] else rule2.id,
                title=data["title"],
                description=f"设备 {data['device']} {data['title']}，当前值 {data['current']}%，之前值 {data['previous']}%",
                severity=data["severity"],
                status=data["status"],
                current_value=data["current"],
                previous_value=data["previous"],
                threshold_value=80.0,
                detected_at=datetime.utcnow() - timedelta(hours=i*2),
                confirmed_at=datetime.utcnow() - timedelta(hours=i*2+1) if data["status"] in ["confirmed", "ticketed", "recovered", "closed"] else None,
                recovered_at=datetime.utcnow() - timedelta(hours=i) if data["status"] in ["recovered", "closed"] else None,
                closed_at=datetime.utcnow() if data["status"] == "closed" else None
            )
            db.add(anomaly)

        db.commit()
        print("测试数据初始化完成！")
        print(f"已创建 {len(anomalies_data)} 条异常记录")
        print(f"已创建 2 条规则")
        print(f"已创建设备指标数据")

    except Exception as e:
        print(f"初始化失败: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    init_test_data()
