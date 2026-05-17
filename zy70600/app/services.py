from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional, List
import json

from app.models import (
    ColdChainBox, TemperatureSample, StoreSignoff,
    PhotoEvidence, ExceptionReview, CompensationConclusion
)
from app.schemas import (
    ColdChainBoxCreate, TemperatureSampleCreate,
    StoreSignoffCreate, PhotoEvidenceCreate,
    ExceptionReviewCreate, CompensationConclusionCreate,
    StatusTransitionRequest, ManualCorrectionRequest
)


BOX_STATUS_TRANSITIONS = {
    "CREATED": ["IN_TRANSIT", "CANCELLED"],
    "IN_TRANSIT": ["ARRIVED", "EXCEPTION"],
    "ARRIVED": ["SIGNED_OFF", "EXCEPTION"],
    "SIGNED_OFF": ["UNDER_REVIEW", "CLOSED"],
    "EXCEPTION": ["UNDER_REVIEW", "RESOLVED"],
    "UNDER_REVIEW": ["COMPENSATED", "REJECTED", "RESOLVED"],
    "COMPENSATED": ["CLOSED"],
    "REJECTED": ["CLOSED", "UNDER_REVIEW"],
    "RESOLVED": ["CLOSED"],
    "CANCELLED": [],
    "CLOSED": []
}


SIGNOFF_STATUS_TRANSITIONS = {
    "DRAFT": ["SUBMITTED", "DISCARDED"],
    "SUBMITTED": ["CONFIRMED", "REJECTED"],
    "CONFIRMED": ["AMENDED"],
    "REJECTED": ["SUBMITTED", "DISCARDED"],
    "DISCARDED": []
}


class StatusTransitionError(Exception):
    pass


class TemperatureValidationError(Exception):
    pass


class DuplicateUploadError(Exception):
    pass


def validate_temperature(temperature: float, temp_min: float, temp_max: float) -> tuple[bool, str]:
    if temperature < temp_min:
        return False, f"温度过低: {temperature}°C，低于下限 {temp_min}°C"
    if temperature > temp_max:
        return False, f"温度过高: {temperature}°C，高于上限 {temp_max}°C"
    return True, "温度正常"


def can_transition_status(current_status: str, target_status: str, transitions: dict) -> bool:
    allowed_next = transitions.get(current_status, [])
    return target_status in allowed_next


def get_box_by_code(db: Session, box_code: str) -> Optional[ColdChainBox]:
    return db.query(ColdChainBox).filter(ColdChainBox.box_code == box_code).first()


def create_box(db: Session, box: ColdChainBoxCreate) -> ColdChainBox:
    existing_box = get_box_by_code(db, box.box_code)
    if existing_box:
        raise DuplicateUploadError(f"冷链箱 {box.box_code} 已存在")
    
    db_box = ColdChainBox(**box.model_dump(), status="CREATED")
    db.add(db_box)
    db.commit()
    db.refresh(db_box)
    return db_box


def transition_box_status(
    db: Session, 
    box_code: str, 
    request: StatusTransitionRequest
) -> ColdChainBox:
    db_box = get_box_by_code(db, box_code)
    if not db_box:
        raise ValueError(f"冷链箱 {box_code} 不存在")
    
    if not can_transition_status(db_box.status, request.target_status, BOX_STATUS_TRANSITIONS):
        raise StatusTransitionError(
            f"状态转换不允许: {db_box.status} -> {request.target_status}. "
            f"允许的状态: {BOX_STATUS_TRANSITIONS.get(db_box.status, [])}"
        )
    
    db_box.status = request.target_status
    db_box.updated_at = datetime.now()
    db.commit()
    db.refresh(db_box)
    return db_box


