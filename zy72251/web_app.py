from fastapi import FastAPI, Request, Form, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, List
import os

from valve_service import ValvePositioningService
from models import ValveStatus, NextAction, Role
from demo_data import create_demo_scenario

app = FastAPI(title="地下管廊阀门定位系统")

templates = Jinja2Templates(directory="templates")

service = ValvePositioningService()
demo_service, demo_record_id = create_demo_scenario()
service.records.update(demo_service.records)
service.change_records.extend(demo_service.change_records)


class PointCloudLogRequest(BaseModel):
    operator: str
    raw_remark: str
    thinning_ratio: Optional[float] = 0.75
    confidence_level: Optional[float] = 0.85


@app.get("/", response_class=HTMLResponse)
async def dashboard(request: Request):
    records = list(service.records.values())
    return templates.TemplateResponse(
        "dashboard.html",
        {"request": request, "records": records}
    )


@app.get("/record/{record_id}", response_class=HTMLResponse)
async def record_detail(request: Request, record_id: str):
    record = service.get_record(record_id)
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    return templates.TemplateResponse(
        "record_detail.html",
        {"request": request, "record": record}
    )


@app.get("/api/record/{record_id}")
async def api_record_detail(record_id: str):
    record = service.get_record(record_id)
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    return record


@app.post("/api/record/{record_id}/add-log")
async def api_add_log(record_id: str, log_request: PointCloudLogRequest):
    log = service.add_point_cloud_log(
        record_id=record_id,
        operator=log_request.operator,
        raw_remark=log_request.raw_remark,
        thinning_ratio=log_request.thinning_ratio,
        confidence_level=log_request.confidence_level
    )
    if not log:
        raise HTTPException(status_code=404, detail="记录不存在")
    return {"status": "success", "log": log}


@app.post("/api/record/{record_id}/calculate")
async def api_calculate(record_id: str, generated_by: str = Form("园区运维小陶")):
    report = service.calculate_safety_distance(record_id, generated_by)
    if not report:
        raise HTTPException(status_code=404, detail="记录不存在")
    return {"status": "success", "report": report}


@app.get("/api/changes")
async def api_changes():
    return {"changes": service.get_all_changes()}


@app.get("/demo", response_class=HTMLResponse)
async def demo_page(request: Request):
    record = service.get_record(demo_record_id)
    return templates.TemplateResponse(
        "demo.html",
        {"request": request, "record": record, "record_id": demo_record_id}
    )
