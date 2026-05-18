from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from datetime import datetime, timedelta
import json
import models
import schemas
from models import RegistrationStatus, PesticideCategory


def generate_registration_no() -> str:
    now = datetime.now()
    return f"NY{now.strftime('%Y%m%d%H%M%S')}{now.microsecond // 1000:03d}"


def create_history_record(
    db: Session,
    registration_id: int,
    version: int,
    change_type: str,
    changed_by: str = None,
    change_reason: str = None,
    registration: models.PesticideRegistration = None
):
    history = models.RegistrationHistory(
        registration_id=registration_id,
        version=version,
        changed_by=changed_by,
        change_type=change_type,
        change_reason=change_reason,
        store_name=registration.store_name,
        pesticide_name=registration.pesticide_name,
        pesticide_category=registration.pesticide_category,
        quantity=registration.quantity,
        purchase_date=registration.purchase_date,
        status=registration.status,
        auditor=registration.auditor,
        audit_opinion=registration.audit_opinion,
        manual_processor=registration.manual_processor,
        manual_remark=registration.manual_remark,
        snapshot_data=json.dumps({
            "store_name": registration.store_name,
            "store_address": registration.store_address,
            "pesticide_name": registration.pesticide_name,
            "pesticide_category": registration.pesticide_category.value,
            "quantity": registration.quantity,
            "unit": registration.unit,
            "purchase_date": registration.purchase_date.isoformat(),
            "status": registration.status.value
        }, ensure_ascii=False)
    )
    db.add(history)


def check_purchase_limit(
    db: Session,
    farmer_id: int,
    pesticide_category: PesticideCategory,
    quantity: float,
    purchase_date: datetime,
    exclude_registration_id: int = None
) -> tuple[bool, str]:
    rule = db.query(models.PurchaseLimitRule).filter(
        models.PurchaseLimitRule.pesticide_category == pesticide_category,
        models.PurchaseLimitRule.is_active == 1
    ).first()

    if not rule:
        return True, ""

    if quantity > rule.max_quantity_per_purchase:
        return False, f"单次购买数量超限，最大允许{rule.max_quantity_per_purchase}{'瓶'}"

    month_start = purchase_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    next_month = (month_start + timedelta(days=32)).replace(day=1)
    
    query = db.query(func.sum(models.PesticideRegistration.quantity)).filter(
        models.PesticideRegistration.farmer_id == farmer_id,
        models.PesticideRegistration.pesticide_category == pesticide_category,
        models.PesticideRegistration.status.in_([
            RegistrationStatus.SUBMITTED,
            RegistrationStatus.UNDER_REVIEW,
            RegistrationStatus.APPROVED
        ]),
        models.PesticideRegistration.purchase_date >= month_start,
        models.PesticideRegistration.purchase_date < next_month
    )
    
    if exclude_registration_id:
        query = query.filter(models.PesticideRegistration.id != exclude_registration_id)
    
    month_total = query.scalar() or 0
    
    if month_total + quantity > rule.max_quantity_per_month:
        return False, f"本月累计购买超限，本月已购{month_total}，限购{rule.max_quantity_per_month}{'瓶'}"
    
    return True, ""


def get_farmer(db: Session, farmer_id: int):
    return db.query(models.Farmer).filter(models.Farmer.id == farmer_id).first()


def get_farmer_by_id_card(db: Session, id_card: str):
    return db.query(models.Farmer).filter(models.Farmer.id_card == id_card).first()


def get_farmers(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Farmer).offset(skip).limit(limit).all()


def create_farmer(db: Session, farmer: schemas.FarmerCreate):
    db_farmer = models.Farmer(**farmer.model_dump())
    db.add(db_farmer)
    db.commit()
    db.refresh(db_farmer)
    return db_farmer


def create_pesticide_registration(db: Session, registration: schemas.PesticideRegistrationCreate):
    is_allowed, limit_msg = check_purchase_limit(
        db,
        farmer_id=registration.farmer_id,
        pesticide_category=registration.pesticide_category,
        quantity=registration.quantity,
        purchase_date=registration.purchase_date
    )
    
    if not is_allowed:
        raise ValueError(limit_msg)
    
    registration_no = generate_registration_no()
    db_registration = models.PesticideRegistration(
        **registration.model_dump(),
        registration_no=registration_no,
        status=RegistrationStatus.DRAFT
    )
    db.add(db_registration)
    db.commit()
    db.refresh(db_registration)
    
    create_history_record(
        db,
        registration_id=db_registration.id,
        version=1,
        change_type="创建",
        change_reason="新建登记记录",
        registration=db_registration
    )
    db.commit()
    
    return db_registration


