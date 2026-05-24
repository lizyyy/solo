from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from sqlalchemy import create_engine, Column, Integer, String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.sql import func
from sqlalchemy import and_
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import uuid

SQLALCHEMY_DATABASE_URL = "sqlite:///./surgical_instruments.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class InstrumentPackage(Base):
    __tablename__ = "instrument_packages"
    id = Column(Integer, primary_key=True, index=True)
    batch_number = Column(String, index=True, unique=True)
    sterilization_cycle = Column(String, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class SterilizationRecord(Base):
    __tablename__ = "sterilization_records"
    id = Column(Integer, primary_key=True, index=True)
    cycle_number = Column(String, index=True)
    batch_number = Column(String, index=True)
    sterilizer_id = Column(String)
    start_time = Column(DateTime(timezone=True))
    end_time = Column(DateTime(timezone=True))
    result = Column(String)
    operator = Column(String)
    temperature = Column(String, nullable=True)
    pressure = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class IsolationOrder(Base):
    __tablename__ = "isolation_orders"
    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String, unique=True, index=True)
    batch_number = Column(String, index=True)
    sterilization_cycle = Column(String, index=True)
    operating_room = Column(String)
    receiving_nurse = Column(String)
    isolation_reason = Column(Text)
    submission_time = Column(DateTime(timezone=True))
    surgery_time = Column(DateTime(timezone=True))
    is_late_submission = Column(Boolean, default=False)
    cross_room_usage = Column(Boolean, default=False)
    temp_package_change = Column(Boolean, default=False)
    sterilization_verified = Column(Boolean, default=False)
    sterilization_result = Column(String, nullable=True)
    status = Column(String, default="pending")
    final_conclusion = Column(String, nullable=True)
    reviewed_by = Column(String, nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class DecisionRecord(Base):
    __tablename__ = "decision_records"
    id = Column(Integer, primary_key=True, index=True)
    isolation_order_id = Column(Integer, ForeignKey("isolation_orders.id"))
    decision_type = Column(String)
    conclusion = Column(String)
    reason = Column(Text)
    operator = Column(String)
    supplementary_evidence = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class UsageRecord(Base):
    __tablename__ = "usage_records"
    id = Column(Integer, primary_key=True, index=True)
    batch_number = Column(String, index=True)
    operating_room = Column(String)
    usage_time = Column(DateTime(timezone=True))
    receiving_nurse = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

Base.metadata.create_all(bind=engine)

class RawMaterialCreate(BaseModel):
    batch_number: str
    sterilization_cycle: str
    operating_room: str
    receiving_nurse: str
    isolation_reason: str
    submission_time: datetime
    surgery_time: datetime
    supplementary_info: Optional[str] = None

class SterilizationRecordCreate(BaseModel):
    cycle_number: str
    batch_number: str
    sterilizer_id: str
    start_time: datetime
    end_time: datetime
    result: str
    operator: str
    temperature: Optional[str] = None
    pressure: Optional[str] = None

class DecisionCreate(BaseModel):
    isolation_order_id: int
    decision_type: str
    conclusion: str
    reason: str
    operator: str
    supplementary_evidence: Optional[str] = None

app = FastAPI(title="手术器械批号隔离 API")

@app.post("/api/sterilization-records/", summary="录入消毒记录")
def create_sterilization_record(record: SterilizationRecordCreate, db: Session = Depends(get_db)):
    existing = db.query(SterilizationRecord).filter(
        and_(
            SterilizationRecord.cycle_number == record.cycle_number,
            SterilizationRecord.batch_number == record.batch_number
        )
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="该炉次+批号的消毒记录已存在")
    
    db_record = SterilizationRecord(
        cycle_number=record.cycle_number,
        batch_number=record.batch_number,
        sterilizer_id=record.sterilizer_id,
        start_time=record.start_time,
        end_time=record.end_time,
        result=record.result,
        operator=record.operator,
        temperature=record.temperature,
        pressure=record.pressure
    )
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    
    return {"status": "success", "record_id": db_record.id, "result": record.result}

@app.get("/api/sterilization-records/", summary="查询消毒记录列表")
def list_sterilization_records(cycle_number: Optional[str] = None, batch_number: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(SterilizationRecord)
    if cycle_number:
        query = query.filter(SterilizationRecord.cycle_number == cycle_number)
    if batch_number:
        query = query.filter(SterilizationRecord.batch_number == batch_number)
    records = query.order_by(SterilizationRecord.created_at.desc()).all()
    return [{"id": r.id, "cycle_number": r.cycle_number, "batch_number": r.batch_number, "result": r.result, "operator": r.operator} for r in records]

def validate_sterilization(db: Session, batch_number: str, cycle_number: str) -> dict:
    records = db.query(SterilizationRecord).filter(
        and_(
            SterilizationRecord.cycle_number == cycle_number,
            SterilizationRecord.batch_number == batch_number
        )
    ).all()
    
    if not records:
        return {
            "valid": False,
            "exists": False,
            "matched": False,
            "passed": False,
            "issues": ["消毒记录不存在：该炉次+批号未找到消毒记录"],
            "risk_level": "critical"
        }
    
    record = records[0]
    matched = record.batch_number == batch_number
    passed = record.result == "合格" or record.result == "pass" or record.result == "PASS"
    
    issues = []
    if not matched:
        issues.append(f"批号不匹配：消毒记录批号为{record.batch_number}，提交批号为{batch_number}")
    if not passed:
        issues.append(f"消毒结果不合格：炉次{cycle_number}的消毒结果为{record.result}")
    
    risk_level = "normal"
    if issues:
        risk_level = "high"
    
    return {
        "valid": len(issues) == 0,
        "exists": True,
        "matched": matched,
        "passed": passed,
        "result": record.result,
        "issues": issues,
        "risk_level": risk_level
    }

@app.post("/api/raw-materials/", summary="接收原始材料并生成隔离单")
def submit_raw_material(material: RawMaterialCreate, db: Session = Depends(get_db)):
    is_late = material.submission_time > material.surgery_time
    
    usage_records = db.query(UsageRecord).filter(UsageRecord.batch_number == material.batch_number).all()
    other_rooms = [r.operating_room for r in usage_records if r.operating_room != material.operating_room]
    cross_room = len(other_rooms) > 0
    
    duplicate_order = db.query(IsolationOrder).filter(
        and_(
            IsolationOrder.batch_number == material.batch_number,
            IsolationOrder.sterilization_cycle == material.sterilization_cycle,
            IsolationOrder.status != "cancelled"
        )
    ).first()
    
    is_temp_change = "临时换包" in material.isolation_reason or "换包" in material.isolation_reason
    
    sterilization_validation = validate_sterilization(db, material.batch_number, material.sterilization_cycle)
    
    if duplicate_order:
        decisions = db.query(DecisionRecord).filter(DecisionRecord.isolation_order_id == duplicate_order.id).order_by(DecisionRecord.created_at.desc()).all()
        return {
            "status": "duplicate",
            "message": "同一份材料已存在隔离单，同一批号+炉次只保留一条有效记录",
            "existing_order": {
                "order_no": duplicate_order.order_no,
                "status": duplicate_order.status,
                "final_conclusion": duplicate_order.final_conclusion,
                "latest_decision": decisions[0].conclusion if decisions else None
            }
        }
    
    order_no = f"ISO-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    order = IsolationOrder(
        order_no=order_no,
        batch_number=material.batch_number,
        sterilization_cycle=material.sterilization_cycle,
        operating_room=material.operating_room,
        receiving_nurse=material.receiving_nurse,
        isolation_reason=material.isolation_reason + (f" 补充说明: {material.supplementary_info}" if material.supplementary_info else ""),
        submission_time=material.submission_time,
        surgery_time=material.surgery_time,
        is_late_submission=is_late,
        cross_room_usage=cross_room,
        temp_package_change=is_temp_change,
        sterilization_verified=sterilization_validation["exists"],
        sterilization_result=sterilization_validation.get("result"),
        status="pending"
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    
    usage = UsageRecord(
        batch_number=material.batch_number,
        operating_room=material.operating_room,
        usage_time=material.surgery_time,
        receiving_nurse=material.receiving_nurse
    )
    db.add(usage)
    db.commit()
    
    all_issues = []
    if is_late:
        all_issues.append("补录时间晚于手术时间")
    if cross_room:
        all_issues.append(f"同批号跨手术间使用: {', '.join(other_rooms)}")
    all_issues.extend(sterilization_validation["issues"])
    
    return {
        "status": "created",
        "order_no": order.order_no,
        "order_id": order.id,
        "flags": {
            "is_late_submission": is_late,
            "cross_room_usage": cross_room,
            "temp_package_change": is_temp_change,
            "sterilization_verified": sterilization_validation["exists"],
            "sterilization_passed": sterilization_validation.get("passed", False)
        },
        "sterilization_validation": sterilization_validation,
        "all_issues": all_issues
    }

@app.get("/api/isolation-orders/")
def list_isolation_orders(skip: int = 0, limit: int = 100, status: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(IsolationOrder)
    if status:
        query = query.filter(IsolationOrder.status == status)
    orders = query.order_by(IsolationOrder.created_at.desc()).offset(skip).limit(limit).all()
    return [{"id": o.id, "order_no": o.order_no, "batch_number": o.batch_number, "sterilization_cycle": o.sterilization_cycle, "status": o.status, "operating_room": o.operating_room, "receiving_nurse": o.receiving_nurse, "sterilization_verified": o.sterilization_verified, "sterilization_result": o.sterilization_result} for o in orders]

@app.get("/api/isolation-orders/{order_id}")
def get_isolation_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(IsolationOrder).filter(IsolationOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="隔离单不存在")
    decisions = db.query(DecisionRecord).filter(DecisionRecord.isolation_order_id == order_id).order_by(DecisionRecord.created_at.desc()).all()
    sterilization_records = db.query(SterilizationRecord).filter(
        and_(
            SterilizationRecord.cycle_number == order.sterilization_cycle,
            SterilizationRecord.batch_number == order.batch_number
        )
    ).all()
    return {
        "id": order.id,
        "order_no": order.order_no,
        "batch_number": order.batch_number,
        "sterilization_cycle": order.sterilization_cycle,
        "operating_room": order.operating_room,
        "receiving_nurse": order.receiving_nurse,
        "isolation_reason": order.isolation_reason,
        "status": order.status,
        "final_conclusion": order.final_conclusion,
        "flags": {
            "is_late_submission": order.is_late_submission,
            "cross_room_usage": order.cross_room_usage,
            "temp_package_change": order.temp_package_change,
            "sterilization_verified": order.sterilization_verified,
            "sterilization_result": order.sterilization_result
        },
        "sterilization_records": [{"id": r.id, "result": r.result, "operator": r.operator} for r in sterilization_records],
        "decisions": [{"id": d.id, "type": d.decision_type, "conclusion": d.conclusion, "operator": d.operator} for d in decisions]
    }

@app.post("/api/decisions/")
def create_decision(decision: DecisionCreate, db: Session = Depends(get_db)):
    order = db.query(IsolationOrder).filter(IsolationOrder.id == decision.isolation_order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="隔离单不存在")
    if order.status == "released" and decision.decision_type == "approve":
        raise HTTPException(status_code=400, detail="重复放行拦截：该隔离单已放行，无需重复操作")
    
    sterilization_validation = validate_sterilization(db, order.batch_number, order.sterilization_cycle)
    
    if decision.decision_type == "approve" and not sterilization_validation["valid"]:
        return {
            "status": "warning",
            "message": "消毒记录校验未通过，放行需谨慎",
            "sterilization_issues": sterilization_validation["issues"],
            "need_manual_confirm": True
        }
    
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
    
    return {
        "status": "success",
        "order_status": order.status,
        "final_conclusion": order.final_conclusion,
        "sterilization_validation": sterilization_validation
    }

@app.get("/api/batch-trace/{batch_number}")
def trace_batch(batch_number: str, db: Session = Depends(get_db)):
    orders = db.query(IsolationOrder).filter(IsolationOrder.batch_number == batch_number).all()
    usage_records = db.query(UsageRecord).filter(UsageRecord.batch_number == batch_number).all()
    sterilization_records = db.query(SterilizationRecord).filter(SterilizationRecord.batch_number == batch_number).all()
    rooms = list(set([u.operating_room for u in usage_records]))
    
    sterilization_results = list(set([r.result for r in sterilization_records]))
    all_passed = all(r.result == "合格" or r.result == "pass" or r.result == "PASS" for r in sterilization_records) if sterilization_records else None
    
    return {
        "batch_number": batch_number,
        "usage_rooms": rooms,
        "has_cross_room_usage": len(rooms) > 1,
        "isolation_count": len(orders),
        "sterilization_records_count": len(sterilization_records),
        "sterilization_results": sterilization_results,
        "all_sterilization_passed": all_passed,
        "orders": [{"order_no": o.order_no, "status": o.status, "operating_room": o.operating_room, "sterilization_cycle": o.sterilization_cycle} for o in orders]
    }

@app.get("/api/sterilization-trace/{cycle}")
def trace_sterilization_cycle(cycle: str, db: Session = Depends(get_db)):
    records = db.query(SterilizationRecord).filter(SterilizationRecord.cycle_number == cycle).all()
    orders = db.query(IsolationOrder).filter(IsolationOrder.sterilization_cycle == cycle).all()
    
    batch_numbers = list(set([r.batch_number for r in records]))
    all_passed = all(r.result == "合格" or r.result == "pass" or r.result == "PASS" for r in records) if records else None
    
    return {
        "cycle": cycle,
        "sterilization_records": [{"id": r.id, "batch_number": r.batch_number, "result": r.result, "operator": r.operator, "sterilizer_id": r.sterilizer_id} for r in records],
        "batch_count": len(batch_numbers),
        "batch_numbers": batch_numbers,
        "all_passed": all_passed,
        "order_count": len(orders),
        "orders": [{"order_no": o.order_no, "batch_number": o.batch_number, "status": o.status} for o in orders]
    }

@app.get("/api/export/report")
def export_report(db: Session = Depends(get_db)):
    orders = db.query(IsolationOrder).order_by(IsolationOrder.created_at.desc()).all()
    headers = ["隔离单号", "批号", "消毒炉次", "手术间", "领用护士", "迟交", "跨房间", "临时换包", "消毒已验证", "消毒结果", "状态", "最终结论", "复核人", "创建时间"]
    rows = [headers]
    for o in orders:
        rows.append([
            o.order_no, o.batch_number, o.sterilization_cycle, o.operating_room, o.receiving_nurse,
            "是" if o.is_late_submission else "否",
            "是" if o.cross_room_usage else "否",
            "是" if o.temp_package_change else "否",
            "是" if o.sterilization_verified else "否",
            o.sterilization_result or "",
            o.status, o.final_conclusion or "", o.reviewed_by or "",
            o.created_at.strftime("%Y-%m-%d %H:%M:%S") if o.created_at else ""
        ])
    csv_lines = []
    for row in rows:
        csv_lines.append(",".join([f'"{str(cell)}"' for cell in row]))
    return PlainTextResponse(content="\n".join(csv_lines), media_type="text/csv")

@app.get("/api/health")
def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}
