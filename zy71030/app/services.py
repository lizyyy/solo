from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List, Optional, Tuple
import hashlib

from app.database import (
    Slide, SecondRead, BorrowRecord, OpinionVersion,
    ReviewRecord, ImportRecord, SecondReadStatus, BorrowStatus,
    get_db
)
from app import schemas


def generate_import_hash(slide_number: str, first_read_doctor: str, first_read_opinion: str) -> str:
    data = f"{slide_number}|{first_read_doctor}|{first_read_opinion[:100]}"
    return hashlib.md5(data.encode()).hexdigest()


def validate_second_read_data(db: Session, data: schemas.SecondReadCreate) -> Tuple[bool, List[str]]:
    errors = []

    if not data.slide_number or len(data.slide_number.strip()) == 0:
        errors.append("切片号不能为空")

    if not data.first_read_doctor or len(data.first_read_doctor.strip()) == 0:
        errors.append("初读医生不能为空")

    if not data.first_read_opinion or len(data.first_read_opinion.strip()) == 0:
        errors.append("初读意见不能为空")

    if data.first_read_date > datetime.now():
        errors.append("初读日期不能晚于当前时间")

    if data.deadline and data.deadline < datetime.now():
        errors.append("截止日期不能早于当前时间")

    return len(errors) == 0, errors


def check_duplicate_import(db: Session, slide_number: str, import_hash: str) -> Optional[ImportRecord]:
    return db.query(ImportRecord).filter(
        ImportRecord.import_hash == import_hash
    ).first()


def get_or_create_slide(db: Session, slide_data: schemas.SlideCreate) -> Slide:
    slide = db.query(Slide).filter(Slide.slide_number == slide_data.slide_number).first()
    if not slide:
        slide = Slide(**slide_data.model_dump())
        db.add(slide)
        db.commit()
        db.refresh(slide)
    return slide


def create_second_read(db: Session, data: schemas.SecondReadCreate) -> Tuple[dict, List[str]]:
    is_valid, errors = validate_second_read_data(db, data)
    if not is_valid:
        return {"status": "error", "message": "数据校验失败"}, errors

    import_hash = generate_import_hash(
        data.slide_number,
        data.first_read_doctor,
        data.first_read_opinion
    )

    duplicate = check_duplicate_import(db, data.slide_number, import_hash)
    if duplicate:
        existing = db.query(SecondRead).join(Slide).filter(
            Slide.slide_number == data.slide_number
        ).first()
        return {
            "status": "duplicate",
            "message": "该切片二读记录已存在",
            "is_duplicate": True,
            "existing_record": {
                "slide_number": data.slide_number,
                "import_date": duplicate.import_date.isoformat(),
                "status": existing.status if existing else None
            }
        }, []

    slide = db.query(Slide).filter(Slide.slide_number == data.slide_number).first()
    if not slide:
        slide = Slide(
            slide_number=data.slide_number,
            patient_id="UNKNOWN",
            patient_name="UNKNOWN"
        )
        db.add(slide)
        db.commit()
        db.refresh(slide)

    second_read = SecondRead(
        slide_id=slide.id,
        first_read_doctor=data.first_read_doctor,
        first_read_opinion=data.first_read_opinion,
        first_read_date=data.first_read_date,
        second_read_doctor=data.second_read_doctor,
        deadline=data.deadline or (datetime.now() + timedelta(days=7)),
        status=SecondReadStatus.FIRST_READ
    )
    db.add(second_read)

    opinion_version = OpinionVersion(
        slide_id=slide.id,
        version_number=1,
        doctor=data.first_read_doctor,
        opinion=data.first_read_opinion,
        opinion_type="first_read",
        is_active=True
    )
    db.add(opinion_version)

    import_record = ImportRecord(
        slide_number=data.slide_number,
        import_hash=import_hash,
        import_status="success",
        message="导入成功"
    )
    db.add(import_record)

    db.commit()
    db.refresh(second_read)

    return {
        "status": "success",
        "message": "二读记录创建成功",
        "is_duplicate": False,
        "id": second_read.id,
        "slide_number": data.slide_number
    }, []


