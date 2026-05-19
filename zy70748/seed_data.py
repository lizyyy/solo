import sys
from datetime import datetime, timedelta
from database import SessionLocal, init_db
from services import IncidentService
from schemas import IncidentCreate, AttributionClueCreate, StatusTransition, IncidentStatus


def seed_demo_data():
    init_db()
    db = SessionLocal()
    service = IncidentService(db)

    print("开始创建演示数据...")

    tenants = [
        ("tenant-001", "字节跳动"),
        ("tenant-002", "阿里巴巴"),
        ("tenant-003", "腾讯科技"),
        ("tenant-004", "美团点评"),
        ("tenant-005", "京东集团")
    ]

    metrics = [
        ("api_calls", "API调用次数"),
        ("storage_usage", "存储使用量"),
        ("bandwidth_usage", "带宽使用量"),
        ("compute_seconds", "计算资源秒数")
    ]

    now = datetime.utcnow()

    created_incidents = []

    for i, (tenant_id, tenant_name) in enumerate(tenants):
        metric_code, metric_name = metrics[i % len(metrics)]

        start_time = now - timedelta(hours=3 + i * 2)
        end_time = now - timedelta(hours=1 + i * 2)

        incident_data = IncidentCreate(
            tenant_id=tenant_id,
            tenant_name=tenant_name,
            metric_name=metric_name,
            metric_value=1000000 * (i + 1) * 2.5,
            baseline_value=1000000 * (i + 1),
            deviation_ratio=2.5,
            start_time=start_time,
            end_time=end_time,
            title=f"{tenant_name} - {metric_name}异常暴涨",
            created_by="system_monitor",
            raw_input=f'{{"alert_id": "alert-{i:03d}", "trigger_time": "{start_time.isoformat()}", "source": "cloud_monitor"}}'
        )

        incident, created = service.create_incident(incident_data)
        if created:
            created_incidents.append(incident)
            print(f"创建事故: {incident.id} - {incident.title}")

            clue1 = AttributionClueCreate(
                source_system="cloud_monitor",
                clue_type="monitor_alert",
                description=f"检测到QPS异常升高，从{1000 * (i + 1)}/min升至{2500 * (i + 1)}/min",
                confidence=0.9,
                is_primary=True,
                created_by="ops_zhang"
            )
            service.add_clue(incident.id, clue1)

            clue2 = AttributionClueCreate(
                source_system="billing_system",
                clue_type="billing_abnormal",
                description=f"预计费用超出预算150%，预计增加{(i + 1) * 5000}元",
                confidence=0.85,
                is_primary=False,
                created_by="finance_li"
            )
            service.add_clue(incident.id, clue2)

            if i == 0:
                service.transition_status(
                    incident.id,
                    StatusTransition(
                        target_status=IncidentStatus.INVESTIGATING,
                        operator="ops_wang",
                        conclusion="开始调查异常原因"
                    )
                )

            elif i == 1:
                service.transition_status(
                    incident.id,
                    StatusTransition(
                        target_status=IncidentStatus.INVESTIGATING,
                        operator="ops_li",
                        conclusion="进入调查阶段"
                    )
                )
                service.transition_status(
                    incident.id,
                    StatusTransition(
                        target_status=IncidentStatus.ATTRIBUTED,
                        operator="dev_zhao",
                        conclusion="归因完成：客户端批量任务导致，已通知用户优化"
                    )
                )

            elif i == 2:
                service.transition_status(
                    incident.id,
                    StatusTransition(
                        target_status=IncidentStatus.INVESTIGATING,
                        operator="ops_zhang",
                        conclusion="开始调查"
                    )
                )
                service.transition_status(
                    incident.id,
                    StatusTransition(
                        target_status=IncidentStatus.ATTRIBUTED,
                        operator="dev_qian",
                        conclusion="归因完成"
                    )
                )
                service.transition_status(
                    incident.id,
                    StatusTransition(
                        target_status=IncidentStatus.RESOLVED,
                        operator="ops_wang",
                        conclusion="用户已限流，指标恢复正常"
                    )
                )
                service.close_incident(
                    incident.id,
                    operator="ops_manager",
                    conclusion="事故已解决：客户端批量任务触发流量异常，已协助用户进行请求限流和错峰处理，系统恢复正常。"
                )

    print(f"\n共创建 {len(created_incidents)} 条事故记录")
    print("演示数据创建完成!")

    db.close()


if __name__ == "__main__":
    seed_demo_data()
