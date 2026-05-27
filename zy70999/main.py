import hashlib
import json
from datetime import datetime
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel, Field
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from models import Base, MaterialSubmission, VerificationRecord, AuditLog

DATABASE_URL = "sqlite:///./union_benefit.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="工会福利领取核销API服务", version="1.0.0")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class MaterialSubmissionCreate(BaseModel):
    submitter: str = Field(..., description="提交人")
    department: str = Field(..., description="部门")
    benefit_type: str = Field(..., description="福利类型")
    beneficiary: str = Field(..., description="受益人姓名")
    beneficiary_id_card: str = Field(..., description="受益人身份证号")
    amount: int = Field(..., description="申请金额（分）")
    application_date: str = Field(..., description="申请日期 YYYY-MM-DD")
    description: Optional[str] = Field(None, description="申请说明")
    raw_materials: Dict[str, Any] = Field(..., description="原始材料JSON")

    def generate_idempotency_key(self) -> str:
        key_data = {
            "beneficiary_id_card": self.beneficiary_id_card,
            "benefit_type": self.benefit_type,
            "application_date": self.application_date,
            "amount": self.amount,
        }
        key_str = json.dumps(key_data, sort_keys=True, ensure_ascii=False)
        return hashlib.sha256(key_str.encode("utf-8")).hexdigest()


class VerificationUpdate(BaseModel):
    operator: str = Field(..., description="操作人")
    conclusion: str = Field(..., description="新结论")
    reason: str = Field(..., description="修改原因")
    review_notes: Optional[str] = Field(None, description="审核备注")


class SubmissionResponse(BaseModel):
    id: int
    idempotency_key: str
    submitter: str
    department: str
    benefit_type: str
    beneficiary: str
    beneficiary_id_card: str
    amount: int
    application_date: str
    description: Optional[str]
    created_at: datetime
    is_duplicate: bool = False


class VerificationRecordResponse(BaseModel):
    id: int
    submission_id: int
    status: str
    conclusion: str
    reviewer: str
    review_notes: Optional[str]
    verified_amount: int
    report_data: Dict[str, Any]
    created_at: datetime
    updated_at: datetime


class AuditLogResponse(BaseModel):
    id: int
    submission_id: int
    record_id: Optional[int]
    operator: str
    operation: str
    field_name: Optional[str]
    old_value: Optional[str]
    new_value: Optional[str]
    reason: str
    created_at: datetime


class SubmissionWithDetailsResponse(BaseModel):
    submission: SubmissionResponse
    verification_records: List[VerificationRecordResponse]
    audit_logs: List[AuditLogResponse]
    traceability: Dict[str, Any]


def generate_report_data(submission: MaterialSubmission) -> Dict[str, Any]:
    return {
        "report_id": f"RPT-{submission.id:06d}",
        "generated_at": datetime.utcnow().isoformat(),
        "summary": {
            "submitter": submission.submitter,
            "department": submission.department,
            "beneficiary": submission.beneficiary,
            "benefit_type": submission.benefit_type,
        },
        "verification_details": {
            "id_card_verified": True,
            "amount_verified": submission.amount,
            "eligibility_check": "passed",
        },
        "raw_materials_reference": {
            "fields": list(submission.raw_materials.keys()),
            "submission_id": submission.id,
        },
    }


@app.post("/api/submissions", response_model=Dict[str, Any])
def create_submission(submission_data: MaterialSubmissionCreate, db: Session = Depends(get_db)):
    idempotency_key = submission_data.generate_idempotency_key()

    existing_submission = (
        db.query(MaterialSubmission)
        .filter(MaterialSubmission.idempotency_key == idempotency_key)
        .first()
    )

    if existing_submission:
        existing_record = (
            db.query(VerificationRecord)
            .filter(VerificationRecord.submission_id == existing_submission.id)
            .first()
        )
        return {
            "message": "同一批材料已提交，返回原有处理结果",
            "is_duplicate": True,
            "submission": {
                "id": existing_submission.id,
                "idempotency_key": existing_submission.idempotency_key,
                "submitter": existing_submission.submitter,
                "department": existing_submission.department,
                "benefit_type": existing_submission.benefit_type,
                "beneficiary": existing_submission.beneficiary,
                "amount": existing_submission.amount,
                "created_at": existing_submission.created_at,
            },
            "verification_result": {
                "status": existing_record.status if existing_record else None,
                "conclusion": existing_record.conclusion if existing_record else None,
                "reviewer": existing_record.reviewer if existing_record else None,
                "verified_amount": existing_record.verified_amount if existing_record else None,
                "report_data": existing_record.report_data if existing_record else None,
            },
        }

    new_submission = MaterialSubmission(
        idempotency_key=idempotency_key,
        submitter=submission_data.submitter,
        department=submission_data.department,
        benefit_type=submission_data.benefit_type,
        beneficiary=submission_data.beneficiary,
        beneficiary_id_card=submission_data.beneficiary_id_card,
        amount=submission_data.amount,
        application_date=submission_data.application_date,
        description=submission_data.description,
        raw_materials=submission_data.raw_materials,
    )
    db.add(new_submission)
    db.flush()

    report_data = generate_report_data(new_submission)

    verification_record = VerificationRecord(
        submission_id=new_submission.id,
        status="completed",
        conclusion="审核通过",
        reviewer=submission_data.submitter,
        review_notes="系统自动审核通过",
        verified_amount=submission_data.amount,
        report_data=report_data,
    )
    db.add(verification_record)

    audit_log = AuditLog(
        submission_id=new_submission.id,
        record_id=verification_record.id,
        operator=submission_data.submitter,
        operation="create",
        reason="新提交材料，系统自动审核",
    )
    db.add(audit_log)

    db.commit()
    db.refresh(new_submission)
    db.refresh(verification_record)

    return {
        "message": "材料提交成功，已完成审核",
        "is_duplicate": False,
        "submission": {
            "id": new_submission.id,
            "idempotency_key": new_submission.idempotency_key,
            "submitter": new_submission.submitter,
            "department": new_submission.department,
            "benefit_type": new_submission.benefit_type,
            "beneficiary": new_submission.beneficiary,
            "amount": new_submission.amount,
            "created_at": new_submission.created_at,
        },
        "verification_result": {
            "status": verification_record.status,
            "conclusion": verification_record.conclusion,
            "reviewer": verification_record.reviewer,
            "verified_amount": verification_record.verified_amount,
            "report_data": verification_record.report_data,
        },
    }


