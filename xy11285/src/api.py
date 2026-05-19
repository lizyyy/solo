from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.responses import Response
from sqlalchemy.orm import Session
from pydantic import BaseModel

from src.database import get_db, init_db
from src.models import PrescriptionStatus, BatchOperationStatus, ErrorType
from src.services import PrescriptionService, BatchOperationService, InitialDataService
from src.import_export import ImportService, ExportService

app = FastAPI(title="宠物医院药房管理系统", version="1.0.0")


@app.on_event("startup")
def startup():
    init_db()


class PrescriptionItemCreate(BaseModel):
    medicine_id: int
    quantity: Optional[float] = None
    administration_route: str = ""
    frequency: str = ""
    duration: str = ""


class PrescriptionCreate(BaseModel):
    pet_id: int
    doctor_id: int
    items: List[PrescriptionItemCreate]
    created_by: str
    diagnosis: str = ""
    notes: str = ""


class PrescriptionQuery(BaseModel):
    status: Optional[PrescriptionStatus] = None
    created_by: Optional[str] = None
    reviewed_by: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    doctor_id: Optional[int] = None


class BatchOperationQuery(BaseModel):
    status: Optional[BatchOperationStatus] = None
    operation_type: Optional[str] = None
    created_by: Optional[str] = None
    error_type: Optional[ErrorType] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


@app.post("/api/init-data", summary="初始化示例数据")
def init_sample_data(db: Session = Depends(get_db)):
    service = InitialDataService(db)
    service.create_sample_data()
    return {"message": "示例数据创建成功"}


