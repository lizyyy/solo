from __future__ import annotations

import json
import os
from typing import Optional

from fastapi import FastAPI, HTTPException, Body
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from thermal_calibrator.models.calibration_record import TemperatureUnit
from thermal_calibrator.store.result_store import ResultStore
from thermal_calibrator.workflow.engine import CalibrationWorkflow


app = FastAPI(title="热像仪温差校准", version="1.0.0")

STORE_DIR = os.environ.get("CALIBRATOR_STORE_DIR", "/tmp/thermal_calibrator_store")
_store = ResultStore(STORE_DIR)
_workflow = CalibrationWorkflow(_store)


class ImportRequest(BaseModel):
    record_id: str = Field(..., description="校准记录唯一ID，如 FLIR-A300-20260609")
    device_name: str = Field(..., description="热像仪设备型号，如 FLIR-A300")
    raw_lines: list = Field(..., description="原始采样间隔说明与温度读数，按原始文件逐行")

    model_config = {
        "json_schema_extra": {
            "example": {
                "record_id": "FLIR-A300-20260609-01",
                "device_name": "FLIR-A300",
                "raw_lines": [
                    "采样间隔 5s",
                    "25.3 °C",
                    "298.15 K °C",
                ],
            }
        }
    }


class EngineerReviewRequest(BaseModel):
    record_id: str = Field(..., description="校准记录ID")
    engineer_name: str = Field(..., description="设备工程师姓名，如何工")
    notes: Optional[str] = Field(default=None, description="工程师补看备注")


class CoachResolveRequest(BaseModel):
    record_id: str = Field(..., description="校准记录ID")
    conflict_line_number: int = Field(..., description="冲突所在的原始行号")
    resolved_value: float = Field(..., description="教练确认后的数值")
    resolved_unit: str = Field(..., description="教练确认后的单位：celsius 或 kelvin")
    coach_name: str = Field(..., description="训练教练姓名")
    coach_note: str = Field(..., description="教练判定理由，留作审计")


class RollbackRequest(BaseModel):
    record_id: str = Field(..., description="校准记录ID")
    conflict_line_number: int = Field(..., description="冲突所在的原始行号")
    operator_name: str = Field(..., description="操作人姓名")


class HandoverUpdateRequest(BaseModel):
    record_id: str = Field(..., description="校准记录ID")
    operator_name: str = Field(..., description="操作人姓名")


_STATUS_EXPLANATION = {
    "imported": "第一步完成：采样间隔说明已导入，待设备工程师补看温度校准记录",
    "pending_coach_review": "检测到摄氏度/开尔文混用，数值两边都合理，留待训练教练复核后才能更新交接报告",
    "reviewed_by_engineer": "第二步完成：设备工程师已补看，无单位冲突待交接报告更新",
    "coach_confirmed": "训练教练已拍板所有混用单位，可进入第三步更新交接报告",
    "rolled_back": "教练判断被回滚，回到待教练复核，交接报告同步回退到回滚前版本",
}

_ACTION_EXPLANATION = {
    "keep_original": "单位标识单一，无冲突，直接保留原始文本与数值",
    "auto_convert_kelvin_to_celsius": "按热像仪量程（-40℃~2000℃）判断：按开尔文合理、按摄氏度超量程，自动换算为摄氏度",
    "coach_resolved": "训练教练拍板确认（见 coach_review_note）",
    "pending_coach_review": "摄氏度/开尔文同时出现，数值两边都说得通，不能自动判，等教练拍板",
    "rolled_back": "已回滚到原始判定状态，等待教练重新复核",
}


