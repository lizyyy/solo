from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
import os
import shutil

from app.database import get_db
from app.models import DeliveryStatus, AnomalyType
from app.schemas import (
    DeliveryOrder as DeliveryOrderSchema,
    DeliveryOrderQuery, PaginatedResponse,
    BatchOperationResult, AnomalyRecord as AnomalyRecordSchema,
    DeliveryItem as DeliveryItemSchema,
    TemperatureRecord as TemperatureRecordSchema,
    DeliveryPhoto as DeliveryPhotoSchema
)
from app.services.delivery_service import DeliveryService
from app.services.import_service import ImportService
from app.services.report_service import ReportService

router = APIRouter(prefix="/delivery", tags=["delivery"])


@router.get("/{order_id}", response_model=DeliveryOrderSchema)
def get_delivery_order(order_id: int, db: Session = Depends(get_db)):
    service = DeliveryService(db)
    order = service.get_delivery_order(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="到货单不存在")
    return order


@router.post("/query", response_model=PaginatedResponse)
def query_delivery_orders(query_params: DeliveryOrderQuery, db: Session = Depends(get_db)):
    service = DeliveryService(db)
    result = service.query_delivery_orders(query_params)
    return result


@router.patch("/{order_id}/status/{status}")
def update_order_status(order_id: int, status: DeliveryStatus, updated_by: str = None,
                        db: Session = Depends(get_db)):
    service = DeliveryService(db)
    try:
        order = service.update_status(order_id, status, updated_by)
        return {"message": "状态更新成功", "order_id": order.id, "status": order.status}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/batch/status/{status}", response_model=BatchOperationResult)
def batch_update_status(order_ids: List[int], status: DeliveryStatus,
                         updated_by: str = None, db: Session = Depends(get_db)):
    service = DeliveryService(db)
    return service.batch_update_status(order_ids, status, updated_by)


@router.post("/{order_id}/receive")
def receive_order(order_id: int, received_by: str, db: Session = Depends(get_db)):
    service = DeliveryService(db)
    try:
        order = service.receive_order(order_id, received_by)
        return {"message": "签收成功", "order_id": order.id, "received_by": order.received_by}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{order_id}/complete")