@app.post("/api/prescriptions", summary="创建处方")
def create_prescription(data: PrescriptionCreate, db: Session = Depends(get_db)):
    service = PrescriptionService(db)
    try:
        prescription = service.create_prescription(
            pet_id=data.pet_id,
            doctor_id=data.doctor_id,
            items_data=[item.dict() for item in data.items],
            created_by=data.created_by,
            diagnosis=data.diagnosis,
            notes=data.notes
        )
        return {
            "id": prescription.id,
            "prescription_no": prescription.prescription_no,
            "status": prescription.status
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/prescriptions/{prescription_id}/submit-review", summary="提交审核")
def submit_for_review(prescription_id: int, operator: str, db: Session = Depends(get_db)):
    service = PrescriptionService(db)
    prescription = service.submit_for_review(prescription_id, operator)
    return {"id": prescription.id, "status": prescription.status}


@app.post("/api/prescriptions/{prescription_id}/approve", summary="审核通过")
def approve_prescription(prescription_id: int, operator: str, notes: str = "", db: Session = Depends(get_db)):
    service = PrescriptionService(db)
    try:
        prescription = service.approve(prescription_id, operator, notes)
        return {"id": prescription.id, "status": prescription.status}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/prescriptions/{prescription_id}/reject", summary="驳回处方")
def reject_prescription(prescription_id: int, operator: str, reason: str, db: Session = Depends(get_db)):
    service = PrescriptionService(db)
    prescription = service.reject(prescription_id, operator, reason)
    return {"id": prescription.id, "status": prescription.status}


@app.post("/api/prescriptions/{prescription_id}/dispense", summary="发药")
def dispense_prescription(prescription_id: int, operator: str, db: Session = Depends(get_db)):
    service = PrescriptionService(db)
    try:
        prescription = service.dispense(prescription_id, operator)
        return {"id": prescription.id, "status": prescription.status}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/prescriptions", summary="查询处方列表")
def list_prescriptions(query: PrescriptionQuery = Depends(), db: Session = Depends(get_db)):
    service = PrescriptionService(db)
    prescriptions = service.query_prescriptions(**query.dict(exclude_none=True))
    result = []
    for p in prescriptions:
        result.append({
            "id": p.id,
            "prescription_no": p.prescription_no,
            "pet_name": p.pet.name if p.pet else "",
            "doctor_name": p.doctor.name if p.doctor else "",
            "status": p.status,
            "diagnosis": p.diagnosis,
            "created_by": p.created_by,
            "created_at": p.created_at,
            "item_count": len(p.items)
        })
    return result


@app.get("/api/prescriptions/{prescription_id}", summary="获取处方详情")
def get_prescription(prescription_id: int, db: Session = Depends(get_db)):
    service = PrescriptionService(db)
    prescription = service.prescription_repo.get_by_id(prescription_id)
    if not prescription:
        raise HTTPException(status_code=404, detail="处方不存在")

    items = []
    for item in prescription.items:
        items.append({
            "id": item.id,
            "medicine_name": item.medicine.name if item.medicine else "",
            "quantity": item.quantity,
            "unit": item.unit,
            "calculated_dosage": item.calculated_dosage,
            "dosage_notes": item.dosage_notes,
            "batch_number": item.inventory_batch.batch_number if item.inventory_batch else ""
        })

    return {
        "id": prescription.id,
        "prescription_no": prescription.prescription_no,
        "pet_name": prescription.pet.name if prescription.pet else "",
        "pet_weight": prescription.pet.weight if prescription.pet else 0,
        "doctor_name": prescription.doctor.name if prescription.doctor else "",
        "status": prescription.status,
        "diagnosis": prescription.diagnosis,
        "notes": prescription.notes,
        "created_by": prescription.created_by,
        "created_at": prescription.created_at,
        "items": items
    }


@app.post("/api/import/prescriptions", summary="批量导入处方")
async def import_prescriptions(file: UploadFile = File(...), created_by: str = "import", db: Session = Depends(get_db)):
    content = await file.read()

    if file.filename.endswith('.xlsx') or file.filename.endswith('.xls'):
        rows = ImportService.read_excel(content)
    elif file.filename.endswith('.csv'):
        rows = ImportService.read_csv(content)
    else:
        raise HTTPException(status_code=400, detail="不支持的文件格式")

    prescription_data = ImportService.parse_prescription_data(rows)

    batch_service = BatchOperationService(db)
    operation = batch_service.create_operation(
        operation_type="import_prescription",
        created_by=created_by,
        items_data=prescription_data
    )

    result = batch_service.process_operation(operation.operation_id)

    return result


@app.post("/api/batch/{operation_id}/retry", summary="重试批量操作失败项")
def retry_batch_operation(operation_id: str, db: Session = Depends(get_db)):
    batch_service = BatchOperationService(db)
    result = batch_service.retry_failed_items(operation_id)
    return result


@app.get("/api/batch/operations", summary="查询批量操作")
def list_batch_operations(query: BatchOperationQuery = Depends(), db: Session = Depends(get_db)):
    batch_service = BatchOperationService(db)
    operations, items = batch_service.query_operations(**query.dict(exclude_none=True))

    result_operations = []
    for op in operations:
        result_operations.append({
            "operation_id": op.operation_id,
            "operation_type": op.operation_type,
            "status": op.status,
            "total_count": op.total_count,
            "success_count": op.success_count,
            "failed_count": op.failed_count,
            "created_by": op.created_by,
            "created_at": op.created_at,
            "completed_at": op.completed_at
        })

    result_items = []
    for item in items:
        result_items.append({
            "row_index": item.row_index,
            "status": item.status,
            "error_type": item.error_type,
            "error_message": item.error_message,
            "record_id": item.record_id,
            "retry_count": item.retry_count
        })

    return {
        "operations": result_operations,
        "items": result_items
    }


@app.get("/api/export/prescriptions", summary="导出处方")
def export_prescriptions(format: str = "xlsx", query: PrescriptionQuery = Depends(), db: Session = Depends(get_db)):
    service = PrescriptionService(db)
    prescriptions = service.query_prescriptions(**query.dict(exclude_none=True))

    if format == "xlsx":
        content = ExportService.export_prescriptions_to_excel(prescriptions)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = f"prescriptions_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"
    elif format == "csv":
        content = ExportService.export_prescriptions_to_csv(prescriptions)
        media_type = "text/csv"
        filename = f"prescriptions_{datetime.now().strftime('%Y%m%d%H%M%S')}.csv"
    else:
        raise HTTPException(status_code=400, detail="不支持的导出格式")

    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@app.get("/api/export/batch-operations", summary="导出批量操作")
def export_batch_operations(format: str = "xlsx", query: BatchOperationQuery = Depends(), db: Session = Depends(get_db)):
    batch_service = BatchOperationService(db)
    operations, items = batch_service.query_operations(**query.dict(exclude_none=True))

    content = ExportService.export_batch_operations_to_excel(operations, items)
    media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    filename = f"batch_operations_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"

    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
