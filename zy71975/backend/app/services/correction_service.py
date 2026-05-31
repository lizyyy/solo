from typing import Optional, Tuple, List, Dict, Any
from sqlalchemy.orm import Session

from app.models.correction import CorrectionRecord
from app.models.compare import CompareResult
from app.models.meeting import Meeting
from app.repositories.meeting_repo import meeting_repo
from app.schemas.correction import CorrectionCreate, CorrectionUpdate, CorrectionBatchResponse
from app.core.exceptions import ResourceNotFoundException, ValidationException


class CorrectionService:
    def create_correction(self, db: Session, correction_in: CorrectionCreate) -> CorrectionRecord:
        meeting_repo.get_by_id_or_404(db, correction_in.meeting_id, "会议")

        original_status = None
        original_answer = None

        if correction_in.compare_result_id:
            compare_result = db.query(CompareResult).filter(
                CompareResult.id == correction_in.compare_result_id,
                CompareResult.is_deleted == False
            ).first()

            if not compare_result:
                raise ResourceNotFoundException("比对结果", correction_in.compare_result_id)

            original_status = compare_result.status
            original_answer = compare_result.meeting_answer

            compare_result.status = correction_in.corrected_status
            if correction_in.corrected_answer:
                compare_result.meeting_answer = correction_in.corrected_answer
            db.add(compare_result)

        correction = CorrectionRecord(
            meeting_id=correction_in.meeting_id,
            compare_result_id=correction_in.compare_result_id,
            original_status=original_status,
            corrected_status=correction_in.corrected_status,
            original_answer=original_answer,
            corrected_answer=correction_in.corrected_answer,
            correction_reason=correction_in.correction_reason,
            operator=correction_in.operator
        )

        db.add(correction)
        db.commit()
        db.refresh(correction)

        self._update_meeting_stats(db, correction_in.meeting_id)

        return correction

    def _update_meeting_stats(self, db: Session, meeting_id: int) -> None:
        compare_results = db.query(CompareResult).filter(
            CompareResult.meeting_id == meeting_id,
            CompareResult.is_deleted == False
        ).all()

        total = len(compare_results)
        correct = sum(1 for r in compare_results if r.status == "correct")
        error = sum(1 for r in compare_results if r.status == "error")

        meeting_repo.update_stats(db, meeting_id, total, correct, error)

    def batch_correct(self, db: Session, meeting_id: int, corrections: List[CorrectionCreate], operator: Optional[str] = None) -> CorrectionBatchResponse:
        meeting_repo.get_by_id_or_404(db, meeting_id, "会议")

        success_count = 0
        fail_count = 0

        for correction_in in corrections:
            try:
                if correction_in.meeting_id != meeting_id:
                    correction_in.meeting_id = meeting_id
                if operator and not correction_in.operator:
                    correction_in.operator = operator

                self.create_correction(db, correction_in)
                success_count += 1
            except Exception:
                fail_count += 1

        return CorrectionBatchResponse(
            meeting_id=meeting_id,
            total_count=len(corrections),
            success_count=success_count,
            fail_count=fail_count
        )

    def get_correction_list(
        self,
        db: Session,
        meeting_id: Optional[int] = None,
        operator: Optional[str] = None,
        page: int = 1,
        page_size: int = 20
    ) -> Tuple[List[CorrectionRecord], int, int]:
        query = db.query(CorrectionRecord).filter(CorrectionRecord.is_deleted == False)

        if meeting_id:
            query = query.filter(CorrectionRecord.meeting_id == meeting_id)

        if operator:
            query = query.filter(CorrectionRecord.operator == operator)

        query = query.order_by(CorrectionRecord.created_at.desc())

        total = query.count()
        skip = (page - 1) * page_size
        items = query.offset(skip).limit(page_size).all()
        total_pages = (total + page_size - 1) // page_size

        return items, total, total_pages

    def get_correction(self, db: Session, correction_id: int) -> CorrectionRecord:
        correction = db.query(CorrectionRecord).filter(
            CorrectionRecord.id == correction_id,
            CorrectionRecord.is_deleted == False
        ).first()

        if not correction:
            raise ResourceNotFoundException("修正记录", correction_id)

        return correction

    def update_correction(self, db: Session, correction_id: int, correction_in: CorrectionUpdate) -> CorrectionRecord:
        correction = self.get_correction(db, correction_id)

        update_data = correction_in.model_dump(exclude_unset=True) if hasattr(correction_in, 'model_dump') else correction_in.dict(exclude_unset=True)

        for field, value in update_data.items():
            if hasattr(correction, field):
                setattr(correction, field, value)

        db.add(correction)
        db.commit()
        db.refresh(correction)

        if correction.compare_result_id:
            compare_result = db.query(CompareResult).filter(
                CompareResult.id == correction.compare_result_id
            ).first()
            if compare_result:
                if correction.corrected_status:
                    compare_result.status = correction.corrected_status
                if correction.corrected_answer:
                    compare_result.meeting_answer = correction.corrected_answer
                db.add(compare_result)
                db.commit()

        self._update_meeting_stats(db, correction.meeting_id)

        return correction

    def delete_correction(self, db: Session, correction_id: int) -> CorrectionRecord:
        correction = self.get_correction(db, correction_id)
        correction.is_deleted = True
        db.add(correction)
        db.commit()
        db.refresh(correction)

        self._update_meeting_stats(db, correction.meeting_id)

        return correction

    def get_correction_stats(self, db: Session, meeting_id: int) -> Dict[str, Any]:
        meeting_repo.get_by_id_or_404(db, meeting_id, "会议")

        corrections = db.query(CorrectionRecord).filter(
            CorrectionRecord.meeting_id == meeting_id,
            CorrectionRecord.is_deleted == False
        ).all()

        status_counts = {}
        operator_counts = {}

        for c in corrections:
            status_counts[c.corrected_status] = status_counts.get(c.corrected_status, 0) + 1
            if c.operator:
                operator_counts[c.operator] = operator_counts.get(c.operator, 0) + 1

        return {
            "meeting_id": meeting_id,
            "total_corrections": len(corrections),
            "status_distribution": status_counts,
            "operator_distribution": operator_counts
        }


correction_service = CorrectionService()
