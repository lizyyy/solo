from fastapi import FastAPI, HTTPException, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, Column, String, Integer, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from datetime import datetime
from typing import List, Optional, Dict, Any
from enum import Enum
import json

app = FastAPI(title="包撤回依赖影响仲裁系统", version="1.0.0")

SQLALCHEMY_DATABASE_URL = "sqlite:///./package_arbitration.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class PackageStatus(str, Enum):
    PUBLISHED = "published"
    WITHDRAW_REQUESTED = "withdraw_requested"
    IMPACT_CALCULATING = "impact_calculating"
    PENDING_ARBITRATION = "pending_arbitration"
    WITHDRAW_APPROVED = "withdraw_approved"
    WITHDRAW_REJECTED = "withdraw_rejected"
    WITHDRAWN = "withdrawn"

class ArbitrationResult(str, Enum):
    APPROVED = "approved"
    REJECTED = "rejected"
    NEED_MORE_INFO = "need_more_info"

class ErrorCode(str, Enum):
    MISSING_FIELD = "missing_field"
    INVALID_STATUS = "invalid_status"
    NEED_MANUAL_REVIEW = "need_manual_review"
    ALREADY_PROCESSED = "already_processed"
    NOT_FOUND = "not_found"
    DUPLICATE_REQUEST = "duplicate_request"

class PackageVersion(Base):
    __tablename__ = "package_versions"
    id = Column(Integer, primary_key=True, index=True)
    package_name = Column(String, index=True, nullable=False)
    version = Column(String, index=True, nullable=False)
    publisher = Column(String, nullable=False)
    publish_time = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default=PackageStatus.PUBLISHED)
    dependencies = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    withdraw_requests = relationship("WithdrawRequest", back_populates="package")

class WithdrawRequest(Base):
    __tablename__ = "withdraw_requests"
    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(String, unique=True, index=True, nullable=False)
    package_id = Column(Integer, ForeignKey("package_versions.id"))
    requester = Column(String, nullable=False)
    reason = Column(Text)
    request_time = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default=PackageStatus.WITHDRAW_REQUESTED)
    package = relationship("PackageVersion", back_populates="withdraw_requests")
    impact_report = relationship("ImpactReport", back_populates="withdraw_request", uselist=False)
    arbitrations = relationship("ArbitrationRecord", back_populates="withdraw_request")

class DependentProject(Base):
    __tablename__ = "dependent_projects"
    id = Column(Integer, primary_key=True, index=True)
    project_name = Column(String, index=True, nullable=False)
    package_name = Column(String, index=True, nullable=False)
    version_constraint = Column(String)
    last_used_time = Column(DateTime)
    owner = Column(String)

class ImpactReport(Base):
    __tablename__ = "impact_reports"
    id = Column(Integer, primary_key=True, index=True)
    withdraw_request_id = Column(Integer, ForeignKey("withdraw_requests.id"))
    impacted_projects = Column(Text)
    total_impacted = Column(Integer, default=0)
    critical_impact = Column(Boolean, default=False)
    impact_details = Column(Text)
    calculated_at = Column(DateTime, default=datetime.utcnow)
    withdraw_request = relationship("WithdrawRequest", back_populates="impact_report")

class ArbitrationRecord(Base):
    __tablename__ = "arbitration_records"
    id = Column(Integer, primary_key=True, index=True)
    withdraw_request_id = Column(Integer, ForeignKey("withdraw_requests.id"))
    arbitrator = Column(String, nullable=False)
    result = Column(String, nullable=False)
    comment = Column(Text)
    arbitrated_at = Column(DateTime, default=datetime.utcnow)
    withdraw_request = relationship("WithdrawRequest", back_populates="arbitrations")

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class PackageVersionCreate(BaseModel):
    package_name: str
    version: str
    publisher: str
    dependencies: Optional[List[str]] = None

class WithdrawRequestCreate(BaseModel):
    package_name: str
    version: str
    requester: str
    reason: Optional[str] = None
    request_id: Optional[str] = None

class ArbitrationCreate(BaseModel):
    request_id: str
    arbitrator: str
    result: ArbitrationResult
    comment: Optional[str] = None

class ErrorResponse(BaseModel):
    error_code: ErrorCode
    message: str
    details: Optional[Dict[str, Any]] = None

def create_error_response(code: ErrorCode, message: str, details: Dict = None, status_code: int = 400):
    return JSONResponse(
        status_code=status_code,
        content={"error_code": code.value, "message": message, "details": details or {}}
    )

