from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional, List
from datetime import datetime

from app.database import get_db
from app.services.settlement_service import SettlementService
from app.models import SettlementRecord, WorkSession, Machinery

router = APIRouter(prefix="/settlement", tags=["结算查询"])


@router.post("/process", response_model=Dict[str, Any])
async def process_settlement(
    machine_id: Optional[str] = Query(None, description="机器编号，不传则处理所有机器"),
    db: Session = Depends(get_db)
):
    try:
        service = SettlementService(db)
        
        session_result = service.rebuild_work_sessions(machine_id=machine_id)
        if not session_result.get("success"):
            return {
                "success": False,
                "message": "重建作业时段失败",
                "errors": session_result.get("errors", [])
            }
        
        settlement_result = service.calculate_settlement(machine_id=machine_id)
        if not settlement_result.get("success"):
            return {
                "success": False,
                "message": "计算结算失败",
                "errors": settlement_result.get("errors", [])
            }
        
        anomaly_result = service.detect_anomalies(machine_id=machine_id)
        
        return {
            "success": True,
            "message": "结算处理完成",
            "work_sessions_created": session_result.get("sessions_created", 0),
            "settlements_created": settlement_result.get("settlements_created", 0),
            "anomalies_detected": anomaly_result.get("anomalies_detected", 0),
            "errors": session_result.get("errors", []) + settlement_result.get("errors", []) + anomaly_result.get("errors", [])
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}")


@router.get("/summary", response_model=Dict[str, Any])
async def get_settlement_summary(
    machine_id: Optional[str] = Query(None, description="机器编号"),
    start_date: Optional[str] = Query(None, description="开始日期 (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="结束日期 (YYYY-MM-DD)"),
    db: Session = Depends(get_db)
):
    try:
        start_dt = None
        end_dt = None
        
        if start_date:
            start_dt = datetime.fromisoformat(f"{start_date}T00:00:00")
        if end_date:
            end_dt = datetime.fromisoformat(f"{end_date}T23:59:59")
        
        service = SettlementService(db)
        result = service.get_settlement_summary(
            machine_id=machine_id,
            start_date=start_dt,
            end_date=end_dt
        )
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"查询失败: {str(e)}")


