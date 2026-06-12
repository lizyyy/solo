#!/usr/bin/env python3
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, PlainTextResponse
from pydantic import BaseModel
from typing import Optional, Dict, List
from processor import RecordProcessor
from demo_data import load_demo_data
import os

app = FastAPI(title="音响租赁调音记录 API")

processor = RecordProcessor()


class ImportRequest(BaseModel):
    raw_text: str
    operator: str = "老周"


class SupplementRequest(BaseModel):
    raw_text: str
    operator: str = "老周"


class CorrectRequest(BaseModel):
    corrections: Dict
    operator: str = "老周"


class ReviewRequest(BaseModel):
    decision: str
    reason: str
    operator: str = "巡演统筹"


@app.on_event("startup")
async def startup_event():
    load_demo_data(processor)


@app.get("/api/records")
async def get_records():
    return {"records": processor.get_records_summary()}


@app.get("/api/records/{record_id}")
async def get_record(record_id: str):
    detail = processor.get_record_detail(record_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Record not found")
    return detail


@app.post("/api/records/import")
async def import_tuner_message(req: ImportRequest):
    record = processor.import_tuner_message(req.raw_text, req.operator)
    return {
        "id": record.id,
        "status": record.status.value,
        "needs_review": record.needs_review
    }


@app.post("/api/records/{record_id}/supplement")
async def supplement_signup(record_id: str, req: SupplementRequest):
    record = processor.supplement_group_signup(record_id, req.raw_text, req.operator)
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    return {
        "id": record.id,
        "song_list": record.song_list,
        "status": record.status.value
    }


@app.post("/api/records/{record_id}/correct")
async def correct_record(record_id: str, req: CorrectRequest):
    record = processor.manual_correct(record_id, req.corrections, req.operator)
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    return {"id": record.id, "status": record.status.value}


@app.post("/api/records/{record_id}/review")
async def review_record_api(record_id: str, req: ReviewRequest):
    record = processor.review_record(record_id, req.decision, req.reason, req.operator)
    if not record:
        raise HTTPException(status_code=404, detail="Record not found or not needs review")
    return {
        "id": record.id,
        "status": record.status.value,
        "review_decision": record.review_decision
    }


@app.post("/api/records/{record_id}/rerun")
async def rerun_record(record_id: str, operator: str = "老周"):
    record = processor.rerun_record(record_id, operator)
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    return {"id": record.id, "run_count": record.run_count, "needs_review": record.needs_review}


@app.get("/api/checklist")
async def get_checklist(band_name: Optional[str] = None):
    return {"checklist": processor.get_song_checklist(band_name)}


@app.get("/api/logs")
async def get_logs(record_id: Optional[str] = None):
    return {"logs": processor.get_logs(record_id)}


@app.get("/api/stats")
async def get_stats():
    report = processor.generate_report()
    return report["stats"]


@app.get("/api/report")
async def get_report():
    return processor.generate_report()


@app.get("/api/report/text", response_class=PlainTextResponse)
async def get_report_text():
    return processor.export_report_text()


@app.get("/")
async def index():
    return FileResponse("static/index.html")


app.mount("/static", StaticFiles(directory="static"), name="static")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
