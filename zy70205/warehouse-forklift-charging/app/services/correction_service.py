from datetime import datetime
from sqlalchemy.orm import Session
from typing import Dict, Any

from app.models.models import (
    Forklift, ForkliftStatus, ChargingStation, ChargingStationStatus,
    BatteryStatus, Task, ChargingRequest, ChargingStatus, AuditLog
)
from app.schemas.schemas import ManualCorrectionRequest

class CorrectionService:
    def __init__(self, db: Session):
        self.db = db

    ALLOWED_ENTITY_TYPES = {
        "forklift": Forklift,
        "station": ChargingStation,
        "battery": BatteryStatus,
        "task": Task,
        "request": ChargingRequest
    }

    ALLOWED_FIELDS = {
        "forklift": ["name", "status", "min_operating_percent", "charging_rate"],
        "station": ["name", "status", "charging_power"],
        "battery": ["current_percent", "health_percent"],
        "task": ["priority", "status", "required_battery_percent", "scheduled_start_time", "scheduled_end_time"],
        "request": ["status", "target_percent", "request_source"]
    }

    FIELD_TYPES = {
        "forklift": {
            "status": ForkliftStatus,
            "min_operating_percent": float,
            "charging_rate": float
        },
        "station": {
            "status": ChargingStationStatus,
            "charging_power": float
        },
        "battery": {
            "current_percent": float,
            "health_percent": float
        },
        "task": {
            "priority": None,
            "status": None,
            "required_battery_percent": float,
            "scheduled_start_time": datetime,
            "scheduled_end_time": datetime
        },
        "request": {
            "status": ChargingStatus,
            "target_percent": float
        }
    }

    def validate_correction(self, request: ManualCorrectionRequest) -> Dict[str, Any]:
        errors = []

        if request.entity_type not in self.ALLOWED_ENTITY_TYPES:
            errors.append({
                "field": "entity_type",
                "code": "INVALID_TYPE",
                "message": f"不支持的实体类型: {request.entity_type}"
            })
            return {"valid": False, "errors": errors}

        ModelClass = self.ALLOWED_ENTITY_TYPES[request.entity_type]
        entity = self.db.query(ModelClass).filter(ModelClass.id == request.entity_id).first()

        if not entity:
            errors.append({
                "field": "entity_id",
                "code": "NOT_FOUND",
                "message": f"{request.entity_type} ID {request.entity_id} 不存在"
            })
            return {"valid": False, "errors": errors}

        allowed_fields = self.ALLOWED_FIELDS.get(request.entity_type, [])
        if request.field_name not in allowed_fields:
            errors.append({
                "field": "field_name",
                "code": "INVALID_FIELD",
                "message": f"不允许修改字段: {request.field_name}"
            })

        current_value = getattr(entity, request.field_name, None)
        current_str = str(current_value) if current_value is not None else ""

        if request.old_value != current_str:
            errors.append({
                "field": "old_value",
                "code": "VALUE_MISMATCH",
                "message": f"原始值不匹配。期望: {current_str}, 提供: {request.old_value}"
            })

        try:
            typed_new_value = self._convert_value(
                request.entity_type, request.field_name, request.new_value
            )
        except Exception as e:
            errors.append({
                "field": "new_value",
                "code": "INVALID_FORMAT",
                "message": f"新值格式错误: {str(e)}"
            })
            typed_new_value = None

        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "entity": entity,
            "typed_new_value": typed_new_value,
            "current_value": current_value
        }

    def _convert_value(self, entity_type: str, field_name: str, value: str) -> Any:
        type_map = self.FIELD_TYPES.get(entity_type, {})
        expected_type = type_map.get(field_name)

        if expected_type is None:
            return value

        if isinstance(expected_type, type) and issubclass(expected_type, str):
            return value

        if expected_type == float:
            return float(value)

        if expected_type == int:
            return int(value)

        if expected_type == datetime:
            return datetime.fromisoformat(value.replace('Z', '+00:00'))

        if hasattr(expected_type, '__members__'):
            return expected_type(value)

        return value

    def apply_correction(self, request: ManualCorrectionRequest) -> Dict[str, Any]:
        validation = self.validate_correction(request)

        if not validation["valid"]:
            return {
                "success": False,
                "code": "VALIDATION_FAILED",
                "message": "修正验证失败",
                "errors": validation["errors"]
            }

        entity = validation["entity"]
        old_value = validation["current_value"]
        new_value = validation["typed_new_value"]

        flow_validation = self._validate_state_transition(
            request.entity_type, request.field_name, old_value, new_value
        )

        if not flow_validation["valid"]:
            return {
                "success": False,
                "code": "INVALID_TRANSITION",
                "message": "非法状态流转",
                "errors": flow_validation["errors"]
            }

        try:
            setattr(entity, request.field_name, new_value)

            audit = AuditLog(
                action="manual_correction",
                entity_type=request.entity_type,
                entity_id=request.entity_id,
                old_value=str(old_value) if old_value is not None else "",
                new_value=str(new_value) if new_value is not None else "",
                operator=request.operator,
                description=request.reason
            )
            self.db.add(audit)
            self.db.commit()

            return {
                "success": True,
                "code": "CORRECTED",
                "message": "人工修正已应用",
                "data": {
                    "entity_type": request.entity_type,
                    "entity_id": request.entity_id,
                    "field_name": request.field_name,
                    "old_value": str(old_value),
                    "new_value": str(new_value),
                    "correction_time": datetime.utcnow().isoformat()
                }
            }

        except Exception as e:
            self.db.rollback()
            return {
                "success": False,
                "code": "INTERNAL_ERROR",
                "message": f"修正失败: {str(e)}"
            }

    def _validate_state_transition(self, entity_type: str, field_name: str, old_value: Any, new_value: Any) -> Dict[str, Any]:
        errors = []

        if entity_type == "request" and field_name == "status":
            valid_transitions = {
                ChargingStatus.PENDING: [ChargingStatus.QUEUED, ChargingStatus.CANCELLED],
                ChargingStatus.QUEUED: [ChargingStatus.CHARGING, ChargingStatus.CANCELLED],
                ChargingStatus.CHARGING: [ChargingStatus.COMPLETED, ChargingStatus.CANCELLED, ChargingStatus.FAILED],
                ChargingStatus.COMPLETED: [],
                ChargingStatus.CANCELLED: [],
                ChargingStatus.FAILED: [ChargingStatus.QUEUED, ChargingStatus.PENDING]
            }

            allowed = valid_transitions.get(old_value, [])
            if new_value not in allowed:
                errors.append({
                    "field": "status",
                    "code": "INVALID_TRANSITION",
                    "message": f"不允许从 {old_value.value if hasattr(old_value, 'value') else old_value} 转换到 {new_value.value if hasattr(new_value, 'value') else new_value}"
                })

        if entity_type == "battery" and field_name == "current_percent":
            if new_value < 0 or new_value > 100:
                errors.append({
                    "field": "current_percent",
                    "code": "OUT_OF_RANGE",
                    "message": "电量必须在 0-100 之间"
                })

        if entity_type == "station" and field_name == "status":
            pass

        return {"valid": len(errors) == 0, "errors": errors}

    def get_correction_history(self, entity_type: str = None, entity_id: int = None) -> list:
        query = self.db.query(AuditLog).filter(AuditLog.action == "manual_correction")

        if entity_type:
            query = query.filter(AuditLog.entity_type == entity_type)
        if entity_id:
            query = query.filter(AuditLog.entity_id == entity_id)

        logs = query.order_by(AuditLog.timestamp.desc()).all()

        return [
            {
                "id": log.id,
                "action": log.action,
                "entity_type": log.entity_type,
                "entity_id": log.entity_id,
                "old_value": log.old_value,
                "new_value": log.new_value,
                "operator": log.operator,
                "timestamp": log.timestamp.isoformat(),
                "reason": log.description
            }
            for log in logs
        ]
