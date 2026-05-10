from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.models.models import (
    Forklift, ForkliftStatus, ChargingStation, ChargingStationStatus,
    BatteryStatus, Task, TaskPriority, TaskStatus,
    ChargingRequest, ChargingStatus, ChargingQueue, AuditLog
)
from app.schemas.schemas import ChargingRequestCreate
from app.services.battery_service import BatteryService

class ChargingService:
    def __init__(self, db: Session):
        self.db = db
        self.battery_service = BatteryService(db)

    def calculate_priority_score(self, forklift: Forklift, battery_status: BatteryStatus) -> float:
        score = 0.0

        current_percent = battery_status.current_percent
        if current_percent < forklift.min_operating_percent:
            score += 100
        elif current_percent < 40:
            score += 60
        elif current_percent < 60:
            score += 30

        now = datetime.utcnow()
        upcoming_tasks = self.db.query(Task).filter(
            Task.forklift_id == forklift.id,
            Task.status == TaskStatus.PENDING,
            Task.scheduled_start_time > now,
            Task.scheduled_start_time <= now + timedelta(hours=8)
        ).all()

        for task in upcoming_tasks:
            if task.priority == TaskPriority.HIGH:
                deficit = max(0, task.required_battery_percent - current_percent)
                if deficit > 0:
                    score += 50
                    time_to_task = (task.scheduled_start_time - now).total_seconds() / 3600
                    if time_to_task < 2:
                        score += 30
            elif task.priority == TaskPriority.MEDIUM:
                deficit = max(0, task.required_battery_percent - current_percent)
                if deficit > 0:
                    score += 25

        if self._forklift_is_charging(forklift.id):
            score -= 200

        return score

    def _forklift_is_charging(self, forklift_id: int) -> bool:
        active_request = self.db.query(ChargingRequest).filter(
            ChargingRequest.forklift_id == forklift_id,
            ChargingRequest.status.in_([ChargingStatus.QUEUED, ChargingStatus.CHARGING])
        ).first()
        return active_request is not None

    def find_available_station(self, preferred_code: Optional[str] = None) -> Optional[ChargingStation]:
        if preferred_code:
            station = self.db.query(ChargingStation).filter(
                ChargingStation.station_code == preferred_code,
                ChargingStation.status == ChargingStationStatus.AVAILABLE
            ).first()
            if station:
                return station
            return None

        available_stations = self.db.query(ChargingStation).filter(
            ChargingStation.status == ChargingStationStatus.AVAILABLE
        ).order_by(ChargingStation.charging_power.desc()).all()

        return available_stations[0] if available_stations else None

    def validate_charging_request(self, data: ChargingRequestCreate) -> dict:
        errors = []

        forklift = self.db.query(Forklift).filter(
            Forklift.forklift_code == data.forklift_code
        ).first()

        if not forklift:
            errors.append({
                "field": "forklift_code",
                "code": "NOT_FOUND",
                "message": f"叉车 {data.forklift_code} 不存在"
            })
        else:
            if forklift.status != ForkliftStatus.ACTIVE:
                errors.append({
                    "field": "forklift_code",
                    "code": "INVALID_STATUS",
                    "message": f"叉车状态为 {forklift.status.value}，不允许充电"
                })

            if self._forklift_is_charging(forklift.id):
                errors.append({
                    "field": "forklift_code",
                    "code": "ALREADY_CHARGING",
                    "message": "该叉车已有活跃的充电请求"
                })

        if data.station_code:
            station = self.db.query(ChargingStation).filter(
                ChargingStation.station_code == data.station_code
            ).first()
            if not station:
                errors.append({
                    "field": "station_code",
                    "code": "NOT_FOUND",
                    "message": f"充电位 {data.station_code} 不存在"
                })
            elif station.status != ChargingStationStatus.AVAILABLE:
                errors.append({
                    "field": "station_code",
                    "code": "UNAVAILABLE",
                    "message": f"充电位状态为 {station.status.value}"
                })

        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "forklift": forklift
        }

    def create_charging_request(self, data: ChargingRequestCreate) -> dict:
        if data.request_idempotency_key:
            existing = self.db.query(ChargingRequest).filter(
                ChargingRequest.request_code == data.request_idempotency_key
            ).first()
            if existing:
                return {
                    "success": False,
                    "code": "DUPLICATE_REQUEST",
                    "message": "检测到重复提交",
                    "data": {"existing_request_id": existing.id, "request_code": existing.request_code}
                }

        validation = self.validate_charging_request(data)
        if not validation["valid"]:
            return {
                "success": False,
                "code": "VALIDATION_FAILED",
                "message": "请求验证失败",
                "errors": validation["errors"]
            }

        forklift = validation["forklift"]
        battery_status = self.db.query(BatteryStatus).filter(
            BatteryStatus.forklift_id == forklift.id
        ).first()

        if not battery_status:
            return {
                "success": False,
                "code": "BATTERY_NOT_FOUND",
                "message": "未找到电池状态记录"
            }

        if battery_status.current_percent >= data.target_percent:
            return {
                "success": False,
                "code": "ALREADY_CHARGED",
                "message": "当前电量已达到目标电量",
                "data": {
                    "current_percent": battery_status.current_percent,
                    "target_percent": data.target_percent
                }
            }

        request_code = data.request_idempotency_key or f"CR-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{forklift.forklift_code}"

        priority_score = self.calculate_priority_score(forklift, battery_status)

        station = self.find_available_station(data.station_code)

        if station:
            status = ChargingStatus.CHARGING
            queue_position = None
        else:
            status = ChargingStatus.QUEUED
            queue_position = self._get_next_queue_position()

        try:
            prediction = self.battery_service.predict_charging_time(
                forklift_code=forklift.forklift_code,
                current_percent=battery_status.current_percent,
                target_percent=data.target_percent,
                station_code=station.station_code if station else None
            )

            request = ChargingRequest(
                request_code=request_code,
                forklift_id=forklift.id,
                station_id=station.id if station else None,
                status=status,
                target_percent=data.target_percent,
                start_percent=battery_status.current_percent,
                queue_position=queue_position,
                priority_score=priority_score,
                estimated_completion_time=prediction.estimated_completion_time,
                request_source=data.request_source,
                queued_at=datetime.utcnow() if not station else None,
                charging_started_at=datetime.utcnow() if station else None
            )

            self.db.add(request)
            self.db.flush()

            if station:
                station.status = ChargingStationStatus.OCCUPIED
                station.current_forklift_id = forklift.id

                battery_status.last_charging_start = datetime.utcnow()
                battery_status.estimated_full_charge_time = prediction.estimated_completion_time

            else:
                queue_item = ChargingQueue(
                    request_id=request.id,
                    position=queue_position,
                    added_at=datetime.utcnow()
                )
                self.db.add(queue_item)

            self._log_audit("create", "charging_request", request.id, None, {
                "forklift_code": forklift.forklift_code,
                "status": status.value,
                "priority_score": priority_score
            })

            self.db.commit()

            response_data = {
                "id": request.id,
                "request_code": request.request_code,
                "forklift_id": request.forklift_id,
                "forklift_code": forklift.forklift_code,
                "station_id": request.station_id,
                "station_code": station.station_code if station else None,
                "status": request.status.value,
                "target_percent": request.target_percent,
                "start_percent": request.start_percent,
                "queue_position": request.queue_position,
                "priority_score": request.priority_score,
                "estimated_charging_hours": prediction.estimated_charging_hours,
                "estimated_completion_time": request.estimated_completion_time.isoformat() if request.estimated_completion_time else None
            }

            return {
                "success": True,
                "code": "CREATED",
                "message": "充电请求创建成功" if station else "充电请求已加入排队",
                "data": response_data
            }

        except Exception as e:
            self.db.rollback()
            return {
                "success": False,
                "code": "INTERNAL_ERROR",
                "message": f"创建充电请求失败: {str(e)}"
            }

    def _get_next_queue_position(self) -> int:
        max_pos = self.db.query(ChargingQueue.position).order_by(
            ChargingQueue.position.desc()
        ).first()
        return (max_pos[0] + 1) if max_pos else 1

    def _log_audit(self, action: str, entity_type: str, entity_id: int, old_value: any, new_value: any):
        audit = AuditLog(
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            old_value=str(old_value) if old_value else None,
            new_value=str(new_value) if new_value else None,
            operator="system"
        )
        self.db.add(audit)

    def get_queue_status(self) -> dict:
        queued_requests = self.db.query(ChargingRequest).filter(
            ChargingRequest.status == ChargingStatus.QUEUED
        ).order_by(ChargingRequest.priority_score.desc(), ChargingRequest.queued_at.asc()).all()

        available_stations = self.db.query(ChargingStation).filter(
            ChargingStation.status == ChargingStationStatus.AVAILABLE
        ).count()

        queue_list = []
        for idx, req in enumerate(queued_requests, 1):
            forklift = self.db.query(Forklift).filter(Forklift.id == req.forklift_id).first()
            queue_list.append({
                "position": idx,
                "request_id": req.id,
                "request_code": req.request_code,
                "forklift_code": forklift.forklift_code if forklift else None,
                "priority_score": req.priority_score,
                "start_percent": req.start_percent,
                "target_percent": req.target_percent,
                "queued_at": req.queued_at.isoformat() if req.queued_at else None
            })

        return {
            "total_queued": len(queued_requests),
            "available_stations": available_stations,
            "queue": queue_list
        }

    def complete_charging(self, request_id: int) -> dict:
        request = self.db.query(ChargingRequest).filter(
            ChargingRequest.id == request_id
        ).first()

        if not request:
            return {"success": False, "code": "NOT_FOUND", "message": "充电请求不存在"}

        if request.status not in [ChargingStatus.CHARGING, ChargingStatus.QUEUED]:
            return {
                "success": False,
                "code": "INVALID_STATUS",
                "message": f"当前状态为 {request.status.value}，无法完成充电"
            }

        battery_status = self.db.query(BatteryStatus).filter(
            BatteryStatus.forklift_id == request.forklift_id
        ).first()

        if battery_status:
            battery_status.current_percent = request.target_percent
            battery_status.last_charging_end = datetime.utcnow()
            battery_status.estimated_full_charge_time = None

        if request.station_id:
            station = self.db.query(ChargingStation).filter(
                ChargingStation.id == request.station_id
            ).first()
            if station:
                station.status = ChargingStationStatus.AVAILABLE
                station.current_forklift_id = None

        request.status = ChargingStatus.COMPLETED
        request.end_percent = request.target_percent
        request.charging_ended_at = datetime.utcnow()

        self._log_audit("complete", "charging_request", request.id, "CHARGING", "COMPLETED")

        self.db.commit()
        self._process_next_in_queue()

        return {
            "success": True,
            "code": "COMPLETED",
            "message": "充电完成",
            "data": {
                "request_id": request.id,
                "start_percent": request.start_percent,
                "end_percent": request.end_percent
            }
        }

    def _process_next_in_queue(self):
        available_stations = self.db.query(ChargingStation).filter(
            ChargingStation.status == ChargingStationStatus.AVAILABLE
        ).all()

        if not available_stations:
            return

        for station in available_stations:
            next_request = self.db.query(ChargingRequest).filter(
                ChargingRequest.status == ChargingStatus.QUEUED
            ).order_by(
                ChargingRequest.priority_score.desc(),
                ChargingRequest.queued_at.asc()
            ).first()

            if not next_request:
                break

            battery_status = self.db.query(BatteryStatus).filter(
                BatteryStatus.forklift_id == next_request.forklift_id
            ).first()

            try:
                prediction = self.battery_service.predict_charging_time(
                    forklift_code=self.db.query(Forklift).filter(
                        Forklift.id == next_request.forklift_id
                    ).first().forklift_code,
                    current_percent=battery_status.current_percent if battery_status else 50.0,
                    target_percent=next_request.target_percent,
                    station_code=station.station_code
                )

                station.status = ChargingStationStatus.OCCUPIED
                station.current_forklift_id = next_request.forklift_id

                old_queue_item = self.db.query(ChargingQueue).filter(
                    ChargingQueue.request_id == next_request.id
                ).first()
                if old_queue_item:
                    self.db.delete(old_queue_item)

                next_request.status = ChargingStatus.CHARGING
                next_request.station_id = station.id
                next_request.queue_position = None
                next_request.charging_started_at = datetime.utcnow()
                next_request.queued_at = None
                next_request.estimated_completion_time = prediction.estimated_completion_time

                if battery_status:
                    battery_status.last_charging_start = datetime.utcnow()
                    battery_status.estimated_full_charge_time = prediction.estimated_completion_time

                self._log_audit("assign_station", "charging_request", next_request.id, "QUEUED", "CHARGING")

            except Exception:
                continue

        self.db.commit()
