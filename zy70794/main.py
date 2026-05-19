from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, Column, String, Integer, DateTime, Boolean, Text, func
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
from typing import Optional, List, Dict, Any
import json
import enum

SQLALCHEMY_DATABASE_URL = "sqlite:///./image_promotion.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class EnvironmentStage(str, enum.Enum):
    DEV = "dev"
    TEST = "test"
    STAGING = "staging"
    PROD = "prod"

class ScanStatus(str, enum.Enum):
    NOT_SCANNED = "not_scanned"
    SCANNING = "scanning"
    PASSED = "passed"
    FAILED = "failed"

class SignatureStatus(str, enum.Enum):
    UNSIGNED = "unsigned"
    SIGNED = "signed"
    VERIFIED = "verified"
    INVALID = "invalid"

class PromotionStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    MANUAL_REVIEW_REQUIRED = "manual_review_required"
    ALREADY_PROCESSED = "already_processed"

class ImageRecord(Base):
    __tablename__ = "image_records"
    id = Column(Integer, primary_key=True, index=True)
    image_tag = Column(String, index=True, nullable=False)
    environment = Column(String, index=True, nullable=False)
    scan_status = Column(String, default=ScanStatus.NOT_SCANNED)
    scan_result = Column(Text)
    scan_time = Column(DateTime)
    signature_status = Column(String, default=SignatureStatus.UNSIGNED)
    signature_key = Column(String)
    signature_time = Column(DateTime)
    deployed = Column(Boolean, default=False)
    deploy_time = Column(DateTime)
    deploy_env = Column(String)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

class PromotionReport(Base):
    __tablename__ = "promotion_reports"
    id = Column(Integer, primary_key=True, index=True)
    image_tag = Column(String, index=True)
    from_stage = Column(String)
    to_stage = Column(String)
    status = Column(String)
    rules_check = Column(Text)
    missing_items = Column(Text)
    reviewer = Column(String)
    review_time = Column(DateTime)
    created_at = Column(DateTime, default=func.now())

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

app = FastAPI(title="镜像晋级清单扫描门禁后端API")

class ImageImportRequest(BaseModel):
    image_tag: str = Field(..., description="镜像标签，如: registry.example.com/app:v1.0.0")
    environment: EnvironmentStage
    scan_status: Optional[ScanStatus] = ScanStatus.NOT_SCANNED
    scan_result: Optional[str] = None
    scan_time: Optional[datetime] = None
    signature_status: Optional[SignatureStatus] = SignatureStatus.UNSIGNED
    signature_key: Optional[str] = None
    signature_time: Optional[datetime] = None
    deployed: Optional[bool] = False
    deploy_time: Optional[datetime] = None
    deploy_env: Optional[str] = None

class PromotionRequest(BaseModel):
    image_tag: str
    from_stage: EnvironmentStage
    to_stage: EnvironmentStage
    reviewer: Optional[str] = None

class ErrorCode(str, enum.Enum):
    MISSING_FIELDS = "missing_fields"
    INVALID_STATE = "invalid_state"
    MANUAL_REVIEW_REQUIRED = "manual_review_required"
    ALREADY_PROCESSED = "already_processed"
    NOT_FOUND = "not_found"

