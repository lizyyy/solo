from sqlalchemy.orm import Session
from shapely.geometry import Point, Polygon, shape
from typing import List, Optional
from datetime import datetime, timedelta
import uuid
import pandas as pd
from io import BytesIO

from app.models.database import (
    Geofence, Device, DevicePosition, AlertEvent, 
    DeviceAssignment, NotificationStrategy, FalseAlarmFilter,
    TrajectoryReport
)
from app.schemas.geofence import (
    GeofenceCreate, GeofenceUpdate, DeviceCreate, DevicePositionCreate,
    AlertEventCreate, AlertEventUpdate, NotificationStrategyCreate,
    FalseAlarmFilterCreate, TrajectoryReportCreate,
    TrajectoryPlaybackRequest, TraceRequest, ManualCorrectionRequest
)

class GeofenceService:
    def __init__(self, db: Session):
        self.db = db

    def create_geofence(self, geofence_data: GeofenceCreate) -> Geofence:
        db_geofence = Geofence(**geofence_data.model_dump())
        self.db.add(db_geofence)
        self.db.commit()
        self.db.refresh(db_geofence)
        return db_geofence

    def get_geofence(self, geofence_id: int) -> Optional[Geofence]:
        return self.db.query(Geofence).filter(Geofence.id == geofence_id).first()

    def get_all_geofences(self, skip: int = 0, limit: int = 100) -> List[Geofence]:
        return self.db.query(Geofence).offset(skip).limit(limit).all()

    def update_geofence(self, geofence_id: int, geofence_data: GeofenceUpdate) -> Optional[Geofence]:
        db_geofence = self.get_geofence(geofence_id)
        if db_geofence:
            update_data = geofence_data.model_dump(exclude_unset=True)
            for key, value in update_data.items():
                setattr(db_geofence, key, value)
            db_geofence.updated_at = datetime.utcnow()
            self.db.commit()
            self.db.refresh(db_geofence)
        return db_geofence

    def delete_geofence(self, geofence_id: int) -> bool:
        db_geofence = self.get_geofence(geofence_id)
        if db_geofence:
            self.db.delete(db_geofence)
            self.db.commit()
            return True
        return False

    def point_in_geofence(self, lat: float, lng: float, geofence: Geofence) -> bool:
        point = Point(lng, lat)
        if geofence.fence_type == "circle":
            center = Point(geofence.coordinates[0], geofence.coordinates[1])
            return point.distance(center) * 111000 <= geofence.radius
        else:
            poly = Polygon(geofence.coordinates)
            return poly.contains(point)

class DeviceService:
    def __init__(self, db: Session):
        self.db = db

    def create_device(self, device_data: DeviceCreate) -> Device:
        db_device = Device(**device_data.model_dump())
        self.db.add(db_device)
        self.db.commit()
        self.db.refresh(db_device)
        return db_device

    def get_device(self, device_id: int) -> Optional[Device]:
        return self.db.query(Device).filter(Device.id == device_id).first()

    def get_device_by_device_id(self, device_id: str) -> Optional[Device]:
        return self.db.query(Device).filter(Device.device_id == device_id).first()

    def get_all_devices(self, skip: int = 0, limit: int = 100) -> List[Device]:
        return self.db.query(Device).offset(skip).limit(limit).all()

class DevicePositionService:
    def __init__(self, db: Session):
        self.db = db

    def add_position(self, position_data: DevicePositionCreate) -> DevicePosition:
        db_position = DevicePosition(**position_data.model_dump())
        self.db.add(db_position)
        self.db.commit()
        self.db.refresh(db_position)
        return db_position

    def get_device_positions(self, device_id: int, start_time: datetime = None, end_time: datetime = None) -> List[DevicePosition]:
        query = self.db.query(DevicePosition).filter(DevicePosition.device_id == device_id)
        if start_time:
            query = query.filter(DevicePosition.timestamp >= start_time)
        if end_time:
            query = query.filter(DevicePosition.timestamp <= end_time)
        return query.order_by(DevicePosition.timestamp).all()

    def invalidate_position(self, position_id: int) -> bool:
        position = self.db.query(DevicePosition).filter(DevicePosition.id == position_id).first()
        if position:
            position.is_valid = False
            self.db.commit()
            return True
        return False