def get_pesticide_registration(db: Session, registration_id: int):
    return db.query(models.PesticideRegistration).filter(models.PesticideRegistration.id == registration_id).first()


def get_pesticide_registrations(db: Session, skip: int = 0, limit: int = 100, farmer_id: int = None):
    query = db.query(models.PesticideRegistration)
    if farmer_id:
        query = query.filter(models.PesticideRegistration.farmer_id == farmer_id)
    return query.order_by(models.PesticideRegistration.created_at.desc()).offset(skip).limit(limit).all()


def update_pesticide_registration(
    db: Session,
    registration_id: int,
    registration_update: schemas.PesticideRegistrationUpdate,
    changed_by: str = None
):
    db_registration = get_pesticide_registration(db, registration_id)
    if not db_registration:
        return None
    
    current_version = db.query(models.RegistrationHistory).filter(
        models.RegistrationHistory.registration_id == registration_id
    ).count()
    
    update_data = registration_update.model_dump(exclude_unset=True)
    
    if 'quantity' in update_data or 'pesticide_category' in update_data:
        new_category = update_data.get('pesticide_category', db_registration.pesticide_category)
        new_quantity = update_data.get('quantity', db_registration.quantity)
        new_purchase_date = update_data.get('purchase_date', db_registration.purchase_date)
        
        is_allowed, limit_msg = check_purchase_limit(
            db,
            farmer_id=db_registration.farmer_id,
            pesticide_category=new_category,
            quantity=new_quantity,
            purchase_date=new_purchase_date,
            exclude_registration_id=registration_id
        )
        
        if not is_allowed:
            raise ValueError(limit_msg)
    
    for key, value in update_data.items():
        setattr(db_registration, key, value)
    
    create_history_record(
        db,
        registration_id=registration_id,
        version=current_version + 1,
        change_type="修改",
        changed_by=changed_by,
        change_reason="更新登记信息",
        registration=db_registration
    )
    
    db.commit()
    db.refresh(db_registration)
    return db_registration


def submit_registration(db: Session, registration_id: int, submitter: str = None):
    db_registration = get_pesticide_registration(db, registration_id)
    if not db_registration:
        return None
    
    if db_registration.status not in [RegistrationStatus.DRAFT, RegistrationStatus.WITHDRAWN]:
        raise ValueError("只有草稿或已撤回状态可以提交")
    
    is_allowed, limit_msg = check_purchase_limit(
        db,
        farmer_id=db_registration.farmer_id,
        pesticide_category=db_registration.pesticide_category,
        quantity=db_registration.quantity,
        purchase_date=db_registration.purchase_date,
        exclude_registration_id=registration_id
    )
    
    if not is_allowed:
        raise ValueError(limit_msg)
    
    current_version = db.query(models.RegistrationHistory).filter(
        models.RegistrationHistory.registration_id == registration_id
    ).count()
    
    db_registration.status = RegistrationStatus.SUBMITTED
    
    create_history_record(
        db,
        registration_id=registration_id,
        version=current_version + 1,
        change_type="提交",
        changed_by=submitter,
        change_reason="提交审核",
        registration=db_registration
    )
    
    db.commit()
    db.refresh(db_registration)
    return db_registration


def withdraw_registration(db: Session, registration_id: int, withdrawer: str = None):
    db_registration = get_pesticide_registration(db, registration_id)
    if not db_registration:
        return None
    
    if db_registration.status not in [RegistrationStatus.SUBMITTED, RegistrationStatus.UNDER_REVIEW]:
        raise ValueError("只有已提交或审核中状态可以撤回")
    
    current_version = db.query(models.RegistrationHistory).filter(
        models.RegistrationHistory.registration_id == registration_id
    ).count()
    
    db_registration.status = RegistrationStatus.WITHDRAWN
    
    create_history_record(
        db,
        registration_id=registration_id,
        version=current_version + 1,
        change_type="撤回",
        changed_by=withdrawer,
        change_reason="撤回申请",
        registration=db_registration
    )
    
    db.commit()
    db.refresh(db_registration)
    return db_registration


