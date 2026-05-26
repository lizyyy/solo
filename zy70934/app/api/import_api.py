from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.import_service import DataImportService
from app.schemas.schemas import ImportResult

router = APIRouter(prefix="/api/import", tags=["数据导入"])


@router.post("/nodes/{project_id}", response_model=ImportResult)
def import_nodes(
    project_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="请上传CSV文件")
    
    content = file.file.read()
    service = DataImportService(db)
    result = service.import_nodes_csv(project_id, content, file.filename)
    
    if not result.success:
        raise HTTPException(status_code=400, detail=result.message)
    
    return result


@router.post("/photos/{project_id}", response_model=ImportResult)
def import_photos(
    project_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith('.json'):
        raise HTTPException(status_code=400, detail="请上传JSON文件")
    
    content = file.file.read()
    service = DataImportService(db)
    result = service.import_photos_json(project_id, content, file.filename)
    
    if not result.success:
        raise HTTPException(status_code=400, detail=result.message)
    
    return result


@router.post("/rectifications/{project_id}", response_model=ImportResult)
def import_rectifications(
    project_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    if not (file.filename.endswith('.csv') or file.filename.endswith('.json')):
        raise HTTPException(status_code=400, detail="请上传CSV或JSON文件")
    
    content = file.file.read()
    service = DataImportService(db)
    result = service.import_rectification_orders(project_id, content, file.filename)
    
    if not result.success:
        raise HTTPException(status_code=400, detail=result.message)
    
    return result
