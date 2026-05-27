from fastapi import APIRouter, Depends, File, UploadFile, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.services import importer
from app.services.importer import list_batches
from app.schemas import ImportSummary

router = APIRouter(prefix="/api/import", tags=["导入"])


@router.post("/employees", response_model=dict, summary="导入员工 JSON")
async def import_employees(
    file: UploadFile = File(...),
    operator: str = "system",
    db: Session = Depends(get_db),
):
    content = await file.read()
    result = importer.import_employees_json(db, file.filename, content, operator)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "导入失败"))
    return result


@router.post("/coupons", response_model=dict, summary="导入券码 CSV")
async def import_coupons(
    file: UploadFile = File(...),
    operator: str = "system",
    db: Session = Depends(get_db),
):
    content = await file.read()
    result = importer.import_coupons_csv(db, file.filename, content, operator)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "导入失败"))
    return result


@router.post("/requisitions", response_model=dict, summary="导入领用 CSV")
async def import_requisitions(
    file: UploadFile = File(...),
    operator: str = "system",
    db: Session = Depends(get_db),
):
    content = await file.read()
    result = importer.import_requisitions_csv(db, file.filename, content, operator)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "导入失败"))
    return result


@router.get("/batches", summary="查询导入批次列表")
async def get_batches(batch_type: str = None, db: Session = Depends(get_db)):
    batches = list_batches(db, batch_type)
    return [
        {
            "id": b.id,
            "batch_no": b.batch_no,
            "batch_type": b.batch_type,
            "file_name": b.file_name,
            "record_count": b.record_count,
            "operator": b.operator,
            "remark": b.remark,
            "created_at": b.created_at,
        }
        for b in batches
    ]
