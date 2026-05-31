from typing import Optional, Tuple, List, Dict, Any
from sqlalchemy.orm import Session
from datetime import datetime

from app.repositories.meeting_repo import meeting_repo
from app.schemas.meeting import MeetingCreate, MeetingUpdate, MeetingAnalyzeResponse
from app.models.meeting import Meeting
from app.utils.file_parser import parse_file, save_uploaded_file, extract_qa_pairs
from app.core.exceptions import ValidationException, BusinessException


class MeetingService:
    def create_meeting(self, db: Session, meeting_in: MeetingCreate) -> Meeting:
        existing = meeting_repo.get_by_meeting_no(db, meeting_in.meeting_no)
        if existing:
            raise BusinessException(
                message=f"Meeting no {meeting_in.meeting_no} already exists",
                user_friendly_message=f"会议编号 {meeting_in.meeting_no} 已经存在了哦～"
            )
        return meeting_repo.create(db, meeting_in)

    def upload_and_create(
        self,
        db: Session,
        file_content: bytes,
        filename: str,
        title: str,
        meeting_no: str
    ) -> Meeting:
        existing = meeting_repo.get_by_meeting_no(db, meeting_no)
        if existing:
            raise BusinessException(
                message=f"Meeting no {meeting_no} already exists",
                user_friendly_message=f"会议编号 {meeting_no} 已经存在了哦～"
            )

        file_path = save_uploaded_file(file_content, filename, meeting_no)
        content = parse_file(file_path)

        meeting_in = MeetingCreate(
            title=title,
            meeting_no=meeting_no,
            content=content,
            file_name=filename,
            file_path=file_path
        )

        meeting = meeting_repo.create(db, meeting_in)
        return meeting

    def analyze_meeting(self, db: Session, meeting_id: int) -> MeetingAnalyzeResponse:
        from app.services.compare_service import compare_service

        meeting = meeting_repo.get_by_id_or_404(db, meeting_id, "会议")

        if meeting.status == "processing":
            raise BusinessException(
                message="Meeting is already being processed",
                user_friendly_message="会议正在处理中，请稍候～"
            )

        meeting.status = "processing"
        db.add(meeting)
        db.commit()

        try:
            qa_pairs = extract_qa_pairs(meeting.content)

            total_questions = len(qa_pairs)
            correct_count = 0
            error_count = 0

            for qa in qa_pairs:
                result = compare_service.compare_qa(db, meeting.id, qa["question"], qa["answer"])
                if result.is_match:
                    correct_count += 1
                else:
                    error_count += 1

            meeting = meeting_repo.update_stats(
                db, meeting_id, total_questions, correct_count, error_count, "completed"
            )

            return MeetingAnalyzeResponse(
                meeting_id=meeting.id,
                total_questions=meeting.total_questions,
                correct_count=meeting.correct_count,
                error_count=meeting.error_count,
                accuracy=meeting.accuracy,
                status=meeting.status
            )

        except Exception as e:
            meeting.status = "failed"
            db.add(meeting)
            db.commit()
            raise e

    def get_meeting_list(
        self,
        db: Session,
        keyword: Optional[str] = None,
        status: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        page: int = 1,
        page_size: int = 10
    ) -> Tuple[List[Meeting], int, int]:
        return meeting_repo.search(db, keyword, status, start_date, end_date, page, page_size)

    def get_meeting(self, db: Session, meeting_id: int) -> Meeting:
        return meeting_repo.get_by_id_or_404(db, meeting_id, "会议")

    def get_meeting_by_no(self, db: Session, meeting_no: str) -> Meeting:
        return meeting_repo.get_by_meeting_no_or_404(db, meeting_no)

    def update_meeting(self, db: Session, meeting_id: int, meeting_in: MeetingUpdate) -> Meeting:
        meeting = meeting_repo.get_by_id_or_404(db, meeting_id, "会议")
        return meeting_repo.update(db, meeting, meeting_in)

    def delete_meeting(self, db: Session, meeting_id: int) -> Meeting:
        return meeting_repo.soft_delete(db, meeting_id)

    def get_recent_meetings(self, db: Session, days: int = 7, limit: int = 10) -> List[Meeting]:
        return meeting_repo.get_recent_meetings(db, days, limit)


meeting_service = MeetingService()
