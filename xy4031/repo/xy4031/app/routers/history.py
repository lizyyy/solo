from typing import List, Optional, Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from app.core.database import get_db
from app.models import (
    BatteryPack,
    ChargeRecord,
    FlightRecord,
    CellVoltageReading,
    MaintenanceNote
)
from app.schemas import (
    ChargeRecordResponse,
    FlightRecordResponse,
    CellVoltageReadingResponse,
    MaintenanceNoteResponse,
    MaintenanceNoteCreate
)
from app.services import ReportExporter

router = APIRouter(tags=["历史查询与报告导出"])


@router.get("/history/{battery_id}")
def get_battery_history(
    battery_id: str,
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    record_type: Optional[str] = Query(None, description="charge/flight/voltage/maintenance"),
    db: Session = Depends(get_db)
):
    battery = db.query(BatteryPack).filter(
        BatteryPack.battery_id == battery_id.upper()
    ).first()
    
    if not battery:
        raise HTTPException(
            status_code=404,
            detail=f"电池编号 {battery_id} 不存在"
        )
    
    result = {
        "battery_id": battery_id.upper(),
        "battery_name": battery.name,
        "records": {}
    }
    
    include_charge = record_type is None or record_type == "charge"
    include_flight = record_type is None or record_type == "flight"
    include_voltage = record_type is None or record_type == "voltage"
    include_maintenance = record_type is None or record_type == "maintenance"
    
    if include_charge:
        query = db.query(ChargeRecord).filter(
            ChargeRecord.battery_id == battery_id.upper()
        )
        if start_date:
            query = query.filter(ChargeRecord.charge_start_time >= start_date)
        if end_date:
            query = query.filter(ChargeRecord.charge_start_time <= end_date)
        
        charges = query.order_by(ChargeRecord.charge_start_time.desc()).all()
        result["records"]["charge"] = [
            {
                "id": c.id,
                "type": "charge",
                "time": c.charge_start_time.isoformat() if c.charge_start_time else None,
                "end_time": c.charge_end_time.isoformat() if c.charge_end_time else None,
                "start_voltage": c.start_voltage,
                "end_voltage": c.end_voltage,
                "cycle_count": c.cycle_count
            }
            for c in charges
        ]
    
    if include_flight:
        query = db.query(FlightRecord).filter(
            FlightRecord.battery_id == battery_id.upper()
        )
        if start_date:
            query = query.filter(FlightRecord.flight_date >= start_date)
        if end_date:
            query = query.filter(FlightRecord.flight_date <= end_date)
        
        flights = query.order_by(FlightRecord.flight_date.desc()).all()
        result["records"]["flight"] = [
            {
                "id": f.id,
                "type": "flight",
                "time": f.flight_date.isoformat() if f.flight_date else None,
                "duration_min": f.flight_duration_min,
                "start_voltage": f.start_voltage,
                "end_voltage": f.end_voltage,
                "min_voltage": f.min_voltage,
                "has_low_alert": f.has_low_voltage_alert,
                "cycle_count": f.cycle_count
            }
            for f in flights
        ]
    
    if include_voltage:
        query = db.query(CellVoltageReading).filter(
            CellVoltageReading.battery_id == battery_id.upper()
        )
        if start_date:
            query = query.filter(CellVoltageReading.reading_time >= start_date)
        if end_date:
            query = query.filter(CellVoltageReading.reading_time <= end_date)
        
        voltages = query.order_by(CellVoltageReading.reading_time.desc()).all()
        result["records"]["voltage"] = [
            {
                "id": v.id,
                "type": "voltage",
                "time": v.reading_time.isoformat() if v.reading_time else None,
                "total_voltage": v.total_voltage,
                "max_cell": v.max_cell_voltage,
                "min_cell": v.min_cell_voltage,
                "voltage_diff": v.voltage_diff
            }
            for v in voltages
        ]
    
    if include_maintenance:
        query = db.query(MaintenanceNote).filter(
            MaintenanceNote.battery_id == battery_id.upper()
        )
        if start_date:
            query = query.filter(MaintenanceNote.note_date >= start_date)
        if end_date:
            query = query.filter(MaintenanceNote.note_date <= end_date)
        
        maintenances = query.order_by(MaintenanceNote.note_date.desc()).all()
        result["records"]["maintenance"] = [
            {
                "id": m.id,
                "type": "maintenance",
                "note_type": m.note_type,
                "time": m.note_date.isoformat() if m.note_date else None,
                "title": m.title,
                "is_sealed": m.is_sealed
            }
            for m in maintenances
        ]
    
    return result


@router.get("/export/{battery_id}/markdown")
def export_markdown(
    battery_id: str,
    include_charge: bool = True,
    include_flight: bool = True,
    include_voltage: bool = True,
    include_maintenance: bool = True,
    db: Session = Depends(get_db)
):
    exporter = ReportExporter(db)
    
    markdown = exporter.export_to_markdown(
        battery_id=battery_id.upper(),
        include_charge=include_charge,
        include_flight=include_flight,
        include_voltage=include_voltage,
        include_maintenance=include_maintenance
    )
    
    return PlainTextResponse(
        content=markdown,
        media_type="text/markdown",
        headers={
            "Content-Disposition": f"attachment; filename={battery_id.upper()}_report.md"
        }
    )


@router.get("/export/{battery_id}/csv")
def export_csv(
    battery_id: str,
    include_charge: bool = True,
    include_flight: bool = True,
    include_voltage: bool = True,
    include_maintenance: bool = True,
    db: Session = Depends(get_db)
):
    exporter = ReportExporter(db)
    
    csv_content = exporter.export_to_csv(
        battery_id=battery_id.upper(),
        include_charge=include_charge,
        include_flight=include_flight,
        include_voltage=include_voltage,
        include_maintenance=include_maintenance
    )
    
    return PlainTextResponse(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={battery_id.upper()}_report.csv"
        }
    )


@router.post("/maintenance", response_model=MaintenanceNoteResponse, status_code=201)
def create_maintenance_note(
    note: MaintenanceNoteCreate,
    db: Session = Depends(get_db)
):
    battery = db.query(BatteryPack).filter(
        BatteryPack.battery_id == note.battery_id.upper()
    ).first()
    
    if not battery:
        raise HTTPException(
            status_code=404,
            detail=f"电池编号 {note.battery_id} 不存在"
        )
    
    db_note = MaintenanceNote(
        battery_id=note.battery_id.upper(),
        note_date=note.note_date or datetime.utcnow(),
        note_type=note.note_type,
        title=note.title,
        content=note.content,
        author=note.author,
        is_sealed=note.is_sealed
    )
    
    db.add(db_note)
    db.commit()
    db.refresh(db_note)
    
    return db_note