def audit_registration(
    db: Session,
    registration_id: int,
    approved: bool,
    audit_request: schemas.AuditRequest
):
    db_registration = get_pesticide_registration(db, registration_id)
    if not db_registration:
        return None
    
    if db_registration.status != RegistrationStatus.UNDER_REVIEW:
        raise ValueError("只有审核中状态可以进行审核")
    
    current_version = db.query(models.RegistrationHistory).filter(
        models.RegistrationHistory.registration_id == registration_id
    ).count()
    
    db_registration.status = RegistrationStatus.APPROVED if approved else RegistrationStatus.REJECTED
    db_registration.auditor = audit_request.auditor
    db_registration.audit_opinion = audit_request.audit_opinion
    db_registration.audit_time = datetime.now()
    
    create_history_record(
        db,
        registration_id=registration_id,
        version=current_version + 1,
        change_type="审核通过" if approved else "审核拒绝",
        changed_by=audit_request.auditor,
        change_reason=audit_request.audit_opinion,
        registration=db_registration
    )
    
    db.commit()
    db.refresh(db_registration)
    return db_registration


def start_manual_process(db: Session, registration_id: int, processor: str = None):
    db_registration = get_pesticide_registration(db, registration_id)
    if not db_registration:
        return None
    
    if db_registration.status != RegistrationStatus.SUBMITTED:
        raise ValueError("只有已提交状态可以进入人工处理")
    
    current_version = db.query(models.RegistrationHistory).filter(
        models.RegistrationHistory.registration_id == registration_id
    ).count()
    
    db_registration.status = RegistrationStatus.MANUAL_PROCESSING
    
    create_history_record(
        db,
        registration_id=registration_id,
        version=current_version + 1,
        change_type="人工处理",
        changed_by=processor,
        change_reason="登记进入人工处理流程",
        registration=db_registration
    )
    
    db.commit()
    db.refresh(db_registration)
    return db_registration


def add_manual_remark(db: Session, registration_id: int, manual_request: schemas.ManualProcessRequest):
    db_registration = get_pesticide_registration(db, registration_id)
    if not db_registration:
        return None
    
    if db_registration.status != RegistrationStatus.MANUAL_PROCESSING:
        raise ValueError("只有人工处理中状态可以添加备注")
    
    current_version = db.query(models.RegistrationHistory).filter(
        models.RegistrationHistory.registration_id == registration_id
    ).count()
    
    db_registration.manual_processor = manual_request.manual_processor
    db_registration.manual_remark = manual_request.manual_remark
    db_registration.manual_process_time = datetime.now()
    
    create_history_record(
        db,
        registration_id=registration_id,
        version=current_version + 1,
        change_type="人工备注",
        changed_by=manual_request.manual_processor,
        change_reason=manual_request.manual_remark,
        registration=db_registration
    )
    
    db.commit()
    db.refresh(db_registration)
    return db_registration


def submit_from_manual(db: Session, registration_id: int, processor: str = None):
    db_registration = get_pesticide_registration(db, registration_id)
    if not db_registration:
        return None
    
    if db_registration.status != RegistrationStatus.MANUAL_PROCESSING:
        raise ValueError("只有人工处理中状态可以提交审核")
    
    is_allowed, limit_msg = check_purchase_limit(
        db,
        farmer_id=db_registration.farmer_id,
        pesticide_category=db_registration.pesticide_category,
        quantity=db_registration.quantity,
        purchase_date=db_registration.purchase_date,
        exclude_registration_id=registration_id
    )
    
    if not is_allowed:
        raise ValueError(limit_msg)
    
    current_version = db.query(models.RegistrationHistory).filter(
        models.RegistrationHistory.registration_id == registration_id
    ).count()
    
    db_registration.status = RegistrationStatus.UNDER_REVIEW
    
    create_history_record(
        db,
        registration_id=registration_id,
        version=current_version + 1,
        change_type="人工提交审核",
        changed_by=processor,
        change_reason="人工处理完成，提交审核",
        registration=db_registration
    )
    
    db.commit()
    db.refresh(db_registration)
    return db_registration


def get_registration_history(db: Session, registration_id: int):
    return db.query(models.RegistrationHistory).filter(
        models.RegistrationHistory.registration_id == registration_id
    ).order_by(models.RegistrationHistory.version.desc()).all()


def create_purchase_limit_rule(db: Session, rule: schemas.PurchaseLimitRuleCreate):
    existing = db.query(models.PurchaseLimitRule).filter(
        models.PurchaseLimitRule.pesticide_category == rule.pesticide_category
    ).first()
    
    if existing:
        existing.max_quantity_per_month = rule.max_quantity_per_month
        existing.max_quantity_per_purchase = rule.max_quantity_per_purchase
        existing.is_active = 1
        db_rule = existing
    else:
        db_rule = models.PurchaseLimitRule(**rule.model_dump())
        db.add(db_rule)
    
    db.commit()
    db.refresh(db_rule)
    return db_rule


def get_purchase_limit_rules(db: Session):
    return db.query(models.PurchaseLimitRule).filter(models.PurchaseLimitRule.is_active == 1).all()
