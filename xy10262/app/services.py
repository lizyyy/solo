from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime
from app.models import VehicleQueue, TemperatureRecord, InspectionRecord
from app.schemas import (
    VehicleQueueCreate, TemperatureRecordCreate,
    TemperatureRecordManualUpdate, InspectionCreate, InspectionComplete
)
from app.constants import (
    QueueStatus, InspectionPriority, RiskLevel,
    QUEUE_STATUS_FLOW, FINAL_STATUSES, RISK_CARGO_TYPES
)
from app.exceptions import (
    DuplicateRecordException, InvalidStatusException,
    ResourceNotFoundException, ManualModificationException
)


def determine_risk_level(cargo_type: str) -> str:
    return RISK_CARGO_TYPES.get(cargo_type, RiskLevel.LOW.value).value


def calculate_inspection_priority(
    vehicle: VehicleQueue,
    abnormal_temp_count: int = 0
) -> str:
    priority_score = 0
    risk_order = {
        RiskLevel.LOW.value: 0,
        RiskLevel.MEDIUM.value: 1,
        RiskLevel.HIGH.value: 2,
        RiskLevel.CRITICAL.value: 3
    }
    priority_score += risk_order.get(vehicle.risk_level, 0) * 2
    if abnormal_temp_count >= 3:
        priority_score += 3
    elif abnormal_temp_count >= 1:
        priority_score += 2
    if priority_score >= 6:
        return InspectionPriority.HIGHEST.value
    elif priority_score >= 4:
        return InspectionPriority.HIGH.value
    elif priority_score >= 2:
        return InspectionPriority.NORMAL.value
    else:
        return InspectionPriority.LOW.value


def validate_temperature(temp: float, low: float, high: float) -> tuple[bool, Optional[str]]:
    if temp < low:
        return False, "温度过低"
    elif temp > high:
        return False, "温度过高"
    return True, None


def can_transition_status(current: str, target: str) -> bool:
    if current in [s.value for s in FINAL_STATUSES]:
        return False
    try:
        current_idx = QUEUE_STATUS_FLOW.index(QueueStatus(current))
        target_idx = QUEUE_STATUS_FLOW.index(QueueStatus(target))
        return target_idx >= current_idx
    except ValueError:
        return target in [s.value for s in FINAL_STATUSES]


