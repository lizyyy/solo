from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.utils.database import get_db
from app.services.parser import CSVParser
from app.services.rules_engine import InventoryRulesEngine
from app.models.schemas import ProcessingResponse, ProcessingResult, ReplacementTrace
from app.models.inventory import Inventory

router = APIRouter()

@router.post("/upload", response_model=ProcessingResponse)
async def upload_inventory(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="仅支持CSV文件")
    
    content = await file.read()
    content_str = content.decode('utf-8')
    
    try:
        items = CSVParser.parse_inventory(content_str)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"CSV解析失败: {str(e)}")
    
    engine = InventoryRulesEngine(db)
    result = engine.process_batch(items)
    
    return result

@router.post("/process", response_model=ProcessingResponse)
async def process_inventory_direct(
    items: List[dict],
    db: Session = Depends(get_db)
):
    engine = InventoryRulesEngine(db)
    result = engine.process_batch(items)
    return result

@router.get("/trace/{batch_number}")
async def trace_replacement(
    batch_number: str,
    trace_type: str = "complete",
    db: Session = Depends(get_db)
):
    inventory = db.query(Inventory).filter(
        Inventory.batch_number == batch_number
    ).first()
    
    if not inventory:
        raise HTTPException(status_code=404, detail="未找到该批次记录")
    
    engine = InventoryRulesEngine(db)
    
    if trace_type == "source":
        has_trace, msg, history = engine.get_replacement_source_trace(batch_number)
        return {
            "batch_number": batch_number,
            "material_name": inventory.material_name,
            "is_replacement": inventory.is_replacement,
            "replaced_batch_number": inventory.replaced_batch,
            "trace_type": "source",
            "trace_message": msg,
            "source_history": history
        }
    elif trace_type == "replacements":
        has_reps, msg, replacements = engine.get_all_replacements_for_batch(batch_number)
        return {
            "batch_number": batch_number,
            "material_name": inventory.material_name,
            "is_replacement": inventory.is_replacement,
            "replaced_batch_number": inventory.replaced_batch,
            "trace_type": "replacements",
            "trace_message": msg,
            "replacements": replacements
        }
    else:
        complete_trace = engine.get_complete_trace(batch_number)
        return complete_trace

@router.get("/records")
async def get_processing_records(
    status: str = None,
    store_id: str = None,
    db: Session = Depends(get_db)
):
    from app.models.inventory import InventoryProcessingRecord
    query = db.query(InventoryProcessingRecord)
    
    if status:
        query = query.filter(InventoryProcessingRecord.status == status)
    if store_id:
        query = query.filter(InventoryProcessingRecord.store_id == store_id)
    
    records = query.order_by(InventoryProcessingRecord.process_date.desc()).all()
    return {"records": records}
