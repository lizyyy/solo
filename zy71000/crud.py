from sqlalchemy.orm import Session
from sqlalchemy import and_
from models import InstrumentPackage, SterilizationRecord, IsolationOrder, DecisionRecord, UsageRecord
from schemas import RawMaterialCreate, DecisionCreate, SterilizationRecordCreate
from datetime import datetime
import uuid


def generate_order_no() -> str:
    return f"ISO-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"


def get_or_create_package(db: Session, batch_number: str, sterilization_cycle: str):
    package = db.query(InstrumentPackage).filter(
        InstrumentPackage.batch_number == batch_number
    ).first()
    if not package:
        package = InstrumentPackage(
            batch_number=batch_number,
            sterilization_cycle=sterilization_cycle
        )
        db.add(package)
        db.commit()
        db.refresh(package)
    return package


def check_cross_room_usage(db: Session, batch_number: str, operating_room: str) -> tuple:
    records = db.query(UsageRecord).filter(
        UsageRecord.batch_number == batch_number
    ).all()
    if not records:
        return False, []
    other_rooms = [r.operating_room for r in records if r.operating_room != operating_room]
    return len(other_rooms) > 0, other_rooms


def check_late_submission(submission_time: datetime, surgery_time: datetime) -> bool:
    return submission_time > surgery_time


def check_duplicate_isolation(db: Session, batch_number: str, sterilization_cycle: str) -> tuple:
    orders = db.query(IsolationOrder).filter(
        and_(
            IsolationOrder.batch_number == batch_number,
            IsolationOrder.sterilization_cycle == sterilization_cycle,
            IsolationOrder.status != "cancelled"
        )
    ).all()
    if orders:
        return True, orders[0]
    return False, None


def validate_sterilization(db: Session, batch_number: str, cycle_number: str) -> dict:
    records = db.query(SterilizationRecord).filter(
        and_(
            SterilizationRecord.sterilization_cycle == cycle_number
        )
    ).all()
    
    matching_records = []
    for r in records:
        package = db.query(InstrumentPackage).filter(InstrumentPackage.id == r.package_id).first()
        if package and package.batch_number == batch_number:
            matching_records.append(r)
    
    if not matching_records:
        return {
            "valid": False,
            "exists": False,
            "matched": False,
            "passed": False,
            "result": None,
            "issues": ["消毒记录不存在：该炉次+批号未找到消毒记录"],
            "risk_level": "critical"
        }
    
    record = matching_records[0]
    passed = record.result == "合格" or record.result == "pass" or record.result == "PASS"
    
    issues = []
    if not passed:
        issues.append(f"消毒结果不合格：炉次{cycle_number}的消毒结果为{record.result}")
    
    risk_level = "normal"
    if issues:
        risk_level = "high"
    
    return {
        "valid": len(issues) == 0,
        "exists": True,
        "matched": True,
        "passed": passed,
        "result": record.result,
        "issues": issues,
        "risk_level": risk_level
    }