class PromotionRuleChecker:
    @staticmethod
    def check_stage_transition(from_stage: str, to_stage: str) -> dict:
        valid_transitions = {
            "dev": ["test"],
            "test": ["staging"],
            "staging": ["prod"],
        }
        is_valid = to_stage in valid_transitions.get(from_stage, [])
        return {
            "rule": "stage_transition",
            "passed": is_valid,
            "message": f"阶段晋级 {from_stage} -> {to_stage}" if is_valid else f"不允许直接从 {from_stage} 晋级到 {to_stage}"
        }

    @staticmethod
    def check_signature(image_record: ImageRecord) -> dict:
        is_verified = image_record.signature_status == SignatureStatus.VERIFIED
        return {
            "rule": "signature_verification",
            "passed": is_verified,
            "message": "签名已验证" if is_verified else "镜像签名未验证或无效"
        }

    @staticmethod
    def check_scan(image_record: ImageRecord) -> dict:
        is_passed = image_record.scan_status == ScanStatus.PASSED
        return {
            "rule": "security_scan",
            "passed": is_passed,
            "message": "安全扫描通过" if is_passed else f"安全扫描状态: {image_record.scan_status}"
        }

    @staticmethod
    def check_deploy_history(image_record: ImageRecord, from_stage: str) -> dict:
        has_deployed = image_record.deployed and image_record.deploy_env == from_stage
        return {
            "rule": "deploy_history",
            "passed": has_deployed,
            "message": f"已在 {from_stage} 环境部署验证" if has_deployed else f"缺少在 {from_stage} 环境的部署记录"
        }

    @classmethod
    def check_all(cls, image_record: ImageRecord, from_stage: str, to_stage: str) -> tuple:
        rules = [
            cls.check_stage_transition(from_stage, to_stage),
            cls.check_signature(image_record),
            cls.check_scan(image_record),
            cls.check_deploy_history(image_record, from_stage),
        ]
        all_passed = all(r["passed"] for r in rules)
        missing_items = [r["message"] for r in rules if not r["passed"]]
        return rules, all_passed, missing_items

@app.post("/api/v1/images/import", response_class=JSONResponse)
def import_image(request: ImageImportRequest):
    db = next(get_db())
    try:
        existing = db.query(ImageRecord).filter(
            ImageRecord.image_tag == request.image_tag,
            ImageRecord.environment == request.environment.value
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=409,
                detail={
                    "code": ErrorCode.ALREADY_PROCESSED,
                    "message": "该镜像在此环境已存在",
                    "image_tag": request.image_tag,
                    "environment": request.environment.value
                }
            )
        
        image = ImageRecord(**request.dict(exclude={"environment"}), environment=request.environment.value)
        db.add(image)
        db.commit()
        db.refresh(image)
        
        return {
            "success": True,
            "message": "镜像导入成功",
            "data": {
                "id": image.id,
                "image_tag": image.image_tag,
                "environment": image.environment
            }
        }
    finally:
        db.close()

@app.get("/api/v1/images", response_class=JSONResponse)
def list_images(
    image_tag: Optional[str] = None,
    environment: Optional[EnvironmentStage] = None,
    scan_status: Optional[ScanStatus] = None,
    signature_status: Optional[SignatureStatus] = None,
    deployed: Optional[bool] = None
):
    db = next(get_db())
    try:
        query = db.query(ImageRecord)
        if image_tag:
            query = query.filter(ImageRecord.image_tag.contains(image_tag))
        if environment:
            query = query.filter(ImageRecord.environment == environment.value)
        if scan_status:
            query = query.filter(ImageRecord.scan_status == scan_status.value)
        if signature_status:
            query = query.filter(ImageRecord.signature_status == signature_status.value)
        if deployed is not None:
            query = query.filter(ImageRecord.deployed == deployed)
        
        images = query.all()
        return {
            "success": True,
            "count": len(images),
            "data": [
                {
                    "id": img.id,
                    "image_tag": img.image_tag,
                    "environment": img.environment,
                    "scan_status": img.scan_status,
                    "signature_status": img.signature_status,
                    "deployed": img.deployed,
                    "created_at": img.created_at.isoformat() if img.created_at else None
                }
                for img in images
            ]
        }
    finally:
        db.close()

@app.get("/api/v1/images/{image_id}", response_class=JSONResponse)
def get_image(image_id: int):
    db = next(get_db())
    try:
        image = db.query(ImageRecord).filter(ImageRecord.id == image_id).first()
        if not image:
            raise HTTPException(
                status_code=404,
                detail={
                    "code": ErrorCode.NOT_FOUND,
                    "message": "镜像记录不存在"
                }
            )
        return {
            "success": True,
            "data": {
                "id": image.id,
                "image_tag": image.image_tag,
                "environment": image.environment,
                "scan_status": image.scan_status,
                "scan_result": image.scan_result,
                "scan_time": image.scan_time.isoformat() if image.scan_time else None,
                "signature_status": image.signature_status,
                "signature_key": image.signature_key,
                "signature_time": image.signature_time.isoformat() if image.signature_time else None,
                "deployed": image.deployed,
                "deploy_time": image.deploy_time.isoformat() if image.deploy_time else None,
                "deploy_env": image.deploy_env,
                "created_at": image.created_at.isoformat() if image.created_at else None
            }
        }
    finally:
        db.close()

