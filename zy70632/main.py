from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime
import json
import pandas as pd
import os
from typing import Optional, List
import database as models
import schemas
from services import (
    BatchService, StorageLocationService, SampleBoxService,
    InspectionService, DestructionService, ExceptionService,
    ReportService
)
from database import get_db, init_db


def safe_json_dumps(obj) -> str:
    def default_converter(o):
        if isinstance(o, datetime):
            return o.isoformat()
        return str(o)
    try:
        return json.dumps(obj, default=default_converter, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"raw_str": str(obj), "serialize_error": str(e)}, ensure_ascii=False)

app = FastAPI(title="预制菜留样抽检销毁系统", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    init_db()


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=500,
        content={"code": 500, "message": str(exc), "data": None}
    )


@app.get("/")
def root():
    return {"message": "预制菜留样抽检销毁系统 API"}


@app.post("/api/batches", response_model=schemas.ApiResponse)
def create_batch(batch: schemas.BatchCreate, db: Session = Depends(get_db)):
    try:
        existing = BatchService.get_batch_by_no(db, batch.batch_no)
        if existing:
            raise HTTPException(status_code=400, detail="批次号已存在")
        db_batch = BatchService.create_batch(db, batch)
        return {"code": 200, "message": "success", "data": {"id": db_batch.id}}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/batches", response_model=List[schemas.Batch])