def create_temperature_sample(db: Session, sample: TemperatureSampleCreate) -> TemperatureSample:
    db_box = get_box_by_code(db, sample.box_code)
    if not db_box:
        raise ValueError(f"冷链箱 {sample.box_code} 不存在")
    
    is_anomaly, _ = validate_temperature(
        sample.temperature, 
        db_box.temperature_min, 
        db_box.temperature_max
    )
    is_anomaly = not is_anomaly
    
    db_sample = TemperatureSample(
        box_id=db_box.id,
        sample_time=sample.sample_time,
        temperature=sample.temperature,
        probe_id=sample.probe_id,
        is_anomaly=is_anomaly
    )
    db.add(db_sample)
    db.commit()
    db.refresh(db_sample)
    
    if is_anomaly and db_box.status not in ["EXCEPTION", "UNDER_REVIEW"]:
        db_box.status = "EXCEPTION"
        db.commit()
    
    return db_sample


def create_signoff(db: Session, signoff: StoreSignoffCreate) -> StoreSignoff:
    db_box = get_box_by_code(db, signoff.box_code)
    if not db_box:
        raise ValueError(f"冷链箱 {signoff.box_code} 不存在")
    
    db_signoff = StoreSignoff(
        box_id=db_box.id,
        **signoff.model_dump(exclude={"box_code"}),
        status="DRAFT"
    )
    db.add(db_signoff)
    db.commit()
    db.refresh(db_signoff)
    return db_signoff


def transition_signoff_status(
    db: Session,
    signoff_id: int,
    target_status: str,
    operator: str
) -> StoreSignoff:
    db_signoff = db.query(StoreSignoff).filter(StoreSignoff.id == signoff_id).first()
    if not db_signoff:
        raise ValueError(f"签收记录 {signoff_id} 不存在")
    
    if not can_transition_status(db_signoff.status, target_status, SIGNOFF_STATUS_TRANSITIONS):
        raise StatusTransitionError(
            f"签收状态转换不允许: {db_signoff.status} -> {target_status}"
        )
    
    db_signoff.status = target_status
    db_signoff.updated_at = datetime.now()
    db.commit()
    db.refresh(db_signoff)
    
    if target_status == "CONFIRMED":
        db_box = db.query(ColdChainBox).filter(ColdChainBox.id == db_signoff.box_id).first()
        if db_box and db_box.status == "ARRIVED":
            db_box.status = "SIGNED_OFF"
            db.commit()
    
    return db_signoff


def create_photo_evidence(db: Session, photo: PhotoEvidenceCreate) -> PhotoEvidence:
    existing_photo = db.query(PhotoEvidence).filter(PhotoEvidence.photo_key == photo.photo_key).first()
    if existing_photo:
        raise DuplicateUploadError(f"照片凭证 {photo.photo_key} 已存在，跳过重复上传")
    
    db_box = get_box_by_code(db, photo.box_code)
    if not db_box:
        raise ValueError(f"冷链箱 {photo.box_code} 不存在")
    
    db_photo = PhotoEvidence(
        box_id=db_box.id,
        **photo.model_dump(exclude={"box_code"})
    )
    db.add(db_photo)
    db.commit()
    db.refresh(db_photo)
    return db_photo


def create_exception_review(db: Session, review: ExceptionReviewCreate) -> ExceptionReview:
    db_box = get_box_by_code(db, review.box_code)
    if not db_box:
        raise ValueError(f"冷链箱 {review.box_code} 不存在")
    
    db_signoff = db.query(StoreSignoff).filter(StoreSignoff.id == review.signoff_id).first()
    if not db_signoff:
        raise ValueError(f"签收记录 {review.signoff_id} 不存在")
    
    original_input = json.dumps({
        "signoff_data": {
            "store_code": db_signoff.store_code,
            "signoff_person": db_signoff.signoff_person,
            "signoff_time": db_signoff.signoff_time.isoformat(),
            "temperature_arrival": db_signoff.temperature_arrival,
            "has_exception": db_signoff.has_exception,
            "exception_desc": db_signoff.exception_desc
        },
        "reviewer": review.reviewer,
        "review_time": datetime.now().isoformat()
    })
    
    db_review = ExceptionReview(
        box_id=db_box.id,
        signoff_id=review.signoff_id,
        reviewer=review.reviewer,
        original_input=original_input,
        review_result=review.review_result,
        review_comment=review.review_comment,
        temperature_violation=review.temperature_violation,
        compensation_eligible=review.compensation_eligible,
        status="PENDING"
    )
    db.add(db_review)
    db.commit()
    db.refresh(db_review)
    
    if db_box.status == "SIGNED_OFF" or db_box.status == "EXCEPTION":
        db_box.status = "UNDER_REVIEW"
        db_box.updated_at = datetime.now()
        db.commit()
    
    return db_review


