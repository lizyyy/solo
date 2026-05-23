from sqlalchemy.orm import Session
from models import Device, Inspection, Quote, Review, StatusHistory, ExceptionLog, InspectionReport, DeviceStatus, ReviewStatus
from schemas import DeviceCreate, InspectionCreate, QuoteCreate, ReviewCreate, StatusTransition, ManualCorrection
from datetime import datetime
import json


def create_status_history(db: Session, device_id: int, from_status: str, to_status: str, operator: str, remarks: str = None):
    status_history = StatusHistory(
        device_id=device_id,
        from_status=from_status,
        to_status=to_status,
        operator=operator,
        remarks=remarks
    )
    db.add(status_history)
    db.commit()


def log_exception(db: Session, serial_number: str, endpoint: str, raw_input: dict, error_message: str):
    exception_log = ExceptionLog(
        serial_number=serial_number,
        endpoint=endpoint,
        raw_input=json.dumps(raw_input, ensure_ascii=False),
        error_message=error_message
    )
    db.add(exception_log)
    db.commit()
    return exception_log


def check_duplicate_serial(db: Session, serial_number: str) -> bool:
    return db.query(Device).filter(Device.serial_number == serial_number).first() is not None


def create_device(db: Session, device: DeviceCreate):
    if check_duplicate_serial(db, device.serial_number):
        raise ValueError(f"序列号 {device.serial_number} 已存在，禁止重复入库")
    
    db_device = Device(**device.model_dump())
    db.add(db_device)
    db.commit()
    db.refresh(db_device)
    
    create_status_history(
        db=db,
        device_id=db_device.id,
        from_status=None,
        to_status=DeviceStatus.PENDING,
        operator="system",
        remarks="设备创建"
    )
    
    return db_device


def get_device_by_serial(db: Session, serial_number: str):
    return db.query(Device).filter(Device.serial_number == serial_number).first()


def calculate_total_score(inspection: InspectionCreate) -> float:
    weights = {
        "screen": 0.3,
        "battery": 0.25,
        "appearance": 0.2,
        "function": 0.25
    }
    
    total = (
        inspection.screen_score * weights["screen"] +
        inspection.battery_score * weights["battery"] +
        inspection.appearance_score * weights["appearance"] +
        inspection.function_score * weights["function"]
    )
    return round(total, 2)


def create_inspection(db: Session, inspection: InspectionCreate):
    device = get_device_by_serial(db, inspection.serial_number)
    if not device:
        raise ValueError(f"设备 {inspection.serial_number} 不存在")
    
    total_score = calculate_total_score(inspection)
    
    inspection_data = inspection.model_dump(exclude={"serial_number", "deductions"})
    inspection_data["total_score"] = total_score
    inspection_data["device_id"] = device.id
    
    db_inspection = Inspection(**inspection_data)
    db.add(db_inspection)
    db.flush()
    
    for deduction in inspection.deductions:
        from models import Deduction
        db_deduction = Deduction(
            inspection_id=db_inspection.id,
            **deduction.model_dump()
        )
        db.add(db_deduction)
    
    old_status = device.status
    
    if device.status in [DeviceStatus.QUOTED, DeviceStatus.REVIEWING, DeviceStatus.APPROVED]:
        remarks = "补测完成（先报价后补测）"
    else:
        device.status = DeviceStatus.INSPECTED
        remarks = "检测完成"
    
    db.commit()
    db.refresh(db_inspection)
    db.refresh(device)
    
    create_status_history(
        db=db,
        device_id=device.id,
        from_status=old_status,
        to_status=device.status,
        operator=inspection.inspector,
        remarks=remarks
    )
    
    return db_inspection


def create_quote(db: Session, quote: QuoteCreate):
    device = get_device_by_serial(db, quote.serial_number)
    if not device:
        raise ValueError(f"设备 {quote.serial_number} 不存在")
    
    last_quote = db.query(Quote).filter(Quote.device_id == device.id).order_by(Quote.version.desc()).first()
    version = last_quote.version + 1 if last_quote else 1
    
    quote_data = quote.model_dump(exclude={"serial_number"})
    quote_data["device_id"] = device.id
    quote_data["version"] = version
    quote_data["final_price"] = quote.initial_price
    
    db_quote = Quote(**quote_data)
    db.add(db_quote)
    
    old_status = device.status
    device.status = DeviceStatus.QUOTED
    
    if old_status == DeviceStatus.PENDING:
        remarks = f"先报价后补测：报价创建，版本 {version}"
    else:
        remarks = f"报价创建，版本 {version}"
    
    db.commit()
    db.refresh(db_quote)
    db.refresh(device)
    
    create_status_history(
        db=db,
        device_id=device.id,
        from_status=old_status,
        to_status=DeviceStatus.QUOTED,
        operator=quote.quoted_by,
        remarks=remarks
    )
    
    return db_quote


def freeze_quote(db: Session, quote_id: int):
    quote = db.query(Quote).filter(Quote.id == quote_id).first()
    if not quote:
        raise ValueError(f"报价 {quote_id} 不存在")
    
    if quote.is_frozen:
        raise ValueError("报价已冻结，无法重复冻结")
    
    quote.is_frozen = True
    quote.frozen_at = datetime.now()
    db.commit()
    db.refresh(quote)
    
    return quote