class AlertService:
    def __init__(self, db: Session):
        self.db = db

    def create_alert(self, alert_data: AlertEventCreate) -> AlertEvent:
        db_alert = AlertEvent(**alert_data.model_dump())
        self.db.add(db_alert)
        self.db.commit()
        self.db.refresh(db_alert)
        return db_alert

    def get_alert(self, alert_id: int) -> Optional[AlertEvent]:
        return self.db.query(AlertEvent).filter(AlertEvent.id == alert_id).first()

    def get_alerts(self, geofence_id: int = None, device_id: int = None, 
                   start_time: datetime = None, end_time: datetime = None,
                   include_false_alarms: bool = True) -> List[AlertEvent]:
        query = self.db.query(AlertEvent)
        if geofence_id:
            query = query.filter(AlertEvent.geofence_id == geofence_id)
        if device_id:
            query = query.filter(AlertEvent.device_id == device_id)
        if start_time:
            query = query.filter(AlertEvent.timestamp >= start_time)
        if end_time:
            query = query.filter(AlertEvent.timestamp <= end_time)
        if not include_false_alarms:
            query = query.filter(AlertEvent.is_false_alarm == False)
        return query.order_by(AlertEvent.timestamp.desc()).all()

    def manual_correction(self, correction_data: ManualCorrectionRequest) -> Optional[AlertEvent]:
        alert = self.get_alert(correction_data.alert_id)
        if alert:
            alert.is_false_alarm = correction_data.is_false_alarm
            alert.is_verified = True
            alert.verified_by = correction_data.corrected_by
            alert.verified_at = datetime.utcnow()
            alert.notes = correction_data.notes
            self.db.commit()
            self.db.refresh(alert)
            self.recalculate_alerts(alert.device_id, alert.timestamp)
        return alert

    def recalculate_alerts(self, device_id: int, from_time: datetime):
        pass

class TrajectoryService:
    def __init__(self, db: Session):
        self.db = db

    def playback_trajectory(self, request: TrajectoryPlaybackRequest) -> dict:
        positions = self.db.query(DevicePosition).filter(
            DevicePosition.device_id == request.device_id,
            DevicePosition.timestamp >= request.start_time,
            DevicePosition.timestamp <= request.end_time,
            DevicePosition.is_valid == True
        ).order_by(DevicePosition.timestamp).all()

        alerts = []
        if request.geofence_id:
            alerts = self.db.query(AlertEvent).filter(
                AlertEvent.device_id == request.device_id,
                AlertEvent.geofence_id == request.geofence_id,
                AlertEvent.timestamp >= request.start_time,
                AlertEvent.timestamp <= request.end_time
            ).all()

        return {
            "positions": positions,
            "alerts": alerts,
            "total_points": len(positions),
            "alert_count": len(alerts)
        }

    def trace_alert(self, request: TraceRequest) -> dict:
        alert = self.db.query(AlertEvent).filter(AlertEvent.id == request.alert_id).first()
        if not alert:
            return None

        if request.trace_type == "before":
            start_time = alert.timestamp - timedelta(seconds=request.time_window)
            end_time = alert.timestamp
        elif request.trace_type == "after":
            start_time = alert.timestamp
            end_time = alert.timestamp + timedelta(seconds=request.time_window)
        else:
            start_time = alert.timestamp - timedelta(seconds=request.time_window)
            end_time = alert.timestamp + timedelta(seconds=request.time_window)

        positions = self.db.query(DevicePosition).filter(
            DevicePosition.device_id == request.device_id,
            DevicePosition.timestamp >= start_time,
            DevicePosition.timestamp <= end_time
        ).order_by(DevicePosition.timestamp).all()

        return {
            "alert": alert,
            "positions": positions,
            "time_window_seconds": request.time_window,
            "trace_type": request.trace_type
        }

    def generate_report(self, report_data: TrajectoryReportCreate, generated_by: str = "system") -> TrajectoryReport:
        positions = self.db.query(DevicePosition).filter(
            DevicePosition.device_id == report_data.device_id,
            DevicePosition.timestamp >= report_data.start_time,
            DevicePosition.timestamp <= report_data.end_time,
            DevicePosition.is_valid == True
        ).all()

        enter_count = 0
        exit_count = 0
        stay_duration = 0

        if report_data.geofence_id:
            alerts = self.db.query(AlertEvent).filter(
                AlertEvent.device_id == report_data.device_id,
                AlertEvent.geofence_id == report_data.geofence_id,
                AlertEvent.timestamp >= report_data.start_time,
                AlertEvent.timestamp <= report_data.end_time,
                AlertEvent.is_false_alarm == False
            ).all()
            
            enter_count = sum(1 for a in alerts if a.event_type == "enter")
            exit_count = sum(1 for a in alerts if a.event_type == "exit")

        report = TrajectoryReport(
            report_id=f"RPT-{uuid.uuid4().hex[:8].upper()}",
            device_id=report_data.device_id,
            geofence_id=report_data.geofence_id,
            start_time=report_data.start_time,
            end_time=report_data.end_time,
            total_points=len(positions),
            enter_count=enter_count,
            exit_count=exit_count,
            stay_duration=stay_duration,
            generated_by=generated_by
        )
        self.db.add(report)
        self.db.commit()
        self.db.refresh(report)
        return report

    def get_report(self, report_id: int) -> Optional[TrajectoryReport]:
        return self.db.query(TrajectoryReport).filter(TrajectoryReport.id == report_id).first()

    def get_all_reports(self, skip: int = 0, limit: int = 100) -> List[TrajectoryReport]:
        return self.db.query(TrajectoryReport).order_by(TrajectoryReport.generated_at.desc()).offset(skip).limit(limit).all()