def list_batches(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return BatchService.list_batches(db, skip, limit)


@app.get("/api/batches/{batch_id}", response_model=schemas.Batch)
def get_batch(batch_id: int, db: Session = Depends(get_db)):
    batch = BatchService.get_batch(db, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    return batch


@app.put("/api/batches/{batch_id}", response_model=schemas.ApiResponse)
def update_batch(batch_id: int, batch_update: schemas.BatchUpdate, db: Session = Depends(get_db)):
    try:
        updated = BatchService.update_batch(db, batch_id, batch_update)
        if not updated:
            raise HTTPException(status_code=404, detail="批次不存在")
        return {"code": 200, "message": "success"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/batches/{batch_id}/close", response_model=schemas.ApiResponse)
def close_batch(batch_id: int, operator: str = Query(...), db: Session = Depends(get_db)):
    try:
        closed = BatchService.close_batch(db, batch_id, operator)
        if not closed:
            raise HTTPException(status_code=404, detail="批次不存在")
        return {"code": 200, "message": "success"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/storage-locations", response_model=schemas.ApiResponse)
def create_location(location: schemas.StorageLocationCreate, db: Session = Depends(get_db)):
    db_location = StorageLocationService.create_location(db, location)
    return {"code": 200, "message": "success", "data": {"id": db_location.id}}


@app.get("/api/storage-locations", response_model=List[schemas.StorageLocation])
def list_locations(available_only: bool = False, db: Session = Depends(get_db)):
    return StorageLocationService.list_locations(db, available_only)


@app.post("/api/sample-boxes", response_model=schemas.ApiResponse)
def create_sample_box(sample: schemas.SampleBoxCreate, db: Session = Depends(get_db)):
    try:
        db_sample = SampleBoxService.create_sample_box(db, sample)
        return {"code": 200, "message": "success", "data": {"id": db_sample.id}}
    except ValueError as e:
        try:
            ExceptionService.create_exception(db, schemas.ExceptionRecordCreate(
                related_type="sample_box",
                related_id=0,
                original_input=safe_json_dumps(sample.model_dump()),
                operator=sample.operator,
                exception_type="create_error",
                description=str(e)
            ))
        except Exception:
            pass
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/sample-boxes", response_model=List[schemas.SampleBox])
def list_sample_boxes(batch_id: Optional[int] = None, status: Optional[str] = None, db: Session = Depends(get_db)):
    return SampleBoxService.list_sample_boxes(db, batch_id, status)


@app.get("/api/sample-boxes/{box_id}", response_model=schemas.SampleBox)
def get_sample_box(box_id: int, db: Session = Depends(get_db)):
    sample = SampleBoxService.get_sample_box(db, box_id)
    if not sample:
        raise HTTPException(status_code=404, detail="留样盒不存在")
    return sample


@app.put("/api/sample-boxes/{box_id}", response_model=schemas.ApiResponse)
def update_sample_box(box_id: int, update: schemas.SampleBoxUpdate, db: Session = Depends(get_db)):
    try:
        updated = SampleBoxService.update_sample_box(db, box_id, update)
        if not updated:
            raise HTTPException(status_code=404, detail="留样盒不存在")
        return {"code": 200, "message": "success"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/sample-boxes/{box_id}/close", response_model=schemas.ApiResponse)
def close_sample_box(box_id: int, operator: str = Query(...), db: Session = Depends(get_db)):
    try:
        closed = SampleBoxService.close_sample_box(db, box_id, operator)
        if not closed:
            raise HTTPException(status_code=404, detail="留样盒不存在")
        return {"code": 200, "message": "success"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/inspections", response_model=schemas.ApiResponse)
def create_inspection(inspection: schemas.InspectionCreate, db: Session = Depends(get_db)):
    try:
        db_inspection = InspectionService.create_inspection(db, inspection)
        return {"code": 200, "message": "success", "data": {"id": db_inspection.id}}
    except ValueError as e:
        try:
            ExceptionService.create_exception(db, schemas.ExceptionRecordCreate(
                related_type="inspection",
                related_id=0,
                original_input=safe_json_dumps(inspection.model_dump()),
                operator=inspection.inspector,
                exception_type="create_error",
                description=str(e)
            ))
        except Exception:
            pass
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/inspections", response_model=List[schemas.Inspection])
def list_inspections(batch_id: Optional[int] = None, status: Optional[str] = None, db: Session = Depends(get_db)):
    return InspectionService.list_inspections(db, batch_id, status)


@app.post("/api/inspections/{inspection_id}/review", response_model=schemas.ApiResponse)
def review_inspection(inspection_id: int, review: schemas.InspectionReview, db: Session = Depends(get_db)):
    try:
        reviewed = InspectionService.review_inspection(db, inspection_id, review)
        if not reviewed:
            raise HTTPException(status_code=404, detail="抽检记录不存在")
        return {"code": 200, "message": "success"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/destructions", response_model=schemas.ApiResponse)
def apply_destruction(destruction: schemas.DestructionCreate, db: Session = Depends(get_db)):
    try:
        db_destruction = DestructionService.apply_destruction(db, destruction)
        return {"code": 200, "message": "success", "data": {"id": db_destruction.id}}
    except ValueError as e:
        try:
            ExceptionService.create_exception(db, schemas.ExceptionRecordCreate(
                related_type="destruction",
                related_id=0,
                original_input=safe_json_dumps(destruction.model_dump()),
                operator=destruction.applicant,
                exception_type="create_error",
                description=str(e)
            ))
        except Exception:
            pass
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/destructions", response_model=List[schemas.Destruction])
def list_destructions(status: Optional[str] = None, db: Session = Depends(get_db)):
    return DestructionService.list_destructions(db, status)


@app.post("/api/destructions/{destruction_id}/review", response_model=schemas.ApiResponse)
def review_destruction(destruction_id: int, review: schemas.DestructionReview, db: Session = Depends(get_db)):
    try:
        reviewed = DestructionService.review_destruction(db, destruction_id, review)
        if not reviewed:
            raise HTTPException(status_code=404, detail="销毁申请不存在")
        return {"code": 200, "message": "success"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/destructions/{destruction_id}/execute", response_model=schemas.ApiResponse)
def execute_destruction(destruction_id: int, execute: schemas.DestructionExecute, db: Session = Depends(get_db)):
    try:
        executed = DestructionService.execute_destruction(db, destruction_id, execute)
        if not executed:
            raise HTTPException(status_code=404, detail="销毁申请不存在")
        return {"code": 200, "message": "success"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/destructions/{destruction_id}/cancel", response_model=schemas.ApiResponse)
def cancel_destruction(destruction_id: int, operator: str = Query(...), db: Session = Depends(get_db)):
    try:
        cancelled = DestructionService.cancel_destruction(db, destruction_id, operator)
        if not cancelled:
            raise HTTPException(status_code=404, detail="销毁申请不存在")
        return {"code": 200, "message": "success"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/exceptions", response_model=List[schemas.ExceptionRecord])
def list_exceptions(status: Optional[str] = None, related_type: Optional[str] = None, db: Session = Depends(get_db)):
    return ExceptionService.list_exceptions(db, status, related_type)


@app.post("/api/exceptions/{exception_id}/handle", response_model=schemas.ApiResponse)
def handle_exception(exception_id: int, handle: schemas.ExceptionRecordHandle, db: Session = Depends(get_db)):
    try:
        handled = ExceptionService.handle_exception(db, exception_id, handle)
        if not handled:
            raise HTTPException(status_code=404, detail="异常记录不存在")
        return {"code": 200, "message": "success"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/reports/trace")
def get_trace_report(request: schemas.TraceReportRequest, db: Session = Depends(get_db)):
    report_data = ReportService.generate_trace_report(
        db, request.batch_no, request.start_date, request.end_date
    )
    return {"code": 200, "message": "success", "data": report_data}


@app.post("/api/reports/trace/export")
def export_trace_report(request: schemas.TraceReportRequest, db: Session = Depends(get_db)):
    report_data = ReportService.generate_trace_report(
        db, request.batch_no, request.start_date, request.end_date
    )

    rows = []
    for batch in report_data:
        for sample in batch["samples"]:
            row = {
                "批次号": batch["batch_no"],
                "菜品名称": batch["dish_name"],
                "生产日期": batch["production_date"],
                "留样盒编号": sample["box_no"],
                "留样日期": sample["sample_date"],
                "有效期至": sample["expiry_date"],
                "留样状态": sample["status"],
                "存放位置": sample["storage_location"]
            }
            rows.append(row)

    df = pd.DataFrame(rows)
    filename = f"trace_report_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"
    df.to_excel(filename, index=False)

    return FileResponse(
        filename,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=filename
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
