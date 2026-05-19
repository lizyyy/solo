from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List
from io import BytesIO

from backend.app.database import get_db
from backend.app.schemas import (
    PrintBatchCreate, PrintBatchBase, PrintBatchDetail,
    LabelRecordBase, LabelRecordDetail,
    StatusUpdateRequest, ExceptionResolveRequest, ReprintRequest, ExportFilter,
    ExceptionRecordBase, WarehouseAccount, LogisticsChannel, LabelTemplate
)
from backend.app.models import LabelRecordStatus, ExceptionStatus
from backend.app.services import (
    PrintService, RecordService, ExceptionService, BatchService,
    ExportService, MasterDataService
)

router = APIRouter()


@router.post("/master-data/init", response_model=dict)
def init_master_data(db: Session = Depends(get_db)):
    service = MasterDataService(db)
    result = service.init_sample_data()
    return {"message": result}


@router.get("/warehouses", response_model=List[WarehouseAccount])
def list_warehouses(db: Session = Depends(get_db)):
    service = MasterDataService(db)
    return service.list_warehouses()


@router.get("/channels", response_model=List[LogisticsChannel])
def list_channels(db: Session = Depends(get_db)):
    service = MasterDataService(db)
    return service.list_channels()


@router.get("/templates", response_model=List[LabelTemplate])
def list_templates(channel_id: int = None, db: Session = Depends(get_db)):
    service = MasterDataService(db)
    return service.list_templates(channel_id)


@router.post("/batches", response_model=PrintBatchBase, status_code=status.HTTP_201_CREATED)
def create_batch(batch_data: PrintBatchCreate, db: Session = Depends(get_db)):
    try:
        service = PrintService(db)
        return service.create_batch(batch_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/batches/{batch_id}/process", response_model=PrintBatchBase)
def process_batch(batch_id: int, db: Session = Depends(get_db)):
    try:
        service = PrintService(db)
        return service.process_batch(batch_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/batches", response_model=List[PrintBatchBase])
def list_batches(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    service = BatchService(db)
    return service.list_batches(skip, limit)


@router.get("/batches/{batch_id}", response_model=PrintBatchDetail)
def get_batch(batch_id: int, db: Session = Depends(get_db)):
    service = BatchService(db)
    batch = service.get_batch_detail(batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return batch


@router.get("/records", response_model=List[LabelRecordBase])
def list_records(
    skip: int = 0,
    limit: int = 100,
    status: LabelRecordStatus = None,
    db: Session = Depends(get_db)
):
    service = RecordService(db)
    return service.list_records(skip, limit, status)


@router.get("/records/{record_id}", response_model=LabelRecordDetail)
def get_record(record_id: int, db: Session = Depends(get_db)):
    service = RecordService(db)
    record = service.get_record_detail(record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    return record


@router.put("/records/{record_id}/status", response_model=LabelRecordBase)
def update_record_status(
    record_id: int,
    request: StatusUpdateRequest,
    db: Session = Depends(get_db)
):
    try:
        service = RecordService(db)
        return service.update_record_status(record_id, request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/records/{record_id}/reprint", response_model=LabelRecordBase)
def reprint_record(
    record_id: int,
    request: ReprintRequest,
    db: Session = Depends(get_db)
):
    try:
        service = RecordService(db)
        return service.reprint_record(record_id, request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/exceptions", response_model=List[ExceptionRecordBase])
def list_exceptions(
    skip: int = 0,
    limit: int = 100,
    status: ExceptionStatus = None,
    db: Session = Depends(get_db)
):
    service = ExceptionService(db)
    return service.list_exceptions(skip, limit, status)


@router.put("/exceptions/{exception_id}/resolve", response_model=ExceptionRecordBase)
def resolve_exception(
    exception_id: int,
    request: ExceptionResolveRequest,
    db: Session = Depends(get_db)
):
    try:
        service = ExceptionService(db)
        return service.resolve_exception(exception_id, request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/exceptions/{exception_id}/archive", response_model=ExceptionRecordBase)
def archive_exception(exception_id: int, db: Session = Depends(get_db)):
    try:
        service = ExceptionService(db)
        return service.archive_exception(exception_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/export")
def export_records(filter: ExportFilter, db: Session = Depends(get_db)):
    service = ExportService(db)
    csv_content = service.export_records(filter)
    
    output = BytesIO()
    output.write(csv_content.encode('utf-8-sig'))
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=logistics_records.csv"}
    )