def _enrich(result: dict) -> dict:
    s = result.get("status", "")
    result["status_explanation"] = _STATUS_EXPLANATION.get(s, s)

    conflicts = result.get("unit_conflicts", [])
    for uc in conflicts:
        a = uc.get("action_taken", "")
        uc["action_explanation"] = _ACTION_EXPLANATION.get(a, a)

    pending = result.get("pending_coach_review_count")
    if pending is None:
        pending = sum(1 for uc in conflicts if uc.get("needs_coach_review"))
        result["pending_coach_review_count"] = pending

    if pending > 0:
        result["handover_blocked_reason"] = (
            f"还有{pending}条摄氏度/开尔文混用记录等待训练教练拍板，"
            "拍板完成后交接报告才能更新。"
        )
        result["handover_ready"] = False
    elif s in ("reviewed_by_engineer", "coach_confirmed"):
        result["handover_ready"] = True
        result["handover_blocked_reason"] = ""
    else:
        result["handover_ready"] = False
        result["handover_blocked_reason"] = result.get("handover_blocked_reason", "")

    result["consistency_note"] = (
        "导出明细（/export）、页面展示（/full）、接口汇总（/summary）均读取 ResultStore 中同一份 JSON，"
        "状态、单位冲突判定、采样间隔、温度读数三端完全一致。"
    )
    return result


@app.post("/calibration/import", summary="第一步：采样间隔说明导入（保留原始行号、自动检测混用单位）")
def api_import(req: ImportRequest = Body(..., embed=False)) -> dict:
    record = _workflow.step_import(req.record_id, req.device_name, req.raw_lines)
    return _enrich(record.to_dict())


@app.post("/calibration/engineer-review", summary="第二步：设备工程师何工补看温度校准记录")
def api_engineer_review(req: EngineerReviewRequest = Body(..., embed=False)) -> dict:
    try:
        record = _workflow.step_engineer_review(
            req.record_id, req.engineer_name, req.notes
        )
        return _enrich(record.to_dict())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/calibration/coach-resolve", summary="训练教练拍板混用单位：必须填数值+单位+判定理由")
def api_coach_resolve(req: CoachResolveRequest = Body(..., embed=False)) -> dict:
    try:
        unit = TemperatureUnit(req.resolved_unit.lower())
        record = _workflow.step_coach_resolve_conflict(
            req.record_id,
            req.conflict_line_number,
            req.resolved_value,
            unit,
            req.coach_name,
            req.coach_note,
        )
        return _enrich(record.to_dict())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/calibration/rollback", summary="回滚：采样间隔、温度读数、交接报告版本一并恢复到回滚前")
def api_rollback(req: RollbackRequest = Body(..., embed=False)) -> dict:
    try:
        record = _workflow.step_rollback_conflict(
            req.record_id, req.conflict_line_number, req.operator_name
        )
        return _enrich(record.to_dict())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/calibration/handover-update", summary="第三步：交接报告更新（所有混用单位拍板后才允许）")
def api_handover_update(req: HandoverUpdateRequest = Body(..., embed=False)) -> dict:
    try:
        record = _workflow.step_handover_update(req.record_id, req.operator_name)
        return _enrich(record.to_dict())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/calibration/list", summary="列出所有校准记录ID")
def api_list() -> dict:
    return {"record_ids": _store.list_records()}


@app.get("/calibration/{record_id}/summary", summary="温度校准记录概览（汇总数）")
def api_get_summary(record_id: str) -> dict:
    result = _store.get_summary(record_id)
    if result is None:
        raise HTTPException(status_code=404, detail="记录不存在")
    return _enrich(result)


@app.get("/calibration/{record_id}/full", summary="温度校准记录完整明细（页面展示用）")
def api_get_full(record_id: str) -> dict:
    result = _store.get_full_result(record_id)
    if result is None:
        raise HTTPException(status_code=404, detail="记录不存在")
    return _enrich(result)


@app.get("/calibration/{record_id}/export", summary="导出明细（与页面展示、接口返回同一份数据）")
def api_export_detail(record_id: str):
    detail = _store.export_detail(record_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="记录不存在")
    parsed = json.loads(detail)
    enriched = _enrich(parsed)
    return JSONResponse(
        content=enriched,
        media_type="application/json; charset=utf-8",
        headers={
            "Content-Disposition": f"attachment; filename={record_id}_calibration_detail.json",
            "X-Consistency-Guarantee": "Same payload as /calibration/{record_id}/full and /calibration/{record_id}/summary",
        },
    )