def create_sterilization_record(db: Session, data: SterilizationRecordCreate):
    package = get_or_create_package(db, data.batch_number, data.cycle_number)
    
    existing = db.query(SterilizationRecord).filter(
        and_(
            SterilizationRecord.sterilization_cycle == data.cycle_number,
            SterilizationRecord.package_id == package.id
        )
    ).first()
    if existing:
        return None, "该炉次+批号的消毒记录已存在"
    
    record = SterilizationRecord(
        package_id=package.id,
        sterilization_cycle=data.cycle_number,
        sterilizer_id=data.sterilizer_id,
        start_time=data.start_time,
        end_time=data.end_time,
        result=data.result,
        operator=data.operator
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record, None


def get_sterilization_records(db: Session, cycle_number: str = None, batch_number: str = None):
    query = db.query(SterilizationRecord)
    if cycle_number:
        query = query.filter(SterilizationRecord.sterilization_cycle == cycle_number)
    if batch_number:
        package = db.query(InstrumentPackage).filter(InstrumentPackage.batch_number == batch_number).first()
        if package:
            query = query.filter(SterilizationRecord.package_id == package.id)
        else:
            return []
    return query.order_by(SterilizationRecord.created_at.desc()).all()


def validate_raw_material(db: Session, material: RawMaterialCreate) -> dict:
    issues = []
    risk_level = "normal"

    is_late = check_late_submission(material.submission_time, material.surgery_time)
    if is_late:
        issues.append(f"补录时间晚于手术时间")
        risk_level = "high"

    cross_room, rooms = check_cross_room_usage(db, material.batch_number, material.operating_room)
    if cross_room:
        issues.append(f"同批号跨手术间使用: {', '.join(rooms)}")
        risk_level = "high"

    duplicate, existing_order = check_duplicate_isolation(db, material.batch_number, material.sterilization_cycle)
    if duplicate:
        issues.append(f"该批号+炉次已存在隔离单")

    is_temp_change = "临时换包" in material.isolation_reason or "换包" in material.isolation_reason

    sterilization_validation = validate_sterilization(db, material.batch_number, material.sterilization_cycle)
    issues.extend(sterilization_validation["issues"])
    if sterilization_validation["risk_level"] == "critical":
        risk_level = "critical"
    elif sterilization_validation["risk_level"] == "high" and risk_level == "normal":
        risk_level = "high"

    return {
        "is_valid": len(issues) == 0 or duplicate is False,
        "issues": issues,
        "risk_level": risk_level,
        "is_late_submission": is_late,
        "cross_room_usage": cross_room,
        "temp_package_change": is_temp_change,
        "existing_order": existing_order if duplicate else None,
        "sterilization_validation": sterilization_validation
    }


def create_isolation_order(db: Session, material: RawMaterialCreate, validation_result: dict):
    package = get_or_create_package(db, material.batch_number, material.sterilization_cycle)

    order = IsolationOrder(
        order_no=generate_order_no(),
        package_id=package.id,
        batch_number=material.batch_number,
        sterilization_cycle=material.sterilization_cycle,
        operating_room=material.operating_room,
        receiving_nurse=material.receiving_nurse,
        isolation_reason=material.isolation_reason + (f"\n补充说明: {material.supplementary_info}" if material.supplementary_info else ""),
        submission_time=material.submission_time,
        surgery_time=material.surgery_time,
        is_late_submission=validation_result["is_late_submission"],
        cross_room_usage=validation_result["cross_room_usage"],
        temp_package_change=validation_result["temp_package_change"],
        sterilization_verified=validation_result["sterilization_validation"]["exists"],
        sterilization_result=validation_result["sterilization_validation"].get("result"),
        status="pending"
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    usage_record = UsageRecord(
        batch_number=material.batch_number,
        operating_room=material.operating_room,
        usage_time=material.surgery_time,
        receiving_nurse=material.receiving_nurse
    )
    db.add(usage_record)
    db.commit()

    return order


def get_isolation_order(db: Session, order_id: int):
    return db.query(IsolationOrder).filter(IsolationOrder.id == order_id).first()


def get_isolation_order_by_no(db: Session, order_no: str):
    return db.query(IsolationOrder).filter(IsolationOrder.order_no == order_no).first()


def get_isolation_orders(db: Session, skip: int = 0, limit: int = 100, status: str = None):
    query = db.query(IsolationOrder)
    if status:
        query = query.filter(IsolationOrder.status == status)
    return query.order_by(IsolationOrder.created_at.desc()).offset(skip).limit(limit).all()


def create_decision_record(db: Session, decision: DecisionCreate):
    order = get_isolation_order(db, decision.isolation_order_id)
    if not order:
        return None

    if order.status == "released" and decision.decision_type == "approve":
        return None

    sterilization_validation = validate_sterilization(db, order.batch_number, order.sterilization_cycle)

    db_decision = DecisionRecord(
        isolation_order_id=decision.isolation_order_id,
        decision_type=decision.decision_type,
        conclusion=decision.conclusion,
        reason=decision.reason + f" 消毒记录校验: {'通过' if sterilization_validation['valid'] else '未通过'}",
        operator=decision.operator,
        supplementary_evidence=decision.supplementary_evidence
    )
    db.add(db_decision)

    if decision.decision_type == "approve":
        order.status = "released"
        order.final_conclusion = decision.conclusion
        order.reviewed_by = decision.operator
        order.reviewed_at = datetime.now()
    elif decision.decision_type == "reject":
        order.status = "rejected"
        order.final_conclusion = decision.conclusion
        order.reviewed_by = decision.operator
        order.reviewed_at = datetime.now()
    elif decision.decision_type == "supplement":
        order.status = "pending"

    db.commit()
    db.refresh(db_decision)
    db.refresh(order)
    return db_decision, sterilization_validation


def get_sterilization_records_by_cycle(db: Session, cycle: str):
    return db.query(SterilizationRecord).filter(SterilizationRecord.sterilization_cycle == cycle).all()


def export_isolation_report(db: Session, start_date: datetime = None, end_date: datetime = None):
    query = db.query(IsolationOrder)
    if start_date:
        query = query.filter(IsolationOrder.created_at >= start_date)
    if end_date:
        query = query.filter(IsolationOrder.created_at <= end_date)
    
    orders = query.order_by(IsolationOrder.created_at.desc()).all()
    
    headers = [
        "隔离单号", "批号", "消毒炉次", "手术间", "领用护士",
        "隔离原因", "提交时间", "手术时间", "是否迟交", "跨房间使用",
        "临时换包", "消毒已验证", "消毒结果", "状态", "最终结论", "复核人", "复核时间"
    ]
    
    rows = [headers]
    for order in orders:
        rows.append([
            order.order_no,
            order.batch_number,
            order.sterilization_cycle,
            order.operating_room,
            order.receiving_nurse,
            order.isolation_reason.replace("\n", " "),
            order.submission_time.strftime("%Y-%m-%d %H:%M:%S"),
            order.surgery_time.strftime("%Y-%m-%d %H:%M:%S"),
            "是" if order.is_late_submission else "否",
            "是" if order.cross_room_usage else "否",
            "是" if order.temp_package_change else "否",
            "是" if order.sterilization_verified else "否",
            order.sterilization_result or "",
            order.status,
            order.final_conclusion or "",
            order.reviewed_by or "",
            order.reviewed_at.strftime("%Y-%m-%d %H:%M:%S") if order.reviewed_at else ""
        ])
    
    return rows


def get_order_decisions(db: Session, order_id: int):
    return db.query(DecisionRecord).filter(DecisionRecord.isolation_order_id == order_id).order_by(DecisionRecord.created_at.desc()).all()
