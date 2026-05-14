from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from app.models.database import get_db
from app.schemas.geofence import (
    GeofenceCreate, GeofenceUpdate, GeofenceResponse,
    DeviceCreate, DeviceResponse,
    DevicePositionCreate, DevicePositionResponse,
    AlertEventCreate, AlertEventResponse, AlertEventUpdate,
    NotificationStrategyCreate, NotificationStrategyResponse,
    FalseAlarmFilterCreate, FalseAlarmFilterResponse,
    TrajectoryReportCreate, TrajectoryReportResponse,
    TrajectoryPlaybackRequest, TraceRequest, ManualCorrectionRequest,
    ExportRequest
)
from app.services.geofence_service import (
    GeofenceService, DeviceService, DevicePositionService,
    AlertService, TrajectoryService, ExportService
)

router = APIRouter(prefix="/api/v1", tags=["geofence"])

@router.post("/geofences", response_model=GeofenceResponse)
def create_geofence(geofence: GeofenceCreate, db: Session = Depends(get_db)):
    service = GeofenceService(db)
    return service.create_geofence(geofence)

@router.get("/geofences", response_model=List[GeofenceResponse])
def get_geofences(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    service = GeofenceService(db)
    return service.get_all_geofences(skip=skip, limit=limit)

@router.get("/geofences/{geofence_id}", response_model=GeofenceResponse)
def get_geofence(geofence_id: int, db: Session = Depends(get_db)):
    service = GeofenceService(db)
    geofence = service.get_geofence(geofence_id)
    if not geofence:
        raise HTTPException(status_code=404, detail="围栏未找到")
    return geofence

@router.put("/geofences/{geofence_id}", response_model=GeofenceResponse)
def update_geofence(geofence_id: int, geofence: GeofenceUpdate, db: Session = Depends(get_db)):
    service = GeofenceService(db)
    updated = service.update_geofence(geofence_id, geofence)
    if not updated:
        raise HTTPException(status_code=404, detail="围栏未找到")
    return updated

@router.delete("/geofences/{geofence_id}")
def delete_geofence(geofence_id: int, db: Session = Depends(get_db)):
    service = GeofenceService(db)
    if not service.delete_geofence(geofence_id):
        raise HTTPException(status_code=404, detail="围栏未找到")
    return {"message": "删除成功"}

@router.post("/devices", response_model=DeviceResponse)
def create_device(device: DeviceCreate, db: Session = Depends(get_db)):
    service = DeviceService(db)
    return service.create_device(device)

@router.get("/devices", response_model=List[DeviceResponse])
def get_devices(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    service = DeviceService(db)
    return service.get_all_devices(skip=skip, limit=limit)

@router.get("/devices/{device_id}", response_model=DeviceResponse)
def get_device(device_id: int, db: Session = Depends(get_db)):
    service = DeviceService(db)
    device = service.get_device(device_id)
    if not device:
        raise HTTPException(status_code=404, detail="设备未找到")
    return device

@router.post("/positions", response_model=DevicePositionResponse)
def add_position(position: DevicePositionCreate, db: Session = Depends(get_db)):
    service = DevicePositionService(db)
    return service.add_position(position)

@router.get("/positions/device/{device_id}", response_model=List[DevicePositionResponse])
def get_device_positions(device_id: int, start_time: datetime = None, end_time: datetime = None, db: Session = Depends(get_db)):
    service = DevicePositionService(db)
    return service.get_device_positions(device_id, start_time, end_time)

@router.post("/alerts", response_model=AlertEventResponse)
def create_alert(alert: AlertEventCreate, db: Session = Depends(get_db)):
    service = AlertService(db)
    return service.create_alert(alert)

@router.get("/alerts", response_model=List[AlertEventResponse])
def get_alerts(geofence_id: int = None, device_id: int = None, 
               start_time: datetime = None, end_time: datetime = None,
               include_false_alarms: bool = True, db: Session = Depends(get_db)):
    service = AlertService(db)
    return service.get_alerts(geofence_id, device_id, start_time, end_time, include_false_alarms)

@router.get("/alerts/{alert_id}", response_model=AlertEventResponse)
def get_alert(alert_id: int, db: Session = Depends(get_db)):
    service = AlertService(db)
    alert = service.get_alert(alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="告警未找到")
    return alert

@router.put("/alerts/{alert_id}", response_model=AlertEventResponse)
def update_alert(alert_id: int, alert: AlertEventUpdate, db: Session = Depends(get_db)):
    service = AlertService(db)
    db_alert = service.get_alert(alert_id)
    if not db_alert:
        raise HTTPException(status_code=404, detail="告警未找到")
    for key, value in alert.model_dump(exclude_unset=True).items():
        setattr(db_alert, key, value)
    db.commit()
    db.refresh(db_alert)
    return db_alert

@router.post("/alerts/manual-correction", response_model=AlertEventResponse)
def manual_correction(correction: ManualCorrectionRequest, db: Session = Depends(get_db)):
    service = AlertService(db)
    alert = service.manual_correction(correction)
    if not alert:
        raise HTTPException(status_code=404, detail="告警未找到")
    return alert

@router.post("/trajectory/playback")
def playback_trajectory(request: TrajectoryPlaybackRequest, db: Session = Depends(get_db)):
    service = TrajectoryService(db)
    result = service.playback_trajectory(request)
    return {
        "positions": [{"id": p.id, "latitude": p.latitude, "longitude": p.longitude, 
                       "timestamp": p.timestamp, "speed": p.speed} 
                      for p in result["positions"]],
        "alerts": [{"id": a.id, "event_type": a.event_type, "timestamp": a.timestamp,
                    "is_false_alarm": a.is_false_alarm} 
                   for a in result["alerts"]],
        "total_points": result["total_points"],
        "alert_count": result["alert_count"]
    }

@router.post("/trajectory/trace")
def trace_alert(request: TraceRequest, db: Session = Depends(get_db)):
    service = TrajectoryService(db)
    result = service.trace_alert(request)
    if not result:
        raise HTTPException(status_code=404, detail="告警未找到")
    return {
        "alert": {
            "id": result["alert"].id,
            "event_type": result["alert"].event_type,
            "timestamp": result["alert"].timestamp,
            "is_false_alarm": result["alert"].is_false_alarm
        },
        "positions": [{"id": p.id, "latitude": p.latitude, "longitude": p.longitude, 
                       "timestamp": p.timestamp} 
                      for p in result["positions"]],
        "time_window_seconds": result["time_window_seconds"],
        "trace_type": result["trace_type"]
    }

@router.post("/trajectory/reports", response_model=TrajectoryReportResponse)
def generate_report(report: TrajectoryReportCreate, generated_by: str = "system", db: Session = Depends(get_db)):
    service = TrajectoryService(db)
    return service.generate_report(report, generated_by)

@router.get("/trajectory/reports", response_model=List[TrajectoryReportResponse])
def get_reports(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    service = TrajectoryService(db)
    return service.get_all_reports(skip=skip, limit=limit)

@router.get("/trajectory/reports/{report_id}", response_model=TrajectoryReportResponse)
def get_report(report_id: int, db: Session = Depends(get_db)):
    service = TrajectoryService(db)
    report = service.get_report(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="报告未找到")
    return report

@router.post("/export")
def export_data(export_request: ExportRequest, db: Session = Depends(get_db)):
    service = ExportService(db)
    output = service.export_to_excel(
        export_type=export_request.export_type,
        device_id=export_request.device_id,
        geofence_id=export_request.geofence_id,
        start_time=export_request.start_time,
        end_time=export_request.end_time
    )
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={export_request.export_type}.xlsx"}
    )

@router.post("/notification-strategies", response_model=NotificationStrategyResponse)
def create_notification_strategy(strategy: NotificationStrategyCreate, db: Session = Depends(get_db)):
    from app.models.database import NotificationStrategy
    db_strategy = NotificationStrategy(**strategy.model_dump())
    db.add(db_strategy)
    db.commit()
    db.refresh(db_strategy)
    return db_strategy

@router.get("/notification-strategies", response_model=List[NotificationStrategyResponse])
def get_notification_strategies(db: Session = Depends(get_db)):
    from app.models.database import NotificationStrategy
    return db.query(NotificationStrategy).all()

@router.post("/false-alarm-filters", response_model=FalseAlarmFilterResponse)
def create_filter(filter_data: FalseAlarmFilterCreate, db: Session = Depends(get_db)):
    from app.models.database import FalseAlarmFilter
    db_filter = FalseAlarmFilter(**filter_data.model_dump())
    db.add(db_filter)
    db.commit()
    db.refresh(db_filter)
    return db_filter

@router.get("/false-alarm-filters", response_model=List[FalseAlarmFilterResponse])
def get_filters(db: Session = Depends(get_db)):
    from app.models.database import FalseAlarmFilter
    return db.query(FalseAlarmFilter).all()