from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.database import get_db
from app.services import ImportService

router = APIRouter()


@router.post("/policies")
async def import_policies(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="必须上传CSV文件")
    
    content = await file.read()
    csv_content = content.decode('utf-8')
    
    service = ImportService(db)
    result = await service.import_policies_csv(csv_content)
    
    return {"filename": file.filename, "result": result}


@router.post("/members")
async def import_members(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="必须上传CSV文件")
    
    content = await file.read()
    csv_content = content.decode('utf-8')
    
    service = ImportService(db)
    result = await service.import_members_csv(csv_content)
    
    return {"filename": file.filename, "result": result}


@router.post("/claim-rules")
async def import_claim_rules(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    if not file.filename.endswith('.json'):
        raise HTTPException(status_code=400, detail="必须上传JSON文件")
    
    content = await file.read()
    json_content = content.decode('utf-8')
    
    service = ImportService(db)
    result = await service.import_claim_rules_json(json_content)
    
    return {"filename": file.filename, "result": result}


@router.post("/claims")
async def import_claims(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="必须上传CSV文件")
    
    content = await file.read()
    csv_content = content.decode('utf-8')
    
    service = ImportService(db)
    result = await service.import_claims_csv(csv_content)
    
    return {"filename": file.filename, "result": result}
