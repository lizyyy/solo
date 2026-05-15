from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from app.models import ExportRequest, ExportStatus
from app.schemas import ExpiryPolicy


class ExpiryManager:
    def __init__(self, db: Session):
        self.db = db

    def calculate_expiry_time(
        self,
        policy: ExpiryPolicy,
        start_time: Optional[datetime] = None
    ) -> datetime:
        if start_time is None:
            start_time = datetime.now()

        if policy.type == "hours":
            hours = policy.value or 24
            return start_time + timedelta(hours=hours)
        elif policy.type == "downloads":
            return start_time + timedelta(days=7)
        elif policy.type == "never":
            return start_time + timedelta(days=365 * 100)
        else:
            return start_time + timedelta(hours=24)

    def check_expired(self, export_request: ExportRequest) -> bool:
        if not export_request.expiry_time:
            return False
        
        if datetime.now() > export_request.expiry_time:
            return True
        return False

    def mark_expired_if_needed(self, export_request: ExportRequest) -> bool:
        if self.check_expired(export_request):
            if export_request.status not in [ExportStatus.EXPIRED, ExportStatus.DOWNLOADED]:
                export_request.status = ExportStatus.EXPIRED
                export_request.final_conclusion = "导出申请已过期"
                self.db.commit()
                self.db.refresh(export_request)
                return True
        return False

    def extend_expiry(
        self,
        export_request: ExportRequest,
        additional_hours: int,
        operator_id: str,
        operator_name: str
    ) -> datetime:
        if export_request.expiry_time:
            new_expiry = export_request.expiry_time + timedelta(hours=additional_hours)
        else:
            new_expiry = datetime.now() + timedelta(hours=additional_hours)
        
        export_request.expiry_time = new_expiry
        if export_request.status == ExportStatus.EXPIRED:
            export_request.status = ExportStatus.READY
        
        self.db.commit()
        self.db.refresh(export_request)
        return new_expiry

    def batch_check_expired(self) -> int:
        expired_count = 0
        requests = self.db.query(ExportRequest).filter(
            ExportRequest.status.notin_([ExportStatus.EXPIRED, ExportStatus.DOWNLOADED, ExportStatus.REJECTED]),
            ExportRequest.expiry_time.isnot(None)
        ).all()

        for request in requests:
            if self.mark_expired_if_needed(request):
                expired_count += 1
        
        return expired_count
