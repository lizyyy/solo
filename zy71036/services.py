from sqlalchemy.orm import Session
from models import (
    Area, Scaffold, AcceptanceRecord, Rectification, Photo,
    AcceptanceReport, OperationLog, ScaffoldStatus
)
from schemas import (
    AcceptanceRecordCreate, RectificationCreate, PhotoCreate,
    AreaCreate, ScaffoldCreate, AcceptanceResult
)
from datetime import datetime
import uuid
import os


REQUIRED_PHOTO_TYPES = ["overall", "detail", "connection"]


class StatusMachine:
    VALID_TRANSITIONS = {
        ScaffoldStatus.DRAFT: [ScaffoldStatus.SUBMITTED, ScaffoldStatus.DEACTIVATED],
        ScaffoldStatus.SUBMITTED: [
            ScaffoldStatus.AUTO_PASSED, ScaffoldStatus.AUTO_REJECTED,
            ScaffoldStatus.PENDING_MANUAL, ScaffoldStatus.RETURNED
        ],
        ScaffoldStatus.AUTO_PASSED: [
            ScaffoldStatus.MANUAL_APPROVED, ScaffoldStatus.MANUAL_REJECTED,
            ScaffoldStatus.ACTIVE, ScaffoldStatus.DEACTIVATED
        ],
        ScaffoldStatus.AUTO_REJECTED: [
            ScaffoldStatus.RETURNED, ScaffoldStatus.PENDING_MANUAL
        ],
        ScaffoldStatus.PENDING_MANUAL: [
            ScaffoldStatus.MANUAL_APPROVED, ScaffoldStatus.MANUAL_REJECTED,
            ScaffoldStatus.RETURNED
        ],
        ScaffoldStatus.MANUAL_APPROVED: [
            ScaffoldStatus.ACTIVE, ScaffoldStatus.DEACTIVATED
        ],
        ScaffoldStatus.MANUAL_REJECTED: [
            ScaffoldStatus.RETURNED, ScaffoldStatus.DEACTIVATED
        ],
        ScaffoldStatus.RETURNED: [
            ScaffoldStatus.RESUBMITTED, ScaffoldStatus.DEACTIVATED
        ],
        ScaffoldStatus.RESUBMITTED: [
            ScaffoldStatus.AUTO_PASSED, ScaffoldStatus.AUTO_REJECTED,
            ScaffoldStatus.PENDING_MANUAL
        ],
        ScaffoldStatus.UNDER_RECTIFICATION: [
            ScaffoldStatus.RECTIFIED, ScaffoldStatus.DEACTIVATED
        ],
        ScaffoldStatus.RECTIFIED: [
            ScaffoldStatus.AUTO_PASSED, ScaffoldStatus.PENDING_MANUAL,
            ScaffoldStatus.DEACTIVATED
        ],
        ScaffoldStatus.ACTIVE: [ScaffoldStatus.DEACTIVATED],
        ScaffoldStatus.DEACTIVATED: [ScaffoldStatus.ACTIVE]
    }

    @classmethod
    def can_transition(cls, current_status: ScaffoldStatus, new_status: ScaffoldStatus) -> bool:
        return new_status in cls.VALID_TRANSITIONS.get(current_status, [])


def log_operation(
    db: Session, record_id: int, operation: str,
    previous_status: str, new_status: str,
    operator: str = None, reason: str = None
):
    log = OperationLog(
        acceptance_record_id=record_id,
        operation=operation,
        previous_status=previous_status,
        new_status=new_status,
        operator=operator,
        reason=reason
    )
    db.add(log)
    db.flush()


def create_area(db: Session, area: AreaCreate):
    db_area = Area(name=area.name, description=area.description)
    db.add(db_area)
    db.commit()
    db.refresh(db_area)
    return db_area


def create_scaffold(db: Session, scaffold: ScaffoldCreate):
    db_scaffold = Scaffold(**scaffold.model_dump())
    db.add(db_scaffold)
    db.commit()
    db.refresh(db_scaffold)
    return db_scaffold


def get_area_deactivation_status(db: Session, area_id: int) -> bool:
    area = db.query(Area).filter(Area.id == area_id).first()
    return area.is_deactivated if area else False


