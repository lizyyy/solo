from datetime import datetime
from enum import Enum
from typing import Optional, List
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, Column, String, DateTime, Boolean, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import json

DATABASE_URL = "sqlite:///./iot_evidence.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class IsolationStatus(str, Enum):
    PENDING = "pending"
    ISOLATED = "isolated"
    NOT_ISOLATED = "not_isolated"
    NEEDS_REVIEW = "needs_review"


class ProcessingStatus(str, Enum):
    NEW = "new"
    PROCESSED = "processed"
    DUPLICATE = "duplicate"


class ErrorCode(str, Enum):
    MISSING_FIELDS = "missing_fields"
    INVALID_STATUS = "invalid_status"
    NEEDS_MANUAL_REVIEW = "needs_manual_review"
    ALREADY_PROCESSED = "already_processed"
    PROOF_VALIDATION_FAILED = "proof_validation_failed"
    FIRMWARE_MISMATCH = "firmware_mismatch"


class DeviceEvidenceDB(Base):
    __tablename__ = "device_evidence"

    report_id = Column(String, primary_key=True, index=True)
    device_id = Column(String, index=True, nullable=False)
    proof_material = Column(Text, nullable=False)
    firmware_version = Column(String, nullable=False)
    expected_firmware = Column(String, nullable=False)
    policy_result = Column(Boolean, nullable=False)
    isolation_action = Column(String, nullable=False)
    isolation_status = Column(String, nullable=False)
    evidence_report = Column(Text)
    processing_status = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    processed_at = Column(DateTime)
    needs_review = Column(Boolean, default=False)
    review_notes = Column(Text)


Base.metadata.create_all(bind=engine)


class DeviceEvidenceCreate(BaseModel):
    device_id: str = Field(..., description="设备编号")
    proof_material: str = Field(..., description="证明材料")
    firmware_version: str = Field(..., description="当前固件版本")
    expected_firmware: str = Field(..., description="预期固件版本")


class DeviceEvidenceResponse(BaseModel):
    report_id: str
    device_id: str
    proof_material: str
    firmware_version: str
    expected_firmware: str
    policy_result: bool
    isolation_action: str
    isolation_status: IsolationStatus
    evidence_report: Optional[str]
    processing_status: ProcessingStatus
    created_at: datetime
    processed_at: Optional[datetime]
    needs_review: bool
    review_notes: Optional[str]

    class Config:
        orm_mode = True


class ErrorResponse(BaseModel):
    error_code: ErrorCode
    message: str
    details: Optional[dict] = None


app = FastAPI(title="IoT设备可信证据隔离动作证明材料API", version="1.0.0")


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    missing_fields = []
    for error in exc.errors():
        if error.get("type") == "missing":
            loc = error.get("loc", [])
            if len(loc) > 1:
                missing_fields.append(loc[1])
    
    if missing_fields:
        return JSONResponse(
            status_code=400,
            content={
                "error_code": ErrorCode.MISSING_FIELDS,
                "message": "缺少必需字段",
                "details": {"missing_fields": missing_fields}
            }
        )
    
    return JSONResponse(
        status_code=400,
        content={
            "error_code": "invalid_request",
            "message": "请求参数无效",
            "details": {"errors": exc.errors()}
        }
    )


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def generate_report_id(device_id: str) -> str:
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    return f"RPT-{device_id}-{timestamp}"


def validate_proof_material(proof: str) -> tuple[bool, str]:
    if not proof or len(proof.strip()) < 10:
        return False, "证明材料长度不足，至少需要10个字符"
    required_keywords = ["hash", "signature", "timestamp"]
    proof_lower = proof.lower()
    for keyword in required_keywords:
        if keyword not in proof_lower:
            return False, f"证明材料缺少必要关键字: {keyword}"
    return True, "证明材料校验通过"


def check_firmware_match(current: str, expected: str) -> tuple[bool, str]:
    if current == expected:
        return True, "固件版本匹配"
    return False, f"固件版本不匹配: 当前={current}, 预期={expected}"


def generate_evidence_report(evidence: DeviceEvidenceCreate, policy_result: bool, 
                             firmware_match: bool, proof_valid: bool) -> str:
    report = {
        "report_time": datetime.utcnow().isoformat(),
        "device_id": evidence.device_id,
        "proof_validation": {
            "passed": proof_valid,
            "message": "证明材料校验通过" if proof_valid else "证明材料校验失败"
        },
        "firmware_check": {
            "matched": firmware_match,
            "current_version": evidence.firmware_version,
            "expected_version": evidence.expected_firmware
        },
        "policy_result": policy_result,
        "risk_assessment": "高风险" if (not proof_valid or not firmware_match) else "低风险",
        "recommended_action": "立即隔离" if (not proof_valid or not firmware_match or not policy_result) else "无需隔离"
    }
    return json.dumps(report, ensure_ascii=False, indent=2)


@app.post("/api/evidence/review", response_model=DeviceEvidenceResponse, 
          responses={400: {"model": ErrorResponse}, 409: {"model": ErrorResponse}})