@app.post("/api/packages/", response_model=Dict[str, Any])
def create_package(pkg: PackageVersionCreate, db: Session = Depends(get_db)):
    if not pkg.package_name or not pkg.version or not pkg.publisher:
        return create_error_response(
            ErrorCode.MISSING_FIELD,
            "缺少必要字段",
            {"missing": ["package_name", "version", "publisher"]}
        )
    existing = db.query(PackageVersion).filter(
        PackageVersion.package_name == pkg.package_name,
        PackageVersion.version == pkg.version
    ).first()
    if existing:
        return {"id": existing.id, "package_name": existing.package_name, "version": existing.version, "status": existing.status}
    db_pkg = PackageVersion(
        package_name=pkg.package_name,
        version=pkg.version,
        publisher=pkg.publisher,
        dependencies=json.dumps(pkg.dependencies or [])
    )
    db.add(db_pkg)
    db.commit()
    db.refresh(db_pkg)
    return {"id": db_pkg.id, "package_name": db_pkg.package_name, "version": db_pkg.version, "status": db_pkg.status}

@app.post("/api/withdraw-requests/", response_model=Dict[str, Any])
def create_withdraw_request(request: WithdrawRequestCreate, db: Session = Depends(get_db)):
    if not request.package_name or not request.version or not request.requester:
        return create_error_response(
            ErrorCode.MISSING_FIELD,
            "缺少必要字段",
            {"missing": ["package_name", "version", "requester"]}
        )
    pkg = db.query(PackageVersion).filter(
        PackageVersion.package_name == request.package_name,
        PackageVersion.version == request.version
    ).first()
    if not pkg:
        return create_error_response(ErrorCode.NOT_FOUND, "包版本不存在", status_code=404)
    if pkg.status not in [PackageStatus.PUBLISHED, PackageStatus.WITHDRAW_REJECTED]:
        return create_error_response(
            ErrorCode.INVALID_STATUS,
            "当前状态不允许申请撤回",
            {"current_status": pkg.status}
        )
    request_id = request.request_id or f"WR-{pkg.package_name}-{pkg.version}-{int(datetime.utcnow().timestamp())}"
    existing_request = db.query(WithdrawRequest).filter(WithdrawRequest.request_id == request_id).first()
    if existing_request:
        return create_error_response(
            ErrorCode.DUPLICATE_REQUEST,
            "撤回申请已存在",
            {"request_id": request_id}
        )
    existing_pending = db.query(WithdrawRequest).join(PackageVersion).filter(
        PackageVersion.id == pkg.id,
        WithdrawRequest.status.in_([PackageStatus.WITHDRAW_REQUESTED, PackageStatus.PENDING_ARBITRATION])
    ).first()
    if existing_pending:
        return create_error_response(
            ErrorCode.ALREADY_PROCESSED,
            "该包已有正在处理中的撤回申请",
            {"existing_request_id": existing_pending.request_id}
        )
    db_request = WithdrawRequest(
        request_id=request_id,
        package_id=pkg.id,
        requester=request.requester,
        reason=request.reason
    )
    pkg.status = PackageStatus.WITHDRAW_REQUESTED
    db.add(db_request)
    db.commit()
    db.refresh(db_request)
    return {
        "request_id": db_request.request_id,
        "package_name": request.package_name,
        "version": request.version,
        "status": db_request.status,
        "next_step": "计算依赖影响"
    }

@app.post("/api/withdraw-requests/{request_id}/calculate-impact", response_model=Dict[str, Any])
def calculate_impact(request_id: str, db: Session = Depends(get_db)):
    db_request = db.query(WithdrawRequest).filter(WithdrawRequest.request_id == request_id).first()
    if not db_request:
        return create_error_response(ErrorCode.NOT_FOUND, "撤回申请不存在", status_code=404)
    if db_request.status != PackageStatus.WITHDRAW_REQUESTED:
        return create_error_response(
            ErrorCode.INVALID_STATUS,
            "当前状态不允许计算影响",
            {"current_status": db_request.status}
        )
    pkg = db_request.package
    db_request.status = PackageStatus.IMPACT_CALCULATING
    pkg.status = PackageStatus.IMPACT_CALCULATING
    db.commit()
    dependents = db.query(DependentProject).filter(
        DependentProject.package_name == pkg.package_name
    ).all()
    impacted_projects = []
    for dep in dependents:
        impacted_projects.append({
            "project_name": dep.project_name,
            "version_constraint": dep.version_constraint,
            "owner": dep.owner
        })
    total_impacted = len(impacted_projects)
    critical_impact = total_impacted > 5
    impact_report = ImpactReport(
        withdraw_request_id=db_request.id,
        impacted_projects=json.dumps(impacted_projects),
        total_impacted=total_impacted,
        critical_impact=critical_impact,
        impact_details=json.dumps({"calculation_method": "direct_dependency_match"})
    )
    db.add(impact_report)
    db_request.status = PackageStatus.PENDING_ARBITRATION
    pkg.status = PackageStatus.PENDING_ARBITRATION
    db.commit()
    return {
        "request_id": request_id,
        "total_impacted": total_impacted,
        "critical_impact": critical_impact,
        "impacted_projects": impacted_projects,
        "status": PackageStatus.PENDING_ARBITRATION,
        "needs_manual_review": critical_impact
    }