@app.put("/api/v1/images/{image_id}/scan", response_class=JSONResponse)
def update_scan_result(
    image_id: int,
    scan_status: ScanStatus,
    scan_result: Optional[str] = None
):
    db = next(get_db())
    try:
        image = db.query(ImageRecord).filter(ImageRecord.id == image_id).first()
        if not image:
            raise HTTPException(status_code=404, detail={"code": ErrorCode.NOT_FOUND, "message": "镜像记录不存在"})
        
        image.scan_status = scan_status.value
        image.scan_result = scan_result
        image.scan_time = datetime.utcnow()
        db.commit()
        
        return {"success": True, "message": "扫描结果更新成功"}
    finally:
        db.close()

@app.put("/api/v1/images/{image_id}/signature", response_class=JSONResponse)
def update_signature(
    image_id: int,
    signature_status: SignatureStatus,
    signature_key: Optional[str] = None
):
    db = next(get_db())
    try:
        image = db.query(ImageRecord).filter(ImageRecord.id == image_id).first()
        if not image:
            raise HTTPException(status_code=404, detail={"code": ErrorCode.NOT_FOUND, "message": "镜像记录不存在"})
        
        image.signature_status = signature_status.value
        image.signature_key = signature_key
        image.signature_time = datetime.utcnow()
        db.commit()
        
        return {"success": True, "message": "签名状态更新成功"}
    finally:
        db.close()

@app.put("/api/v1/images/{image_id}/deploy", response_class=JSONResponse)
def mark_deployed(image_id: int, deploy_env: EnvironmentStage):
    db = next(get_db())
    try:
        image = db.query(ImageRecord).filter(ImageRecord.id == image_id).first()
        if not image:
            raise HTTPException(status_code=404, detail={"code": ErrorCode.NOT_FOUND, "message": "镜像记录不存在"})
        
        image.deployed = True
        image.deploy_env = deploy_env.value
        image.deploy_time = datetime.utcnow()
        db.commit()
        
        return {"success": True, "message": "部署记录更新成功"}
    finally:
        db.close()

@app.post("/api/v1/promotion/check", response_class=JSONResponse)
def check_promotion(request: PromotionRequest):
    db = next(get_db())
    try:
        image = db.query(ImageRecord).filter(
            ImageRecord.image_tag == request.image_tag,
            ImageRecord.environment == request.from_stage.value
        ).first()
        
        if not image:
            raise HTTPException(
                status_code=404,
                detail={
                    "code": ErrorCode.NOT_FOUND,
                    "message": f"在 {request.from_stage.value} 环境未找到该镜像"
                }
            )
        
        existing_report = db.query(PromotionReport).filter(
            PromotionReport.image_tag == request.image_tag,
            PromotionReport.to_stage == request.to_stage.value,
            PromotionReport.status.in_([PromotionStatus.APPROVED, PromotionStatus.REJECTED])
        ).first()
        
        if existing_report:
            raise HTTPException(
                status_code=409,
                detail={
                    "code": ErrorCode.ALREADY_PROCESSED,
                    "message": "该晋级请求已处理",
                    "existing_status": existing_report.status
                }
            )
        
        rules, all_passed, missing_items = PromotionRuleChecker.check_all(
            image, request.from_stage.value, request.to_stage.value
        )
        
        status = PromotionStatus.APPROVED if all_passed else PromotionStatus.MANUAL_REVIEW_REQUIRED
        
        report = PromotionReport(
            image_tag=request.image_tag,
            from_stage=request.from_stage.value,
            to_stage=request.to_stage.value,
            status=status.value,
            rules_check=json.dumps(rules, ensure_ascii=False),
            missing_items=json.dumps(missing_items, ensure_ascii=False),
            reviewer=request.reviewer,
            review_time=datetime.utcnow()
        )
        db.add(report)
        db.commit()
        db.refresh(report)
        
        if all_passed:
            return {
                "success": True,
                "status": PromotionStatus.APPROVED,
                "message": "晋级检查通过",
                "report_id": report.id,
                "rules_check": rules,
                "missing_items": []
            }
        else:
            raise HTTPException(
                status_code=422,
                detail={
                    "code": ErrorCode.MANUAL_REVIEW_REQUIRED,
                    "message": "部分检查项未通过，需要人工复核",
                    "status": PromotionStatus.MANUAL_REVIEW_REQUIRED,
                    "report_id": report.id,
                    "rules_check": rules,
                    "missing_items": missing_items
                }
            )
    finally:
        db.close()

