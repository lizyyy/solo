from __future__ import annotations
import uuid
from datetime import datetime
from typing import Any, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from ..models import (
    MaintenanceScreenshot,
    NameplateData,
    ReportExport,
    WaterHammerInput,
    WaterHammerResult,
)
from ..engine import run_calculation
from ..store import DataStore

data_store = DataStore("./wh_data")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class OverrideReasonRequest(BaseModel):
    reason: str
    reviewer: Optional[str] = None


class EngineerReviewRequest(BaseModel):
    approve: bool
    reviewer: str
    comments: str


class TrainerReviewRequest(BaseModel):
    reviewer: str
    comments: str


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/nameplates")
def create_nameplate(data: NameplateData) -> dict[str, Any]:
    data_store.save_nameplate(data)
    return {"equipment_id": data.equipment_id, "status": "saved"}


@app.get("/nameplates")
def list_nameplates() -> dict[str, list[str]]:
    return {"equipment_ids": data_store.list_nameplates()}


@app.get("/nameplates/{equipment_id}")
def get_nameplate(equipment_id: str) -> NameplateData:
    data = data_store.load_nameplate(equipment_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Nameplate not found")
    return data


@app.post("/screenshots")
def create_screenshot(data: MaintenanceScreenshot) -> dict[str, Any]:
    data_store.save_screenshot(data)
    return {"screenshot_id": data.screenshot_id, "status": "saved"}


@app.get("/screenshots")
def list_screenshots() -> dict[str, list[str]]:
    return {"screenshot_ids": data_store.list_screenshots()}


@app.post("/calculate")
def calculate(data: WaterHammerInput) -> dict[str, Any]:
    calc_id = str(uuid.uuid4())
    result = run_calculation(data)
    data_store.save_calculation(calc_id, data, result)
    return {"calc_id": calc_id, "result": result.model_dump(mode="json")}


@app.get("/calculations")
def list_calculations() -> dict[str, list[str]]:
    return {"calc_ids": data_store.list_calculations()}


@app.get("/calculations/{calc_id}")
def get_calculation(calc_id: str) -> dict[str, Any]:
    loaded = data_store.load_calculation(calc_id)
    if loaded is None:
        raise HTTPException(status_code=404, detail="Calculation not found")
    input_data, result = loaded
    return {
        "calc_id": calc_id,
        "input": input_data.model_dump(mode="json"),
        "result": result.model_dump(mode="json"),
    }


@app.get("/calculations/{calc_id}/replay")
def get_replay(calc_id: str) -> dict[str, Any]:
    loaded = data_store.load_calculation(calc_id)
    if loaded is None:
        raise HTTPException(status_code=404, detail="Calculation not found")
    input_data, result = loaded
    next_actions = []
    for entry in result.parameter_entries:
        if entry.next_action and entry.next_action not in next_actions:
            next_actions.append(entry.next_action)
    return {
        "calc_id": calc_id,
        "status": result.status.value,
        "classification": result.classification,
        "parameter_entries": [e.model_dump(mode="json") for e in result.parameter_entries],
        "override_flags": [f.model_dump(mode="json") for f in result.override_flags],
        "replay_narrative": result.replay_narrative,
        "change_history": [c.model_dump(mode="json") for c in result.change_history],
        "reviewed_by_engineer": result.reviewed_by_engineer,
        "reviewed_by_trainer": result.reviewed_by_trainer,
        "engineer_name": result.engineer_name,
        "trainer_name": result.trainer_name,
        "next_actions": next_actions,
    }


@app.patch("/calculations/{calc_id}/overrides/{param_name}")
def add_override_reason(calc_id: str, param_name: str, request: OverrideReasonRequest) -> dict[str, Any]:
    result = data_store.add_override_reason(calc_id, param_name, request.reason, request.reviewer)
    if result is None:
        raise HTTPException(status_code=404, detail="Calculation or parameter not found")
    return {"status": "updated", "result": result.model_dump(mode="json")}


@app.post("/calculations/{calc_id}/link-screenshot/{screenshot_id}")
def link_screenshot(calc_id: str, screenshot_id: str) -> dict[str, Any]:
    result = data_store.link_screenshot_to_parameters(screenshot_id, calc_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Calculation or screenshot not found")
    return {"status": "linked", "result": result.model_dump(mode="json")}


@app.patch("/calculations/{calc_id}/status/engineer-review")
def engineer_review(calc_id: str, request: EngineerReviewRequest) -> dict[str, Any]:
    result = data_store.review_by_engineer(calc_id, request.approve, request.reviewer, request.comments)
    if result is None:
        raise HTTPException(status_code=404, detail="Calculation not found")
    return {"status": "updated", "result": result.model_dump(mode="json")}


@app.patch("/calculations/{calc_id}/status/trainer-review")
def trainer_review(calc_id: str, request: TrainerReviewRequest) -> dict[str, Any]:
    result = data_store.review_by_trainer(calc_id, request.reviewer, request.comments)
    if result is None:
        raise HTTPException(status_code=404, detail="Calculation not found")
    return {"status": "updated", "result": result.model_dump(mode="json")}


@app.post("/calculations/{calc_id}/status/finalize")
def finalize_calc(calc_id: str) -> dict[str, Any]:
    result = data_store.finalize_calc(calc_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Calculation not found")
    return {"status": "finalized", "result": result.model_dump(mode="json")}


@app.get("/calculations/{calc_id}/history")
def get_history(calc_id: str) -> dict[str, Any]:
    loaded = data_store.load_calculation(calc_id)
    if loaded is None:
        raise HTTPException(status_code=404, detail="Calculation not found")
    _, result = loaded
    return {"change_history": [c.model_dump(mode="json") for c in result.change_history]}


@app.get("/calculations/{calc_id}/export")
def export_calc(calc_id: str) -> dict[str, Any]:
    export_result = data_store.export_report(calc_id)
    if export_result is None:
        raise HTTPException(status_code=404, detail="Calculation not found")
    report, file_path = export_result
    return {"report": report.model_dump(mode="json"), "file_path": file_path}


@app.post("/calculations/{calc_id}/refresh")
def refresh_calc(calc_id: str) -> dict[str, Any]:
    loaded = data_store.load_calculation(calc_id)
    if loaded is None:
        raise HTTPException(status_code=404, detail="Calculation not found")
    input_data, old_result = loaded
    preserved_status = old_result.status
    preserved_reviewed_by_engineer = old_result.reviewed_by_engineer
    preserved_reviewed_by_trainer = old_result.reviewed_by_trainer
    preserved_engineer_name = old_result.engineer_name
    preserved_trainer_name = old_result.trainer_name
    preserved_change_history = list(old_result.change_history)
    preserved_override_flags = list(old_result.override_flags)
    new_result = run_calculation(input_data)
    new_result.status = preserved_status
    new_result.reviewed_by_engineer = preserved_reviewed_by_engineer
    new_result.reviewed_by_trainer = preserved_reviewed_by_trainer
    new_result.engineer_name = preserved_engineer_name
    new_result.trainer_name = preserved_trainer_name
    new_result.change_history = preserved_change_history
    new_result.override_flags = preserved_override_flags
    data_store.save_calculation(calc_id, input_data, new_result)
    return {"status": "refreshed", "result": new_result.model_dump(mode="json")}
