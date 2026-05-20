from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from typing import Optional

from ..models.models import Student, QuotaWindow, RunRequest, RequestStatus
from ..core.config import settings


class QuotaService:
    @staticmethod
    def get_or_create_quota_window(db: Session, student_id: int) -> QuotaWindow:
        now = datetime.utcnow()
        window_start = now.replace(minute=0, second=0, microsecond=0)
        window_end = window_start + timedelta(minutes=settings.QUOTA_WINDOW_MINUTES)

        window = db.query(QuotaWindow).filter(
            QuotaWindow.student_id == student_id,
            QuotaWindow.window_start <= now,
            QuotaWindow.window_end > now
        ).first()

        if not window:
            student = db.query(Student).filter(Student.id == student_id).first()
            max_quota = student.quota_per_window if student else settings.DEFAULT_QUOTA_PER_WINDOW
            window = QuotaWindow(
                student_id=student_id,
                window_start=window_start,
                window_end=window_end,
                used_quota=0,
                max_quota=max_quota
            )
            db.add(window)
            db.commit()
            db.refresh(window)

        return window

    @staticmethod
    def check_quota(db: Session, student_id: int) -> dict:
        window = QuotaService.get_or_create_quota_window(db, student_id)
        return {
            "has_quota": window.used_quota < window.max_quota,
            "used_quota": window.used_quota,
            "max_quota": window.max_quota,
            "window_end": window.window_end
        }

    @staticmethod
    def consume_quota(db: Session, student_id: int) -> bool:
        window = QuotaService.get_or_create_quota_window(db, student_id)
        if window.used_quota >= window.max_quota:
            return False
        window.used_quota += 1
        db.commit()
        return True

    @staticmethod
    def release_quota(db: Session, student_id: int):
        window = QuotaService.get_or_create_quota_window(db, student_id)
        if window.used_quota > 0:
            window.used_quota -= 1
            db.commit()

    @staticmethod
    def get_pending_requests_count(db: Session, student_id: int) -> int:
        return db.query(RunRequest).filter(
            RunRequest.student_id == student_id,
            RunRequest.status.in_([RequestStatus.PENDING, RequestStatus.QUEUED, RequestStatus.RUNNING])
        ).count()

    @staticmethod
    def can_submit_request(db: Session, student_id: int) -> tuple[bool, str]:
        quota_info = QuotaService.check_quota(db, student_id)
        if not quota_info["has_quota"]:
            return False, f"配额已用尽，请在{quota_info['window_end']}后重试"

        pending_count = QuotaService.get_pending_requests_count(db, student_id)
        if pending_count >= settings.MAX_PENDING_REQUESTS:
            return False, f"待处理请求过多（当前{pending_count}个），请等待完成后再提交"

        return True, "OK"