def check_deactivation_interception(db: Session, scaffold_id: int) -> dict:
    scaffold = db.query(Scaffold).filter(Scaffold.id == scaffold_id).first()
    if not scaffold:
        return {"blocked": True, "reason": "脚手架不存在"}
    
    if scaffold.is_deactivated:
        return {
            "blocked": True,
            "reason": f"脚手架已停用: {scaffold.deactivated_reason or '未提供原因'}"
        }
    
    if scaffold.area.is_deactivated:
        return {
            "blocked": True,
            "reason": f"所属区域已停用: {scaffold.area.deactivated_reason or '未提供原因'}"
        }
    
    return {"blocked": False, "reason": None}


def auto_validate_acceptance(db: Session, record: AcceptanceRecord) -> AcceptanceResult:
    issues = []
    auto_check_passed = True
    requires_manual_review = False

    deactivation_check = check_deactivation_interception(db, record.scaffold_id)
    if deactivation_check["blocked"]:
        issues.append(f"停用拦截: {deactivation_check['reason']}")
        auto_check_passed = False

    open_rectifications = db.query(Rectification).filter(
        Rectification.acceptance_record_id == record.id,
        Rectification.is_closed == False
    ).all()
    
    if open_rectifications:
        issues.append(f"存在 {len(open_rectifications)} 项未关闭整改")
        auto_check_passed = False

    photos = db.query(Photo).filter(
        Photo.acceptance_record_id == record.id
    ).all()
    
    photo_types = set(p.photo_type for p in photos)
    missing_photos = set(REQUIRED_PHOTO_TYPES) - photo_types
    
    if missing_photos:
        issues.append(f"缺失必要照片类型: {', '.join(missing_photos)}")
        auto_check_passed = False
        requires_manual_review = True

    if len(photos) < 3:
        issues.append(f"照片数量不足: 当前 {len(photos)} 张，至少需要 3 张")
        auto_check_passed = False

    if record.submission_count > 2:
        issues.append(f"多次提交记录: 已提交 {record.submission_count} 次，建议人工审核")
        requires_manual_review = True

    high_severity_rect = db.query(Rectification).filter(
        Rectification.acceptance_record_id == record.id,
        Rectification.severity == "critical",
        Rectification.is_closed == False
    ).first()
    
    if high_severity_rect:
        issues.append("存在严重级别的未关闭整改项")
        auto_check_passed = False
        requires_manual_review = True

    return AcceptanceResult(
        record_id=record.id,
        status=record.status,
        is_accepted=auto_check_passed and not requires_manual_review,
        auto_check_passed=auto_check_passed,
        issues=issues,
        rectification_count=len(record.rectifications),
        open_rectification_count=len(open_rectifications),
        photo_count=len(photos),
        requires_manual_review=requires_manual_review
    )


def create_acceptance_record(db: Session, record: AcceptanceRecordCreate):
    db_record = AcceptanceRecord(
        batch_no=record.batch_no,
        scaffold_id=record.scaffold_id,
        inspector=record.inspector,
        inspection_date=record.inspection_date,
        created_by=record.created_by
    )
    db.add(db_record)
    db.flush()

    for rect in record.rectifications:
        db_rect = Rectification(
            acceptance_record_id=db_record.id,
            scaffold_id=db_record.scaffold_id,
            **rect.model_dump()
        )
        db.add(db_rect)

    log_operation(db, db_record.id, "create", None, ScaffoldStatus.DRAFT.value, record.created_by)
    
    db.commit()
    db.refresh(db_record)
    return db_record


def submit_acceptance_record(db: Session, record_id: int, operator: str = None):
    record = db.query(AcceptanceRecord).filter(AcceptanceRecord.id == record_id).first()
    if not record:
        return None

    current_status = ScaffoldStatus(record.status)
    
    target_status = ScaffoldStatus.RESUBMITTED if current_status == ScaffoldStatus.RETURNED else ScaffoldStatus.SUBMITTED
    
    if not StatusMachine.can_transition(current_status, target_status):
        raise ValueError(f"无法从 {current_status.value} 提交")

    record.submission_count += 1
    previous_status = record.status
    record.status = target_status.value

    log_operation(db, record.id, "submit", previous_status, record.status, operator)

    result = auto_validate_acceptance(db, record)
    
    if result.requires_manual_review:
        record.status = ScaffoldStatus.PENDING_MANUAL.value
    elif result.auto_check_passed:
        record.status = ScaffoldStatus.AUTO_PASSED.value
        record.is_accepted = True
    else:
        record.status = ScaffoldStatus.AUTO_REJECTED.value
        record.is_accepted = False

    log_operation(db, record.id, "auto_validate", previous_status, record.status, "system")

    db.commit()
    db.refresh(record)
    return record, result


