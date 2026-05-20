from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any

from app.models import get_db
from app.services import TraceService

router = APIRouter()


@router.get("/record/{record_id}", response_model=Dict[str, Any])
async def get_full_trace(
    record_id: str,
    db: Session = Depends(get_db)
):
    """获取对账记录的完整追溯信息"""
    try:
        service = TraceService(db)
        trace = service.get_full_trace(record_id)
        
        return {
            "success": True,
            "data": trace
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/appointment/{appointment_id}", response_model=Dict[str, Any])
async def get_trace_by_appointment(
    appointment_id: str,
    db: Session = Depends(get_db)
):
    """通过预约ID获取对账追溯信息"""
    try:
        service = TraceService(db)
        traces = service.get_record_by_appointment(appointment_id)
        
        return {
            "success": True,
            "total": len(traces),
            "data": traces
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/child/{child_id_card}", response_model=Dict[str, Any])
async def get_child_history(
    child_id_card: str,
    db: Session = Depends(get_db)
):
    """获取儿童的完整预约对账历史"""
    try:
        service = TraceService(db)
        history = service.get_child_history(child_id_card)
        
        return {
            "success": True,
            "data": history
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
