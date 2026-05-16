from datetime import datetime
from typing import Optional
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from app.database import get_db, engine, Base
from app import crud, schemas
from app.models import VerdictStatus
from app.services import VerdictReportGenerator

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="OpenAPI变更裁决API",
    description="接口契约变更分析与裁决服务",
    version="1.0.0"
)


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error_code": "INTERNAL_SERVER_ERROR",
            "error_message": str(exc),
            "details": None,
            "timestamp": datetime.utcnow().isoformat()
        }
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error_code": f"HTTP_{exc.status_code}",
            "error_message": exc.detail,
            "details": None,
            "timestamp": datetime.utcnow().isoformat()
        }
    )


@app.post("/api/v1/changes/", response_model=schemas.ContractChangeResponse, status_code=status.HTTP_201_CREATED)
def create_change(change: schemas.ContractChangeCreate, db: Session = Depends(get_db)):
    db_change = crud.create_contract_change(db, change)
    return db_change


@app.get("/api/v1/changes/{change_id}", response_model=schemas.ContractChangeResponse)
def get_change(change_id: int, db: Session = Depends(get_db)):
    db_change = crud.get_contract_change(db, change_id)
    if db_change is None:
        raise HTTPException(status_code=404, detail="变更记录不存在")
    return db_change


@app.get("/api/v1/changes/", response_model=schemas.PaginatedResponse)
def list_changes(
    api_path: Optional[str] = None,
    http_method: Optional[str] = None,
    caller: Optional[str] = None,
    risk_level: Optional[str] = None,
    status_filter: Optional[str] = None,
    change_category: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db)
):
    skip = (page - 1) * page_size
    risk_level_enum = None
    status_enum = None
    category_enum = None
    
    from app.models import RiskLevel, ChangeCategory
    
    if risk_level:
        try:
            risk_level_enum = RiskLevel(risk_level)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"无效的风险等级: {risk_level}")
    
    if status_filter:
        try:
            status_enum = VerdictStatus(status_filter)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"无效的状态: {status_filter}")
    
    if change_category:
        try:
            category_enum = ChangeCategory(change_category)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"无效的变更分类: {change_category}")

    changes = crud.get_contract_changes(
        db, api_path, http_method, caller, risk_level_enum, status_enum, category_enum, skip, page_size
    )
    total = crud.count_contract_changes(
        db, api_path, http_method, caller, risk_level_enum, status_enum, category_enum
    )

    return schemas.PaginatedResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=changes
    )


@app.patch("/api/v1/changes/{change_id}/status", response_model=schemas.ContractChangeResponse)
def update_change_status(
    change_id: int,
    request: schemas.StatusUpdateRequest,
    db: Session = Depends(get_db)
):
    db_change = crud.update_status(db, change_id, request.new_status, request.reason, request.updated_by)
    if db_change is None:
        raise HTTPException(status_code=404, detail="变更记录不存在")
    return db_change


@app.patch("/api/v1/changes/{change_id}/correct", response_model=schemas.ContractChangeResponse)
def manual_correction(
    change_id: int,
    request: schemas.ManualCorrectionRequest,
    db: Session = Depends(get_db)
):
    db_change = crud.apply_manual_correction(db, change_id, request)
    if db_change is None:
        raise HTTPException(status_code=404, detail="变更记录不存在")
    return db_change


@app.post("/api/v1/changes/{change_id}/defer", response_model=schemas.ContractChangeResponse)
def defer_verdict(
    change_id: int,
    request: schemas.DeferralRequest,
    db: Session = Depends(get_db)
):
    db_change = crud.defer_verdict(db, change_id, request)
    if db_change is None:
        raise HTTPException(status_code=404, detail="变更记录不存在")
    return db_change


@app.post("/api/v1/changes/{change_id}/report", response_model=schemas.VerdictReportResponse)
def create_report(
    change_id: int,
    report_type: str = "full",
    db: Session = Depends(get_db)
):
    db_report = crud.generate_report(db, change_id, report_type)
    if db_report is None:
        raise HTTPException(status_code=404, detail="变更记录不存在")
    return db_report


@app.get("/api/v1/changes/{change_id}/reports")
def list_reports(
    change_id: int,
    db: Session = Depends(get_db)
):
    reports = crud.get_reports_by_change_id(db, change_id)
    return reports


@app.get("/api/v1/export/")
def export_changes(
    api_path: Optional[str] = None,
    http_method: Optional[str] = None,
    caller: Optional[str] = None,
    risk_level: Optional[str] = None,
    status_filter: Optional[str] = None,
    change_category: Optional[str] = None,
    db: Session = Depends(get_db)
):
    from app.models import RiskLevel, ChangeCategory
    
    risk_level_enum = None
    status_enum = None
    category_enum = None
    
    if risk_level:
        try:
            risk_level_enum = RiskLevel(risk_level)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"无效的风险等级: {risk_level}")
    
    if status_filter:
        try:
            status_enum = VerdictStatus(status_filter)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"无效的状态: {status_filter}")
    
    if change_category:
        try:
            category_enum = ChangeCategory(change_category)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"无效的变更分类: {change_category}")

    changes = crud.get_contract_changes(
        db, api_path, http_method, caller, risk_level_enum, status_enum, category_enum, 0, 1000
    )

    return VerdictReportGenerator.generate_export_data(changes)


@app.get("/health")
def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
