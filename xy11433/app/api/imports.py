import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import DataSource
from app.schemas import ImportResult
from app.services import ImportService
from app.config import settings

router = APIRouter(prefix="/import", tags=["数据导入"])


@router.post("/excel", response_model=ImportResult)
async def import_excel(
    file: UploadFile = File(...),
    data_source: DataSource = Form(...),
    imported_by: str = Form(...),
    db: Session = Depends(get_db)
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="请上传文件")
    
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="仅支持Excel文件")
    
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    
    file_ext = os.path.splitext(file.filename)[1]
    saved_filename = f"{uuid.uuid4()}{file_ext}"
    saved_path = os.path.join(settings.UPLOAD_DIR, saved_filename)
    
    try:
        contents = await file.read()
        with open(saved_path, 'wb') as f:
            f.write(contents)
        
        import_service = ImportService(db)
        result = import_service.import_from_excel(
            file_path=saved_path,
            file_name=file.filename,
            data_source=data_source,
            imported_by=imported_by
        )
        
        return result
        
    except Exception as e:
        if os.path.exists(saved_path):
            os.remove(saved_path)
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")


@router.post("/correct/{record_id}")
def manual_correct(
    record_id: int,
    corrected_data: dict,
    operator: str,
    reason: str,
    db: Session = Depends(get_db)
):
    import_service = ImportService(db)
    
    try:
        record = import_service.manual_correct_record(
            record_id=record_id,
            corrected_data=corrected_data,
            operator=operator,
            reason=reason
        )
        return {"success": True, "record_id": record.id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
