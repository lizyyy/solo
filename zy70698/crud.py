from sqlalchemy.orm import Session
from sqlalchemy import and_, func
import models
import schemas
from datetime import datetime
import json
from typing import List, Tuple


class BusinessException(Exception):
    def __init__(self, error_code: str, error_type: str, message: str, details: dict = None):
        self.error_code = error_code
        self.error_type = error_type
        self.message = message
        self.details = details or {}
        super().__init__(message)


def check_material_availability(db: Session, course_id: int, exclude_registration_id: int = None) -> Tuple[bool, List[dict]]:
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise BusinessException("COURSE_NOT_FOUND", "validation_error", "课程不存在", {"course_id": course_id})

    registered_count = db.query(models.Registration).filter(
        and_(
            models.Registration.course_id == course_id,
            models.Registration.status == "registered",
            models.Registration.id != exclude_registration_id if exclude_registration_id else True
        )
    ).count()

    course_material_kits = db.query(models.CourseMaterialKit).filter(
        models.CourseMaterialKit.course_id == course_id
    ).all()

    warnings = []
    has_shortage = False

    for cmk in course_material_kits:
        material_kit = db.query(models.MaterialKit).filter(
            models.MaterialKit.id == cmk.material_kit_id
        ).first()
        if not material_kit:
            continue

        required_quantity = (registered_count + 1) * cmk.quantity_per_student
        available = material_kit.total_quantity - material_kit.reserved_quantity

        if required_quantity > material_kit.total_quantity:
            has_shortage = True
            warnings.append({
                "material_kit_id": material_kit.id,
                "material_name": material_kit.name,
                "required": required_quantity,
                "available": available,
                "shortage": required_quantity - available,
                "level": "critical"
            })
        elif available <= material_kit.warning_threshold:
            warnings.append({
                "material_kit_id": material_kit.id,
                "material_name": material_kit.name,
                "required": required_quantity,
                "available": available,
                "shortage": 0,
                "level": "warning"
            })

    return has_shortage, warnings


def reserve_materials_for_registration(db: Session, registration_id: int):
    registration = db.query(models.Registration).filter(
        models.Registration.id == registration_id
    ).first()
    if not registration:
        raise BusinessException("REGISTRATION_NOT_FOUND", "validation_error", "报名记录不存在")

    course_material_kits = db.query(models.CourseMaterialKit).filter(
        models.CourseMaterialKit.course_id == registration.course_id
    ).all()

    for cmk in course_material_kits:
        material_kit = db.query(models.MaterialKit).filter(
            models.MaterialKit.id == cmk.material_kit_id
        ).with_for_update().first()
        
        if not material_kit:
            continue

        reserve_qty = cmk.quantity_per_student
        prev_reserved = material_kit.reserved_quantity
        
        material_kit.reserved_quantity += reserve_qty
        material_kit.available_quantity = material_kit.total_quantity - material_kit.reserved_quantity

        stock_record = models.StockRecord(
            material_kit_id=material_kit.id,
            change_type="reserve",
            change_quantity=reserve_qty,
            previous_quantity=prev_reserved,
            new_quantity=material_kit.reserved_quantity,
            related_registration_id=registration_id,
            notes=f"报名锁料: 课程ID={registration.course_id}, 学员ID={registration.student_id}"
        )
        db.add(stock_record)

    db.commit()


def release_materials_for_drop(db: Session, registration_id: int, drop_record_id: int):
    registration = db.query(models.Registration).filter(
        models.Registration.id == registration_id
    ).first()
    if not registration:
        raise BusinessException("REGISTRATION_NOT_FOUND", "validation_error", "报名记录不存在")

    course_material_kits = db.query(models.CourseMaterialKit).filter(
        models.CourseMaterialKit.course_id == registration.course_id
    ).all()

    for cmk in course_material_kits:
        material_kit = db.query(models.MaterialKit).filter(
            models.MaterialKit.id == cmk.material_kit_id
        ).with_for_update().first()
        
        if not material_kit:
            continue

        release_qty = cmk.quantity_per_student
        prev_reserved = material_kit.reserved_quantity
        
        material_kit.reserved_quantity = max(0, material_kit.reserved_quantity - release_qty)
        material_kit.available_quantity = material_kit.total_quantity - material_kit.reserved_quantity

        stock_record = models.StockRecord(
            material_kit_id=material_kit.id,
            change_type="release",
            change_quantity=-release_qty,
            previous_quantity=prev_reserved,
            new_quantity=material_kit.reserved_quantity,
            related_registration_id=registration_id,
            related_drop_id=drop_record_id,
            notes=f"退课释放: 课程ID={registration.course_id}, 学员ID={registration.student_id}"
        )
        db.add(stock_record)

    db.commit()


