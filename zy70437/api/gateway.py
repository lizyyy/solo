from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import GatewayErrorExtract, Batch
from schemas import GatewayErrorExtractCreate, GatewayErrorExtract as GatewayErrorExtractSchema

router = APIRouter(prefix="/gateway-error-extracts", tags=["网关错误摘录"])

@router.post("/", response_model=List[GatewayErrorExtractSchema])
def create_error_extracts(
    extracts: List[GatewayErrorExtractCreate],
    batch_id: int = None,
    db: Session = Depends(get_db)
):
    db_extracts = []
    for extract_data in extracts:
        db_extract = GatewayErrorExtract(**extract_data.dict())
        if batch_id:
            batch = db.query(Batch).filter(Batch.id == batch_id).first()
            if not batch:
                raise HTTPException(status_code=404, detail=f"批次 {batch_id} 不存在")
            db_extract.batch_id = batch_id
        db.add(db_extract)
        db_extracts.append(db_extract)
    
    db.commit()
    for extract in db_extracts:
        db.refresh(extract)
    
    return db_extracts

@router.get("/{extract_id}", response_model=GatewayErrorExtractSchema)
def get_error_extract(extract_id: int, db: Session = Depends(get_db)):
    extract = db.query(GatewayErrorExtract).filter(GatewayErrorExtract.id == extract_id).first()
    if not extract:
        raise HTTPException(status_code=404, detail="网关错误摘录不存在")
    return extract

@router.get("/", response_model=List[GatewayErrorExtractSchema])
def list_error_extracts(
    batch_id: int = None,
    trace_id: str = None,
    error_code: str = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(GatewayErrorExtract)
    
    if batch_id:
        query = query.filter(GatewayErrorExtract.batch_id == batch_id)
    if trace_id:
        query = query.filter(GatewayErrorExtract.trace_id == trace_id)
    if error_code:
        query = query.filter(GatewayErrorExtract.error_code == error_code)
    
    return query.offset(skip).limit(limit).all()

@router.get("/{extract_id}/raw")
def get_raw_extract_data(extract_id: int, db: Session = Depends(get_db)):
    extract = db.query(GatewayErrorExtract).filter(GatewayErrorExtract.id == extract_id).first()
    if not extract:
        raise HTTPException(status_code=404, detail="网关错误摘录不存在")
    return extract.raw_data
