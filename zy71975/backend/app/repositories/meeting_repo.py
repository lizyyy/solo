from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from app.repositories.base import BaseRepository
from app.models.meeting import Meeting
from app.schemas.meeting import MeetingCreate, MeetingUpdate


class MeetingRepository(BaseRepository[Meeting, MeetingCreate, MeetingUpdate]):
    def __init__(self):
        super().__init__(Meeting)

    def get_by_meeting_no(self, db: Session, meeting_no: str) -> Optional[Meeting]:
        return db.query(Meeting).filter(
            Meeting.meeting_no == meeting_no,
            Meeting.is_deleted == False
        ).first()

    def get_by_meeting_no_or_404(self, db: Session, meeting_no: str) -> Meeting:
        meeting = self.get_by_meeting_no(db, meeting_no)
        if not meeting:
            from app.core.exceptions import ResourceNotFoundException
            raise ResourceNotFoundException(
                resource="会议",
                resource_id=meeting_no,
                user_friendly_message=f"找不到编号为 {meeting_no} 的会议哦～"
            )
        return meeting

    def search(
        self,
        db: Session,
        keyword: Optional[str] = None,
        status: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        page: int = 1,
        page_size: int = 10
    ) -> Tuple[List[Meeting], int, int]:
        query = db.query(Meeting).filter(Meeting.is_deleted == False)

        if keyword:
            query = query.filter(
                (Meeting.title.contains(keyword)) |
                (Meeting.meeting_no.contains(keyword)) |
                (Meeting.content.contains(keyword))
            )

        if status:
            query = query.filter(Meeting.status == status)

        if start_date:
            query = query.filter(Meeting.created_at >= start_date)

        if end_date:
            query = query.filter(Meeting.created_at <= end_date + timedelta(days=1))

        query = query.order_by(Meeting.created_at.desc())

        total = query.count()
        skip = (page - 1) * page_size
        items = query.offset(skip).limit(page_size).all()
        total_pages = (total + page_size - 1) // page_size

        return items, total, total_pages

    def update_stats(
        self,
        db: Session,
        meeting_id: int,
        total_questions: int,
        correct_count: int,
        error_count: int,
        status: str = "completed"
    ) -> Meeting:
        meeting = self.get_by_id_or_404(db, meeting_id, "会议")
        meeting.total_questions = total_questions
        meeting.correct_count = correct_count
        meeting.error_count = error_count
        meeting.status = status

        if total_questions > 0:
            accuracy = (correct_count / total_questions) * 100
            meeting.accuracy = f"{accuracy:.1f}%"
        else:
            meeting.accuracy = "0%"

        db.add(meeting)
        db.commit()
        db.refresh(meeting)
        return meeting

    def get_recent_meetings(self, db: Session, days: int = 7, limit: int = 10) -> List[Meeting]:
        start_date = datetime.now() - timedelta(days=days)
        return db.query(Meeting).filter(
            Meeting.is_deleted == False,
            Meeting.created_at >= start_date
        ).order_by(Meeting.created_at.desc()).limit(limit).all()


meeting_repo = MeetingRepository()
