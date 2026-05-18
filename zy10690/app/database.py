import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from app.models import (
    QueuePriority, QueuePriorityCreate, QueuePriorityReview,
    QueuePriorityRestore, PriorityStatus, PriorityReportItem
)


class PriorityDatabase:
    def __init__(self):
        self._records: Dict[str, QueuePriority] = {}
        self._history: List[Dict] = []

    def create_priority_request(self, request: QueuePriorityCreate) -> QueuePriority:
        record_id = str(uuid.uuid4())
        now = datetime.now()
        restore_at = now + timedelta(hours=request.restore_hours)
        
        record = QueuePriority(
            id=record_id,
            model_name=request.model_name,
            tenant_id=request.tenant_id,
            queue_name=request.queue_name,
            original_priority=request.original_priority,
            target_priority=request.target_priority,
            reason=request.reason,
            applicant=request.applicant,
            status=PriorityStatus.PENDING,
            created_at=now,
            updated_at=now,
            restore_at=restore_at
        )
        
        self._records[record_id] = record
        self._add_history(record_id, "created", f"申请创建: {request.reason}")
        return record

    def get_record(self, record_id: str) -> Optional[QueuePriority]:
        return self._records.get(record_id)

    def list_records(self, status: Optional[PriorityStatus] = None,
                    tenant_id: Optional[str] = None,
                    model_name: Optional[str] = None) -> List[QueuePriority]:
        records = list(self._records.values())
        if status:
            records = [r for r in records if r.status == status]
        if tenant_id:
            records = [r for r in records if r.tenant_id == tenant_id]
        if model_name:
            records = [r for r in records if r.model_name == model_name]
        return sorted(records, key=lambda x: x.created_at, reverse=True)

    def review_priority(self, record_id: str, review: QueuePriorityReview) -> QueuePriority:
        record = self._records[record_id]
        record.updated_at = datetime.now()
        record.reviewer = review.reviewer
        record.review_comment = review.comment
        
        if review.approved:
            record.status = PriorityStatus.APPROVED
            self._add_history(record_id, "approved", f"审批通过: {review.comment or '无备注'}")
        else:
            record.status = PriorityStatus.REJECTED
            record.conclusion = f"申请被拒绝: {review.comment}"
            self._add_history(record_id, "rejected", f"审批拒绝: {review.comment}")
        
        return record

    def apply_priority(self, record_id: str) -> QueuePriority:
        record = self._records[record_id]
        if record.status != PriorityStatus.APPROVED:
            raise ValueError("只有已审批的申请才能生效")
        
        now = datetime.now()
        record.status = PriorityStatus.ACTIVE
        record.applied_at = now
        record.updated_at = now
        record.wait_time_seconds = int((now - record.created_at).total_seconds())
        self._add_history(record_id, "applied", "优先级调整已生效")
        return record

    def restore_priority(self, record_id: str, restore: QueuePriorityRestore) -> QueuePriority:
        record = self._records[record_id]
        if record.status != PriorityStatus.ACTIVE:
            raise ValueError("只有生效中的记录才能恢复")
        
        now = datetime.now()
        record.status = PriorityStatus.RESTORED
        record.restored_at = now
        record.updated_at = now
        record.conclusion = f"已恢复，恢复理由: {restore.reason}"
        self._add_history(record_id, "restored", f"由 {restore.restorer} 恢复: {restore.reason}")
        return record

    def check_priority_risk(self, record: QueuePriority) -> Dict:
        risk_level = "low"
        risk_messages = []
        
        if record.target_priority <= 3 and record.original_priority >= 7:
            risk_level = "high"
            risk_messages.append("低优先级任务被大幅提升，可能影响线上租户")
        
        active_high_priority = [
            r for r in self._records.values()
            if r.status == PriorityStatus.ACTIVE and r.target_priority <= 3
        ]
        if len(active_high_priority) >= 3:
            risk_level = "high"
            risk_messages.append("当前高优先级队列过多，建议复核")
        
        if record.tenant_id.startswith("test_") and record.target_priority <= 3:
            risk_level = "medium"
            risk_messages.append("测试租户使用高优先级，需确认必要性")
        
        return {
            "risk_level": risk_level,
            "messages": risk_messages,
            "needs_review": risk_level in ["medium", "high"]
        }

    def _add_history(self, record_id: str, action: str, detail: str):
        self._history.append({
            "record_id": record_id,
            "action": action,
            "detail": detail,
            "timestamp": datetime.now()
        })

    def get_history(self, record_id: str) -> List[Dict]:
        return [h for h in self._history if h["record_id"] == record_id]

    def generate_report(self) -> List[PriorityReportItem]:
        items = []
        for record in self._records.values():
            item = PriorityReportItem(
                id=record.id[:8],
                model_name=record.model_name,
                tenant_id=record.tenant_id,
                queue_name=record.queue_name,
                original_priority=record.original_priority,
                target_priority=record.target_priority,
                reason=record.reason,
                applicant=record.applicant,
                status=record.status.value,
                reviewer=record.reviewer,
                created_at=record.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                applied_at=record.applied_at.strftime("%Y-%m-%d %H:%M:%S") if record.applied_at else None,
                restored_at=record.restored_at.strftime("%Y-%m-%d %H:%M:%S") if record.restored_at else None,
                wait_time_seconds=record.wait_time_seconds,
                conclusion=record.conclusion
            )
            items.append(item)
        return items


db = PriorityDatabase()