@app.get("/api/v1/reports", response_class=JSONResponse)
def list_reports(
    image_tag: Optional[str] = None,
    status: Optional[PromotionStatus] = None,
    from_stage: Optional[EnvironmentStage] = None,
    to_stage: Optional[EnvironmentStage] = None
):
    db = next(get_db())
    try:
        query = db.query(PromotionReport)
        if image_tag:
            query = query.filter(PromotionReport.image_tag.contains(image_tag))
        if status:
            query = query.filter(PromotionReport.status == status.value)
        if from_stage:
            query = query.filter(PromotionReport.from_stage == from_stage.value)
        if to_stage:
            query = query.filter(PromotionReport.to_stage == to_stage.value)
        
        reports = query.order_by(PromotionReport.created_at.desc()).all()
        return {
            "success": True,
            "count": len(reports),
            "data": [
                {
                    "id": r.id,
                    "image_tag": r.image_tag,
                    "from_stage": r.from_stage,
                    "to_stage": r.to_stage,
                    "status": r.status,
                    "rules_check": json.loads(r.rules_check) if r.rules_check else [],
                    "missing_items": json.loads(r.missing_items) if r.missing_items else [],
                    "reviewer": r.reviewer,
                    "review_time": r.review_time.isoformat() if r.review_time else None,
                    "created_at": r.created_at.isoformat() if r.created_at else None
                }
                for r in reports
            ]
        }
    finally:
        db.close()

@app.get("/api/v1/reports/{report_id}/export", response_class=JSONResponse)
def export_report(report_id: int):
    db = next(get_db())
    try:
        report = db.query(PromotionReport).filter(PromotionReport.id == report_id).first()
        if not report:
            raise HTTPException(
                status_code=404,
                detail={"code": ErrorCode.NOT_FOUND, "message": "报告不存在"}
            )
        
        return {
            "success": True,
            "export_format": "json",
            "report": {
                "id": report.id,
                "image_tag": report.image_tag,
                "promotion_path": f"{report.from_stage} -> {report.to_stage}",
                "status": report.status,
                "review_summary": {
                    "rules_check": json.loads(report.rules_check) if report.rules_check else [],
                    "missing_items": json.loads(report.missing_items) if report.missing_items else []
                },
                "reviewer": report.reviewer,
                "review_time": report.review_time.isoformat() if report.review_time else None,
                "generated_at": datetime.utcnow().isoformat()
            }
        }
    finally:
        db.close()

@app.put("/api/v1/reports/{report_id}/review", response_class=JSONResponse)
def manual_review(report_id: int, status: PromotionStatus, reviewer: str):
    db = next(get_db())
    try:
        report = db.query(PromotionReport).filter(PromotionReport.id == report_id).first()
        if not report:
            raise HTTPException(status_code=404, detail={"code": ErrorCode.NOT_FOUND, "message": "报告不存在"})
        
        if report.status in [PromotionStatus.APPROVED, PromotionStatus.REJECTED]:
            raise HTTPException(
                status_code=409,
                detail={
                    "code": ErrorCode.ALREADY_PROCESSED,
                    "message": "该报告已完成复核",
                    "current_status": report.status
                }
            )
        
        report.status = status.value
        report.reviewer = reviewer
        report.review_time = datetime.utcnow()
        db.commit()
        
        return {
            "success": True,
            "message": "人工复核完成",
            "status": status.value
        }
    finally:
        db.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
