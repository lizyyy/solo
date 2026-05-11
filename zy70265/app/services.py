from datetime import datetime
from typing import List, Optional
from sqlalchemy.orm import Session

from app.models import User, GasCylinder, Borrow, CylinderLevelHistory, CylinderWarning, ExchangeRequest
from app.schemas import UserCreate, GasCylinderCreate, GasCylinderUpdate, BorrowCreate, ExchangeRequestCreate, ExchangeRequestUpdate
from app.config import DANGER_CATEGORIES, WARNING_THRESHOLDS, CYLINDER_STATUS, BORROW_STATUS, EXCHANGE_STATUS


class BusinessException(Exception):
    def __init__(self, error_code: str, message: str, details: dict = None):
        self.error_code = error_code
        self.message = message
        self.details = details
        super().__init__(message)


def validate_danger_category(category: str) -> bool:
    return category in DANGER_CATEGORIES


def get_cylinder_by_id(db: Session, cylinder_id: int) -> Optional[GasCylinder]:
    return db.query(GasCylinder).filter(GasCylinder.id == cylinder_id).first()


def get_cylinder_by_code(db: Session, code: str) -> Optional[GasCylinder]:
    return db.query(GasCylinder).filter(GasCylinder.cylinder_code == code).first()


def create_user(db: Session, user_data: UserCreate) -> User:
    existing_user = db.query(User).filter(User.username == user_data.username).first()
    if existing_user:
        raise BusinessException("USER_EXISTS", f"用户 {user_data.username} 已存在")
    
    user = User(**user_data.dict())
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()


def create_gas_cylinder(db: Session, data: GasCylinderCreate) -> GasCylinder:
    if not validate_danger_category(data.danger_category):
        raise BusinessException(
            "INVALID_DANGER_CATEGORY",
            f"无效的危险分类: {data.danger_category}",
            {"valid_categories": list(DANGER_CATEGORIES.keys())}
        )
    
    if get_cylinder_by_code(db, data.cylinder_code):
        raise BusinessException(
            "CYLINDER_CODE_EXISTS",
            f"气瓶编号 {data.cylinder_code} 已存在"
        )
    
    cylinder = GasCylinder(**data.dict())
    
    warning_status = cylinder.check_warning_level(WARNING_THRESHOLDS, DANGER_CATEGORIES)
    if warning_status:
        cylinder.status = warning_status
    else:
        cylinder.status = "IN_STORAGE"
    
    db.add(cylinder)
    db.commit()
    db.refresh(cylinder)
    
    if warning_status:
        create_warning_for_cylinder(db, cylinder, warning_status)
    
    return cylinder


def update_cylinder_level(db: Session, cylinder_id: int, new_level: float, recorded_by: str = None, notes: str = None) -> GasCylinder:
    cylinder = get_cylinder_by_id(db, cylinder_id)
    if not cylinder:
        raise BusinessException("CYLINDER_NOT_FOUND", f"气瓶ID {cylinder_id} 不存在")
    
    if new_level > cylinder.capacity:
        raise BusinessException(
            "INVALID_LEVEL",
            "新的余量不能大于气瓶容量",
            {"max_capacity": cylinder.capacity}
        )
    
    previous_level = cylinder.current_level
    
    history = CylinderLevelHistory(
        cylinder_id=cylinder.id,
        previous_level=previous_level,
        new_level=new_level,
        recorded_by=recorded_by,
        notes=notes
    )
    db.add(history)
    
    cylinder.current_level = new_level
    
    warning_status = cylinder.check_warning_level(WARNING_THRESHOLDS, DANGER_CATEGORIES)
    
    if warning_status:
        if cylinder.status != warning_status:
            cylinder.status = warning_status
            create_warning_for_cylinder(db, cylinder, warning_status)
    else:
        if cylinder.status in ["LOW_WARNING", "CRITICAL_WARNING", "EMERGENCY_WARNING"]:
            cylinder.status = "IN_USE" if any_active_borrow(db, cylinder.id) else "IN_STORAGE"
            resolve_active_warnings(db, cylinder.id)
    
    db.commit()
    db.refresh(cylinder)
    return cylinder


def any_active_borrow(db: Session, cylinder_id: int) -> bool:
    return db.query(Borrow).filter(
        Borrow.cylinder_id == cylinder_id,
        Borrow.status == "ACTIVE"
    ).first() is not None


