import hashlib
import json
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc, asc

from models import ReviewSample, FilterCondition
import schemas


class FilterService:
    @staticmethod
    def _generate_condition_hash(conditions: Dict[str, Any], page: int, page_size: int,
                                 sort_by: str = None, sort_order: str = "desc") -> str:
        data = {
            "conditions": conditions,
            "page": page,
            "page_size": page_size,
            "sort_by": sort_by,
            "sort_order": sort_order,
        }
        return hashlib.md5(json.dumps(data, sort_keys=True).encode()).hexdigest()

    @staticmethod
    def _build_query_from_conditions(query, conditions: Dict[str, Any]):
        filters = []

        if "sample_batch_no" in conditions and conditions["sample_batch_no"]:
            filters.append(ReviewSample.sample_batch_no == conditions["sample_batch_no"])

        if "sample_date_start" in conditions and conditions["sample_date_start"]:
            filters.append(ReviewSample.sample_date >= conditions["sample_date_start"])

        if "sample_date_end" in conditions and conditions["sample_date_end"]:
            filters.append(ReviewSample.sample_date <= conditions["sample_date_end"])

        if "review_status" in conditions and conditions["review_status"]:
            if isinstance(conditions["review_status"], list):
                filters.append(ReviewSample.review_status.in_(conditions["review_status"]))
            else:
                filters.append(ReviewSample.review_status == conditions["review_status"])

        if "is_anomaly" in conditions and conditions["is_anomaly"] is not None:
            filters.append(ReviewSample.is_anomaly == conditions["is_anomaly"])

        if "anomaly_type" in conditions and conditions["anomaly_type"]:
            if isinstance(conditions["anomaly_type"], list):
                filters.append(ReviewSample.anomaly_type.in_(conditions["anomaly_type"]))
            else:
                filters.append(ReviewSample.anomaly_type == conditions["anomaly_type"])

        if "sampler" in conditions and conditions["sampler"]:
            filters.append(ReviewSample.sampler == conditions["sampler"])

        if "reviewer" in conditions and conditions["reviewer"]:
            filters.append(ReviewSample.reviewer == conditions["reviewer"])

        if "has_late_data" in conditions and conditions["has_late_data"]:
            filters.append(
                or_(
                    ReviewSample.inspection.has(is_late_submit=True),
                    ReviewSample.dialog.has(is_late_supplement=True),
                    ReviewSample.knowledge_entry.has(is_manual_modified=True),
                )
            )

        if filters:
            query = query.filter(and_(*filters))

        return query

    @staticmethod
    def get_or_create_filter(
        db: Session,
        filter_data: schemas.FilterConditionCreate,
    ) -> Tuple[FilterCondition, bool]:
        condition_hash = FilterService._generate_condition_hash(
            filter_data.conditions,
            filter_data.page,
            filter_data.page_size,
            filter_data.sort_by,
            filter_data.sort_order,
        )

        existing = db.query(FilterCondition).filter(
            FilterCondition.condition_hash == condition_hash
        ).first()

        if existing:
            existing.last_used_at = datetime.now()
            if filter_data.total_count > 0:
                existing.total_count = filter_data.total_count
            db.flush()
            return existing, False

        new_filter = FilterCondition(
            condition_hash=condition_hash,
            conditions=filter_data.conditions,
            page=filter_data.page,
            page_size=filter_data.page_size,
            sort_by=filter_data.sort_by,
            sort_order=filter_data.sort_order,
            total_count=filter_data.total_count,
            created_by=filter_data.created_by,
            last_used_at=datetime.now(),
        )
        db.add(new_filter)
        db.flush()
        return new_filter, True

    @staticmethod
    def query_samples(
        db: Session,
        filter_condition: schemas.FilterConditionCreate,
        associate_filter: bool = True,
    ) -> Tuple[List[ReviewSample], int, FilterCondition]:
        query = db.query(ReviewSample)

        query = FilterService._build_query_from_conditions(query, filter_condition.conditions)

        total_count = query.count()
        filter_condition.total_count = total_count

        if filter_condition.sort_by:
            sort_func = desc if filter_condition.sort_order == "desc" else asc
            query = query.order_by(sort_func(getattr(ReviewSample, filter_condition.sort_by)))
        else:
            query = query.order_by(desc(ReviewSample.created_at))

        offset = (filter_condition.page - 1) * filter_condition.page_size
        samples = query.offset(offset).limit(filter_condition.page_size).all()

        db_filter, _ = FilterService.get_or_create_filter(db, filter_condition)

        if associate_filter:
            for sample in samples:
                sample.filter_condition_id = db_filter.id

        return samples, total_count, db_filter

    @staticmethod
    def get_filter_by_hash(db: Session, condition_hash: str) -> Optional[FilterCondition]:
        return db.query(FilterCondition).filter(
            FilterCondition.condition_hash == condition_hash
        ).first()

    @staticmethod
    def get_filter_samples(db: Session, filter_id: int, apply_conditions: bool = True) -> List[ReviewSample]:
        filter_cond = db.query(FilterCondition).filter(FilterCondition.id == filter_id).first()
        if not filter_cond:
            raise ValueError(f"Filter {filter_id} not found")

        if not apply_conditions:
            return db.query(ReviewSample).filter(
                ReviewSample.filter_condition_id == filter_id
            ).all()

        query = db.query(ReviewSample)
        query = FilterService._build_query_from_conditions(query, filter_cond.conditions)

        if filter_cond.sort_by:
            sort_func = desc if filter_cond.sort_order == "desc" else asc
            query = query.order_by(sort_func(getattr(ReviewSample, filter_cond.sort_by)))
        else:
            query = query.order_by(desc(ReviewSample.created_at))

        return query.all()

    @staticmethod
    def get_associated_samples(db: Session, filter_id: int) -> List[ReviewSample]:
        return db.query(ReviewSample).filter(
            ReviewSample.filter_condition_id == filter_id
        ).all()

    @staticmethod
    def compare_filters(db: Session, filter_id_1: int, filter_id_2: int) -> Dict[str, Any]:
        f1 = db.query(FilterCondition).filter(FilterCondition.id == filter_id_1).first()
        f2 = db.query(FilterCondition).filter(FilterCondition.id == filter_id_2).first()

        if not f1 or not f2:
            raise ValueError("Filter not found")

        return {
            "hash_match": f1.condition_hash == f2.condition_hash,
            "conditions_match": f1.conditions == f2.conditions,
            "page_match": f1.page == f2.page,
            "page_size_match": f1.page_size == f2.page_size,
            "sort_match": f1.sort_by == f2.sort_by and f1.sort_order == f2.sort_order,
            "total_count_diff": f2.total_count - f1.total_count,
            "filter_1_id": f1.id,
            "filter_2_id": f2.id,
        }

    @staticmethod
    def get_recent_filters(db: Session, limit: int = 10, created_by: str = None) -> List[FilterCondition]:
        query = db.query(FilterCondition)
        if created_by:
            query = query.filter(FilterCondition.created_by == created_by)
        return query.order_by(desc(FilterCondition.last_used_at)).limit(limit).all()