def create_review(db: Session, review: ReviewCreate):
    device = get_device_by_serial(db, review.serial_number)
    if not device:
        raise ValueError(f"设备 {review.serial_number} 不存在")
    
    review_data = review.model_dump(exclude={"serial_number"})
    review_data["device_id"] = device.id
    
    db_review = Review(**review_data)
    db.add(db_review)
    
    old_status = device.status
    device.status = DeviceStatus.REVIEWING
    db.commit()
    db.refresh(db_review)
    db.refresh(device)
    
    create_status_history(
        db=db,
        device_id=device.id,
        from_status=old_status,
        to_status=DeviceStatus.REVIEWING,
        operator=review.reviewer,
        remarks="进入复核流程"
    )
    
    return db_review


def update_review_status(db: Session, review_id: int, status: ReviewStatus, comments: str = None):
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise ValueError(f"复核记录 {review_id} 不存在")
    
    review.status = status
    review.comments = comments
    review.reviewed_at = datetime.now()
    
    device = review.device
    old_status = device.status
    
    if status == ReviewStatus.APPROVED:
        device.status = DeviceStatus.APPROVED
    elif status == ReviewStatus.REJECTED:
        device.status = DeviceStatus.REJECTED
    elif status == ReviewStatus.NEEDS_REVISION:
        device.status = DeviceStatus.INSPECTED
    
    db.commit()
    db.refresh(review)
    db.refresh(device)
    
    create_status_history(
        db=db,
        device_id=device.id,
        from_status=old_status,
        to_status=device.status,
        operator=review.reviewer,
        remarks=f"复核结果：{status}"
    )
    
    return review


def transition_status(db: Session, transition: StatusTransition):
    device = get_device_by_serial(db, transition.serial_number)
    if not device:
        raise ValueError(f"设备 {transition.serial_number} 不存在")
    
    old_status = device.status
    device.status = transition.target_status
    db.commit()
    db.refresh(device)
    
    create_status_history(
        db=db,
        device_id=device.id,
        from_status=old_status,
        to_status=transition.target_status,
        operator=transition.operator,
        remarks=transition.remarks
    )
    
    return device


def apply_manual_correction(db: Session, correction: ManualCorrection):
    device = get_device_by_serial(db, correction.serial_number)
    if not device:
        raise ValueError(f"设备 {correction.serial_number} 不存在")
    
    if correction.correction_type == "status":
        old_status = device.status
        device.status = correction.correction_value
        db.commit()
        db.refresh(device)
        
        create_status_history(
            db=db,
            device_id=device.id,
            from_status=old_status,
            to_status=correction.correction_value,
            operator=correction.operator,
            remarks=f"人工修正：{correction.reason}"
        )
    elif correction.correction_type == "quote":
        latest_quote = db.query(Quote).filter(Quote.device_id == device.id).order_by(Quote.version.desc()).first()
        if latest_quote and not latest_quote.is_frozen:
            latest_quote.final_price = float(correction.correction_value)
            db.commit()
            db.refresh(latest_quote)
    
    return device


def generate_report(db: Session, serial_number: str, generated_by: str):
    device = get_device_by_serial(db, serial_number)
    if not device:
        raise ValueError(f"设备 {serial_number} 不存在")
    
    latest_inspection = db.query(Inspection).filter(Inspection.device_id == device.id).order_by(Inspection.created_at.desc()).first()
    latest_quote = db.query(Quote).filter(Quote.device_id == device.id).order_by(Quote.version.desc()).first()
    latest_review = db.query(Review).filter(Review.device_id == device.id).order_by(Review.created_at.desc()).first()
    
    report_number = f"RPT{datetime.now().strftime('%Y%m%d%H%M%S')}{device.id}"
    
    content = {
        "report_number": report_number,
        "device_info": {
            "serial_number": device.serial_number,
            "brand": device.brand,
            "model": device.model,
            "storage": device.storage,
            "color": device.color,
            "status": device.status
        },
        "inspection": {
            "screen_score": latest_inspection.screen_score if latest_inspection else None,
            "battery_score": latest_inspection.battery_score if latest_inspection else None,
            "appearance_score": latest_inspection.appearance_score if latest_inspection else None,
            "function_score": latest_inspection.function_score if latest_inspection else None,
            "total_score": latest_inspection.total_score if latest_inspection else None,
            "inspector": latest_inspection.inspector if latest_inspection else None
        } if latest_inspection else None,
        "quote": {
            "version": latest_quote.version if latest_quote else None,
            "initial_price": latest_quote.initial_price if latest_quote else None,
            "final_price": latest_quote.final_price if latest_quote else None,
            "is_frozen": latest_quote.is_frozen if latest_quote else None,
            "quoted_by": latest_quote.quoted_by if latest_quote else None
        } if latest_quote else None,
        "review": {
            "status": latest_review.status if latest_review else None,
            "comments": latest_review.comments if latest_review else None,
            "reviewer": latest_review.reviewer if latest_review else None
        } if latest_review else None,
        "generated_at": datetime.now().isoformat(),
        "generated_by": generated_by
    }
    
    report = InspectionReport(
        device_id=device.id,
        report_number=report_number,
        content=json.dumps(content, ensure_ascii=False, indent=2),
        generated_by=generated_by
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    
    return report
