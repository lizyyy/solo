from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional

from app.models import get_db, RecordStatus
from app.services import ReconciliationEngine, ReviewService

router = APIRouter()


@router.post("/run", response_model=Dict[str, Any])
async def run_reconciliation(
    batch_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """执行对账处理"""
    try:
        engine = ReconciliationEngine(db)
        result = engine.run_reconciliation(batch_id)
        
        return {
            "success": True,
            "message": f"对账处理完成，共处理 {result['total_records']} 条记录",
            "data": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/recalculate/{record_id}", response_model=Dict[str, Any])
async def recalculate_record(
    record_id: str,
    db: Session = Depends(get_db)
):
    """重新计算单条对账记录"""
    try:
        engine = ReconciliationEngine(db)
        record = engine.recalculate_record(record_id)
        
        return {
            "success": True,
            "message": "重新计算完成",
            "data": {
                "record_id": record.record_id,
                "status": record.status,
                "discrepancies": record.discrepancies,
                "auto_check_passed": record.auto_check_passed
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/statistics", response_model=Dict[str, Any])
async def get_statistics(
    batch_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """获取对账统计信息"""
    review_service = ReviewService(db)
    stats = review_service.get_review_statistics(batch_id)
    
    return {
        "success": True,
        "data": stats
    }