def update_second_read_status(db: Session, second_read_id: int, new_status: SecondReadStatus) -> Optional[SecondRead]:
    second_read = db.query(SecondRead).filter(SecondRead.id == second_read_id).first()
    if not second_read:
        return None

    valid_transitions = {
        SecondReadStatus.PENDING: [SecondReadStatus.FIRST_READ, SecondReadStatus.CANCELLED],
        SecondReadStatus.FIRST_READ: [SecondReadStatus.SECOND_READ_IN_PROGRESS, SecondReadStatus.CANCELLED],
        SecondReadStatus.SECOND_READ_IN_PROGRESS: [
            SecondReadStatus.SECOND_READ_COMPLETED,
            SecondReadStatus.REVISED,
            SecondReadStatus.CANCELLED
        ],
        SecondReadStatus.SECOND_READ_COMPLETED: [SecondReadStatus.REVISED, SecondReadStatus.REPORTED, SecondReadStatus.CANCELLED],
        SecondReadStatus.REVISED: [SecondReadStatus.REPORTED, SecondReadStatus.CANCELLED],
        SecondReadStatus.REPORTED: [],
        SecondReadStatus.CANCELLED: []
    }

    if new_status not in valid_transitions.get(second_read.status, []):
        return None

    second_read.status = new_status
    db.commit()
    db.refresh(second_read)
    return second_read


def process_second_read(db: Session, second_read_id: int, data: schemas.SecondReadUpdate) -> Tuple[dict, List[str]]:
    errors = []
    second_read = db.query(SecondRead).filter(SecondRead.id == second_read_id).first()

    if not second_read:
        return {"status": "error", "message": "二读记录不存在"}, ["二读记录不存在"]

    if second_read.status == SecondReadStatus.CANCELLED:
        return {"status": "error", "message": "该记录已被撤销"}, ["该记录已被撤销"]

    if data.second_read_opinion:
        if not second_read.second_read_doctor:
            errors.append("未指定二读医生")
            return {"status": "error", "message": "未指定二读医生"}, errors

        second_read.second_read_opinion = data.second_read_opinion
        second_read.second_read_date = data.second_read_date or datetime.now()
        second_read.status = SecondReadStatus.SECOND_READ_COMPLETED

        opinion_version = OpinionVersion(
            slide_id=second_read.slide_id,
            version_number=db.query(OpinionVersion).filter(
                OpinionVersion.slide_id == second_read.slide_id
            ).count() + 1,
            doctor=second_read.second_read_doctor,
            opinion=data.second_read_opinion,
            opinion_type="second_read",
            is_active=True
        )
        db.add(opinion_version)

    if data.revision_opinion:
        if second_read.status not in [SecondReadStatus.SECOND_READ_COMPLETED, SecondReadStatus.REVISED]:
            errors.append("只能在二读完成后进行修订")
            return {"status": "error", "message": "只能在二读完成后进行修订"}, errors

        second_read.revision_opinion = data.revision_opinion
        second_read.revision_date = data.revision_date or datetime.now()
        second_read.status = SecondReadStatus.REVISED

        opinion_version = OpinionVersion(
            slide_id=second_read.slide_id,
            version_number=db.query(OpinionVersion).filter(
                OpinionVersion.slide_id == second_read.slide_id
            ).count() + 1,
            doctor=second_read.second_read_doctor,
            opinion=data.revision_opinion,
            opinion_type="revision",
            is_active=True
        )
        db.add(opinion_version)

    db.commit()
    db.refresh(second_read)

    return {
        "status": "success",
        "message": "更新成功",
        "id": second_read.id,
        "current_status": second_read.status
    }, []


