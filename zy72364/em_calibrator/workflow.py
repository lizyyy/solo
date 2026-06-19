import datetime
from typing import Optional, List
from .models import (
    TemperatureRecord, RecordStatus, ChangeType, ChangeHistory,
    WorkflowLog, SensorMapping, SafetyVerdict, STATUS_TRANSITIONS,
)
from .db import Database


class TransitionError(Exception):
    pass


def advance_status(db: Database, record_id: int, operator: str, note: str = "") -> TemperatureRecord:
    rec = db.get_record(record_id)
    if rec is None:
        raise ValueError(f"Record {record_id} not found")
    allowed = STATUS_TRANSITIONS.get(rec.status, [])
    if not allowed:
        raise TransitionError(f"no allowed transition from status '{rec.status}'")
    new_status = allowed[0]
    wl = WorkflowLog(
        record_id=record_id,
        from_status=rec.status,
        to_status=new_status,
        operator=operator,
        note=note,
    )
    db.insert_workflow_log(wl)
    ch = ChangeHistory(
        record_id=record_id,
        change_type=ChangeType.STATUS_CHANGE.value,
        field_name="status",
        old_value=rec.status,
        new_value=new_status,
        changed_by=operator,
        reason=note,
    )
    db.insert_change_history(ch)
    rec.status = new_status
    rec.updated_at = datetime.datetime.now().isoformat()
    db.update_record(rec)
    return rec


def engineer_review(db: Database, record_id: int, operator: str, note: str = "") -> TemperatureRecord:
    rec = db.get_record(record_id)
    if rec is None:
        raise ValueError(f"Record {record_id} not found")
    if rec.status not in (RecordStatus.IMPORTED.value, RecordStatus.ENGINEER_REVIEW.value):
        raise TransitionError(f"engineer review requires IMPORTED or ENGINEER_REVIEW status, got '{rec.status}'")
    if rec.status != RecordStatus.IMPORTED.value:
        return advance_status(db, record_id, operator, note or "engineer review passed")
    latest = db.get_previous_record_for_position(rec.equipment_position, rec.id)
    if latest and latest.sensor_id != rec.sensor_id:
        sm = SensorMapping(
            equipment_position=rec.equipment_position,
            old_sensor_id=latest.sensor_id,
            new_sensor_id=rec.sensor_id,
        )
        db.insert_sensor_mapping(sm)
        wl = WorkflowLog(
            record_id=record_id,
            from_status=rec.status,
            to_status=RecordStatus.SENSOR_CHANGED.value,
            operator=operator,
            note=f"sensor changed: {latest.sensor_id} -> {rec.sensor_id}",
        )
        db.insert_workflow_log(wl)
        ch = ChangeHistory(
            record_id=record_id,
            change_type=ChangeType.SENSOR_REMAP.value,
            field_name="sensor_id",
            old_value=latest.sensor_id,
            new_value=rec.sensor_id,
            changed_by=operator,
            reason="sensor id changed after restart, flagged for safety review",
        )
        db.insert_change_history(ch)
        rec.status = RecordStatus.SENSOR_CHANGED.value
        rec.updated_at = datetime.datetime.now().isoformat()
        db.update_record(rec)
        return rec
    rec = advance_status(db, record_id, operator, note or "engineer review passed")
    if rec.status == RecordStatus.ENGINEER_REVIEW.value:
        rec = advance_status(db, record_id, operator, note or "engineer review passed")
    return rec