def create_warning_for_cylinder(db: Session, cylinder: GasCylinder, warning_type: str):
    category_info = DANGER_CATEGORIES.get(cylinder.danger_category, {})
    category_name = category_info.get("name", cylinder.danger_category)
    
    severity_map = {
        "LOW_WARNING": "LOW",
        "CRITICAL_WARNING": "MEDIUM",
        "EMERGENCY_WARNING": "HIGH"
    }
    
    message = f"气瓶 {cylinder.cylinder_code} ({cylinder.gas_type}, {category_name}) 余量预警: 当前剩余 {(cylinder.current_level / cylinder.capacity * 100):.1f}%"
    
    existing_warning = db.query(CylinderWarning).filter(
        CylinderWarning.cylinder_id == cylinder.id,
        CylinderWarning.warning_type == warning_type,
        CylinderWarning.is_resolved == False
    ).first()
    
    if not existing_warning:
        warning = CylinderWarning(
            cylinder_id=cylinder.id,
            warning_type=warning_type,
            message=message,
            severity=severity_map.get(warning_type, "MEDIUM")
        )
        db.add(warning)


def resolve_active_warnings(db: Session, cylinder_id: int):
    warnings = db.query(CylinderWarning).filter(
        CylinderWarning.cylinder_id == cylinder_id,
        CylinderWarning.is_resolved == False
    ).all()
    
    for warning in warnings:
        warning.is_resolved = True
        warning.resolved_at = datetime.utcnow()


def create_borrow(db: Session, data: BorrowCreate) -> Borrow:
    cylinder = get_cylinder_by_id(db, data.cylinder_id)
    if not cylinder:
        raise BusinessException("CYLINDER_NOT_FOUND", f"气瓶ID {data.cylinder_id} 不存在")
    
    user = get_user_by_id(db, data.user_id)
    if not user:
        raise BusinessException("USER_NOT_FOUND", f"用户ID {data.user_id} 不存在")
    
    if any_active_borrow(db, cylinder.id):
        raise BusinessException(
            "CYLINDER_ALREADY_BORROWED",
            f"气瓶 {cylinder.cylinder_code} 已被借用"
        )
    
    if cylinder.status in ["EXCHANGING", "DECOMMISSIONED"]:
        raise BusinessException(
            "CYLINDER_UNAVAILABLE",
            f"气瓶 {cylinder.cylinder_code} 当前不可借用",
            {"current_status": cylinder.status}
        )
    
    if data.expected_return_date <= datetime.utcnow():
        raise BusinessException(
            "INVALID_RETURN_DATE",
            "预计归还日期必须晚于当前时间"
        )
    
    borrow = Borrow(**data.dict())
    db.add(borrow)
    
    if cylinder.status == "IN_STORAGE":
        cylinder.status = "IN_USE"
    
    db.commit()
    db.refresh(borrow)
    return borrow


def return_borrow(db: Session, borrow_id: int, notes: str = None) -> Borrow:
    borrow = db.query(Borrow).filter(Borrow.id == borrow_id).first()
    if not borrow:
        raise BusinessException("BORROW_NOT_FOUND", f"借用记录ID {borrow_id} 不存在")
    
    if borrow.status == "RETURNED":
        raise BusinessException("BORROW_ALREADY_RETURNED", f"借用记录已归还")
    
    borrow.actual_return_date = datetime.utcnow()
    borrow.status = "RETURNED"
    if notes:
        borrow.notes = notes
    
    cylinder = borrow.cylinder
    warning_status = cylinder.check_warning_level(WARNING_THRESHOLDS, DANGER_CATEGORIES)
    if warning_status:
        cylinder.status = warning_status
    else:
        cylinder.status = "IN_STORAGE"
    
    db.commit()
    db.refresh(borrow)
    return borrow


def create_exchange_request(db: Session, data: ExchangeRequestCreate) -> ExchangeRequest:
    cylinder = get_cylinder_by_id(db, data.cylinder_id)
    if not cylinder:
        raise BusinessException("CYLINDER_NOT_FOUND", f"气瓶ID {data.cylinder_id} 不存在")
    
    user = get_user_by_id(db, data.requester_id)
    if not user:
        raise BusinessException("USER_NOT_FOUND", f"用户ID {data.requester_id} 不存在")
    
    active_exchange = db.query(ExchangeRequest).filter(
        ExchangeRequest.cylinder_id == cylinder.id,
        ExchangeRequest.status.in_(["PENDING", "APPROVED", "IN_PROGRESS"])
    ).first()
    
    if active_exchange:
        raise BusinessException(
            "EXCHANGE_IN_PROGRESS",
            f"气瓶 {cylinder.cylinder_code} 已有换瓶申请正在处理中",
            {"existing_request_id": active_exchange.id}
        )
    
    category_info = DANGER_CATEGORIES.get(cylinder.danger_category, {})
    if category_info.get("requires_special_approval"):
        if not user.is_admin:
            raise BusinessException(
                "NEEDS_ADMIN_APPROVAL",
                f"{category_info.get('name')} 换瓶需要管理员审批",
                {"danger_category": cylinder.danger_category}
            )
    
    request = ExchangeRequest(**data.dict())
    db.add(request)
    
    cylinder.status = "EXCHANGING"
    
    db.commit()
    db.refresh(request)
    return request


