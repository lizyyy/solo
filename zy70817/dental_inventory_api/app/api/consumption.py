from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
from app.utils.database import get_db
from app.services.parser import CSVParser
from app.models.recall import StoreConsumption
from app.models.schemas import StoreConsumptionCreate
from typing import List

router = APIRouter()

@router.post("/upload")
async def upload_consumption(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="仅支持CSV文件")
    
    content = await file.read()
    content_str = content.decode('utf-8')
    
    try:
        items = CSVParser.parse_consumption(content_str)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"CSV解析失败: {str(e)}")
    
    saved_items = []
    for item in items:
        consumption = StoreConsumption(**item)
        db.add(consumption)
        saved_items.append(item)
    
    db.commit()
    
    return {
        "message": f"成功导入{len(saved_items)}条消耗记录",
        "count": len(saved_items),
        "items": saved_items
    }

@router.post("/")
async def create_consumption(
    items: List[StoreConsumptionCreate],
    db: Session = Depends(get_db)
):
    saved_items = []
    for item in items:
        consumption = StoreConsumption(**item.dict())
        db.add(consumption)
        saved_items.append(item)
    
    db.commit()
    
    return {
        "message": f"成功保存{len(saved_items)}条消耗记录",
        "count": len(saved_items),
        "items": saved_items
    }

@router.get("/")
async def list_consumption(
    store_id: str = None,
    batch_number: str = None,
    db: Session = Depends(get_db)
):
    query = db.query(StoreConsumption)
    
    if store_id:
        query = query.filter(StoreConsumption.store_id == store_id)
    if batch_number:
        query = query.filter(StoreConsumption.batch_number == batch_number)
    
    records = query.order_by(StoreConsumption.consumption_date.desc()).all()
    return {"records": records}