def complete_order(order_id: int, db: Session = Depends(get_db)):
    service = DeliveryService(db)
    try:
        order = service.complete_order(order_id)
        return {"message": "完成成功", "order_id": order.id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{order_id}/reject")
def reject_order(order_id: int, reason: str, db: Session = Depends(get_db)):
    service = DeliveryService(db)
    try:
        order = service.reject_order(order_id, reason)
        return {"message": "拒收成功", "order_id": order.id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{order_id}/items", response_model=List[DeliveryItemSchema])
def get_order_items(order_id: int, db: Session = Depends(get_db)):
    service = DeliveryService(db)
    return service.get_order_items(order_id)


@router.get("/{order_id}/temperature", response_model=List[TemperatureRecordSchema])
def get_temperature_records(order_id: int, db: Session = Depends(get_db)):
    service = DeliveryService(db)
    return service.get_temperature_records(order_id)


@router.get("/{order_id}/photos", response_model=List[DeliveryPhotoSchema])
def get_photos(order_id: int, db: Session = Depends(get_db)):
    service = DeliveryService(db)
    return service.get_photos(order_id)


@router.get("/{order_id}/anomalies", response_model=List[AnomalyRecordSchema])
def get_anomalies(order_id: int, db: Session = Depends(get_db)):
    service = DeliveryService(db)
    return service.get_anomalies(order_id)


@router.post("/{order_id}/anomalies", response_model=AnomalyRecordSchema)
def add_anomaly(order_id: int, anomaly_type: AnomalyType, description: str,
                 reported_by: str = None, db: Session = Depends(get_db)):
    service = DeliveryService(db)
    try:
        return service.add_anomaly(order_id, anomaly_type, description, reported_by)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/anomalies/{anomaly_id}/resolve")
def resolve_anomaly(anomaly_id: int, resolved_by: str, resolution: str,
                     db: Session = Depends(get_db)):
    service = DeliveryService(db)
    try:
        anomaly = service.resolve_anomaly(anomaly_id, resolved_by, resolution)
        return {"message": "异常已解决", "anomaly_id": anomaly.id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/items/{item_id}/inspect")
def inspect_item(item_id: int, inspected_by: str, result: str, remarks: str = None,
                  db: Session = Depends(get_db)):
    service = DeliveryService(db)
    try:
        item = service.inspect_item(item_id, inspected_by, result, remarks)
        return {"message": "检验完成", "item_id": item.id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/batch/inspect", response_model=BatchOperationResult)
def batch_inspect_items(item_ids: List[int], inspected_by: str, result: str,
                         db: Session = Depends(get_db)):
    service = DeliveryService(db)
    return service.batch_inspect_items(item_ids, inspected_by, result)


@router.get("/{order_id}/summary")
def get_order_summary(order_id: int, db: Session = Depends(get_db)):
    service = DeliveryService(db)
    try:
        return service.get_order_summary(order_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/statistics")
def get_statistics(start_date: datetime = None, end_date: datetime = None,
                    db: Session = Depends(get_db)):
    service = DeliveryService(db)
    return service.get_statistics(start_date, end_date)


@router.post("/import/csv")
def import_from_csv(file: UploadFile = File(...), started_by: str = None,
                     db: Session = Depends(get_db)):
    upload_dir = "./data/uploads"
    os.makedirs(upload_dir, exist_ok=True)

    file_path = os.path.join(upload_dir, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    service = ImportService(db)
    result = service.import_delivery_orders_from_csv(file_path, file.filename, started_by)

    return {
        "message": f"导入完成，成功 {result['success_count']} 条，失败 {result['failed_count']} 条",
        **result
    }


@router.post("/import/temperature")
def import_temperature_from_json(file: UploadFile = File(...), started_by: str = None,
                                  db: Session = Depends(get_db)):
    upload_dir = "./data/uploads"
    os.makedirs(upload_dir, exist_ok=True)

    file_path = os.path.join(upload_dir, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    service = ImportService(db)
    result = service.import_temperature_records_from_json(file_path, file.filename, started_by)

    return {
        "message": f"导入完成，成功 {result['success_count']} 条，失败 {result['failed_count']} 条",
        **result
    }


@router.get("/bad-records")
def get_bad_records(batch_id: str = None, import_type: str = None,
                     is_resolved: bool = None, db: Session = Depends(get_db)):
    service = ImportService(db)
    return service.get_bad_records(batch_id, import_type, is_resolved)


@router.patch("/bad-records/{record_id}/resolve")
def resolve_bad_record(record_id: int, resolved_by: str, resolution_notes: str,
                        db: Session = Depends(get_db)):
    service = ImportService(db)
    try:
        record = service.resolve_bad_record(record_id, resolved_by, resolution_notes)
        return {"message": "坏记录已标记为已解决", "record_id": record.id}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/report/export/excel")
def export_report_excel(query_params: DeliveryOrderQuery, include_details: bool = True,
                         db: Session = Depends(get_db)):
    service = ReportService(db)
    filepath = service.export_to_excel(query_params, include_details)
    return {
        "message": "报告生成成功",
        "file_path": filepath,
        "filename": os.path.basename(filepath)
    }


@router.post("/report/export/csv")
def export_report_csv(query_params: DeliveryOrderQuery, db: Session = Depends(get_db)):
    service = ReportService(db)
    files = service.export_to_csv(query_params)
    return {
        "message": "报告生成成功",
        "files": files
    }


@router.get("/report/statistics")
def get_statistics_report(start_date: datetime = None, end_date: datetime = None,
                           db: Session = Depends(get_db)):
    service = ReportService(db)
    return service.generate_statistics_report(start_date, end_date)


@router.get("/report/temperature/{order_id}")
def get_temperature_report(order_id: int, db: Session = Depends(get_db)):
    service = ReportService(db)
    try:
        return service.generate_temperature_report(order_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/exports")
def list_export_files():
    service = ReportService(next(get_db()))
    files = service.get_export_files()
    return {"files": files}
