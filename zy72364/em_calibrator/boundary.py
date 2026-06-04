from typing import Optional, List
from .models import (
    TemperatureRecord, RecordStatus, SensorMapping, SafetyVerdict,
    ChangeType, ChangeHistory, STATUS_TRANSITIONS,
)
from .db import Database


class BoundaryViolation(Exception):
    pass


def check_sensor_restart_rule(
    db: Database,
    equipment_position: str,
    new_sensor_id: str,
) -> Optional[SensorMapping]:
    latest = db.get_latest_record_for_position(equipment_position)
    if latest is None:
        return None
    if latest.sensor_id != new_sensor_id:
        pending = db.get_pending_sensor_mappings()
        for sm in pending:
            if sm.equipment_position == equipment_position:
                return sm
        return SensorMapping(
            equipment_position=equipment_position,
            old_sensor_id=latest.sensor_id,
            new_sensor_id=new_sensor_id,
        )
    return None


def enforce_caliber_consistency(
    db: Database,
    equipment_position: str,
    new_caliber: str,
) -> Optional[str]:
    latest = db.get_latest_record_for_position(equipment_position)
    if latest is None:
        return None
    if latest.caliber != new_caliber:
        return (
            f"caliber mismatch for position {equipment_position}: "
            f"expected '{latest.caliber}', got '{new_caliber}'"
        )
    return None


def validate_transition(
    current_status: str,
    target_status: str,
) -> bool:
    allowed = STATUS_TRANSITIONS.get(current_status, [])
    return target_status in allowed


def check_duplicate_import(
    db: Database,
    batch_hash: str,
) -> bool:
    existing = db.get_batch_by_hash(batch_hash)
    return existing is not None


BOUNDARY_RULES = {
    "sensor_restart": {
        "description": "sensor restart detected when sensor_id changes for same equipment_position",
        "action": "flag as sensor_changed, do NOT auto-approve, must go through safety review",
        "rollback": "safety officer can reject, which reverts sensor_id to old value and returns to engineer_review",
    },
    "caliber_mismatch": {
        "description": "caliber field differs from previous record for same equipment_position",
        "action": "raise warning, engineer must confirm before proceeding",
        "rollback": "engineer can revert caliber to previous value",
    },
    "duplicate_import": {
        "description": "same batch_hash already exists in database",
        "action": "skip entirely, return existing batch_id with 0 new records",
        "rollback": "not applicable, no data is written",
    },
    "status_transition": {
        "description": "record status must follow STATUS_TRANSITIONS map",
        "action": "reject any transition not in allowed list",
        "rollback": "transition is simply not performed",
    },
}
