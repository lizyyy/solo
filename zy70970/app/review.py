from datetime import datetime
from typing import List, Optional
import uuid

from .models import (
    ReviewRecord, ReviewStatus, ViolationType, SprayJob,
    ValidationResult
)
from .store import store
from .validator import ValidationEngine


class ReviewManager:
    @staticmethod
    def create_review(
        job_id: str,
        reviewer: str,
        status: ReviewStatus,
        review_notes: str,
        adjusted_dosage: Optional[float] = None,
        adjusted_area: Optional[float] = None,
        override_violations: Optional[List[ViolationType]] = None
    ) -> ReviewRecord:
        review_id = str(uuid.uuid4())
        record = ReviewRecord(
            id=review_id,
            job_id=job_id,
            reviewer=reviewer,
            status=status,
            review_notes=review_notes,
            reviewed_at=datetime.now(),
            adjusted_dosage=adjusted_dosage,
            adjusted_area=adjusted_area,
            override_violations=override_violations or []
        )
        store.add_review_record(record)

        if adjusted_dosage is not None or adjusted_area is not None:
            updates = {}
            if adjusted_dosage is not None:
                updates["dosage_used"] = adjusted_dosage
            if adjusted_area is not None:
                updates["area_size_hectares"] = adjusted_area
            store.update_spray_job(job_id, **updates)

            ValidationEngine.validate_single_job(store.get_spray_job(job_id))

        return record

    @staticmethod
    def update_review(
        review_id: str,
        status: Optional[ReviewStatus] = None,
        review_notes: Optional[str] = None,
        adjusted_dosage: Optional[float] = None,
        adjusted_area: Optional[float] = None,
        override_violations: Optional[List[ViolationType]] = None
    ) -> Optional[ReviewRecord]:
        record = store.get_review_record(review_id)
        if not record:
            return None

        if status is not None:
            record.status = status
        if review_notes is not None:
            record.review_notes = review_notes
        if adjusted_dosage is not None:
            record.adjusted_dosage = adjusted_dosage
        if adjusted_area is not None:
            record.adjusted_area = adjusted_area
        if override_violations is not None:
            record.override_violations = override_violations

        record.reviewed_at = datetime.now()

        if adjusted_dosage is not None or adjusted_area is not None:
            updates = {}
            if adjusted_dosage is not None:
                updates["dosage_used"] = adjusted_dosage
            if adjusted_area is not None:
                updates["area_size_hectares"] = adjusted_area
            store.update_spray_job(record.job_id, **updates)

            ValidationEngine.validate_single_job(store.get_spray_job(record.job_id))

        return record

    @staticmethod
    def recalculate_all() -> List[ValidationResult]:
        return ValidationEngine.validate_all_jobs()

    @staticmethod
    def get_job_with_review(job_id: str) -> dict:
        job = store.get_spray_job(job_id)
        validation = store.get_validation_result(job_id)
        review = store.get_review_by_job_id(job_id)

        if not job:
            return {}

        result = job.model_dump()
        result["review_status"] = store.get_job_review_status(job_id).value
        result["validation"] = validation.model_dump() if validation else None
        result["review"] = review.model_dump() if review else None

        if review and review.override_violations and validation:
            result["effective_violations"] = [
                v.model_dump() for v in validation.violations
                if v.type not in review.override_violations
            ]
            result["is_effectively_valid"] = len(result["effective_violations"]) == 0
        else:
            result["effective_violations"] = [
                v.model_dump() for v in validation.violations
            ] if validation else []
            result["is_effectively_valid"] = validation.is_valid if validation else True

        return result

    @staticmethod
    def get_all_jobs_with_reviews() -> List[dict]:
        return [
            ReviewManager.get_job_with_review(job.id)
            for job in store.get_all_spray_jobs()
        ]
