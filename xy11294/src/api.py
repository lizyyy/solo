from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime

from src.database import get_db, init_db
from src.models import OperationStatus, ExceptionType, OperationType, RoleType, Equipment
from src.schemas import (
    EquipmentCreate,
    EquipmentResponse,
    ImportOperation,
    OccupyOperation,
    TransferOperation,
    ReturnOperation,
    LossOperation,
    BatchOperationRequest,
    BatchOperationResult,
    QueryFilter
)
from src.services import EquipmentService, OperationService
from src.batch_service import BatchOperationService, ReportService

app = FastAPI(
    title="会展设备租赁管理系统",
    description="用于管理桁架、灯具、屏幕等会展设备的借用、调拨、归还和损耗",
    version="1.0.0"
)


@app.on_event("startup")
async def startup_event():
    init_db()


@app.post("/equipment/", response_model=EquipmentResponse, summary="创建设备")
def create_equipment(equipment: EquipmentCreate, db: Session = Depends(get_db)):
    existing = EquipmentService.get_by_code(db, equipment.code)
    if existing:
        raise HTTPException(status_code=400, detail="设备编号已存在")

    return EquipmentService.create(
        db,
        code=equipment.code,
        name=equipment.name,
        type=equipment.type,
        total_quantity=equipment.total_quantity,
        unit=equipment.unit,
        description=equipment.description
    )


@app.get("/equipment/", summary="获取所有设备列表")
def list_equipment(db: Session = Depends(get_db)):
    return EquipmentService.list_all(db)


@app.get("/equipment/{code}", response_model=EquipmentResponse, summary="获取单个设备信息")
def get_equipment(code: str, db: Session = Depends(get_db)):
    equipment = EquipmentService.get_by_code(db, code)
    if not equipment:
        raise HTTPException(status_code=404, detail="设备不存在")
    return equipment


@app.post("/operations/import/", summary="导入设备")
def import_operation(data: ImportOperation, db: Session = Depends(get_db)):
    return OperationService.handle_import(db, data)


@app.post("/operations/occupy/", summary="占用/借用设备")
def occupy_operation(data: OccupyOperation, db: Session = Depends(get_db)):
    return OperationService.handle_occupy(db, data)


@app.post("/operations/transfer/", summary="调拨设备（展位间转移）")
def transfer_operation(data: TransferOperation, db: Session = Depends(get_db)):
    return OperationService.handle_transfer(db, data)


@app.post("/operations/return/", summary="归还设备")
def return_operation(data: ReturnOperation, db: Session = Depends(get_db)):
    return OperationService.handle_return(db, data)


@app.post("/operations/loss/", summary="记录损耗")
def loss_operation(data: LossOperation, db: Session = Depends(get_db)):
    return OperationService.handle_loss(db, data)


@app.post("/operations/batch/", response_model=BatchOperationResult, summary="批量操作")
def batch_operation(request: BatchOperationRequest, db: Session = Depends(get_db)):
    return BatchOperationService.process_batch(db, request.operations)


@app.get("/operations/", summary="查询操作记录")
def query_operations(
    operator: Optional[str] = Query(None, description="操作人"),
    start_time: Optional[datetime] = Query(None, description="开始时间"),
    end_time: Optional[datetime] = Query(None, description="结束时间"),
    status: Optional[OperationStatus] = Query(None, description="状态"),
    exception_type: Optional[ExceptionType] = Query(None, description="异常类型"),
    operation_type: Optional[OperationType] = Query(None, description="操作类型"),
    booth: Optional[str] = Query(None, description="展位号"),
    equipment_code: Optional[str] = Query(None, description="设备编号"),
    db: Session = Depends(get_db)
):
    filter_params = QueryFilter(
        operator=operator,
        start_time=start_time,
        end_time=end_time,
        status=status,
        exception_type=exception_type,
        operation_type=operation_type,
        booth=booth,
        equipment_code=equipment_code
    )

    records = OperationService.query_records(db, filter_params)

    result = []
    for record in records:
        equipment = db.query(Equipment).filter(Equipment.id == record.equipment_id).first() if record.equipment_id else None
        result.append({
            "id": record.id,
            "request_id": record.request_id,
            "equipment_code": equipment.code if equipment else "",
            "equipment_name": equipment.name if equipment else "",
            "operation_type": record.operation_type.value,
            "quantity": record.quantity,
            "booth": record.booth,
            "from_booth": record.from_booth,
            "to_booth": record.to_booth,
            "operator": record.operator,
            "role": record.role.value,
            "status": record.status.value,
            "exception_type": record.exception_type.value,
            "remark": record.remark,
            "operated_at": record.operated_at,
            "created_at": record.created_at
        })

    return result


@app.get("/operations/summary/", summary="获取操作记录统计摘要")
def get_summary(db: Session = Depends(get_db)):
    return OperationService.get_record_summary(db)


@app.get("/report/export/", summary="导出操作记录报告")
def export_report(
    operator: Optional[str] = Query(None, description="操作人"),
    start_time: Optional[datetime] = Query(None, description="开始时间"),
    end_time: Optional[datetime] = Query(None, description="结束时间"),
    status: Optional[OperationStatus] = Query(None, description="状态"),
    exception_type: Optional[ExceptionType] = Query(None, description="异常类型"),
    operation_type: Optional[OperationType] = Query(None, description="操作类型"),
    booth: Optional[str] = Query(None, description="展位号"),
    equipment_code: Optional[str] = Query(None, description="设备编号"),
    format: str = Query("xlsx", description="导出格式: xlsx 或 csv"),
    db: Session = Depends(get_db)
):
    filter_params = QueryFilter(
        operator=operator,
        start_time=start_time,
        end_time=end_time,
        status=status,
        exception_type=exception_type,
        operation_type=operation_type,
        booth=booth,
        equipment_code=equipment_code
    )

    output = ReportService.export_records(db, filter_params, format)

    media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" if format == "xlsx" else "text/csv"
    file_ext = "xlsx" if format == "xlsx" else "csv"

    return StreamingResponse(
        output,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename=operation_report.{file_ext}"}
    )


@app.get("/stock/current/", summary="获取当前库存状态")
def get_current_stock(db: Session = Depends(get_db)):
    return ReportService.get_current_stock(db)


@app.get("/stock/export/", summary="导出库存快照报告")
def export_stock_report(
    format: str = Query("xlsx", description="导出格式: xlsx 或 csv"),
    db: Session = Depends(get_db)
):
    output = ReportService.export_stock_snapshot(db, format)

    media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" if format == "xlsx" else "text/csv"
    file_ext = "xlsx" if format == "xlsx" else "csv"

    return StreamingResponse(
        output,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename=stock_snapshot.{file_ext}"}
    )


@app.get("/audit/{record_id}/", summary="获取审计日志")
def get_audit_logs(record_id: int, db: Session = Depends(get_db)):
    from src.models import AuditLog
    logs = db.query(AuditLog).filter(AuditLog.record_id == record_id).all()

    return [
        {
            "id": log.id,
            "action": log.action,
            "operator": log.operator,
            "role": log.role.value,
            "old_value": log.old_value,
            "new_value": log.new_value,
            "operated_at": log.operated_at
        }
        for log in logs
    ]
