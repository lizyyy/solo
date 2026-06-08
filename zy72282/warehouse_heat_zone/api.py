from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from .models import (
    CoordinateOrigin,
    Shelf,
    PhotoRecord,
    AlertLabel,
    RecordStatus,
    AlertSeverity,
)
from .processor import HeatZoneProcessor

app = FastAPI(title="仓储货架承重热区 API")

processor = HeatZoneProcessor(data_dir="./data")


class CoordinateOriginRequest(BaseModel):
    origin_id: str
    name: str
    x: float
    y: float
    z: float
    description: str


class ShelfRequest(BaseModel):
    code: str
    location_x: float
    location_y: float
    max_load: float
    current_load: float
    origin_id: str


class ProcessRecordRequest(BaseModel):
    shelf_code: str
    origin_id: str
    batch_id: Optional[str] = None
    photo_number: Optional[str] = None
    is_mobile_blocked: bool = False


class SupplementPhotoRequest(BaseModel):
    record_id: str
    photo_number: str
    old_calibration: bool = False


class ManualCorrectRequest(BaseModel):
    record_id: str
    new_status: str
    note: str


@app.post("/api/origins")
async def import_origin(origin: CoordinateOriginRequest):
    origin_obj = CoordinateOrigin(**origin.dict())
    origin_id = processor.import_coordinate_origin(origin_obj)
    return {"status": "success", "origin_id": origin_id}


@app.get("/api/origins")
async def list_origins():
    return {"origins": [o.__dict__ for o in processor.origins.values()]}


@app.post("/api/shelves")
async def add_shelf(shelf: ShelfRequest):
    shelf_obj = Shelf(shelf_id=f"shelf_{shelf.code}", **shelf.dict())
    processor.add_shelf(shelf_obj)
    return {"status": "success", "shelf_code": shelf.code}


@app.get("/api/shelves")
async def list_shelves():
    return {"shelves": [s.__dict__ for s in processor.shelves.values()]}


@app.post("/api/batch/{batch_id}")
async def create_batch(batch_id: str):
    processor.create_new_batch(batch_id)
    return {"status": "success", "batch_id": batch_id}


@app.post("/api/process")
async def process_record(req: ProcessRecordRequest):
    photo = None
    if req.is_mobile_blocked:
        photo = PhotoRecord(
            photo_id=f"photo_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            photo_number=req.photo_number or "",
            is_mobile_screenshot=True,
            screenshot_bbox=(100, 50, 200, 150),
            labels=[
                AlertLabel(
                    label_id="label_1",
                    position_x=80,
                    position_y=60,
                    width=60,
                    height=30,
                    severity=AlertSeverity.HIGH,
                    message="承重告警",
                )
            ],
        )

    record = processor.process_record(
        shelf_code=req.shelf_code,
        origin_id=req.origin_id,
        photo=photo,
        photo_number=req.photo_number,
        batch_id=req.batch_id,
    )
    return {
        "status": "success",
        "record_id": record.record_id,
        "batch_id": record.batch_id,
        "record_status": record.status.value,
        "safe_distance": record.heat_zones[0].safe_distance if record.heat_zones else 0,
    }


@app.post("/api/supplement-photo")
async def supplement_photo(req: SupplementPhotoRequest):
    record = processor.supplement_photo_number(
        record_id=req.record_id,
        photo_number=req.photo_number,
        old_calibration=req.old_calibration,
    )
    latest_report = processor.get_latest_report(record.batch_id) if record.batch_id else None
    return {
        "status": "success",
        "record_id": record.record_id,
        "new_status": record.status.value,
        "batch_id": record.batch_id,
        "report_updated": latest_report is not None,
    }


@app.post("/api/manual-correct")
async def manual_correct(req: ManualCorrectRequest):
    status_map = {
        "normal": RecordStatus.NORMAL,
        "need_review": RecordStatus.NEED_REVIEW,
        "completed": RecordStatus.COMPLETED,
        "old_calibration": RecordStatus.OLD_CALIBRATION,
    }
    if req.new_status not in status_map:
        raise HTTPException(status_code=400, detail="Invalid status")

    record = processor.manual_correct(
        record_id=req.record_id,
        new_status=status_map[req.new_status],
        note=req.note,
    )
    latest_report = processor.get_latest_report(record.batch_id) if record.batch_id else None
    return {
        "status": "success",
        "record_id": record.record_id,
        "new_status": record.status.value,
        "batch_id": record.batch_id,
        "report_updated": latest_report is not None,
    }


@app.post("/api/rerun/{record_id}")
async def rerun_record(record_id: str):
    record = processor.rerun_record(record_id)
    latest_report = processor.get_latest_report(record.batch_id) if record.batch_id else None
    return {
        "status": "success",
        "record_id": record.record_id,
        "run_count": record.run_count,
        "batch_id": record.batch_id,
        "report_updated": latest_report is not None,
    }


@app.get("/api/report/{batch_id}")
async def get_report(batch_id: str):
    report = processor.generate_safety_report(batch_id)
    return {
        "report_id": report.report_id,
        "batch_id": report.batch_id,
        "total_records": report.total_records,
        "normal_count": report.normal_count,
        "need_review_count": report.need_review_count,
        "old_calibration_count": report.old_calibration_count,
        "avg_safe_distance": report.avg_safe_distance,
        "records": [
            {
                "record_id": r.record_id,
                "shelf_code": r.shelf_code,
                "status": r.status.value,
                "safe_distance": r.heat_zones[0].safe_distance if r.heat_zones else 0,
            }
            for r in report.records
        ],
    }


@app.get("/api/records")
async def list_records():
    records = processor.get_all_records()
    return {
        "records": [
            {
                "record_id": r.record_id,
                "shelf_code": r.shelf_code,
                "batch_id": r.batch_id,
                "status": r.status.value,
                "photo_number": r.photo_number,
                "run_count": r.run_count,
                "safe_distance": r.heat_zones[0].safe_distance if r.heat_zones else 0,
            }
            for r in records
        ]
    }


@app.get("/api/records/{record_id}")
async def get_record(record_id: str):
    record = processor.get_record(record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    return {
        "record_id": record.record_id,
        "shelf_code": record.shelf_code,
        "batch_id": record.batch_id,
        "status": record.status.value,
        "photo_number": record.photo_number,
        "heat_zones": [z.__dict__ for z in record.heat_zones],
        "is_manual_correction": record.is_manual_correction,
        "correction_note": record.correction_note,
        "run_count": record.run_count,
    }
