from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional
from datetime import datetime

from database import get_db
from models import WindTurbine, Blade, InspectionRecord, SCADAAllarm, WorkOrder
from schemas import (
    WindTurbineCreate, WindTurbineUpdate, WindTurbineResponse,
    BladeResponse, InspectionRecordResponse, SCADAAllarmResponse, WorkOrderResponse,
    APIResponse
)

router = APIRouter(prefix="/api/turbines", tags=["风机管理"])


@router.get("/", response_model=APIResponse)
def get_turbines(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """获取风机列表"""
    query = db.query(WindTurbine)
    
    if status:
        query = query.filter(WindTurbine.status == status)
    
    total = query.count()
    turbines = query.order_by(desc(WindTurbine.created_at)).offset(skip).limit(limit).all()
    
    return APIResponse(
        message=f"获取到 {len(turbines)} 个风机",
        data={
            "total": total,
            "items": [WindTurbineResponse.model_validate(t) for t in turbines]
        }
    )


@router.get("/{turbine_id}", response_model=APIResponse)
def get_turbine(turbine_id: int, db: Session = Depends(get_db)):
    """获取单个风机详情"""
    turbine = db.query(WindTurbine).filter(WindTurbine.id == turbine_id).first()
    if not turbine:
        raise HTTPException(status_code=404, detail="风机不存在")
    
    return APIResponse(
        message="获取风机详情成功",
        data=WindTurbineResponse.model_validate(turbine)
    )


@router.post("/", response_model=APIResponse)
def create_turbine(turbine: WindTurbineCreate, db: Session = Depends(get_db)):
    """创建风机"""
    # 检查风机编号是否已存在
    existing = db.query(WindTurbine).filter(WindTurbine.turbine_id == turbine.turbine_id).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"风机编号 {turbine.turbine_id} 已存在")
    
    db_turbine = WindTurbine(**turbine.model_dump())
    db.add(db_turbine)
    db.commit()
    db.refresh(db_turbine)
    
    # 自动创建3个叶片
    for blade_num in [1, 2, 3]:
        db_blade = Blade(
            turbine_id=db_turbine.id,
            blade_number=blade_num
        )
        db.add(db_blade)
    
    db.commit()
    
    return APIResponse(
        message="风机创建成功",
        data=WindTurbineResponse.model_validate(db_turbine)
    )


@router.put("/{turbine_id}", response_model=APIResponse)
def update_turbine(turbine_id: int, turbine: WindTurbineUpdate, db: Session = Depends(get_db)):
    """更新风机信息"""
    db_turbine = db.query(WindTurbine).filter(WindTurbine.id == turbine_id).first()
    if not db_turbine:
        raise HTTPException(status_code=404, detail="风机不存在")
    
    update_data = turbine.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_turbine, key, value)
    
    db.commit()
    db.refresh(db_turbine)
    
    return APIResponse(
        message="风机信息更新成功",
        data=WindTurbineResponse.model_validate(db_turbine)
    )


@router.delete("/{turbine_id}", response_model=APIResponse)
def delete_turbine(turbine_id: int, db: Session = Depends(get_db)):
    """删除风机"""
    db_turbine = db.query(WindTurbine).filter(WindTurbine.id == turbine_id).first()
    if not db_turbine:
        raise HTTPException(status_code=404, detail="风机不存在")
    
    db.delete(db_turbine)
    db.commit()
    
    return APIResponse(message=f"风机 {db_turbine.turbine_id} 已删除")


@router.get("/{turbine_id}/blades", response_model=APIResponse)
def get_turbine_blades(turbine_id: int, db: Session = Depends(get_db)):
    """获取风机的所有叶片"""
    turbine = db.query(WindTurbine).filter(WindTurbine.id == turbine_id).first()
    if not turbine:
        raise HTTPException(status_code=404, detail="风机不存在")
    
    blades = db.query(Blade).filter(Blade.turbine_id == turbine_id).order_by(Blade.blade_number).all()
    
    return APIResponse(
        message=f"获取到 {len(blades)} 个叶片",
        data=[BladeResponse.model_validate(b) for b in blades]
    )


@router.get("/{turbine_id}/inspections", response_model=APIResponse)
def get_turbine_inspections(
    turbine_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """获取风机的巡检记录"""
    turbine = db.query(WindTurbine).filter(WindTurbine.id == turbine_id).first()
    if not turbine:
        raise HTTPException(status_code=404, detail="风机不存在")
    
    query = db.query(InspectionRecord).filter(InspectionRecord.turbine_id == turbine_id)
    total = query.count()
    inspections = query.order_by(desc(InspectionRecord.inspection_date)).offset(skip).limit(limit).all()
    
    return APIResponse(
        message=f"获取到 {len(inspections)} 条巡检记录",
        data={
            "total": total,
            "items": [InspectionRecordResponse.model_validate(i) for i in inspections]
        }
    )


@router.get("/{turbine_id}/alarms", response_model=APIResponse)
def get_turbine_alarms(
    turbine_id: int,
    is_active: Optional[bool] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    """获取风机的SCADA告警"""
    turbine = db.query(WindTurbine).filter(WindTurbine.id == turbine_id).first()
    if not turbine:
        raise HTTPException(status_code=404, detail="风机不存在")
    
    query = db.query(SCADAAllarm).filter(SCADAAllarm.turbine_id == turbine_id)
    
    if is_active is not None:
        query = query.filter(SCADAAllarm.is_active == is_active)
    
    total = query.count()
    alarms = query.order_by(desc(SCADAAllarm.start_time)).offset(skip).limit(limit).all()
    
    return APIResponse(
        message=f"获取到 {len(alarms)} 条告警记录",
        data={
            "total": total,
            "items": [SCADAAllarmResponse.model_validate(a) for a in alarms]
        }
    )


@router.get("/{turbine_id}/work-orders", response_model=APIResponse)
def get_turbine_work_orders(
    turbine_id: int,
    status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    """获取风机的维修工单"""
    turbine = db.query(WindTurbine).filter(WindTurbine.id == turbine_id).first()
    if not turbine:
        raise HTTPException(status_code=404, detail="风机不存在")
    
    query = db.query(WorkOrder).filter(WorkOrder.turbine_id == turbine_id)
    
    if status:
        query = query.filter(WorkOrder.status == status)
    
    total = query.count()
    work_orders = query.order_by(desc(WorkOrder.created_time)).offset(skip).limit(limit).all()
    
    return APIResponse(
        message=f"获取到 {len(work_orders)} 条维修工单",
        data={
            "total": total,
            "items": [WorkOrderResponse.model_validate(w) for w in work_orders]
        }
    )
