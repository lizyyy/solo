from datetime import datetime, timedelta
from app.database import db
from app.models import QueuePriorityCreate, QueuePriorityReview, QueuePriorityRestore, PriorityStatus


def load_sample_data():
    samples = [
        {
            "type": "normal",
            "data": QueuePriorityCreate(
                model_name="gpt-3.5-turbo",
                tenant_id="tenant_001",
                queue_name="inference_normal",
                original_priority=5,
                target_priority=5,
                reason="普通线上推理任务",
                applicant="ops_user1",
                restore_hours=24
            ),
            "status": "normal"
        },
        {
            "type": "pending",
            "data": QueuePriorityCreate(
                model_name="llama-2-70b",
                tenant_id="tenant_002",
                queue_name="inference_batch",
                original_priority=8,
                target_priority=3,
                reason="紧急批次任务，需提前完成",
                applicant="data_analyst1",
                restore_hours=4
            ),
            "status": "pending"
        },
        {
            "type": "active",
            "data": QueuePriorityCreate(
                model_name="qwen-vl",
                tenant_id="tenant_003",
                queue_name="inference_vip",
                original_priority=6,
                target_priority=2,
                reason="VIP客户实时推理需求",
                applicant="account_manager1",
                restore_hours=72
            ),
            "status": "active"
        },
        {
            "type": "restored",
            "data": QueuePriorityCreate(
                model_name="chatglm3-6b",
                tenant_id="tenant_004",
                queue_name="inference_test",
                original_priority=9,
                target_priority=4,
                reason="临时测试任务提权",
                applicant="dev_user1",
                restore_hours=2
            ),
            "status": "restored"
        }
    ]
    
    for sample in samples:
        record = db.create_priority_request(sample["data"])
        
        if sample["status"] == "normal":
            record.status = PriorityStatus.NORMAL
            record.conclusion = "普通优先级，无需调整"
        
        elif sample["status"] == "pending":
            pass
        
        elif sample["status"] == "active":
            db.review_priority(
                record.id,
                QueuePriorityReview(
                    reviewer="admin_user1",
                    approved=True,
                    comment="VIP客户需求紧急，同意提权"
                )
            )
            db.apply_priority(record.id)
        
        elif sample["status"] == "restored":
            db.review_priority(
                record.id,
                QueuePriorityReview(
                    reviewer="admin_user2",
                    approved=True,
                    comment="临时测试，短时间提权"
                )
            )
            db.apply_priority(record.id)
            db.restore_priority(
                record.id,
                QueuePriorityRestore(
                    restorer="dev_user1",
                    reason="测试完成，恢复原优先级"
                )
            )
    
    print(f"已加载 {len(samples)} 条样例数据")
