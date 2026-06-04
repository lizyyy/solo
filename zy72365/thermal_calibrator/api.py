from __future__ import annotations

import os
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from thermal_calibrator.models.calibration_record import TemperatureUnit
from thermal_calibrator.store.result_store import ResultStore
from thermal_calibrator.workflow.engine import CalibrationWorkflow


app = FastAPI(title="热像仪温差校准")

STORE_DIR = os.environ.get("CALIBRATOR_STORE_DIR", "/tmp/thermal_calibrator_store")
_store = ResultStore(STORE_DIR)
_workflow = CalibrationWorkflow(_store)


class ImportRequest(BaseModel):
    record_id: str
    device_name: str
    raw_lines: list


class EngineerReviewRequest(BaseModel):
    record_id: str
    engineer_name: str
    notes: Optional[str] = None


class CoachResolveRequest(BaseModel):
    record_id: str
    conflict_line_number: int
    resolved_value: float
    resolved_unit: str
    coach_name: str
    coach_note: str


class RollbackRequest(BaseModel):
    record_id: str
    conflict_line_number: int
    operator_name: str


class HandoverUpdateRequest(BaseModel):
    record_id: str
    operator_name: str


@app.post("/calibration/import")
def api_import(req):
    record = _workflow.step_import(req.record_id, req.device_name, req.raw_lines)
    return record.to_dict()


@app.post("/calibration/engineer-review")
def api_engineer_review(req):
    try:
        record = _workflow.step_engineer_review(
            req.record_id, req.engineer_name, req.notes
        )
        return record.to_dict()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/calibration/coach-resolve")
def api_coach_resolve(req):
    try:
        unit = TemperatureUnit(req.resolved_unit)
        record = _workflow.step_coach_resolve_conflict(
            req.record_id,
            req.conflict_line_number,
            req.resolved_value,
            unit,
            req.coach_name,
            req.coach_note,
        )
        return record.to_dict()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/calibration/rollback")
def api_rollback(req):
    try:
        record = _workflow.step_rollback_conflict(
            req.record_id, req.conflict_line_number, req.operator_name
        )
        return record.to_dict()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/calibration/handover-update")
def api_handover_update(req):
    try:
        record = _workflow.step_handover_update(req.record_id, req.operator_name)
        return record.to_dict()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/calibration/{record_id}/full")
def api_get_full(record_id):
    result = _store.get_full_result(record_id)
    if result is None:
        raise HTTPException(status_code=404, detail="记录不存在")
    return result


@app.get("/calibration/{record_id}/summary")
def api_get_summary(record_id):
    result = _store.get_summary(record_id)
    if result is None:
        raise HTTPException(status_code=404, detail="记录不存在")
    return result


@app.get("/calibration/{record_id}/export")
def api_export_detail(record_id):
    detail = _store.export_detail(record_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="记录不存在")
    return {"record_id": record_id, "detail_json": detail}


@app.get("/calibration/list")
def api_list():
    return {"record_ids": _store.list_records()}