async def review_evidence(evidence: DeviceEvidenceCreate):
    db = next(get_db())
    
    report_id = generate_report_id(evidence.device_id)
    
    existing = db.query(DeviceEvidenceDB).filter(
        DeviceEvidenceDB.device_id == evidence.device_id,
        DeviceEvidenceDB.proof_material == evidence.proof_material,
        DeviceEvidenceDB.firmware_version == evidence.firmware_version
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=409,
            detail={
                "error_code": ErrorCode.ALREADY_PROCESSED,
                "message": "该证据已处理过，重复上报",
                "details": {"existing_report_id": existing.report_id}
            }
        )
    
    proof_valid, proof_msg = validate_proof_material(evidence.proof_material)
    firmware_match, firmware_msg = check_firmware_match(evidence.firmware_version, evidence.expected_firmware)
    
    policy_result = proof_valid and firmware_match
    
    if not proof_valid:
        isolation_action = "强制隔离"
        isolation_status = IsolationStatus.ISOLATED
        needs_review = False
    elif not firmware_match:
        isolation_action = "待人工复核"
        isolation_status = IsolationStatus.NEEDS_REVIEW
        needs_review = True
    elif policy_result:
        isolation_action = "不隔离"
        isolation_status = IsolationStatus.NOT_ISOLATED
        needs_review = False
    else:
        isolation_action = "待人工复核"
        isolation_status = IsolationStatus.NEEDS_REVIEW
        needs_review = True
    
    evidence_report = generate_evidence_report(evidence, policy_result, firmware_match, proof_valid)
    
    db_evidence = DeviceEvidenceDB(
        report_id=report_id,
        device_id=evidence.device_id,
        proof_material=evidence.proof_material,
        firmware_version=evidence.firmware_version,
        expected_firmware=evidence.expected_firmware,
        policy_result=policy_result,
        isolation_action=isolation_action,
        isolation_status=isolation_status,
        evidence_report=evidence_report,
        processing_status=ProcessingStatus.PROCESSED,
        processed_at=datetime.utcnow(),
        needs_review=needs_review
    )
    
    db.add(db_evidence)
    db.commit()
    db.refresh(db_evidence)
    
    if needs_review:
        raise HTTPException(
            status_code=400,
            detail={
                "error_code": ErrorCode.NEEDS_MANUAL_REVIEW,
                "message": "需要人工复核",
                "details": {
                    "report_id": report_id,
                    "reason": firmware_msg if not firmware_match else "策略判断异常",
                    "isolation_action": isolation_action
                }
            }
        )
    
    return db_evidence


@app.get("/api/evidence/list", response_model=List[DeviceEvidenceResponse])
async def list_evidence(
    device_id: Optional[str] = Query(None, description="按设备编号筛选"),
    isolation_status: Optional[IsolationStatus] = Query(None, description="按隔离状态筛选"),
    needs_review: Optional[bool] = Query(None, description="按是否需要复核筛选"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0)
):
    db = next(get_db())
    query = db.query(DeviceEvidenceDB)
    
    if device_id:
        query = query.filter(DeviceEvidenceDB.device_id == device_id)
    if isolation_status:
        query = query.filter(DeviceEvidenceDB.isolation_status == isolation_status)
    if needs_review is not None:
        query = query.filter(DeviceEvidenceDB.needs_review == needs_review)
    
    results = query.order_by(DeviceEvidenceDB.created_at.desc()).offset(offset).limit(limit).all()
    return results


@app.get("/api/evidence/{report_id}", response_model=DeviceEvidenceResponse)
async def get_evidence(report_id: str):
    db = next(get_db())
    evidence = db.query(DeviceEvidenceDB).filter(DeviceEvidenceDB.report_id == report_id).first()
    if not evidence:
        raise HTTPException(status_code=404, detail="证据报告不存在")
    return evidence


@app.get("/api/evidence/export/{report_id}")
async def export_evidence(report_id: str):
    db = next(get_db())
    evidence = db.query(DeviceEvidenceDB).filter(DeviceEvidenceDB.report_id == report_id).first()
    if not evidence:
        raise HTTPException(status_code=404, detail="证据报告不存在")
    
    export_data = {
        "report_id": evidence.report_id,
        "device_id": evidence.device_id,
        "proof_material": evidence.proof_material,
        "firmware": {
            "current": evidence.firmware_version,
            "expected": evidence.expected_firmware
        },
        "policy_result": evidence.policy_result,
        "isolation": {
            "action": evidence.isolation_action,
            "status": evidence.isolation_status
        },
        "evidence_report": json.loads(evidence.evidence_report) if evidence.evidence_report else None,
        "processing": {
            "status": evidence.processing_status,
            "created_at": evidence.created_at.isoformat(),
            "processed_at": evidence.processed_at.isoformat() if evidence.processed_at else None
        },
        "needs_review": evidence.needs_review,
        "review_notes": evidence.review_notes
    }
    
    return export_data


@app.post("/api/evidence/{report_id}/review")
async def manual_review(report_id: str, approve: bool, review_notes: str = ""):
    db = next(get_db())
    evidence = db.query(DeviceEvidenceDB).filter(DeviceEvidenceDB.report_id == report_id).first()
    if not evidence:
        raise HTTPException(status_code=404, detail="证据报告不存在")
    
    if not evidence.needs_review:
        raise HTTPException(
            status_code=400,
            detail={
                "error_code": ErrorCode.INVALID_STATUS,
                "message": "该证据不需要人工复核",
                "details": {"current_status": evidence.isolation_status}
            }
        )
    
    if approve:
        evidence.isolation_status = IsolationStatus.ISOLATED
        evidence.isolation_action = "人工审核通过 - 已隔离"
    else:
        evidence.isolation_status = IsolationStatus.NOT_ISOLATED
        evidence.isolation_action = "人工审核驳回 - 不隔离"
    
    evidence.needs_review = False
    evidence.review_notes = review_notes
    evidence.processed_at = datetime.utcnow()
    
    db.commit()
    db.refresh(evidence)
    
    return {"message": "人工复核完成", "report_id": report_id, "isolation_status": evidence.isolation_status}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