def manual_review(db: Session, record_id: int, operator: str, reason: str, approved: bool):
    record = db.query(AcceptanceRecord).filter(AcceptanceRecord.id == record_id).first()
    if not record:
        return None

    current_status = ScaffoldStatus(record.status)
    if current_status not in [ScaffoldStatus.PENDING_MANUAL, ScaffoldStatus.AUTO_REJECTED]:
        raise ValueError(f"当前状态 {current_status.value} 不支持人工审核")

    previous_status = record.status
    
    if approved:
        if not StatusMachine.can_transition(current_status, ScaffoldStatus.MANUAL_APPROVED):
            raise ValueError(f"无法从 {current_status.value} 转换到人工通过")
        record.status = ScaffoldStatus.MANUAL_APPROVED.value
        record.is_accepted = True
    else:
        if not StatusMachine.can_transition(current_status, ScaffoldStatus.MANUAL_REJECTED):
            raise ValueError(f"无法从 {current_status.value} 转换到人工拒绝")
        record.status = ScaffoldStatus.MANUAL_REJECTED.value
        record.is_accepted = False

    record.manual_override_by = operator
    record.manual_override_reason = reason
    record.manual_override_at = datetime.now()

    log_operation(db, record.id, "manual_review", previous_status, record.status, operator, reason)

    db.commit()
    db.refresh(record)
    return record


def return_for_supplement(db: Session, record_id: int, operator: str, reason: str):
    record = db.query(AcceptanceRecord).filter(AcceptanceRecord.id == record_id).first()
    if not record:
        return None

    current_status = ScaffoldStatus(record.status)
    if not StatusMachine.can_transition(current_status, ScaffoldStatus.RETURNED):
        raise ValueError(f"无法从 {current_status.value} 退回补充")

    previous_status = record.status
    record.status = ScaffoldStatus.RETURNED.value
    record.version += 1

    log_operation(db, record.id, "return", previous_status, record.status, operator, reason)

    db.commit()
    db.refresh(record)
    return record


def recalculate_status(db: Session, record_id: int, operator: str = None):
    record = db.query(AcceptanceRecord).filter(AcceptanceRecord.id == record_id).first()
    if not record:
        return None

    previous_status = record.status
    result = auto_validate_acceptance(db, record)

    if result.requires_manual_review:
        new_status = ScaffoldStatus.PENDING_MANUAL.value
    elif result.auto_check_passed:
        new_status = ScaffoldStatus.AUTO_PASSED.value
        record.is_accepted = True
    else:
        new_status = ScaffoldStatus.AUTO_REJECTED.value
        record.is_accepted = False

    record.status = new_status
    log_operation(db, record.id, "recalculate", previous_status, new_status, operator or "system")

    db.commit()
    db.refresh(record)
    return record, result


def close_rectification(db: Session, rectification_id: int, operator: str, verification_method: str):
    rect = db.query(Rectification).filter(Rectification.id == rectification_id).first()
    if not rect:
        return None

    rect.is_closed = True
    rect.closed_at = datetime.now()
    rect.closed_by = operator
    rect.verification_method = verification_method

    record = db.query(AcceptanceRecord).filter(
        AcceptanceRecord.id == rect.acceptance_record_id
    ).first()
    
    if record:
        all_closed = all(r.is_closed for r in record.rectifications)
        if all_closed and record.status == ScaffoldStatus.UNDER_RECTIFICATION.value:
            previous_status = record.status
            record.status = ScaffoldStatus.RECTIFIED.value
            log_operation(db, record.id, "rectification_complete", previous_status, record.status, operator)

    db.commit()
    db.refresh(rect)
    return rect


def add_photo(db: Session, acceptance_record_id: int, photo: PhotoCreate):
    db_photo = Photo(
        acceptance_record_id=acceptance_record_id,
        **photo.model_dump()
    )
    db.add(db_photo)
    db.commit()
    db.refresh(db_photo)
    return db_photo