class QueueService:
    def __init__(self, db: Session):
        self.db = db

    def get_next_queue_number(self) -> int:
        max_num = self.db.query(func.max(VehicleQueue.queue_number)).scalar()
        return (max_num or 0) + 1

    def enqueue_vehicle(self, data: VehicleQueueCreate) -> VehicleQueue:
        existing = self.db.query(VehicleQueue).filter(
            VehicleQueue.plate_number == data.plate_number,
            VehicleQueue.status.notin_([s.value for s in FINAL_STATUSES])
        ).first()
        if existing:
            raise DuplicateRecordException(
                f"车牌号 '{data.plate_number}' 已在排队中（排队号: {existing.queue_number}）",
                {"plate_number": data.plate_number, "queue_number": existing.queue_number}
            )
        queue_num = self.get_next_queue_number()
        risk_level = data.risk_level.value if data.risk_level else determine_risk_level(data.cargo_type)
        vehicle = VehicleQueue(
            plate_number=data.plate_number,
            queue_number=queue_num,
            cargo_type=data.cargo_type,
            risk_level=risk_level,
            target_temp_low=data.target_temp_low,
            target_temp_high=data.target_temp_high,
            inspection_priority=InspectionPriority.LOW.value,
            remark=data.remark
        )
        self.db.add(vehicle)
        self.db.commit()
        self.db.refresh(vehicle)
        return vehicle

    def get_queue_list(
        self,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        limit: int = 50
    ) -> List[VehicleQueue]:
        query = self.db.query(VehicleQueue)
        if status:
            query = query.filter(VehicleQueue.status == status)
        if priority:
            query = query.filter(VehicleQueue.inspection_priority == priority)
        from sqlalchemy import case
        priority_case = case(
            (VehicleQueue.inspection_priority == InspectionPriority.HIGHEST.value, 0),
            (VehicleQueue.inspection_priority == InspectionPriority.HIGH.value, 1),
            (VehicleQueue.inspection_priority == InspectionPriority.NORMAL.value, 2),
            (VehicleQueue.inspection_priority == InspectionPriority.LOW.value, 3),
            else_=4
        )
        return query.order_by(priority_case, VehicleQueue.queue_number).limit(limit).all()

    def get_vehicle(self, vehicle_id: int) -> VehicleQueue:
        vehicle = self.db.query(VehicleQueue).filter(VehicleQueue.id == vehicle_id).first()
        if not vehicle:
            raise ResourceNotFoundException("车辆", str(vehicle_id))
        return vehicle

    def get_vehicle_by_plate(self, plate_number: str) -> VehicleQueue:
        vehicle = self.db.query(VehicleQueue).filter(
            VehicleQueue.plate_number == plate_number
        ).first()
        if not vehicle:
            raise ResourceNotFoundException("车辆", plate_number)
        return vehicle

    def update_vehicle_status(
        self,
        vehicle_id: int,
        target_status: QueueStatus,
        remark: Optional[str] = None
    ) -> VehicleQueue:
        vehicle = self.get_vehicle(vehicle_id)
        if not can_transition_status(vehicle.status, target_status.value):
            raise InvalidStatusException(
                vehicle.status,
                [s.value for s in QUEUE_STATUS_FLOW] + [s.value for s in FINAL_STATUSES]
            )
        vehicle.status = target_status.value
        if target_status in FINAL_STATUSES:
            vehicle.exit_time = datetime.utcnow()
        if remark:
            vehicle.remark = (vehicle.remark or "") + ("\n" if vehicle.remark else "") + remark
        self.db.commit()
        self.db.refresh(vehicle)
        return vehicle

    def refresh_priority(self, vehicle_id: int) -> VehicleQueue:
        vehicle = self.get_vehicle(vehicle_id)
        abnormal_count = self.db.query(TemperatureRecord).filter(
            TemperatureRecord.vehicle_id == vehicle.id,
            TemperatureRecord.is_normal == False
        ).count()
        vehicle.inspection_priority = calculate_inspection_priority(vehicle, abnormal_count)
        self.db.commit()
        self.db.refresh(vehicle)
        return vehicle