def cancel_second_read(db: Session, second_read_id: int, reason: str) -> Tuple[dict, List[str]]:
    second_read = db.query(SecondRead).filter(SecondRead.id == second_read_id).first()

    if not second_read:
        return {"status": "error", "message": "二读记录不存在"}, ["二读记录不存在"]

    if second_read.status == SecondReadStatus.REPORTED:
        return {"status": "error", "message": "已报告的记录不能撤销"}, ["已报告的记录不能撤销"]

    second_read.status = SecondReadStatus.CANCELLED
    db.commit()

    return {"status": "success", "message": "撤销成功", "reason": reason}, []


def review_second_read(db: Session, data: schemas.ReviewRecordCreate) -> Tuple[dict, List[str]]:
    second_read = db.query(SecondRead).filter(SecondRead.id == data.second_read_id).first()

    if not second_read:
        return {"status": "error", "message": "二读记录不存在"}, ["二读记录不存在"]

    if second_read.status not in [SecondReadStatus.SECOND_READ_COMPLETED, SecondReadStatus.REVISED]:
        return {"status": "error", "message": "只能复核已完成或已修订的记录"}, ["只能复核已完成或已修订的记录"]

    review = ReviewRecord(**data.model_dump())
    db.add(review)

    if data.is_approved:
        second_read.is_report_issued = True
        second_read.report_issued_date = datetime.now()
        second_read.status = SecondReadStatus.REPORTED

    db.commit()

    return {"status": "success", "message": "复核完成", "is_approved": data.is_approved}, []


def create_borrow_record(db: Session, data: schemas.BorrowRecordCreate) -> Tuple[dict, List[str]]:
    slide = db.query(Slide).filter(Slide.slide_number == data.slide_number).first()
    if not slide:
        return {"status": "error", "message": "切片不存在"}, ["切片不存在"]

    active_borrow = db.query(BorrowRecord).filter(
        BorrowRecord.slide_id == slide.id,
        BorrowRecord.status.in_([BorrowStatus.BORROWED, BorrowStatus.OVERDUE])
    ).first()

    if active_borrow:
        return {"status": "error", "message": "该切片正在借出中"}, ["该切片正在借出中"]

    borrow = BorrowRecord(
        slide_id=slide.id,
        borrower=data.borrower,
        borrower_department=data.borrower_department,
        borrow_date=data.borrow_date,
        due_date=data.due_date,
        notes=data.notes,
        status=BorrowStatus.BORROWED
    )
    db.add(borrow)
    db.commit()
    db.refresh(borrow)

    return {"status": "success", "message": "借片成功", "id": borrow.id}, []


def return_borrow_record(db: Session, borrow_id: int, data: schemas.BorrowRecordReturn) -> Tuple[dict, List[str]]:
    borrow = db.query(BorrowRecord).filter(BorrowRecord.id == borrow_id).first()

    if not borrow:
        return {"status": "error", "message": "借片记录不存在"}, ["借片记录不存在"]

    if borrow.status == BorrowStatus.RETURNED:
        return {"status": "error", "message": "该切片已归还"}, ["该切片已归还"]

    borrow.return_date = data.return_date
    borrow.status = BorrowStatus.RETURNED
    db.commit()

    return {"status": "success", "message": "归还成功"}, []


def check_overdue_items(db: Session) -> List[dict]:
    now = datetime.now()
    alerts = []

    overdue_borrows = db.query(BorrowRecord).join(Slide).filter(
        BorrowRecord.due_date < now,
        BorrowRecord.status == BorrowStatus.BORROWED
    ).all()

    for borrow in overdue_borrows:
        overdue_days = (now - borrow.due_date).days
        alerts.append({
            "slide_number": borrow.slide.slide_number,
            "patient_name": borrow.slide.patient_name,
            "type": "borrow_overdue",
            "overdue_days": overdue_days,
            "message": f"切片借出已超期 {overdue_days} 天，借用人：{borrow.borrower}"
        })
        borrow.status = BorrowStatus.OVERDUE

    overdue_second_reads = db.query(SecondRead).join(Slide).filter(
        SecondRead.deadline < now,
        SecondRead.status.in_([SecondReadStatus.FIRST_READ, SecondReadStatus.SECOND_READ_IN_PROGRESS])
    ).all()

    for sr in overdue_second_reads:
        overdue_days = (now - sr.deadline).days
        alerts.append({
            "slide_number": sr.slide.slide_number,
            "patient_name": sr.slide.patient_name,
            "type": "second_read_overdue",
            "overdue_days": overdue_days,
            "message": f"二读已超期 {overdue_days} 天，二读医生：{sr.second_read_doctor or '未指定'}"
        })

    db.commit()
    return alerts


