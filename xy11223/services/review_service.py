from typing import Dict, List, Optional, Any
from datetime import datetime
from sqlalchemy.orm import Session
from database import SessionLocal
from utils import generate_review_id
from models import (
    FoodSample, TemperatureRecord, WasteRecord,
    ReviewRecord, RecordStatus, ReviewStatus
)


class ReviewService:
    def __init__(self, db: Optional[Session] = None):
        self.db = db or SessionLocal()

    def __del__(self):
        if hasattr(self, 'db'):
            self.db.close()

    def create_review(self,
                      record_id: str,
                      record_type: str,
                      reviewer_id: str,
                      reviewer_name: str,
                      review_result: str,
                      review_notes: str = "") -> Dict[str, Any]:

        review = ReviewRecord(
            id=generate_review_id(),
            reviewer_id=reviewer_id,
            reviewer_name=reviewer_name,
            review_status=ReviewStatus.REVIEWED,
            review_result=review_result,
            review_notes=review_notes,
            review_time=datetime.utcnow()
        )

        if record_type == "sample":
            review.sample_id = record_id
            sample = self.db.query(FoodSample).get(record_id)
            if sample:
                sample.status = review_result
        elif record_type == "temperature":
            review.temperature_record_id = record_id
            temp = self.db.query(TemperatureRecord).get(record_id)
            if temp:
                temp.status = review_result
        elif record_type == "waste":
            review.waste_record_id = record_id
            waste = self.db.query(WasteRecord).get(record_id)
            if waste:
                waste.status = review_result

        self.db.add(review)
        self.db.commit()

        return review.to_dict()

    def batch_review(self,
                     record_ids: List[str],
                     record_type: str,
                     reviewer_id: str,
                     reviewer_name: str,
                     review_result: str,
                     review_notes: str = "") -> Dict[str, Any]:

        success_count = 0
        failed_ids = []

        for record_id in record_ids:
            try:
                self.create_review(
                    record_id, record_type, reviewer_id, reviewer_name, review_result, review_notes
                )
                success_count += 1
            except Exception as e:
                failed_ids.append({
                    "record_id": record_id,
                    "error": str(e)
                })

        return {
            "total": len(record_ids),
            "success_count": success_count,
            "failed_count": len(failed_ids),
            "failed_items": failed_ids
        }

    def get_review_by_record(self, record_id: str, record_type: str) -> Optional[Dict[str, Any]]:
        query = self.db.query(ReviewRecord)

        if record_type == "sample":
            query = query.filter(ReviewRecord.sample_id == record_id)
        elif record_type == "temperature":
            query = query.filter(ReviewRecord.temperature_record_id == record_id)
        elif record_type == "waste":
            query = query.filter(ReviewRecord.waste_record_id == record_id)

        review = query.first()
        return review.to_dict() if review else None

    def query_reviews(self,
                      reviewer_id: str = None,
                      review_status: str = None,
                      review_result: str = None,
                      start_time: datetime = None,
                      end_time: datetime = None,
                      offset: int = 0,
                      limit: int = 100) -> Dict[str, Any]:

        query = self.db.query(ReviewRecord)

        if reviewer_id:
            query = query.filter(ReviewRecord.reviewer_id == reviewer_id)
        if review_status:
            query = query.filter(ReviewRecord.review_status == review_status)
        if review_result:
            query = query.filter(ReviewRecord.review_result == review_result)
        if start_time:
            query = query.filter(ReviewRecord.review_time >= start_time)
        if end_time:
            query = query.filter(ReviewRecord.review_time <= end_time)

        total = query.count()
        reviews = query.order_by(ReviewRecord.review_time.desc()).offset(offset).limit(limit).all()

        return {
            "total": total,
            "items": [r.to_dict() for r in reviews]
        }

    def appeal_review(self,
                      review_id: str,
                      appeal_reason: str) -> Dict[str, Any]:

        review = self.db.query(ReviewRecord).get(review_id)
        if not review:
            return {"error": "复核记录不存在"}

        review.review_status = ReviewStatus.APPEALED
        review.appeal_reason = appeal_reason
        review.appeal_time = datetime.utcnow()

        self.db.commit()
        return review.to_dict()

    def resolve_appeal(self,
                       review_id: str,
                       reviewer_id: str,
                       reviewer_name: str,
                       appeal_result: str,
                       appeal_notes: str = "") -> Dict[str, Any]:

        review = self.db.query(ReviewRecord).get(review_id)
        if not review:
            return {"error": "复核记录不存在"}

        review.reviewer_id_2 = reviewer_id
        review.reviewer_name_2 = reviewer_name
        review.appeal_result = appeal_result

        self.db.commit()
        return review.to_dict()

    def get_pending_review_count(self) -> Dict[str, int]:
        sample_count = self.db.query(FoodSample).filter(
            ~FoodSample.id.in_(
                self.db.query(ReviewRecord.sample_id).filter(ReviewRecord.sample_id.isnot(None)).distinct()
            )
        ).count()

        temp_count = self.db.query(TemperatureRecord).filter(
            ~TemperatureRecord.id.in_(
                self.db.query(ReviewRecord.temperature_record_id).filter(
                    ReviewRecord.temperature_record_id.isnot(None)).distinct()
            )
        ).count()

        waste_count = self.db.query(WasteRecord).filter(
            ~WasteRecord.id.in_(
                self.db.query(ReviewRecord.waste_record_id).filter(ReviewRecord.waste_record_id.isnot(None)).distinct()
            )
        ).count()

        return {
            "samples": sample_count,
            "temperature": temp_count,
            "waste": waste_count,
            "total": sample_count + temp_count + waste_count
        }
