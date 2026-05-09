from fastapi import FastAPI, Depends, HTTPException, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List
import io

from app.db import get_db, engine, Base
from app.models import (
    EnterpriseCustomer, Receipt, SignatureRecord, 
    ReprintPermission, DownloadLog, AuditLog
)
from app.schemas import (
    PermissionRequest, DownloadRequest, DownloadResult,
    ExportRequest, ExportItem, ValidationResult
)
from app.services.receipt_service import ReceiptService
from app.services.export_service import ExportService
from app.config import settings

Base.metadata.create_all(bind=engine)

app = FastAPI(title=settings.app_name, version="1.0.0")


def setup_test_data(db: Session):
    existing_customer = db.query(EnterpriseCustomer).filter(
        EnterpriseCustomer.customer_id == "CUST001"
    ).first()
    
    if existing_customer:
        return
    
    customer = EnterpriseCustomer(
        customer_id="CUST001",
        customer_name="测试企业有限公司",
        company_type="LIMITED_LIABILITY",
        status="ACTIVE"
    )
    db.add(customer)
    
    receipts = [
        Receipt(
            receipt_index=f"RCPT_202401{str(i).zfill(2)}_001",
            original_transaction_id=f"TXN_202401{str(i).zfill(2)}_00{i}",
            customer_id="CUST001",
            transaction_type="TRANSFER",
            transaction_amount=100000 * i,
            transaction_currency="CNY",
            transaction_date=datetime(2024, 1, i, 10, 0, 0),
            counterparty_name=f"供应商{i}公司",
            counterparty_account=f"123456{i}",
            payer_account="9876543210",
            payer_name="测试企业有限公司",
            original_receipt_path=f"/receipts/RCPT_202401{str(i).zfill(2)}_001.pdf"
        )
        for i in range(1, 4)
    ]
    db.add_all(receipts)
    db.flush()
    
    signatures = [
        SignatureRecord(
            receipt_id=receipt.id,
            receipt_index=receipt.receipt_index,
            original_transaction_id=receipt.original_transaction_id,
            signature_value=f"SIGNATURE_{i}",
            signature_algorithm="SHA256",
            signed_at=datetime(2024, 1, i, 10, 5, 0),
            verification_status="VERIFIED",
            verified_at=datetime(2024, 1, i, 10, 6, 0),
            verified_by="SYSTEM"
        )
        for i, receipt in enumerate(receipts, 1)
    ]
    db.add_all(signatures)
    
    db.commit()


@app.on_event("startup")
def startup_event():
    with Session(engine) as db:
        setup_test_data(db)


@app.post("/api/permissions/", response_model=dict)
def create_permission(request: PermissionRequest, db: Session = Depends(get_db)):
    service = ReceiptService(db)
    permission, result = service.create_permission(request)
    
    if not result.valid:
        raise HTTPException(
            status_code=400,
            detail={
                "success": False,
                "errors": result.errors,
                "warnings": result.warnings
            }
        )
    
    return {
        "success": True,
        "permission_id": permission.permission_id,
        "max_download_count": permission.max_download_count,
        "valid_until": permission.valid_until.isoformat()
    }


@app.post("/api/download/", response_model=DownloadResult)
def download_receipt(request: DownloadRequest, db: Session = Depends(get_db)):
    service = ReceiptService(db)
    result = service.download_receipt(request)
    
    if not result.success:
        raise HTTPException(
            status_code=400,
            detail={
                "success": False,
                "receipt_index": request.receipt_index,
                "error_message": result.error_message
            }
        )
    
    return result


@app.post("/api/export/csv")
def export_csv(request: ExportRequest, db: Session = Depends(get_db)):
    service = ReceiptService(db)
    items = service.get_export_items(
        customer_id=request.customer_id,
        start_date=request.start_date,
        end_date=request.end_date
    )
    
    validation = ExportService.validate_export_data(items)
    if not validation["valid"]:
        raise HTTPException(
            status_code=400,
            detail={"success": False, "errors": validation["errors"]}
        )
    
    csv_content = ExportService.export_to_csv(
        items=items,
        customer_id=request.customer_id,
        export_time=datetime.utcnow()
    )
    
    filename = f"reprint_summary_{request.customer_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    
    return Response(
        content=csv_content.encode("utf-8-sig"),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )


@app.post("/api/export/json")
def export_json(request: ExportRequest, db: Session = Depends(get_db)):
    service = ReceiptService(db)
    items = service.get_export_items(
        customer_id=request.customer_id,
        start_date=request.start_date,
        end_date=request.end_date
    )
    
    validation = ExportService.validate_export_data(items)
    if not validation["valid"]:
        raise HTTPException(
            status_code=400,
            detail={"success": False, "errors": validation["errors"]}
        )
    
    json_content = ExportService.export_to_json(
        items=items,
        customer_id=request.customer_id,
        export_time=datetime.utcnow()
    )
    
    return Response(
        content=json_content,
        media_type="application/json; charset=utf-8"
    )


@app.get("/api/permissions/{permission_id}")
def get_permission(permission_id: str, db: Session = Depends(get_db)):
    permission = db.query(ReprintPermission).filter(
        ReprintPermission.permission_id == permission_id
    ).first()
    
    if not permission:
        raise HTTPException(status_code=404, detail="权限不存在")
    
    return {
        "permission_id": permission.permission_id,
        "receipt_index": permission.receipt_index,
        "original_transaction_id": permission.original_transaction_id,
        "max_download_count": permission.max_download_count,
        "current_download_count": permission.current_download_count,
        "is_active": permission.is_active,
        "valid_from": permission.valid_from.isoformat(),
        "valid_until": permission.valid_until.isoformat()
    }


@app.get("/api/audit-logs/")
def list_audit_logs(
    operator_id: str = None,
    receipt_index: str = None,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(AuditLog)
    
    if operator_id:
        query = query.filter(AuditLog.operator_id == operator_id)
    if receipt_index:
        query = query.filter(AuditLog.receipt_index == receipt_index)
    
    logs = query.order_by(AuditLog.operated_at.desc()).limit(limit).all()
    
    return {
        "count": len(logs),
        "logs": [
            {
                "audit_id": log.audit_id,
                "operation_type": log.operation_type,
                "operator_name": log.operator_name,
                "receipt_index": log.receipt_index,
                "operation_result": log.operation_result,
                "operated_at": log.operated_at.isoformat(),
                "operation_details": log.operation_details
            }
            for log in logs
        ]
    }


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": settings.app_name}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)