def create_registration(db: Session, registration: schemas.RegistrationCreate):
    existing = db.query(models.Registration).filter(
        and_(
            models.Registration.course_id == registration.course_id,
            models.Registration.student_id == registration.student_id,
            models.Registration.status == "registered"
        )
    ).first()
    
    if existing:
        raise BusinessException(
            "ALREADY_REGISTERED",
            "state_error",
            "该学员已报名此课程",
            {"registration_id": existing.id}
        )

    course = db.query(models.Course).filter(models.Course.id == registration.course_id).first()
    if not course or not course.is_active:
        raise BusinessException("COURSE_NOT_AVAILABLE", "state_error", "课程不可用")

    current_count = db.query(models.Registration).filter(
        and_(
            models.Registration.course_id == registration.course_id,
            models.Registration.status == "registered"
        )
    ).count()

    if current_count >= course.max_students:
        raise BusinessException("COURSE_FULL", "state_error", "课程已满员")

    has_shortage, warnings = check_material_availability(db, registration.course_id)
    
    needs_review = has_shortage or (len(warnings) > 0 and any(w["level"] == "critical" for w in warnings))

    db_registration = models.Registration(**registration.model_dump())
    db.add(db_registration)
    db.commit()
    db.refresh(db_registration)

    reserve_materials_for_registration(db, db_registration.id)

    return {
        "registration": db_registration,
        "warnings": warnings,
        "needs_review": needs_review
    }


def drop_course(db: Session, drop_data: schemas.DropRecordCreate):
    registration = db.query(models.Registration).filter(
        models.Registration.id == drop_data.registration_id
    ).first()
    
    if not registration:
        raise BusinessException("REGISTRATION_NOT_FOUND", "validation_error", "报名记录不存在")
    
    if registration.status != "registered":
        raise BusinessException(
            "INVALID_STATUS",
            "state_error",
            "报名状态不允许退课",
            {"current_status": registration.status}
        )

    registration.status = "dropped"
    registration.cancelled_at = datetime.now()

    drop_record = models.DropRecord(
        registration_id=drop_data.registration_id,
        course_id=registration.course_id,
        student_id=registration.student_id,
        drop_type=drop_data.drop_type,
        reason=drop_data.reason,
        transferred_to_course_id=drop_data.transferred_to_course_id,
        needs_review=drop_data.needs_review
    )
    db.add(drop_record)
    db.commit()
    db.refresh(drop_record)

    release_materials_for_drop(db, registration.id, drop_record.id)

    return {
        "registration": registration,
        "drop_record": drop_record
    }


