from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import os
import tempfile
import shutil

from ..database import get_db
from ..config import settings
from ..models.warehouse_map import WarehouseMap
from ..models.robot import Robot
from ..models.order import Order
from ..models.scheduling_batch import SchedulingBatch
from ..services.data_import_service import DataImportService
from ..services.scheduling_service import SchedulingService, ReplayService
from ..services.report_export_service import ReportExportService


router = APIRouter()


@router.post("/import/map")
async def import_map(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith('.json'):
        raise HTTPException(status_code=400, detail="File must be JSON format")
    
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix='.json') as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name
        
        service = DataImportService(db)
        warehouse_map, stats = service.import_warehouse_map(tmp_path)
        
        os.unlink(tmp_path)
        
        return {
            "success": True,
            "message": "Map imported successfully",
            "map_id": warehouse_map.id,
            "map_name": warehouse_map.name,
            "statistics": stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/import/robots")
async def import_robots(
    file: UploadFile = File(...),
    warehouse_map_id: Optional[int] = Form(None),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith(('.yaml', '.yml')):
        raise HTTPException(status_code=400, detail="File must be YAML format")
    
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix='.yaml') as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name
        
        service = DataImportService(db)
        robots, stats = service.import_robots(tmp_path, warehouse_map_id)
        
        os.unlink(tmp_path)
        
        return {
            "success": True,
            "message": "Robots imported successfully",
            "statistics": stats,
            "imported_count": len(robots)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/import/orders")
async def import_orders(
    file: UploadFile = File(...),
    warehouse_map_id: Optional[int] = Form(None),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith(('.csv', '.json')):
        raise HTTPException(status_code=400, detail="File must be CSV or JSON format")
    
    try:
        suffix = '.csv' if file.filename.endswith('.csv') else '.json'
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name
        
        service = DataImportService(db)
        orders, stats = service.import_orders(tmp_path, warehouse_map_id)
        
        os.unlink(tmp_path)
        
        return {
            "success": True,
            "message": "Orders imported successfully",
            "statistics": stats,
            "imported_count": len(orders)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/maps")
async def get_maps(db: Session = Depends(get_db)):
    maps = db.query(WarehouseMap).filter(
        WarehouseMap.is_active == True
    ).all()
    
    return {
        "maps": [
            {
                "id": m.id,
                "name": m.name,
                "description": m.description,
                "width": m.width,
                "height": m.height,
                "grid_size": m.grid_size,
                "created_at": m.created_at.isoformat() if m.created_at else None
            }
            for m in maps
        ]
    }


@router.get("/maps/{map_id}")
async def get_map(map_id: int, db: Session = Depends(get_db)):
    warehouse_map = db.query(WarehouseMap).filter(
        WarehouseMap.id == map_id
    ).first()
    
    if not warehouse_map:
        raise HTTPException(status_code=404, detail="Map not found")
    
    import json
    map_data = json.loads(warehouse_map.map_data)
    
    return {
        "id": warehouse_map.id,
        "name": warehouse_map.name,
        "description": warehouse_map.description,
        "width": warehouse_map.width,
        "height": warehouse_map.height,
        "grid_size": warehouse_map.grid_size,
        "map_data": map_data,
        "created_at": warehouse_map.created_at.isoformat() if warehouse_map.created_at else None
    }


@router.get("/robots")
async def get_robots(
    warehouse_map_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Robot).filter(Robot.is_active == True)
    
    if warehouse_map_id:
        query = query.filter(Robot.warehouse_map_id == warehouse_map_id)
    
    robots = query.all()
    
    return {
        "robots": [
            {
                "id": r.id,
                "robot_id": r.robot_id,
                "name": r.name,
                "warehouse_map_id": r.warehouse_map_id,
                "position": {
                    "x": r.current_x,
                    "y": r.current_y,
                    "z": r.current_z
                },
                "orientation": r.orientation,
                "status": r.status.value,
                "battery_level": r.battery_level,
                "max_speed": r.max_speed,
                "payload_capacity": r.payload_capacity
            }
            for r in robots
        ]
    }


@router.get("/orders")
async def get_orders(
    warehouse_map_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Order)
    
    if warehouse_map_id:
        query = query.filter(Order.warehouse_map_id == warehouse_map_id)
    
    if status:
        from ..models.order import OrderStatus
        try:
            status_enum = OrderStatus[status.upper()]
            query = query.filter(Order.status == status_enum)
        except KeyError:
            pass
    
    orders = query.all()
    
    return {
        "orders": [
            {
                "id": o.id,
                "order_id": o.order_id,
                "priority": o.priority,
                "pickup_location": {
                    "x": o.pickup_location_x,
                    "y": o.pickup_location_y,
                    "name": o.pickup_location_name
                },
                "dropoff_location": {
                    "x": o.dropoff_location_x,
                    "y": o.dropoff_location_y,
                    "name": o.dropoff_location_name
                },
                "cargo": {
                    "type": o.cargo_type,
                    "weight": o.cargo_weight,
                    "volume": o.cargo_volume
                },
                "status": o.status.value,
                "created_at": o.created_at.isoformat() if o.created_at else None
            }
            for o in orders
        ]
    }


@router.post("/scheduling/batches")
async def create_batch(
    warehouse_map_id: int,
    name: str,
    description: str = "",
    algorithm: str = "greedy",
    db: Session = Depends(get_db)
):
    try:
        service = SchedulingService(db)
        batch = service.create_batch(warehouse_map_id, name, description, algorithm)
        
        return {
            "success": True,
            "message": "Batch created successfully",
            "batch_id": batch.id,
            "batch_uuid": batch.batch_id,
            "name": batch.name
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/scheduling/batches/{batch_id}/run")
async def run_scheduling(
    batch_id: int,
    db: Session = Depends(get_db)
):
    try:
        service = SchedulingService(db)
        result = service.run_scheduling(batch_id)
        
        return {
            "success": True,
            "message": "Scheduling completed",
            "result": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/scheduling/batches")
async def get_batches(
    warehouse_map_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(SchedulingBatch)
    
    if warehouse_map_id:
        query = query.filter(SchedulingBatch.warehouse_map_id == warehouse_map_id)
    
    if status:
        from ..models.scheduling_batch import SchedulingStatus
        try:
            status_enum = SchedulingStatus[status.upper()]
            query = query.filter(SchedulingBatch.status == status_enum)
        except KeyError:
            pass
    
    batches = query.order_by(SchedulingBatch.created_at.desc()).all()
    
    return {
        "batches": [
            {
                "id": b.id,
                "batch_id": b.batch_id,
                "name": b.name,
                "description": b.description,
                "algorithm": b.algorithm.value,
                "status": b.status.value,
                "total_robots": b.total_robots,
                "total_orders": b.total_orders,
                "total_tasks": b.total_tasks,
                "completed_orders": b.completed_orders,
                "completed_tasks": b.completed_tasks,
                "start_time": b.start_time.isoformat() if b.start_time else None,
                "end_time": b.end_time.isoformat() if b.end_time else None,
                "created_at": b.created_at.isoformat() if b.created_at else None
            }
            for b in batches
        ]
    }


@router.post("/scheduling/batches/{batch_id}/generate-frames")
async def generate_frames(
    batch_id: int,
    time_step: float = 0.5,
    db: Session = Depends(get_db)
):
    try:
        service = ReplayService(db)
        result = service.generate_replay_frames(batch_id, time_step)
        
        return {
            "success": True,
            "message": "Replay frames generated",
            "result": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/scheduling/batches/{batch_id}/frames")
async def get_frames(
    batch_id: int,
    start_frame: int = 0,
    end_frame: Optional[int] = None,
    db: Session = Depends(get_db)
):
    try:
        service = ReplayService(db)
        frames = service.get_replay_frames(batch_id, start_frame, end_frame)
        
        return {
            "frames": frames,
            "total_frames": len(frames)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/scheduling/compare")
async def compare_batches(
    batch_id1: int,
    batch_id2: int,
    db: Session = Depends(get_db)
):
    try:
        service = ReplayService(db)
        comparison = service.compare_batches(batch_id1, batch_id2)
        
        return {
            "success": True,
            "comparison": comparison
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reports/batch/{batch_id}")
async def get_batch_report(
    batch_id: int,
    format: str = "markdown",
    db: Session = Depends(get_db)
):
    try:
        service = ReportExportService(db)
        report = service.generate_batch_report(batch_id, format)
        
        if format == "json":
            import json
            return json.loads(report)
        else:
            return PlainTextResponse(
                content=report,
                media_type="text/markdown"
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reports/comparison/{batch_id1}/{batch_id2}")
async def get_comparison_report(
    batch_id1: int,
    batch_id2: int,
    format: str = "markdown",
    db: Session = Depends(get_db)
):
    try:
        service = ReportExportService(db)
        report = service.generate_comparison_report(batch_id1, batch_id2, format)
        
        if format == "json":
            import json
            return json.loads(report)
        else:
            return PlainTextResponse(
                content=report,
                media_type="text/markdown"
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