def create_compensation_conclusion(
    db: Session, 
    conclusion: CompensationConclusionCreate
) -> CompensationConclusion:
    db_box = get_box_by_code(db, conclusion.box_code)
    if not db_box:
        raise ValueError(f"冷链箱 {conclusion.box_code} 不存在")
    
    db_review = db.query(ExceptionReview).filter(ExceptionReview.id == conclusion.review_id).first()
    if not db_review:
        raise ValueError(f"复核记录 {conclusion.review_id} 不存在")
    
    db_conclusion = CompensationConclusion(
        box_id=db_box.id,
        review_id=conclusion.review_id,
        **conclusion.model_dump(exclude={"box_code", "review_id"}),
        status="DRAFT"
    )
    db.add(db_conclusion)
    db.commit()
    db.refresh(db_conclusion)
    
    if conclusion.approved_by:
        db_conclusion.status = "CONFIRMED"
        db_box.status = "COMPENSATED"
        db_box.updated_at = datetime.now()
        db.commit()
        db.refresh(db_conclusion)
    
    return db_conclusion


def manual_correction(
    db: Session,
    box_code: str,
    request: ManualCorrectionRequest
) -> ColdChainBox:
    db_box = get_box_by_code(db, box_code)
    if not db_box:
        raise ValueError(f"冷链箱 {box_code} 不存在")
    
    if not hasattr(db_box, request.field_name):
        raise ValueError(f"字段 {request.field_name} 不存在")
    
    old_value = str(getattr(db_box, request.field_name))
    if old_value != request.old_value:
        raise ValueError(f"旧值不匹配，预期 {request.old_value}，实际 {old_value}")
    
    setattr(db_box, request.field_name, request.new_value)
    db_box.updated_at = datetime.now()
    db.commit()
    db.refresh(db_box)
    
    return db_box


def get_box_detail(db: Session, box_code: str) -> Optional[ColdChainBox]:
    return db.query(ColdChainBox).filter(ColdChainBox.box_code == box_code).first()


def list_boxes(
    db: Session,
    status: Optional[str] = None,
    batch_no: Optional[str] = None,
    skip: int = 0,
    limit: int = 100
) -> List[ColdChainBox]:
    query = db.query(ColdChainBox)
    if status:
        query = query.filter(ColdChainBox.status == status)
    if batch_no:
        query = query.filter(ColdChainBox.batch_no == batch_no)
    return query.offset(skip).limit(limit).all()


def close_box(db: Session, box_code: str, operator: str) -> ColdChainBox:
    db_box = get_box_by_code(db, box_code)
    if not db_box:
        raise ValueError(f"冷链箱 {box_code} 不存在")
    
    if db_box.status == "CLOSED":
        raise StatusTransitionError("冷链箱已处于关闭状态")
    
    if db_box.status not in ["COMPENSATED", "REJECTED", "RESOLVED"]:
        raise StatusTransitionError(
            f"当前状态 {db_box.status} 不允许关闭，需先完成赔付或问题解决"
        )
    
    db_box.status = "CLOSED"
    db_box.updated_at = datetime.now()
    db.commit()
    db.refresh(db_box)
    return db_box
