import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.database import SessionLocal, engine, Base
from app.models import Batch, Token, FailedItem, ApprovalItem, CandidateList, Report, ProcessingStatus, TokenStatus, RiskType
from app.services import generate_token


def seed_demo_data():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        print("Starting to seed demo data...")

        batch1 = Batch(
            batch_no="FREEZE-2024-001",
            operator="admin",
            description="过期版本冻结通知 - 包含正常和异常情况",
            risk_type=RiskType.EXPIRED_VERSION,
            status=ProcessingStatus.PARTIAL,
            total_count=10,
            success_count=8,
            failed_count=2,
            start_time=datetime.utcnow() - timedelta(hours=2),
            end_time=datetime.utcnow() - timedelta(hours=1, minutes=55),
            created_at=datetime.utcnow() - timedelta(hours=2),
            updated_at=datetime.utcnow() - timedelta(hours=1, minutes=55)
        )
        db.add(batch1)
        db.flush()

        for i in range(8):
            token = Token(
                token_value=generate_token(f"version_1_0_{i}"),
                batch_id=batch1.id,
                subject=f"version_1_0_{i}",
                risk_type=RiskType.EXPIRED_VERSION,
                status=TokenStatus.ACTIVE if i < 5 else TokenStatus.USED,
                expires_at=datetime.utcnow() + timedelta(days=7 - i),
                issued_at=datetime.utcnow() - timedelta(hours=2),
                issued_by="admin",
                token_metadata={"version": "1.0.0", "module": f"module_{i}", "action": "freeze"}
            )
            db.add(token)

        failed_items_data = [
            {
                "item_key": "merge_error_001",
                "content": {"version": "2.0.0", "module": "payment", "error": "Branch conflict detected"},
                "error_type": "MergeError",
                "error_message": "无法合并分支: feature/payment-v2 与 release/2.0 存在冲突",
                "stack_trace": "Traceback (most recent call last):\n  File \"merge.py\", line 42, in execute_merge\n    raise MergeError(\"Branch conflict detected\")\nMergeError: Branch conflict detected"
            },
            {
                "item_key": "merge_error_002",
                "content": {"version": "2.1.0", "module": "auth", "error": "Permission denied"},
                "error_type": "MergeError",
                "error_message": "合并权限不足: 您没有合并到主分支的权限",
                "stack_trace": "Traceback (most recent call last):\n  File \"merge.py\", line 67, in check_permissions\n    raise PermissionError(\"Permission denied\")\nPermissionError: Permission denied"
            }
        ]

        for item in failed_items_data:
            failed = FailedItem(
                batch_id=batch1.id,
                item_key=item["item_key"],
                content=item["content"],
                error_type=item["error_type"],
                error_message=item["error_message"],
                stack_trace=item["stack_trace"],
                retry_count=3,
                resolved=False,
                created_at=datetime.utcnow() - timedelta(hours=1, minutes=50)
            )
            db.add(failed)

        batch2 = Batch(
            batch_no="FREEZE-2024-002",
            operator="operator1",
            description="旧版本冻结 - 已完成",
            risk_type=RiskType.EXPIRED_VERSION,
            status=ProcessingStatus.SUCCESS,
            total_count=5,
            success_count=5,
            failed_count=0,
            start_time=datetime.utcnow() - timedelta(days=1),
            end_time=datetime.utcnow() - timedelta(days=1, minutes=55),
            created_at=datetime.utcnow() - timedelta(days=1),
            updated_at=datetime.utcnow() - timedelta(days=1, minutes=55)
        )
        db.add(batch2)
        db.flush()

        for i in range(5):
            token = Token(
                token_value=generate_token(f"old_version_{i}"),
                batch_id=batch2.id,
                subject=f"old_version_{i}",
                risk_type=RiskType.EXPIRED_VERSION,
                status=TokenStatus.ACTIVE,
                expires_at=datetime.utcnow() + timedelta(days=6),
                issued_at=datetime.utcnow() - timedelta(days=1),
                issued_by="operator1",
                token_metadata={"version": f"0.9.{i}", "status": "frozen"}
            )
            db.add(token)

        batch3 = Batch(
            batch_no="PERM-CHECK-001",
            operator="security_admin",
            description="权限违规检查",
            risk_type=RiskType.PERMISSION_VIOLATION,
            status=ProcessingStatus.SUCCESS,
            total_count=3,
            success_count=3,
            failed_count=0,
            start_time=datetime.utcnow() - timedelta(days=2),
            end_time=datetime.utcnow() - timedelta(days=2, minutes=5),
            created_at=datetime.utcnow() - timedelta(days=2),
            updated_at=datetime.utcnow() - timedelta(days=2, minutes=5)
        )
        db.add(batch3)
        db.flush()

        for i in range(3):
            token = Token(
                token_value=generate_token(f"perm_check_{i}"),
                batch_id=batch3.id,
                subject=f"user_{i}",
                risk_type=RiskType.PERMISSION_VIOLATION,
                status=TokenStatus.ACTIVE,
                expires_at=datetime.utcnow() + timedelta(days=5),
                issued_at=datetime.utcnow() - timedelta(days=2),
                issued_by="security_admin",
                token_metadata={"permission": f"level_{i}"}
            )
            db.add(token)

        approval_items = [
            {
                "item_key": "approve_merge_001",
                "title": "审批: 合并 payment 模块修复",
                "assignee": "team_lead",
                "priority": "high",
                "reminders_count": 2
            },
            {
                "item_key": "approve_freeze_001",
                "title": "审批: 冻结过期版本 v1.0.0",
                "assignee": "release_manager",
                "priority": "normal",
                "reminders_count": 1
            }
        ]

        for idx, item in enumerate(approval_items):
            approval = ApprovalItem(
                batch_id=batch1.id,
                item_key=item["item_key"],
                title=item["title"],
                content={"batch_id": batch1.id, "item_key": item["item_key"]},
                assignee=item["assignee"],
                status="pending",
                priority=item["priority"],
                due_date=datetime.utcnow() + timedelta(days=3),
                reminders_count=item["reminders_count"],
                last_reminder_at=datetime.utcnow() - timedelta(hours=1) if idx == 0 else None,
                created_at=datetime.utcnow() - timedelta(hours=2),
                updated_at=datetime.utcnow() - timedelta(hours=1) if idx == 0 else datetime.utcnow() - timedelta(hours=2)
            )
            db.add(approval)

        candidate_rollback = CandidateList(
            batch_id=batch1.id,
            list_type="rollback",
            name="回滚候选清单 - 合并错误项",
            description="需要回滚的有问题的令牌列表",
            items=[
                {"token_id": 1, "reason": "错误的版本号"},
                {"token_id": 3, "reason": "模块信息不正确"}
            ],
            approved=False,
            created_by="admin",
            created_at=datetime.utcnow() - timedelta(minutes=30)
        )
        db.add(candidate_rollback)

        candidate_cleanup = CandidateList(
            batch_id=batch2.id,
            list_type="cleanup",
            name="清理候选清单 - 过期令牌",
            description="需要清理的已过期令牌",
            items=[
                {"token_id": 9, "reason": "已过期"},
                {"token_id": 10, "reason": "已过期"}
            ],
            approved=True,
            approved_by="manager",
            approved_at=datetime.utcnow() - timedelta(minutes=10),
            executed=False,
            created_by="operator1",
            created_at=datetime.utcnow() - timedelta(hours=1)
        )
        db.add(candidate_cleanup)

        report = Report(
            batch_id=batch1.id,
            report_type="processing_summary",
            title=f"处理报告 - FREEZE-2024-001",
            summary="Batch FREEZE-2024-001 processing completed. Success: 8, Failed: 2. Risk type: expired_version",
            comparison_data={
                "before": {"total_count": 10, "status": "pending"},
                "after": {"total_count": 10, "success_count": 8, "failed_count": 2, "success_rate": "80.00%", "status": "partial"}
            },
            execution_stats={
                "total_execution_time_ms": 1250,
                "avg_execution_time_ms": 125,
                "processing_records_count": 1
            },
            next_steps=[
                {"priority": "high", "action": "review_failed_items", "description": "Review 2 failed items", "link": "/api/failed-items?batch_id=1"},
                {"priority": "medium", "action": "monitor_active_tokens", "description": "Monitor 5 active tokens", "link": "/api/tokens?batch_id=1&status=active"}
            ],
            generated_by="system",
            generated_at=datetime.utcnow() - timedelta(hours=1, minutes=50)
        )
        db.add(report)

        db.commit()
        print("Demo data seeded successfully!")
        print(f"\nCreated:")
        print(f"  - 3 Batches (FREEZE-2024-001, FREEZE-2024-002, PERM-CHECK-001)")
        print(f"  - 16 Tokens total")
        print(f"  - 2 Failed Items (merge errors)")
        print(f"  - 2 Approval Items (with reminders)")
        print(f"  - 2 Candidate Lists (rollback, cleanup)")
        print(f"  - 1 Report")

    except Exception as e:
        db.rollback()
        print(f"Error seeding demo data: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo_data()