class ExportService:
    def __init__(self, db: Session):
        self.db = db

    def export_to_excel(self, export_type: str, device_id: int = None, 
                        geofence_id: int = None, start_time: datetime = None, 
                        end_time: datetime = None) -> BytesIO:
        if export_type == "positions":
            query = self.db.query(DevicePosition)
            if device_id:
                query = query.filter(DevicePosition.device_id == device_id)
            if start_time:
                query = query.filter(DevicePosition.timestamp >= start_time)
            if end_time:
                query = query.filter(DevicePosition.timestamp <= end_time)
            
            data = [{
                "设备ID": p.device_id,
                "纬度": p.latitude,
                "经度": p.longitude,
                "时间": p.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                "速度": p.speed,
                "方向": p.direction,
                "精度": p.accuracy
            } for p in query.all()]

        elif export_type == "alerts":
            query = self.db.query(AlertEvent)
            if device_id:
                query = query.filter(AlertEvent.device_id == device_id)
            if geofence_id:
                query = query.filter(AlertEvent.geofence_id == geofence_id)
            if start_time:
                query = query.filter(AlertEvent.timestamp >= start_time)
            if end_time:
                query = query.filter(AlertEvent.timestamp <= end_time)
            
            data = [{
                "告警ID": a.id,
                "围栏ID": a.geofence_id,
                "设备ID": a.device_id,
                "事件类型": a.event_type,
                "时间": a.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                "是否误报": "是" if a.is_false_alarm else "否",
                "是否验证": "是" if a.is_verified else "否",
                "置信度": a.confidence
            } for a in query.all()]

        else:
            query = self.db.query(TrajectoryReport)
            if device_id:
                query = query.filter(TrajectoryReport.device_id == device_id)
            data = [{
                "报告ID": r.report_id,
                "设备ID": r.device_id,
                "围栏ID": r.geofence_id,
                "开始时间": r.start_time.strftime("%Y-%m-%d %H:%M:%S") if r.start_time else "",
                "结束时间": r.end_time.strftime("%Y-%m-%d %H:%M:%S") if r.end_time else "",
                "轨迹点数": r.total_points,
                "进入次数": r.enter_count,
                "离开次数": r.exit_count,
                "停留时长(秒)": r.stay_duration
            } for r in query.all()]

        df = pd.DataFrame(data)
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='导出数据')
        output.seek(0)
        return output