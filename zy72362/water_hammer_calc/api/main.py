from __future__ import annotations
import uuid
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ..models import (
    MaintenanceScreenshot,
    NameplateData,
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
    return {
        "parameter_entries": [e.model_dump(mode="json") for e in result.parameter_entries],
        "override_flags": [f.model_dump(mode="json") for f in result.override_flags],
        "replay_narrative": result.replay_narrative,
    }


@app.patch("/calculations/{calc_id}/overrides/{param_name}")
def add_override_reason(calc_id: str, param_name: str, request: OverrideReasonRequest) -> dict[str, Any]:
    result = data_store.add_override_reason(calc_id, param_name, request.reason)
    if result is None:
        raise HTTPException(status_code=404, detail="Calculation or parameter not found")
    return {"status": "updated", "result": result.model_dump(mode="json")}


@app.post("/calculations/{calc_id}/link-screenshot/{screenshot_id}")
def link_screenshot(calc_id: str, screenshot_id: str) -> dict[str, Any]:
    input_data = data_store.link_screenshot_to_parameters(screenshot_id, calc_id)
    if input_data is None:
        raise HTTPException(status_code=404, detail="Calculation or screenshot not found")
    return {"status": "linked", "input": input_data.model_dump(mode="json")}