@app.post("/api/arbitrations/", response_model=Dict[str, Any])
def create_arbitration(arbitration: ArbitrationCreate, db: Session = Depends(get_db)):
    if not arbitration.request_id or not arbitration.arbitrator or not arbitration.result:
        return create_error_response(
            ErrorCode.MISSING_FIELD,
            "缺少必要字段",
            {"missing": ["request_id", "arbitrator", "result"]}
        )
    db_request = db.query(WithdrawRequest).filter(WithdrawRequest.request_id == arbitration.request_id).first()
    if not db_request:
        return create_error_response(ErrorCode.NOT_FOUND, "撤回申请不存在", status_code=404)
    if db_request.status != PackageStatus.PENDING_ARBITRATION:
        if db_request.status in [PackageStatus.WITHDRAW_APPROVED, PackageStatus.WITHDRAW_REJECTED, PackageStatus.WITHDRAWN]:
            return create_error_response(
                ErrorCode.ALREADY_PROCESSED,
                "该撤回申请已完成仲裁",
                {"current_status": db_request.status}
            )
        return create_error_response(
            ErrorCode.INVALID_STATUS,
            "当前状态不允许仲裁",
            {"current_status": db_request.status}
        )
    impact_report = db.query(ImpactReport).filter(ImpactReport.withdraw_request_id == db_request.id).first()
    if impact_report and impact_report.critical_impact and arbitration.result == ArbitrationResult.APPROVED:
        if not arbitration.comment or len(arbitration.comment) < 10:
            return create_error_response(
                ErrorCode.NEED_MANUAL_REVIEW,
                "关键影响的撤回批准需要详细的复核说明",
                {"required_comment_length": 10}
            )
    arbitration_record = ArbitrationRecord(
        withdraw_request_id=db_request.id,
        arbitrator=arbitration.arbitrator,
        result=arbitration.result.value,
        comment=arbitration.comment
    )
    db.add(arbitration_record)
    pkg = db_request.package
    if arbitration.result == ArbitrationResult.APPROVED:
        db_request.status = PackageStatus.WITHDRAW_APPROVED
        pkg.status = PackageStatus.WITHDRAWN
    elif arbitration.result == ArbitrationResult.REJECTED:
        db_request.status = PackageStatus.WITHDRAW_REJECTED
        pkg.status = PackageStatus.PUBLISHED
    elif arbitration.result == ArbitrationResult.NEED_MORE_INFO:
        return {
            "request_id": arbitration.request_id,
            "result": arbitration.result.value,
            "status": "pending_more_info",
            "comment": arbitration.comment
        }
    db.commit()
    return {
        "request_id": arbitration.request_id,
        "result": arbitration.result.value,
        "package_status": pkg.status,
        "arbitrated_at": arbitration_record.arbitrated_at.isoformat()
    }

@app.get("/api/withdraw-requests/", response_model=List[Dict[str, Any]])
def list_withdraw_requests(
    status: Optional[str] = None,
    package_name: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(WithdrawRequest)
    if status:
        query = query.filter(WithdrawRequest.status == status)
    if package_name:
        query = query.join(PackageVersion).filter(PackageVersion.package_name == package_name)
    requests = query.all()
    result = []
    for req in requests:
        result.append({
            "request_id": req.request_id,
            "package_name": req.package.package_name,
            "version": req.package.version,
            "requester": req.requester,
            "status": req.status,
            "request_time": req.request_time.isoformat()
        })
    return result

@app.get("/api/impact-reports/{request_id}", response_model=Dict[str, Any])
def get_impact_report(request_id: str, db: Session = Depends(get_db)):
    db_request = db.query(WithdrawRequest).filter(WithdrawRequest.request_id == request_id).first()
    if not db_request:
        return create_error_response(ErrorCode.NOT_FOUND, "撤回申请不存在", status_code=404)
    report = db.query(ImpactReport).filter(ImpactReport.withdraw_request_id == db_request.id).first()
    if not report:
        return create_error_response(ErrorCode.NOT_FOUND, "影响报告不存在", status_code=404)
    return {
        "request_id": request_id,
        "total_impacted": report.total_impacted,
        "critical_impact": report.critical_impact,
        "impacted_projects": json.loads(report.impacted_projects),
        "calculated_at": report.calculated_at.isoformat()
    }

@app.post("/api/dependent-projects/", response_model=Dict[str, Any])
def add_dependent_project(
    project_name: str,
    package_name: str,
    version_constraint: Optional[str] = None,
    owner: Optional[str] = None,
    db: Session = Depends(get_db)
):
    if not project_name or not package_name:
        return create_error_response(ErrorCode.MISSING_FIELD, "缺少必要字段")
    dep = DependentProject(
        project_name=project_name,
        package_name=package_name,
        version_constraint=version_constraint,
        owner=owner,
        last_used_time=datetime.utcnow()
    )
    db.add(dep)
    db.commit()
    db.refresh(dep)
    return {"id": dep.id, "project_name": dep.project_name, "package_name": dep.package_name}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)