def deactivate_area(db: Session, area_id: int, reason: str, operator: str):
    area = db.query(Area).filter(Area.id == area_id).first()
    if not area:
        return None
    
    area.is_deactivated = True
    area.deactivated_reason = reason
    
    for scaffold in area.scaffolds:
        scaffold.is_deactivated = True
        scaffold.deactivated_reason = f"区域停用: {reason}"

    db.commit()
    db.refresh(area)
    return area


def deactivate_scaffold(db: Session, scaffold_id: int, reason: str, operator: str):
    scaffold = db.query(Scaffold).filter(Scaffold.id == scaffold_id).first()
    if not scaffold:
        return None
    
    scaffold.is_deactivated = True
    scaffold.deactivated_reason = reason

    db.commit()
    db.refresh(scaffold)
    return scaffold


def generate_report(db: Session, record_id: int, generated_by: str):
    record = db.query(AcceptanceRecord).filter(AcceptanceRecord.id == record_id).first()
    if not record:
        return None

    if not record.is_accepted:
        raise ValueError("未通过验收的记录无法生成报告")

    report_no = f"RPT-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    
    os.makedirs("reports", exist_ok=True)
    file_path = f"reports/{report_no}.txt"
    
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(f"脚手架验收报告\n")
        f.write(f"报告编号: {report_no}\n")
        f.write(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"生成人: {generated_by}\n\n")
        f.write(f"批次号: {record.batch_no}\n")
        f.write(f"脚手架编号: {record.scaffold.scaffold_number}\n")
        f.write(f"所属区域: {record.scaffold.area.name}\n")
        f.write(f"验收状态: {record.status}\n")
        f.write(f"验收结果: {'通过' if record.is_accepted else '未通过'}\n")
        f.write(f"验收人员: {record.inspector}\n")
        f.write(f"整改项数: {len(record.rectifications)}\n")
        f.write(f"照片数: {len(record.photos)}\n")

    report = AcceptanceReport(
        acceptance_record_id=record_id,
        report_no=report_no,
        file_path=file_path,
        generated_by=generated_by
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


def get_statistics(db: Session):
    total_records = db.query(AcceptanceRecord).count()
    total_accepted = db.query(AcceptanceRecord).filter(AcceptanceRecord.is_accepted == True).count()
    total_rejected = db.query(AcceptanceRecord).filter(
        AcceptanceRecord.is_accepted == False,
        AcceptanceRecord.status.in_([ScaffoldStatus.AUTO_REJECTED.value, ScaffoldStatus.MANUAL_REJECTED.value])
    ).count()
    total_deactivated = db.query(Scaffold).filter(Scaffold.is_deactivated == True).count()
    pending_review = db.query(AcceptanceRecord).filter(
        AcceptanceRecord.status == ScaffoldStatus.PENDING_MANUAL.value
    ).count()
    open_rectifications = db.query(Rectification).filter(Rectification.is_closed == False).count()
    
    photo_missing_count = 0
    records = db.query(AcceptanceRecord).all()
    for record in records:
        photos = db.query(Photo).filter(Photo.acceptance_record_id == record.id).all()
        if len(photos) < 3:
            photo_missing_count += 1

    active_areas = db.query(Area).filter(Area.is_deactivated == False).count()
    deactivated_areas = db.query(Area).filter(Area.is_deactivated == True).count()

    return {
        "total_records": total_records,
        "total_accepted": total_accepted,
        "total_rejected": total_rejected,
        "total_deactivated": total_deactivated,
        "pending_review": pending_review,
        "open_rectifications": open_rectifications,
        "photo_missing_count": photo_missing_count,
        "active_areas": active_areas,
        "deactivated_areas": deactivated_areas
    }


def verify_statistics(db: Session):
    stats = get_statistics(db)
    
    query_accepted = db.query(AcceptanceRecord).filter(AcceptanceRecord.is_accepted == True).count()
    query_deactivated = db.query(Scaffold).filter(Scaffold.is_deactivated == True).count()
    
    verification = {
        "stats": stats,
        "verification_checks": {
            "accepted_count_match": stats["total_accepted"] == query_accepted,
            "deactivated_count_match": stats["total_deactivated"] == query_deactivated,
            "total_count_valid": stats["total_accepted"] + stats["total_rejected"] <= stats["total_records"]
        }
    }
    
    return verification