def safety_review(db: Database, record_id: int, operator: str, approve: bool, note: str = "") -> TemperatureRecord:
    rec = db.get_record(record_id)
    if rec is None:
        raise ValueError(f"Record {record_id} not found")
    if rec.status not in (RecordStatus.SAFETY_REVIEW.value, RecordStatus.SENSOR_CHANGED.value):
        raise TransitionError(
            f"safety review requires SAFETY_REVIEW or SENSOR_CHANGED status, got '{rec.status}'"
        )

    if rec.status == RecordStatus.SENSOR_CHANGED.value:
        pending_mappings = db.get_pending_sensor_mappings()
        target_mapping = None
        for sm in pending_mappings:
            if sm.equipment_position == rec.equipment_position:
                target_mapping = sm
                break

        if approve:
            if target_mapping:
                db.update_sensor_mapping_verdict(
                    target_mapping.id, SafetyVerdict.APPROVED.value, operator
                )
            rec = advance_status(db, record_id, operator, note or "safety review approved after sensor change")
            if rec.status == RecordStatus.SAFETY_REVIEW.value:
                rec = advance_status(db, record_id, operator, note or "safety review approved after sensor change")
            return rec
        else:
            if target_mapping:
                db.update_sensor_mapping_verdict(
                    target_mapping.id, SafetyVerdict.REJECTED.value, operator
                )
                old_sensor = target_mapping.old_sensor_id
                ch = ChangeHistory(
                    record_id=record_id,
                    change_type=ChangeType.ROLLBACK.value,
                    field_name="sensor_id",
                    old_value=rec.sensor_id,
                    new_value=old_sensor,
                    changed_by=operator,
                    reason="safety officer rejected sensor change, rolled back",
                )
                db.insert_change_history(ch)
                rec.sensor_id = old_sensor
            rec.status = RecordStatus.ENGINEER_REVIEW.value
            rec.updated_at = datetime.datetime.now().isoformat()
            db.update_record(rec)
            wl = WorkflowLog(
                record_id=record_id,
                from_status=RecordStatus.SENSOR_CHANGED.value,
                to_status=RecordStatus.ENGINEER_REVIEW.value,
                operator=operator,
                note="rolled back sensor change after safety rejection",
            )
            db.insert_workflow_log(wl)
            return rec

    if approve:
        return advance_status(db, record_id, operator, note or "safety review approved")

    wl = WorkflowLog(
        record_id=record_id,
        from_status=rec.status,
        to_status=RecordStatus.ENGINEER_REVIEW.value,
        operator=operator,
        note=note or "safety review rejected, returning to engineer review",
    )
    db.insert_workflow_log(wl)
    ch = ChangeHistory(
        record_id=record_id,
        change_type=ChangeType.STATUS_CHANGE.value,
        field_name="status",
        old_value=rec.status,
        new_value=RecordStatus.ENGINEER_REVIEW.value,
        changed_by=operator,
        reason="safety review rejected",
    )
    db.insert_change_history(ch)
    rec.status = RecordStatus.ENGINEER_REVIEW.value
    rec.updated_at = datetime.datetime.now().isoformat()
    db.update_record(rec)
    return rec


def rollback_to_engineer_review(db: Database, record_id: int, operator: str, reason: str = "") -> TemperatureRecord:
    rec = db.get_record(record_id)
    if rec is None:
        raise ValueError(f"Record {record_id} not found")
    old_status = rec.status
    wl = WorkflowLog(
        record_id=record_id,
        from_status=old_status,
        to_status=RecordStatus.ENGINEER_REVIEW.value,
        operator=operator,
        note=reason or "manual rollback to engineer review",
    )
    db.insert_workflow_log(wl)
    ch = ChangeHistory(
        record_id=record_id,
        change_type=ChangeType.ROLLBACK.value,
        field_name="status",
        old_value=old_status,
        new_value=RecordStatus.ENGINEER_REVIEW.value,
        changed_by=operator,
        reason=reason or "manual rollback",
    )
    db.insert_change_history(ch)
    rec.status = RecordStatus.ENGINEER_REVIEW.value
    rec.updated_at = datetime.datetime.now().isoformat()
    db.update_record(rec)
    return rec


def get_full_audit_trail(db: Database, record_id: int) -> dict:
    rec = db.get_record(record_id)
    if rec is None:
        return {}
    history = db.get_change_history(record_id)
    workflow = db.get_workflow_log(record_id)
    return {
        "record": rec,
        "change_history": history,
        "workflow_log": workflow,
    }


def validate_transition(current_status: str, target_status: str) -> bool:
    allowed = STATUS_TRANSITIONS.get(current_status, [])
    return target_status in allowed
