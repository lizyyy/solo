from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import io
import csv
import json
from datetime import datetime

from app.config.database import get_db
from app.utils.security import get_current_active_user
from app.utils.data_masking import mask_sensitive_data
from app.models.models import PrintBatch, LabRecord, Order, ReworkRecord, ImportRecord, User

router = APIRouter(prefix="/export", tags=["数据导出"])


def generate_csv(data, fieldnames):
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    for row in data:
        writer.writerow(row)
    output.seek(0)
    return output


@router.get("/batches")
def export_batches_csv(
    status: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = db.query(PrintBatch)
    if status:
        query = query.filter(PrintBatch.status == status)
    batches = query.all()
    
    data = []
    for batch in batches:
        row = {
            "id": batch.id,
            "batch_number": batch.batch_number,
            "paper_batch": batch.paper_batch,
            "product_name": batch.product_name,
            "customer_info": batch.customer_info,
            "operator_id": batch.operator_id,
            "cost_details": batch.cost_details,
            "status": batch.status,
            "created_at": batch.created_at.isoformat() if batch.created_at else ""
        }
        data.append(mask_sensitive_data(row, current_user.role))
    
    fieldnames = ["id", "batch_number", "paper_batch", "product_name", 
                  "customer_info", "operator_id", "cost_details", "status", "created_at"]
    output = generate_csv(data, fieldnames)
    
    filename = f"batches_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/lab-data")
def export_lab_data_csv(
    batch_id: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = db.query(LabRecord)
    if batch_id:
        query = query.filter(LabRecord.batch_id == batch_id)
    records = query.all()
    
    data = []
    for record in records:
        row = {
            "id": record.id,
            "batch_id": record.batch_id,
            "l_value": record.l_value,
            "a_value": record.a_value,
            "b_value": record.b_value,
            "delta_e": record.delta_e,
            "measurement_point": record.measurement_point,
            "operator_id": record.operator_id,
            "measured_at": record.measured_at.isoformat() if record.measured_at else "",
            "created_at": record.created_at.isoformat() if record.created_at else ""
        }
        data.append(mask_sensitive_data(row, current_user.role))
    
    fieldnames = ["id", "batch_id", "l_value", "a_value", "b_value", 
                  "delta_e", "measurement_point", "operator_id", "measured_at", "created_at"]
    output = generate_csv(data, fieldnames)
    
    filename = f"lab_data_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/orders")
def export_orders_csv(
    batch_id: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = db.query(Order)
    if batch_id:
        query = query.filter(Order.batch_id == batch_id)
    orders = query.all()
    
    data = []
    for order in orders:
        row = {
            "id": order.id,
            "batch_id": order.batch_id,
            "order_number": order.order_number,
            "product_spec": order.product_spec,
            "quantity": order.quantity,
            "customer_info": order.customer_info,
            "cost_details": order.cost_details,
            "delivery_date": order.delivery_date.isoformat() if order.delivery_date else "",
            "created_at": order.created_at.isoformat() if order.created_at else ""
        }
        data.append(mask_sensitive_data(row, current_user.role))
    
    fieldnames = ["id", "batch_id", "order_number", "product_spec", "quantity",
                  "customer_info", "cost_details", "delivery_date", "created_at"]
    output = generate_csv(data, fieldnames)
    
    filename = f"orders_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/rework")
def export_rework_csv(
    batch_id: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = db.query(ReworkRecord)
    if batch_id:
        query = query.filter(ReworkRecord.batch_id == batch_id)
    records = query.all()
    
    data = []
    for record in records:
        row = {
            "id": record.id,
            "batch_id": record.batch_id,
            "reason": record.reason,
            "rework_type": record.rework_type,
            "operator_id": record.operator_id,
            "notes": record.notes,
            "reworked_at": record.reworked_at.isoformat() if record.reworked_at else "",
            "created_at": record.created_at.isoformat() if record.created_at else ""
        }
        data.append(mask_sensitive_data(row, current_user.role))
    
    fieldnames = ["id", "batch_id", "reason", "rework_type", 
                  "operator_id", "notes", "reworked_at", "created_at"]
    output = generate_csv(data, fieldnames)
    
    filename = f"rework_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/import-records")
def export_import_records_json(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    records = db.query(ImportRecord).order_by(ImportRecord.created_at.desc()).all()
    
    data = []
    for record in records:
        data.append({
            "id": record.id,
            "file_name": record.file_name,
            "import_type": record.import_type,
            "total_records": record.total_records,
            "success_count": record.success_count,
            "error_count": record.error_count,
            "session_id": record.session_id,
            "created_at": record.created_at.isoformat() if record.created_at else ""
        })
    
    output = io.StringIO(json.dumps(data, ensure_ascii=False, indent=2))
    filename = f"import_records_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    
    return StreamingResponse(
        output,
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