@router.get("/list", response_model=Dict[str, Any])
async def list_settlements(
    machine_id: Optional[str] = Query(None, description="机器编号"),
    start_date: Optional[str] = Query(None, description="开始日期 (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="结束日期 (YYYY-MM-DD)"),
    status: Optional[str] = Query(None, description="状态: pending, reviewed, approved"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    db: Session = Depends(get_db)
):
    try:
        query = db.query(SettlementRecord).join(
            WorkSession, SettlementRecord.work_session_id == WorkSession.session_id
        )
        
        if machine_id:
            query = query.filter(SettlementRecord.machine_id == machine_id)
        
        if start_date:
            start_dt = datetime.fromisoformat(f"{start_date}T00:00:00")
            query = query.filter(WorkSession.start_time >= start_dt)
        
        if end_date:
            end_dt = datetime.fromisoformat(f"{end_date}T23:59:59")
            query = query.filter(WorkSession.end_time <= end_dt)
        
        if status:
            query = query.filter(SettlementRecord.status == status)
        
        total_count = query.count()
        
        query = query.order_by(WorkSession.start_time.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)
        
        settlements = query.all()
        
        settlement_list = []
        for s in settlements:
            work_session = db.query(WorkSession).filter(
                WorkSession.session_id == s.work_session_id
            ).first()
            
            machine = db.query(Machinery).filter(
                Machinery.machine_id == s.machine_id
            ).first()
            
            settlement_list.append({
                "settlement_id": s.settlement_id,
                "machine_id": s.machine_id,
                "machine_name": machine.machine_name if machine else None,
                "plot_id": s.plot_id,
                "work_session_id": s.work_session_id,
                "start_time": work_session.start_time.isoformat() if work_session else None,
                "end_time": work_session.end_time.isoformat() if work_session else None,
                "total_area_mu": s.total_area_mu,
                "night_area_mu": s.night_area_mu,
                "empty_deduction_area_mu": s.empty_deduction_area_mu,
                "billable_area_mu": s.billable_area_mu,
                "price_per_mu": s.price_per_mu,
                "night_surcharge": s.night_surcharge,
                "empty_driving_deduction": s.empty_driving_deduction,
                "total_amount": s.total_amount,
                "status": s.status,
                "created_at": s.created_at.isoformat() if s.created_at else None,
                "reviewed_at": s.reviewed_at.isoformat() if s.reviewed_at else None,
                "reviewer": s.reviewer,
                "review_notes": s.review_notes
            })
        
        return {
            "success": True,
            "total_count": total_count,
            "page": page,
            "page_size": page_size,
            "data": settlement_list
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"查询失败: {str(e)}")


@router.get("/{settlement_id}", response_model=Dict[str, Any])
async def get_settlement_detail(
    settlement_id: str,
    db: Session = Depends(get_db)
):
    try:
        settlement = db.query(SettlementRecord).filter(
            SettlementRecord.settlement_id == settlement_id
        ).first()
        
        if not settlement:
            raise HTTPException(status_code=404, detail="结算记录不存在")
        
        work_session = db.query(WorkSession).filter(
            WorkSession.session_id == settlement.work_session_id
        ).first()
        
        machine = db.query(Machinery).filter(
            Machinery.machine_id == settlement.machine_id
        ).first()
        
        return {
            "success": True,
            "data": {
                "settlement_id": settlement.settlement_id,
                "machine": {
                    "machine_id": machine.machine_id if machine else None,
                    "machine_name": machine.machine_name if machine else None,
                    "machine_type": machine.machine_type if machine else None,
                    "driver_name": machine.driver_name if machine else None
                },
                "plot_id": settlement.plot_id,
                "work_session": {
                    "session_id": work_session.session_id if work_session else None,
                    "start_time": work_session.start_time.isoformat() if work_session else None,
                    "end_time": work_session.end_time.isoformat() if work_session else None,
                    "duration_minutes": work_session.duration_minutes if work_session else None,
                    "total_distance_km": work_session.total_distance_km if work_session else None,
                    "working_distance_km": work_session.working_distance_km if work_session else None,
                    "empty_distance_km": work_session.empty_distance_km if work_session else None,
                    "is_cross_midnight": work_session.is_cross_midnight if work_session else None,
                    "has_boundary_missing": work_session.has_boundary_missing if work_session else None
                },
                "area": {
                    "total_area_mu": settlement.total_area_mu,
                    "night_area_mu": settlement.night_area_mu,
                    "empty_deduction_area_mu": settlement.empty_deduction_area_mu,
                    "billable_area_mu": settlement.billable_area_mu
                },
                "amount": {
                    "price_per_mu": settlement.price_per_mu,
                    "night_surcharge": settlement.night_surcharge,
                    "empty_driving_deduction": settlement.empty_driving_deduction,
                    "total_amount": settlement.total_amount
                },
                "review": {
                    "status": settlement.status,
                    "created_at": settlement.created_at.isoformat() if settlement.created_at else None,
                    "reviewed_at": settlement.reviewed_at.isoformat() if settlement.reviewed_at else None,
                    "reviewer": settlement.reviewer,
                    "review_notes": settlement.review_notes
                }
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"查询失败: {str(e)}")


@router.post("/{settlement_id}/review", response_model=Dict[str, Any])
async def review_settlement(
    settlement_id: str,
    status: str = Query(..., description="审核状态: reviewed, approved, rejected"),
    reviewer: str = Query(None, description="审核人"),
    review_notes: str = Query(None, description="审核备注"),
    db: Session = Depends(get_db)
):
    try:
        settlement = db.query(SettlementRecord).filter(
            SettlementRecord.settlement_id == settlement_id
        ).first()
        
        if not settlement:
            raise HTTPException(status_code=404, detail="结算记录不存在")
        
        valid_statuses = ["reviewed", "approved", "rejected"]
        if status not in valid_statuses:
            raise HTTPException(
                status_code=400, 
                detail=f"无效的状态，有效值为: {', '.join(valid_statuses)}"
            )
        
        settlement.status = status
        settlement.reviewed_at = datetime.now()
        if reviewer:
            settlement.reviewer = reviewer
        if review_notes:
            settlement.review_notes = review_notes
        
        db.commit()
        
        return {
            "success": True,
            "message": "审核完成",
            "settlement_id": settlement_id,
            "status": status
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"审核失败: {str(e)}")
