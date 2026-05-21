from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, BackgroundTasks, Query
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import os
import shutil
import asyncio

from database import SessionLocal, engine, Base
from models import ContractStatus, RiskLevel
from schemas import (
    ContractCreate, ContractUpdate, ContractResponse, ContractListResponse,
    PaginatedResponse, ClauseResponse, ClauseUpdate, ClauseTypeCreate,
    ClauseTypeResponse, ExtractRequest, StatusUpdateRequest, RiskAnnotationRequest,
    RevisionRequest, ExportRequest, BulkUploadResponse, ErrorResponse,
    VersionCompareResponse
)
from crud import (
    get_contract, get_contracts, count_contracts, create_contract, update_contract,
    delete_contract, get_clause, get_clauses_by_contract, update_clause,
    get_clause_types, create_clause_type, annotate_risk, generate_request_hash,
    request_deduplicator
)
from services import (
    ExtractionService, ExportService, DataCleanupService,
    CompensationService, VersionCompareService
)
from config import settings

Base.metadata.create_all(bind=engine)

app = FastAPI(title="合同条款抽取API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.detail,
            "error_code": str(exc.status_code),
            "timestamp": datetime.now().isoformat()
        }
    )


@app.get("/")
def root():
    return {"message": "合同条款抽取API服务", "version": "1.0.0"}


@app.post("/api/contracts", response_model=ContractResponse, status_code=201)
def create_contract_endpoint(contract: ContractCreate, db: Session = Depends(get_db)):
    errors = DataCleanupService.validate_contract_data(contract.model_dump())
    if errors:
        raise HTTPException(status_code=400, detail="; ".join(errors))
    
    request_hash = generate_request_hash(contract.model_dump())
    if request_deduplicator.is_duplicate(request_hash):
        raise HTTPException(status_code=409, detail="重复请求，请稍后再试")
    
    if contract.party_a:
        contract.party_a = DataCleanupService.sanitize_text(contract.party_a)
    if contract.party_b:
        contract.party_b = DataCleanupService.sanitize_text(contract.party_b)
    
    return create_contract(db, contract)


@app.get("/api/contracts", response_model=PaginatedResponse)
def list_contracts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[ContractStatus] = None,
    risk_level: Optional[RiskLevel] = None,
    overall_risk: Optional[RiskLevel] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    final_risk = risk_level or overall_risk
    skip = (page - 1) * page_size
    contracts = get_contracts(db, skip=skip, limit=page_size, status=status, 
                              risk_level=final_risk, search=search)
    total = count_contracts(db, status=status, risk_level=final_risk, search=search)
    
    items = []
    for contract in contracts:
        clause_count = len(contract.clauses) if contract.clauses else 0
        items.append(ContractListResponse(
            id=contract.id,
            filename=contract.filename,
            contract_name=contract.contract_name,
            party_a=contract.party_a,
            party_b=contract.party_b,
            status=contract.status,
            overall_risk=contract.overall_risk,
            clause_count=clause_count,
            created_at=contract.created_at,
            updated_at=contract.updated_at
        ))
    
    return PaginatedResponse(items=items, total=total, page=page, page_size=page_size)


@app.get("/api/contracts/{contract_id}", response_model=ContractResponse)
def get_contract_endpoint(contract_id: int, db: Session = Depends(get_db)):
    contract = get_contract(db, contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="合同不存在")
    return contract


@app.put("/api/contracts/{contract_id}", response_model=ContractResponse)
def update_contract_endpoint(contract_id: int, contract_update: ContractUpdate, 
                             db: Session = Depends(get_db)):
    contract = update_contract(db, contract_id, contract_update)
    if not contract:
        raise HTTPException(status_code=404, detail="合同不存在")
    return contract


@app.delete("/api/contracts/{contract_id}", status_code=204)
def delete_contract_endpoint(contract_id: int, db: Session = Depends(get_db)):
    success = delete_contract(db, contract_id)
    if not success:
        raise HTTPException(status_code=404, detail="合同不存在")
    return None


