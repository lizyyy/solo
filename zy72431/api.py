#!/usr/bin/env python3
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
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


@app.on_event("startup")
async def startup_event():
    load_demo_data(processor)


@app.get("/api/records")
async def get_records():
    return {"records": processor.get_records_summary()}


@app.get("/api/records/{record_id}")
async def get_record(record_id: str):
    record = next((r for r in processor.records if r.id == record_id), None)
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    return {
        "id": record.id,
        "date": record.date,
        "band_name": record.band_name,
        "room": record.room,
        "start_time": record.start_time,
        "end_time": record.end_time,
        "hours": record.hours,
        "tuner_name": record.tuner_name,
        "song_list": record.song_list,
        "members": record.members,
        "status": record.status.value,
        "source": record.source.value,
        "is_leave": record.is_leave,
        "is_consumed": record.is_consumed,
        "needs_review": record.needs_review,
        "review_note": record.review_note,
        "tuner_note": record.tuner_note,
        "group_remark": record.group_remark,
        "corrections": record.corrections,
        "run_count": record.run_count
    }


@app.post("/api/records/import")
async def import_tuner_message(req: ImportRequest):
    record = processor.import_tuner_message(req.raw_text, req.operator)
    return {"id": record.id, "status": record.status.value}


@app.post("/api/records/{record_id}/supplement")
async def supplement_signup(record_id: str, req: SupplementRequest):
    record = processor.supplement_group_signup(record_id, req.raw_text, req.operator)
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    return {"id": record.id, "song_list": record.song_list}


@app.post("/api/records/{record_id}/correct")
async def correct_record(record_id: str, req: CorrectRequest):
    record = processor.manual_correct(record_id, req.corrections, req.operator)
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    return {"id": record.id, "status": record.status.value}


@app.post("/api/records/{record_id}/rerun")
async def rerun_record(record_id: str, operator: str = "老周"):
    record = processor.rerun_record(record_id, operator)
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    return {"id": record.id, "run_count": record.run_count}


@app.get("/api/checklist")
async def get_checklist(band_name: Optional[str] = None):
    return {"checklist": processor.get_song_checklist(band_name)}


@app.get("/api/logs")
async def get_logs(record_id: Optional[str] = None):
    return {"logs": processor.get_logs(record_id)}


@app.get("/api/stats")
async def get_stats():
    records = processor.records
    return {
        "total": len(records),
        "normal": sum(1 for r in records if r.status.value == "normal"),
        "leave_consumed": sum(1 for r in records if r.status.value == "leave_consumed"),
        "supplemented": sum(1 for r in records if r.status.value == "supplemented"),
        "pending_review": sum(1 for r in records if r.needs_review),
        "corrected": sum(1 for r in records if r.status.value == "corrected"),
        "total_songs": len(processor.song_checklists)
    }


@app.get("/")
async def index():
    return FileResponse("static/index.html")


app.mount("/static", StaticFiles(directory="static"), name="static")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