def generate_report_data(db: Session, second_read_id: int) -> Optional[dict]:
    second_read = db.query(SecondRead).filter(SecondRead.id == second_read_id).first()
    if not second_read:
        return None

    slide = second_read.slide

    borrow_history = []
    for borrow in slide.borrow_records:
        borrow_history.append({
            "borrower": borrow.borrower,
            "department": borrow.borrower_department,
            "borrow_date": borrow.borrow_date.isoformat(),
            "due_date": borrow.due_date.isoformat(),
            "return_date": borrow.return_date.isoformat() if borrow.return_date else None,
            "status": borrow.status
        })

    opinion_history = []
    for ov in slide.opinion_versions:
        opinion_history.append({
            "version": ov.version_number,
            "doctor": ov.doctor,
            "opinion_type": ov.opinion_type,
            "opinion": ov.opinion,
            "created_at": ov.created_at.isoformat()
        })

    return {
        "slide_number": slide.slide_number,
        "patient_name": slide.patient_name,
        "patient_id": slide.patient_id,
        "specimen_type": slide.specimen_type or "未指定",
        "first_read_doctor": second_read.first_read_doctor,
        "first_read_opinion": second_read.first_read_opinion,
        "first_read_date": second_read.first_read_date,
        "second_read_doctor": second_read.second_read_doctor,
        "second_read_opinion": second_read.second_read_opinion,
        "second_read_date": second_read.second_read_date,
        "revision_opinion": second_read.revision_opinion,
        "revision_date": second_read.revision_date,
        "borrow_history": borrow_history,
        "opinion_history": opinion_history,
        "report_date": datetime.now()
    }


def get_second_read_detail(db: Session, second_read_id: int) -> Optional[dict]:
    second_read = db.query(SecondRead).filter(SecondRead.id == second_read_id).first()
    if not second_read:
        return None

    result = {
        "id": second_read.id,
        "slide_number": second_read.slide.slide_number,
        "patient_name": second_read.slide.patient_name,
        "patient_id": second_read.slide.patient_id,
        "first_read_doctor": second_read.first_read_doctor,
        "first_read_opinion": second_read.first_read_opinion,
        "first_read_date": second_read.first_read_date,
        "second_read_doctor": second_read.second_read_doctor,
        "second_read_opinion": second_read.second_read_opinion,
        "second_read_date": second_read.second_read_date,
        "revision_opinion": second_read.revision_opinion,
        "revision_date": second_read.revision_date,
        "status": second_read.status,
        "is_report_issued": second_read.is_report_issued,
        "report_issued_date": second_read.report_issued_date,
        "deadline": second_read.deadline,
        "created_at": second_read.created_at,
        "borrow_records": [],
        "opinion_versions": [],
        "review_records": []
    }

    for borrow in second_read.slide.borrow_records:
        result["borrow_records"].append({
            "id": borrow.id,
            "borrower": borrow.borrower,
            "department": borrow.borrower_department,
            "borrow_date": borrow.borrow_date,
            "due_date": borrow.due_date,
            "return_date": borrow.return_date,
            "status": borrow.status
        })

    for ov in second_read.slide.opinion_versions:
        result["opinion_versions"].append({
            "version_number": ov.version_number,
            "doctor": ov.doctor,
            "opinion_type": ov.opinion_type,
            "opinion": ov.opinion,
            "created_at": ov.created_at
        })

    for review in second_read.review_records:
        result["review_records"].append({
            "id": review.id,
            "reviewer": review.reviewer,
            "review_opinion": review.review_opinion,
            "is_approved": review.is_approved,
            "review_date": review.review_date
        })

    return result