@app.post("/api/contracts/upload", response_model=BulkUploadResponse)
async def upload_contracts(
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db)
):
    success_count = 0
    failed_count = 0
    failed_files = []
    contract_ids = []
    
    settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    
    for file in files:
        try:
            if not file.filename:
                failed_count += 1
                failed_files.append("unknown_file")
                continue
            
            file_path = settings.UPLOAD_DIR / file.filename
            
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            file_size = file_path.stat().st_size
            
            contract_data = ContractCreate(
                filename=file.filename,
                file_path=str(file_path),
                file_size=file_size
            )
            
            errors = DataCleanupService.validate_contract_data(contract_data.model_dump())
            if errors:
                failed_count += 1
                failed_files.append(f"{file.filename}: {'; '.join(errors)}")
                os.remove(file_path)
                continue
            
            contract = create_contract(db, contract_data)
            contract_ids.append(contract.id)
            success_count += 1
            
        except Exception as e:
            failed_count += 1
            failed_files.append(f"{file.filename}: {str(e)}")
    
    return BulkUploadResponse(
        success_count=success_count,
        failed_count=failed_count,
        failed_files=failed_files,
        contract_ids=contract_ids
    )


@app.post("/api/contracts/extract")
async def extract_clauses(
    request: ExtractRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    request_hash = generate_request_hash(request.model_dump())
    if request_deduplicator.is_duplicate(request_hash, ttl_seconds=60):
        raise HTTPException(status_code=409, detail="抽取任务已在进行中，请稍后再试")
    
    for contract_id in request.contract_ids:
        contract = get_contract(db, contract_id)
        if not contract:
            continue
        
        if contract.status == ContractStatus.EXTRACTING:
            continue
        
        background_tasks.add_task(ExtractionService.extract_clauses_async, contract_id, db)
    
    return {
        "message": "抽取任务已启动",
        "contract_ids": request.contract_ids
    }


@app.post("/api/contracts/{contract_id}/status")
def update_status(
    contract_id: int,
    request: StatusUpdateRequest,
    db: Session = Depends(get_db)
):
    from crud import update_contract_status
    
    contract = update_contract_status(db, contract_id, request.status, request.note)
    if not contract:
        raise HTTPException(status_code=404, detail="合同不存在")
    
    return {"message": "状态已更新", "status": contract.status.value}


@app.post("/api/contracts/{contract_id}/retry")
def retry_extraction_endpoint(
    contract_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    result = CompensationService.handle_failed_extraction(db, contract_id)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    
    background_tasks.add_task(ExtractionService.extract_clauses_async, contract_id, db)
    
    return result


@app.post("/api/contracts/bulk-retry")
def bulk_retry_extraction(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    result = CompensationService.bulk_retry_failed_extractions(db)
    
    for contract_id in result.get("retried_ids", []):
        background_tasks.add_task(ExtractionService.extract_clauses_async, contract_id, db)
    
    return result


@app.get("/api/contracts/{contract_id}/clauses", response_model=List[ClauseResponse])
def list_clauses(contract_id: int, db: Session = Depends(get_db)):
    contract = get_contract(db, contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="合同不存在")
    return get_clauses_by_contract(db, contract_id)


@app.put("/api/clauses/{clause_id}", response_model=ClauseResponse)
def update_clause_endpoint(
    clause_id: int,
    clause_update: ClauseUpdate,
    db: Session = Depends(get_db)
):
    if clause_update.revised_text:
        clause_update.revised_text = DataCleanupService.sanitize_text(
            clause_update.revised_text
        )
    
    clause = update_clause(db, clause_id, clause_update)
    if not clause:
        raise HTTPException(status_code=404, detail="条款不存在")
    return clause


@app.post("/api/clauses/{clause_id}/risk")
def annotate_risk_endpoint(
    clause_id: int,
    request: RiskAnnotationRequest,
    db: Session = Depends(get_db)
):
    clause = annotate_risk(db, clause_id, request.risk_level, request.risk_reason)
    if not clause:
        raise HTTPException(status_code=404, detail="条款不存在")
    
    return {"message": "风险标注已更新", "risk_level": clause.risk_level.value}


@app.post("/api/clauses/{clause_id}/revise")
def revise_clause_endpoint(
    clause_id: int,
    request: RevisionRequest,
    db: Session = Depends(get_db)
):
    from schemas import ClauseUpdate
    
    revised_text = DataCleanupService.sanitize_text(request.revised_text)
    if not revised_text:
        raise HTTPException(status_code=400, detail="修订内容不能为空")
    
    clause_update = ClauseUpdate(
        revised_text=revised_text,
        revision_note=request.revision_note
    )
    
    clause = update_clause(db, clause_id, clause_update)
    if not clause:
        raise HTTPException(status_code=404, detail="条款不存在")
    
    return {"message": "修订已保存", "clause_id": clause_id}


@app.get("/api/clause-types", response_model=List[ClauseTypeResponse])
def list_clause_types(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return get_clause_types(db, skip=skip, limit=limit)


@app.post("/api/clause-types", response_model=ClauseTypeResponse, status_code=201)
def create_clause_type_endpoint(clause_type: ClauseTypeCreate, db: Session = Depends(get_db)):
    return create_clause_type(db, clause_type)


@app.post("/api/export")
def export_contracts_endpoint(request: ExportRequest, db: Session = Depends(get_db)):
    try:
        file_path = ExportService.export_contracts(
            db,
            contract_ids=request.contract_ids,
            export_format=request.format,
            include_clauses=request.include_clauses,
            include_revisions=request.include_revisions
        )
        
        filename = os.path.basename(file_path)
        
        return FileResponse(
            path=file_path,
            filename=filename,
            media_type="application/octet-stream"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导出失败: {str(e)}")


@app.get("/api/stats")
def get_statistics(db: Session = Depends(get_db)):
    from sqlalchemy import func
    from models import Contract
    
    status_stats = db.query(
        Contract.status,
        func.count(Contract.id)
    ).group_by(Contract.status).all()
    
    risk_stats = db.query(
        Contract.overall_risk,
        func.count(Contract.id)
    ).group_by(Contract.overall_risk).all()
    
    total_contracts = db.query(func.count(Contract.id)).scalar()
    
    return {
        "total_contracts": total_contracts,
        "status_distribution": {s[0].value: s[1] for s in status_stats},
        "risk_distribution": {r[0].value: r[1] for r in risk_stats}
    }


@app.get("/api/contracts/{contract_id}/versions")
def get_contract_versions(contract_id: int, db: Session = Depends(get_db)):
    from models import ContractVersion
    
    contract = get_contract(db, contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="合同不存在")
    
    versions = db.query(ContractVersion).filter(
        ContractVersion.contract_id == contract_id
    ).order_by(ContractVersion.version_number.desc()).all()
    
    return versions


@app.get("/api/contracts/{contract_id}/compare", response_model=VersionCompareResponse)
def compare_contract_versions(
    contract_id: int,
    version_a: int = Query(..., description="旧版本号"),
    version_b: int = Query(..., description="新版本号"),
    db: Session = Depends(get_db)
):
    try:
        result = VersionCompareService.compare_versions_by_number(
            db, contract_id, version_a, version_b
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.on_event("startup")
def startup_event():
    db = SessionLocal()
    try:
        existing_types = get_clause_types(db)
        if not existing_types:
            default_types = [
                ClauseTypeCreate(name="合同主体", description="合同双方基本信息"),
                ClauseTypeCreate(name="付款条款", description="付款方式、期限、金额等"),
                ClauseTypeCreate(name="违约责任", description="违约情形及责任承担"),
                ClauseTypeCreate(name="保密条款", description="保密义务及期限"),
                ClauseTypeCreate(name="争议解决", description="争议处理方式"),
                ClauseTypeCreate(name="生效条款", description="合同生效条件"),
                ClauseTypeCreate(name="终止条款", description="合同终止情形"),
            ]
            for ct in default_types:
                create_clause_type(db, ct)
    finally:
        db.close()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