class TemperatureService:
    def __init__(self, db: Session):
        self.db = db
        self.queue_service = QueueService(db)

    def check_duplicate_record(
        self,
        vehicle_id: int,
        record_time: datetime
    ) -> bool:
        existing = self.db.query(TemperatureRecord).filter(
            TemperatureRecord.vehicle_id == vehicle_id,
            TemperatureRecord.record_time == record_time
        ).first()
        return existing is not None

    def add_temperature(self, data: TemperatureRecordCreate) -> TemperatureRecord:
        vehicle = self.queue_service.get_vehicle(data.vehicle_id)
        if self.check_duplicate_record(data.vehicle_id, data.record_time):
            raise DuplicateRecordException(
                f"同一时间点的温度记录已存在（车辆ID: {data.vehicle_id}, 时间: {data.record_time}）",
                {"vehicle_id": data.vehicle_id, "record_time": data.record_time.isoformat()}
            )
        is_normal, anomaly_type = validate_temperature(
            data.temperature,
            vehicle.target_temp_low,
            vehicle.target_temp_high
        )
        record = TemperatureRecord(
            vehicle_id=data.vehicle_id,
            temperature=data.temperature,
            record_time=data.record_time,
            is_normal=is_normal,
            anomaly_type=anomaly_type,
            remark=data.remark
        )
        self.db.add(record)
        self.db.commit()
        self.db.refresh(record)
        self.queue_service.refresh_priority(data.vehicle_id)
        return record

    def get_vehicle_temperatures(self, vehicle_id: int) -> List[TemperatureRecord]:
        return self.db.query(TemperatureRecord).filter(
            TemperatureRecord.vehicle_id == vehicle_id
        ).order_by(TemperatureRecord.record_time).all()

    def manual_update_temperature(
        self,
        record_id: int,
        data: TemperatureRecordManualUpdate
    ) -> TemperatureRecord:
        record = self.db.query(TemperatureRecord).filter(
            TemperatureRecord.id == record_id
        ).first()
        if not record:
            raise ResourceNotFoundException("温度记录", str(record_id))
        if record.is_manual_modified:
            raise ManualModificationException(
                "该温度记录已被修改过，不允许再次修改",
                {"record_id": record_id, "last_modified_by": record.modified_by}
            )
        vehicle = self.queue_service.get_vehicle(record.vehicle_id)
        is_normal, anomaly_type = validate_temperature(
            data.new_temperature,
            vehicle.target_temp_low,
            vehicle.target_temp_high
        )
        record.original_temperature = record.temperature
        record.temperature = data.new_temperature
        record.is_normal = is_normal
        record.anomaly_type = anomaly_type
        record.is_manual_modified = True
        record.modified_by = data.modified_by
        record.remark = (record.remark or "") + ("\n" if record.remark else "") + \
            f"人工修改: 原因={data.reason}, 原温度={record.original_temperature}℃"
        self.db.commit()
        self.db.refresh(record)
        self.queue_service.refresh_priority(record.vehicle_id)
        return record


class InspectionService:
    def __init__(self, db: Session):
        self.db = db
        self.queue_service = QueueService(db)

    def start_inspection(self, data: InspectionCreate) -> InspectionRecord:
        vehicle = self.queue_service.get_vehicle(data.vehicle_id)
        if vehicle.status not in [QueueStatus.WAITING.value, QueueStatus.INSPECTION_PENDING.value]:
            raise InvalidStatusException(
                vehicle.status,
                [QueueStatus.WAITING.value, QueueStatus.INSPECTION_PENDING.value],
                f"车辆状态不允许开始查验，当前状态: {vehicle.status}"
            )
        inspection = InspectionRecord(
            vehicle_id=data.vehicle_id,
            inspector=data.inspector,
            started_at=datetime.utcnow()
        )
        self.db.add(inspection)
        vehicle.status = QueueStatus.INSPECTING.value
        self.db.commit()
        self.db.refresh(inspection)
        self.db.refresh(vehicle)
        return inspection

    def complete_inspection(
        self,
        inspection_id: int,
        data: InspectionComplete
    ) -> tuple[InspectionRecord, VehicleQueue]:
        inspection = self.db.query(InspectionRecord).filter(
            InspectionRecord.id == inspection_id
        ).first()
        if not inspection:
            raise ResourceNotFoundException("查验记录", str(inspection_id))
        if inspection.completed_at:
            raise InvalidStatusException(
                "已完成",
                ["进行中"],
                "该查验已完成，不可重复提交"
            )
        vehicle = self.queue_service.get_vehicle(inspection.vehicle_id)
        inspection.inspection_result = data.inspection_result
        inspection.issues_found = data.issues_found
        inspection.check_points = data.check_points
        inspection.completed_at = datetime.utcnow()
        if data.inspection_result.lower() == "passed":
            target_status = QueueStatus.PASSED
        else:
            target_status = QueueStatus.DETAINED
        vehicle.status = target_status.value
        vehicle.exit_time = datetime.utcnow()
        self.db.commit()
        self.db.refresh(inspection)
        self.db.refresh(vehicle)
        return inspection, vehicle

    def get_vehicle_inspections(self, vehicle_id: int) -> List[InspectionRecord]:
        return self.db.query(InspectionRecord).filter(
            InspectionRecord.vehicle_id == vehicle_id
        ).order_by(InspectionRecord.created_at.desc()).all()