def transfer_course(db: Session, transfer_data: schemas.TransferCourseRequest):
    registration = db.query(models.Registration).filter(
        models.Registration.id == transfer_data.registration_id
    ).first()
    
    if not registration:
        raise BusinessException("REGISTRATION_NOT_FOUND", "validation_error", "报名记录不存在")
    
    if registration.status != "registered":
        raise BusinessException(
            "INVALID_STATUS",
            "state_error",
            "报名状态不允许换课",
            {"current_status": registration.status}
        )

    if registration.course_id == transfer_data.target_course_id:
        raise BusinessException(
            "SAME_COURSE",
            "validation_error",
            "不能换课到同一课程"
        )

    target_course = db.query(models.Course).filter(
        models.Course.id == transfer_data.target_course_id
    ).first()
    
    if not target_course or not target_course.is_active:
        raise BusinessException("TARGET_COURSE_NOT_AVAILABLE", "state_error", "目标课程不可用")

    existing = db.query(models.Registration).filter(
        and_(
            models.Registration.course_id == transfer_data.target_course_id,
            models.Registration.student_id == registration.student_id,
            models.Registration.status == "registered"
        )
    ).first()
    
    if existing:
        raise BusinessException(
            "ALREADY_REGISTERED_TARGET",
            "state_error",
            "该学员已报名目标课程",
            {"registration_id": existing.id}
        )

    target_count = db.query(models.Registration).filter(
        and_(
            models.Registration.course_id == transfer_data.target_course_id,
            models.Registration.status == "registered"
        )
    ).count()

    if target_count >= target_course.max_students:
        raise BusinessException("TARGET_COURSE_FULL", "state_error", "目标课程已满员")

    has_shortage, warnings = check_material_availability(db, transfer_data.target_course_id)

    drop_record = models.DropRecord(
        registration_id=registration.id,
        course_id=registration.course_id,
        student_id=registration.student_id,
        drop_type="transfer",
        reason=transfer_data.reason,
        transferred_to_course_id=transfer_data.target_course_id,
        needs_review=has_shortage
    )
    db.add(drop_record)

    release_materials_for_drop(db, registration.id, drop_record.id)

    registration.status = "transferred"
    registration.cancelled_at = datetime.now()

    new_registration = models.Registration(
        course_id=transfer_data.target_course_id,
        student_id=registration.student_id,
        status="registered",
        notes=f"从课程 {registration.course_id} 转来"
    )
    db.add(new_registration)
    db.commit()
    db.refresh(new_registration)

    reserve_materials_for_registration(db, new_registration.id)

    return {
        "old_registration": registration,
        "new_registration": new_registration,
        "drop_record": drop_record,
        "warnings": warnings,
        "needs_review": has_shortage
    }


def generate_preparation_report(db: Session, report_data: schemas.PreparationReportCreate):
    course = db.query(models.Course).filter(models.Course.id == report_data.course_id).first()
    if not course:
        raise BusinessException("COURSE_NOT_FOUND", "validation_error", "课程不存在")

    total_registered = db.query(models.Registration).filter(
        and_(
            models.Registration.course_id == report_data.course_id,
            models.Registration.status == "registered"
        )
    ).count()

    total_dropped = db.query(models.Registration).filter(
        and_(
            models.Registration.course_id == report_data.course_id,
            models.Registration.status.in_(["dropped", "transferred"])
        )
    ).count()

    net_registered = total_registered

    course_material_kits = db.query(models.CourseMaterialKit).filter(
        models.CourseMaterialKit.course_id == report_data.course_id
    ).all()

    materials_summary = []
    material_warnings = []
    has_warnings = False

    for cmk in course_material_kits:
        material_kit = db.query(models.MaterialKit).filter(
            models.MaterialKit.id == cmk.material_kit_id
        ).first()
        if not material_kit:
            continue

        required = total_registered * cmk.quantity_per_student
        available = material_kit.total_quantity - material_kit.reserved_quantity

        materials_summary.append({
            "material_id": material_kit.id,
            "material_name": material_kit.name,
            "required": required,
            "reserved": material_kit.reserved_quantity,
            "available": available,
            "unit": material_kit.unit
        })

        if required > material_kit.total_quantity:
            has_warnings = True
            material_warnings.append({
                "material_kit_id": material_kit.id,
                "material_name": material_kit.name,
                "available_quantity": available,
                "required_quantity": required,
                "shortage": required - material_kit.total_quantity,
                "warning_level": "critical"
            })
        elif available <= material_kit.warning_threshold:
            has_warnings = True
            material_warnings.append({
                "material_kit_id": material_kit.id,
                "material_name": material_kit.name,
                "available_quantity": available,
                "required_quantity": required,
                "shortage": 0,
                "warning_level": "warning"
            })

    report = models.PreparationReport(
        course_id=report_data.course_id,
        total_registered=total_registered,
        total_dropped=total_dropped,
        net_registered=net_registered,
        materials_summary=json.dumps(materials_summary, ensure_ascii=False),
        has_warnings=has_warnings,
        warning_details=json.dumps(material_warnings, ensure_ascii=False),
        generated_by=report_data.generated_by
    )

    db.add(report)
    db.commit()
    db.refresh(report)

    return {
        "report": report,
        "materials_summary": materials_summary,
        "material_warnings": material_warnings
    }


