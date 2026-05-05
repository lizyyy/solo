from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
import os
import json

from database import get_db
from models.release import FlightRelease
from models.flight import FlightPlan
from models.deice import DeiceFluidRecord
from models.weather import WeatherData
from models.gate import GateOperationLog
from models.audit import AuditLog
from config import settings

from services.export_service import ExportService

router = APIRouter(prefix="/api/export", tags=["导出功能"])


@router.get("/markdown/{flight_number}", response_class=FileResponse)
def export_markdown(
    flight_number: str,
    download: bool = False,
    db: Session = Depends(get_db)
):
    release = db.query(FlightRelease).filter(
        FlightRelease.flight_number == flight_number
    ).first()
    
    if not release:
        raise HTTPException(
            status_code=404,
            detail=f"航班 {flight_number} 的放行记录不存在"
        )
    
    flight = db.query(FlightPlan).filter(
        FlightPlan.flight_number == flight_number
    ).first()
    
    deice_records = db.query(DeiceFluidRecord).filter(
        DeiceFluidRecord.flight_number == flight_number
    ).order_by(DeiceFluidRecord.application_start_time.asc()).all()
    
    latest_weather = db.query(WeatherData).order_by(
        WeatherData.observation_time.desc()
    ).first()
    
    gate_logs = db.query(GateOperationLog).filter(
        GateOperationLog.flight_number == flight_number
    ).order_by(GateOperationLog.arrival_time.asc()).all()
    
    release_dict = release.to_dict()
    flight_dict = flight.to_dict() if flight else {}
    deice_dicts = [d.to_dict() for d in deice_records]
    weather_dict = latest_weather.to_dict() if latest_weather else {}
    gate_dict = gate_logs[-1].to_dict() if gate_logs else {}
    
    markdown = ExportService.generate_markdown_handover(
        flight_release=release_dict,
        flight_plan=flight_dict,
        deice_records=deice_dicts,
        weather_data=weather_dict,
        gate_log=gate_dict
    )
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"handover_{flight_number}_{timestamp}.md"
    
    filepath = ExportService.save_to_file(markdown, filename, "markdown")
    
    if download:
        return FileResponse(
            filepath,
            media_type="text/markdown",
            filename=filename
        )
    
    return JSONResponse(content={
        "message": "Markdown 交接单已生成",
        "filename": filename,
        "filepath": filepath,
        "content": markdown
    })


@router.get("/audit/{flight_number}", response_class=FileResponse)
def export_audit(
    flight_number: str,
    download: bool = False,
    db: Session = Depends(get_db)
):
    release = db.query(FlightRelease).filter(
        FlightRelease.flight_number == flight_number
    ).first()
    
    if not release:
        raise HTTPException(
            status_code=404,
            detail=f"航班 {flight_number} 的放行记录不存在"
        )
    
    flight = db.query(FlightPlan).filter(
        FlightPlan.flight_number == flight_number
    ).first()
    
    deice_records = db.query(DeiceFluidRecord).filter(
        DeiceFluidRecord.flight_number == flight_number
    ).order_by(DeiceFluidRecord.application_start_time.asc()).all()
    
    latest_weather = db.query(WeatherData).order_by(
        WeatherData.observation_time.desc()
    ).first()
    
    gate_logs = db.query(GateOperationLog).filter(
        GateOperationLog.flight_number == flight_number
    ).order_by(GateOperationLog.arrival_time.asc()).all()
    
    audit_logs = db.query(AuditLog).filter(
        AuditLog.flight_number == flight_number
    ).order_by(AuditLog.created_at.asc()).all()
    
    release_dict = release.to_dict()
    flight_dict = flight.to_dict() if flight else {}
    deice_dicts = [d.to_dict() for d in deice_records]
    weather_dict = latest_weather.to_dict() if latest_weather else {}
    gate_dict = gate_logs[-1].to_dict() if gate_logs else {}
    audit_dicts = [a.to_dict() for a in audit_logs]
    
    audit_package = ExportService.generate_audit_package(
        flight_release=release_dict,
        flight_plan=flight_dict,
        deice_records=deice_dicts,
        weather_data=weather_dict,
        gate_log=gate_dict,
        audit_logs=audit_dicts
    )
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"audit_{flight_number}_{timestamp}.json"
    
    filepath = ExportService.save_json_to_file(audit_package, filename, "audit")
    
    if download:
        return FileResponse(
            filepath,
            media_type="application/json",
            filename=filename
        )
    
    return JSONResponse(content={
        "message": "JSON 审计包已生成",
        "filename": filename,
        "filepath": filepath,
        "package": audit_package
    })


@router.get("/list", response_model=dict)
def list_exports(
    export_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    export_dir = settings.EXPORT_DIR
    
    markdown_files = []
    audit_files = []
    
    if os.path.exists(export_dir):
        markdown_dir = os.path.join(export_dir, "markdown")
        if os.path.exists(markdown_dir):
            for f in os.listdir(markdown_dir):
                if f.endswith('.md'):
                    filepath = os.path.join(markdown_dir, f)
                    stat = os.stat(filepath)
                    markdown_files.append({
                        "filename": f,
                        "filepath": filepath,
                        "size": stat.st_size,
                        "created_at": datetime.fromtimestamp(stat.st_ctime).isoformat()
                    })
        
        audit_dir = os.path.join(export_dir, "audit")
        if os.path.exists(audit_dir):
            for f in os.listdir(audit_dir):
                if f.endswith('.json'):
                    filepath = os.path.join(audit_dir, f)
                    stat = os.stat(filepath)
                    audit_files.append({
                        "filename": f,
                        "filepath": filepath,
                        "size": stat.st_size,
                        "created_at": datetime.fromtimestamp(stat.st_ctime).isoformat()
                    })
    
    result = {
        "markdown_count": len(markdown_files),
        "audit_count": len(audit_files)
    }
    
    if export_type is None or export_type == "markdown":
        result["markdown_files"] = sorted(markdown_files, key=lambda x: x["created_at"], reverse=True)
    if export_type is None or export_type == "audit":
        result["audit_files"] = sorted(audit_files, key=lambda x: x["created_at"], reverse=True)
    
    return result


@router.get("/audit-log/{flight_number}", response_model=dict)
def get_audit_logs(
    flight_number: str,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(AuditLog).filter(
        AuditLog.flight_number == flight_number
    )
    
    total = query.count()
    logs = query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()
    
    return {
        "flight_number": flight_number,
        "total": total,
        "logs": [l.to_dict() for l in logs]
    }


@router.get("/audit-log/all", response_model=dict)
def get_all_audit_logs(
    skip: int = 0,
    limit: int = 100,
    action: Optional[str] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    query = db.query(AuditLog)
    
    if action:
        query = query.filter(AuditLog.action == action)
    if start_time:
        query = query.filter(AuditLog.created_at >= start_time)
    if end_time:
        query = query.filter(AuditLog.created_at <= end_time)
    
    total = query.count()
    logs = query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()
    
    return {
        "total": total,
        "logs": [l.to_dict() for l in logs]
    }
