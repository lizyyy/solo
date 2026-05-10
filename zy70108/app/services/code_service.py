from datetime import datetime
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.models import TraceabilityCode, CodeStatus, ExceptionType
from app.services.common import generate_code, log_exception, create_pending_task, TaskType


def generate_codes(db: Session, count: int,
                   cooperative_id: Optional[str] = None) -> List[TraceabilityCode]:
    generated = []
    for _ in range(count):
        for attempt in range(10):
            code = generate_code()
            if not db.query(TraceabilityCode).filter(
                    TraceabilityCode.code == code).first():
                db_code = TraceabilityCode(
                    code=code,
                    status=CodeStatus.AVAILABLE,
                    cooperative_id=cooperative_id
                )
                db.add(db_code)
                generated.append(db_code)
                break
        else:
            log_exception(
                db, ExceptionType.SYSTEM_ERROR, "generate_codes",
                f"Failed to generate unique code after 10 attempts",
                {"cooperative_id": cooperative_id, "count": count}
            )
    db.commit()
    for code in generated:
        db.refresh(code)
    return generated


def get_codes(db: Session, skip: int = 0, limit: int = 100,
              status: Optional[str] = None,
              cooperative_id: Optional[str] = None) -> Tuple[List[TraceabilityCode], int]:
    query = db.query(TraceabilityCode)
    if status:
        query = query.filter(TraceabilityCode.status == status)
    if cooperative_id:
        query = query.filter(TraceabilityCode.cooperative_id == cooperative_id)
    total = query.with_entities(func.count(TraceabilityCode.id)).scalar()
    codes = query.order_by(TraceabilityCode.created_at.desc()).offset(skip).limit(limit).all()
    return codes, total


def get_code_by_value(db: Session, code: str) -> Optional[TraceabilityCode]:
    return db.query(TraceabilityCode).filter(TraceabilityCode.code == code).first()


def issue_codes(db: Session, codes: List[str], farmer_id: str,
                cooperative_id: str) -> Tuple[List[TraceabilityCode], List[str]]:
    issued = []
    invalid = []
    for code_value in codes:
        code = db.query(TraceabilityCode).filter(
            TraceabilityCode.code == code_value
        ).first()
        if not code:
            invalid.append(code_value)
            log_exception(
                db, ExceptionType.INVALID_CODE, "issue_codes",
                f"Code not found: {code_value}",
                {"code": code_value, "farmer_id": farmer_id, "cooperative_id": cooperative_id}
            )
            continue
        if code.status != CodeStatus.AVAILABLE:
            invalid.append(code_value)
            log_exception(
                db, ExceptionType.DATA_CONFLICT, "issue_codes",
                f"Code {code_value} is not available (status: {code.status})",
                {"code": code_value, "current_status": code.status, "farmer_id": farmer_id}
            )
            continue
        code.status = CodeStatus.ISSUED
        code.farmer_id = farmer_id
        code.cooperative_id = cooperative_id
        code.issued_at = datetime.utcnow()
        issued.append(code)
    if invalid:
        create_pending_task(
            db, TaskType.BATCH_PROCESSING,
            f"发码异常处理 - {len(invalid)} 个码无效",
            f"以下码无法发放：{', '.join(invalid[:10])}{'...' if len(invalid) > 10 else ''}",
            {"invalid_codes": invalid, "farmer_id": farmer_id, "cooperative_id": cooperative_id}
        )
    db.commit()
    for code in issued:
        db.refresh(code)
    return issued, invalid


def recycle_codes(db: Session, codes: List[str]) -> Tuple[List[TraceabilityCode], List[str]]:
    recycled = []
    invalid = []
    for code_value in codes:
        code = db.query(TraceabilityCode).filter(
            TraceabilityCode.code == code_value
        ).first()
        if not code:
            invalid.append(code_value)
            log_exception(
                db, ExceptionType.INVALID_CODE, "recycle_codes",
                f"Code not found: {code_value}",
                {"code": code_value}
            )
            continue
        if code.status not in [CodeStatus.ISSUED, CodeStatus.INVALID]:
            invalid.append(code_value)
            log_exception(
                db, ExceptionType.DATA_CONFLICT, "recycle_codes",
                f"Code {code_value} cannot be recycled (status: {code.status})",
                {"code": code_value, "current_status": code.status}
            )
            continue
        code.status = CodeStatus.RECYCLED
        code.recycled_at = datetime.utcnow()
        recycled.append(code)
    if invalid:
        create_pending_task(
            db, TaskType.BATCH_PROCESSING,
            f"回收异常处理 - {len(invalid)} 个码无法回收",
            f"以下码无法回收：{', '.join(invalid[:10])}{'...' if len(invalid) > 10 else ''}",
            {"invalid_codes": invalid}
        )
    db.commit()
    for code in recycled:
        db.refresh(code)
    return recycled, invalid