def create_course(db: Session, course: schemas.CourseCreate):
    db_course = models.Course(**course.model_dump())
    db.add(db_course)
    db.commit()
    db.refresh(db_course)
    return db_course


def create_student(db: Session, student: schemas.StudentCreate):
    existing = db.query(models.Student).filter(models.Student.phone == student.phone).first()
    if existing:
        return existing
    db_student = models.Student(**student.model_dump())
    db.add(db_student)
    db.commit()
    db.refresh(db_student)
    return db_student


def create_material_kit(db: Session, material_kit: schemas.MaterialKitCreate):
    db_material = models.MaterialKit(**material_kit.model_dump())
    db_material.available_quantity = material_kit.total_quantity
    db.add(db_material)
    db.commit()
    db.refresh(db_material)
    return db_material


def update_material_kit(db: Session, material_id: int, material_update: schemas.MaterialKitUpdate):
    material = db.query(models.MaterialKit).filter(models.MaterialKit.id == material_id).first()
    if not material:
        raise BusinessException("MATERIAL_NOT_FOUND", "validation_error", "材料包不存在")
    
    update_data = material_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(material, key, value)
    
    material.available_quantity = material.total_quantity - material.reserved_quantity
    db.commit()
    db.refresh(material)
    return material


def create_course_material_kit(db: Session, cmk: schemas.CourseMaterialKitCreate):
    existing = db.query(models.CourseMaterialKit).filter(
        and_(
            models.CourseMaterialKit.course_id == cmk.course_id,
            models.CourseMaterialKit.material_kit_id == cmk.material_kit_id
        )
    ).first()
    if existing:
        existing.quantity_per_student = cmk.quantity_per_student
        db.commit()
        db.refresh(existing)
        return existing
    
    db_cmk = models.CourseMaterialKit(**cmk.model_dump())
    db.add(db_cmk)
    db.commit()
    db.refresh(db_cmk)
    return db_cmk


def review_drop_record(db: Session, drop_id: int, reviewed_by: str):
    drop_record = db.query(models.DropRecord).filter(models.DropRecord.id == drop_id).first()
    if not drop_record:
        raise BusinessException("DROP_RECORD_NOT_FOUND", "validation_error", "退课记录不存在")
    
    if drop_record.reviewed:
        raise BusinessException(
            "ALREADY_REVIEWED",
            "state_error",
            "该记录已复核",
            {"reviewed_at": drop_record.reviewed_at, "reviewed_by": drop_record.reviewed_by}
        )
    
    drop_record.reviewed = True
    drop_record.reviewed_by = reviewed_by
    drop_record.reviewed_at = datetime.now()
    db.commit()
    db.refresh(drop_record)
    return drop_record


def get_course_registrations(db: Session, course_id: int, status: str = None):
    query = db.query(models.Registration).filter(models.Registration.course_id == course_id)
    if status:
        query = query.filter(models.Registration.status == status)
    return query.all()


def get_material_kits(db: Session, has_warning: bool = None):
    query = db.query(models.MaterialKit)
    if has_warning:
        query = query.filter(
            (models.MaterialKit.total_quantity - models.MaterialKit.reserved_quantity) <= models.MaterialKit.warning_threshold
        )
    return query.all()


def get_drop_records(db: Session, needs_review: bool = None, course_id: int = None):
    query = db.query(models.DropRecord)
    if needs_review is not None:
        query = query.filter(models.DropRecord.needs_review == needs_review)
    if course_id:
        query = query.filter(models.DropRecord.course_id == course_id)
    return query.all()


def get_preparation_reports(db: Session, course_id: int = None, has_warnings: bool = None):
    query = db.query(models.PreparationReport)
    if course_id:
        query = query.filter(models.PreparationReport.course_id == course_id)
    if has_warnings is not None:
        query = query.filter(models.PreparationReport.has_warnings == has_warnings)
    return query.all()