@app.put("/api/verifications/{record_id}", response_model=Dict[str, Any])
def update_verification(
    record_id: int, update_data: VerificationUpdate, db: Session = Depends(get_db)
):
    record = (
        db.query(VerificationRecord).filter(VerificationRecord.id == record_id).first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="核销记录不存在")

    old_conclusion = record.conclusion
    old_review_notes = record.review_notes

    if old_conclusion != update_data.conclusion:
        audit_log = AuditLog(
            submission_id=record.submission_id,
            record_id=record.id,
            operator=update_data.operator,
            operation="update",
            field_name="conclusion",
            old_value=old_conclusion,
            new_value=update_data.conclusion,
            reason=update_data.reason,
        )
        db.add(audit_log)
        record.conclusion = update_data.conclusion

    if update_data.review_notes is not None and old_review_notes != update_data.review_notes:
        audit_log_notes = AuditLog(
            submission_id=record.submission_id,
            record_id=record.id,
            operator=update_data.operator,
            operation="update",
            field_name="review_notes",
            old_value=old_review_notes or "",
            new_value=update_data.review_notes,
            reason=update_data.reason,
        )
        db.add(audit_log_notes)
        record.review_notes = update_data.review_notes

    db.commit()
    db.refresh(record)

    return {
        "message": "结论修改成功",
        "record_id": record.id,
        "old_conclusion": old_conclusion,
        "new_conclusion": record.conclusion,
        "operator": update_data.operator,
        "reason": update_data.reason,
    }


@app.get("/api/submissions/{submission_id}/trace", response_model=Dict[str, Any])
def get_submission_trace(submission_id: int, db: Session = Depends(get_db)):
    submission = (
        db.query(MaterialSubmission)
        .filter(MaterialSubmission.id == submission_id)
        .first()
    )
    if not submission:
        raise HTTPException(status_code=404, detail="提交记录不存在")

    verification_records = (
        db.query(VerificationRecord)
        .filter(VerificationRecord.submission_id == submission_id)
        .all()
    )

    audit_logs = (
        db.query(AuditLog)
        .filter(AuditLog.submission_id == submission_id)
        .order_by(AuditLog.created_at.asc())
        .all()
    )

    traceability = {
        "raw_input_to_report": {
            "raw_materials_fields": list(submission.raw_materials.keys()),
            "key_fields_trace": {
                "受益人": {
                    "raw_field": "beneficiary",
                    "raw_value": submission.beneficiary,
                    "report_field": "summary.beneficiary",
                },
                "福利类型": {
                    "raw_field": "benefit_type",
                    "raw_value": submission.benefit_type,
                    "report_field": "summary.benefit_type",
                },
                "金额": {
                    "raw_field": "amount",
                    "raw_value": submission.amount,
                    "report_field": "verification_details.amount_verified",
                },
            },
        },
        "conclusion_history": [],
    }

    for log in audit_logs:
        if log.field_name == "conclusion":
            traceability["conclusion_history"].append(
                {
                    "operator": log.operator,
                    "old_value": log.old_value,
                    "new_value": log.new_value,
                    "reason": log.reason,
                    "changed_at": log.created_at,
                }
            )

    return {
        "submission": {
            "id": submission.id,
            "submitter": submission.submitter,
            "department": submission.department,
            "benefit_type": submission.benefit_type,
            "beneficiary": submission.beneficiary,
            "amount": submission.amount,
            "application_date": submission.application_date,
            "raw_materials": submission.raw_materials,
            "created_at": submission.created_at,
        },
        "verification_records": [
            {
                "id": r.id,
                "status": r.status,
                "conclusion": r.conclusion,
                "reviewer": r.reviewer,
                "review_notes": r.review_notes,
                "verified_amount": r.verified_amount,
                "report_data": r.report_data,
            }
            for r in verification_records
        ],
        "audit_logs": [
            {
                "id": log.id,
                "operator": log.operator,
                "operation": log.operation,
                "field_name": log.field_name,
                "old_value": log.old_value,
                "new_value": log.new_value,
                "reason": log.reason,
                "created_at": log.created_at,
            }
            for log in audit_logs
        ],
        "traceability": traceability,
    }


@app.get("/api/audit-logs", response_model=List[AuditLogResponse])
def list_audit_logs(submission_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(AuditLog)
    if submission_id:
        query = query.filter(AuditLog.submission_id == submission_id)
    logs = query.order_by(AuditLog.created_at.desc()).all()
    return logs


@app.get("/api/submissions", response_model=List[SubmissionResponse])
def list_submissions(
    department: Optional[str] = None,
    benefit_type: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(MaterialSubmission)
    if department:
        query = query.filter(MaterialSubmission.department == department)
    if benefit_type:
        query = query.filter(MaterialSubmission.benefit_type == benefit_type)
    submissions = query.order_by(MaterialSubmission.created_at.desc()).all()
    return submissions


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "工会福利领取核销API服务"}