def update_exchange_request(db: Session, request_id: int, data: ExchangeRequestUpdate, user_id: int = None) -> ExchangeRequest:
    request = db.query(ExchangeRequest).filter(ExchangeRequest.id == request_id).first()
    if not request:
        raise BusinessException("EXCHANGE_NOT_FOUND", f"换瓶申请ID {request_id} 不存在")
    
    if data.status == "APPROVED" and request.status != "PENDING":
        raise BusinessException(
            "INVALID_TRANSITION",
            f"当前状态 {request.status} 不能批准"
        )
    
    if data.status == "COMPLETED" and request.status != "IN_PROGRESS":
        raise BusinessException(
            "INVALID_TRANSITION",
            f"当前状态 {request.status} 不能完成"
        )
    
    if data.status:
        request.status = data.status
    
    if data.approved_by:
        request.approved_by = data.approved_by
    
    if data.approval_notes:
        request.approval_notes = data.approval_notes
    
    if data.new_cylinder_id:
        new_cylinder = get_cylinder_by_id(db, data.new_cylinder_id)
        if not new_cylinder:
            raise BusinessException("NEW_CYLINDER_NOT_FOUND", f"新气瓶ID {data.new_cylinder_id} 不存在")
        request.new_cylinder_id = data.new_cylinder_id
    
    if data.status == "COMPLETED":
        old_cylinder = request.cylinder
        old_cylinder.status = "DECOMMISSIONED"
        
        if request.new_cylinder_id:
            new_cylinder = get_cylinder_by_id(db, request.new_cylinder_id)
            if new_cylinder:
                active_borrow = db.query(Borrow).filter(
                    Borrow.cylinder_id == old_cylinder.id,
                    Borrow.status == "ACTIVE"
                ).first()
                if active_borrow:
                    active_borrow.cylinder_id = new_cylinder.id
                    new_cylinder.status = "IN_USE"
    
    db.commit()
    db.refresh(request)
    return request


def generate_safety_report(db: Session) -> dict:
    total_cylinders = db.query(GasCylinder).count()
    
    cylinders_by_category = {}
    for category, info in DANGER_CATEGORIES.items():
        count = db.query(GasCylinder).filter(GasCylinder.danger_category == category).count()
        cylinders_by_category[info["name"]] = count
    
    warning_cylinders = {
        "low": db.query(GasCylinder).filter(GasCylinder.status == "LOW_WARNING").count(),
        "critical": db.query(GasCylinder).filter(GasCylinder.status == "CRITICAL_WARNING").count(),
        "emergency": db.query(GasCylinder).filter(GasCylinder.status == "EMERGENCY_WARNING").count()
    }
    
    active_borrows = db.query(Borrow).filter(Borrow.status == "ACTIVE").count()
    overdue_borrows = db.query(Borrow).filter(
        Borrow.status == "ACTIVE",
        Borrow.expected_return_date < datetime.utcnow()
    ).count()
    
    pending_exchanges = db.query(ExchangeRequest).filter(
        ExchangeRequest.status.in_(["PENDING", "APPROVED", "IN_PROGRESS"])
    ).count()
    
    return {
        "total_cylinders": total_cylinders,
        "cylinders_by_danger_category": cylinders_by_category,
        "warning_cylinders": warning_cylinders,
        "active_borrows": active_borrows,
        "overdue_borrows": overdue_borrows,
        "pending_exchanges": pending_exchanges,
        "report_generated_at": datetime.utcnow()
    }


def enrich_cylinder_response(cylinder: GasCylinder) -> dict:
    cylinder_dict = {c.key: getattr(cylinder, c.key) for c in GasCylinder.__table__.columns}
    cylinder_dict["current_level_percentage"] = (cylinder.current_level / cylinder.capacity) * 100
    cylinder_dict["danger_category_info"] = DANGER_CATEGORIES.get(cylinder.danger_category, {})
    return cylinder_dict


def enrich_borrow_response(borrow: Borrow) -> dict:
    borrow_dict = {c.key: getattr(borrow, c.key) for c in Borrow.__table__.columns}
    borrow_dict["is_overdue"] = borrow.is_overdue()
    return borrow_dict
