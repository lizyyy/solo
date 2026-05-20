from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import io
import pandas as pd

from app.database import get_db
from app.services import CustomsService
from app.schemas import (
    DeclarationBatch as DeclarationBatchSchema,
    DeclarationItem as DeclarationItemSchema,
    HsCode as HsCodeSchema,
    RejectionNotice as RejectionNoticeSchema,
    TaxCertificate as TaxCertificateSchema,
    OperationLog as OperationLogSchema,
    BatchDetailResponse, ItemDetailResponse,
    TaxCertificateTraceResponse
)
from app.models import (
    DeclarationBatch, DeclarationItem, HsCode, RejectionNotice,
    TaxCertificate, OperationLog, DeclarationItemStatus, BatchStatus
)

router = APIRouter(prefix="/api", tags=["customs"])


@router.post("/hs-codes/import", response_model=List[HsCodeSchema])
async def import_hs_codes(
    json_file: UploadFile = File(...),
    operator: str = "system",
    db: Session = Depends(get_db)
):
    content = await json_file.read()
    service = CustomsService(db)
    try:
        return service.import_hs_codes_from_json(content.decode("utf-8"), operator)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/batches/import", response_model=DeclarationBatchSchema)
async def import_declaration_batch(
    csv_file: UploadFile = File(...),
    batch_no: str = "",
    operator: str = "system",
    declaration_port: Optional[str] = None,
    declaration_date: Optional[datetime] = None,
    ebp_no: Optional[str] = None,
    currency: str = "CNY",
    db: Session = Depends(get_db)
):
    service = CustomsService(db)
    try:
        content = await csv_file.read()
        csv_file_like = io.BytesIO(content)
        return service.import_declaration_from_csv(
            csv_file_like, batch_no, operator, declaration_port, declaration_date, ebp_no, currency
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/rejection-notices", response_model=RejectionNoticeSchema)
async def create_rejection_notice(
    batch_id: int,
    rejection_no: str,
    rejection_reason: str,
    handler: str,
    rejection_date: Optional[datetime] = None,
    rejection_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    service = CustomsService(db)
    try:
        return service.import_rejection_notice(
            batch_id, rejection_no, rejection_reason, handler, rejection_date, rejection_type
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/items/{item_id}/convert-currency", response_model=DeclarationItemSchema)
async def convert_item_currency(
    item_id: int,
    target_currency: str,
    exchange_rate: float,
    operator: str,
    reason: str,
    db: Session = Depends(get_db)
):
    service = CustomsService(db)
    try:
        return service.convert_currency(item_id, target_currency, exchange_rate, operator, reason)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/items/merge-category", response_model=List[DeclarationItemSchema])
async def merge_items_category(
    item_ids: List[int],
    target_category_code: str,
    target_category_name: str,
    operator: str,
    reason: str,
    db: Session = Depends(get_db)
):
    service = CustomsService(db)
    try:
        return service.merge_category(item_ids, target_category_code, target_category_name, operator, reason)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/items/{item_id}/supplement-tax", response_model=TaxCertificateSchema)
async def supplement_item_tax(
    item_id: int,
    certificate_no: str,
    tax_amount: float,
    reason: str,
    operator: str,
    tax_type: str = "补税",
    certificate_type: str = "补税凭证",
    source_type: Optional[str] = None,
    source_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    service = CustomsService(db)
    try:
        return service.process_supplement_tax(
            item_id, certificate_no, tax_amount, reason, operator,
            tax_type, certificate_type, source_type, source_id
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/items/{item_id}/status", response_model=DeclarationItemSchema)
async def update_item_status(
    item_id: int,
    status: DeclarationItemStatus,
    operator: str,
    remark: Optional[str] = None,
    db: Session = Depends(get_db)
):
    service = CustomsService(db)
    try:
        return service.mark_item_processed(item_id, operator, status, remark)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/items/{item_id}/return", response_model=DeclarationItemSchema)
async def return_item_for_correction(
    item_id: int,
    operator: str,
    reason: str,
    db: Session = Depends(get_db)
):
    service = CustomsService(db)
    try:
        return service.return_item_for_correction(item_id, operator, reason)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/items/export")
async def export_items(
    batch_id: Optional[int] = None,
    status: Optional[DeclarationItemStatus] = None,
    hs_code: Optional[str] = None,
    is_supplement_tax: Optional[bool] = None,
    operator: Optional[str] = None,
    db: Session = Depends(get_db)
):
    service = CustomsService(db)
    items = service.export_items(batch_id, status, hs_code, is_supplement_tax, operator)

    data = []
    for item in items:
        data.append({
            "ID": item.id,
            "批次ID": item.batch_id,
            "项号": item.item_no,
            "SKU": item.sku,
            "商品名称": item.product_name,
            "规格型号": item.specification,
            "HS编码": item.hs_code,
            "原产国": item.origin_country,
            "数量": item.quantity,
            "单位": item.unit,
            "单价": item.unit_price,
            "总价": item.total_price,
            "币制": item.currency,
            "汇率": item.exchange_rate,
            "总价(人民币)": item.total_price_cny,
            "税率": item.tax_rate,
            "税额": item.tax_amount_cny,
            "品类编码": item.category_code,
            "品类名称": item.category_name,
            "状态": item.status,
            "是否补税": item.is_supplement_tax,
            "补税次数": item.supplement_tax_count,
            "备注": item.remark,
            "创建时间": item.created_at
        })

    df = pd.DataFrame(data)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="申报明细")
    output.seek(0)

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=declaration_items_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"}
    )


@router.get("/batches/{batch_no}", response_model=BatchDetailResponse)
async def get_batch_by_no(
    batch_no: str,
    db: Session = Depends(get_db)
):
    service = CustomsService(db)
    batch = service.query_by_batch_no(batch_no)
    if not batch:
        raise HTTPException(status_code=404, detail="申报批次不存在")
    return batch


@router.get("/rejection-notices/{rejection_no}", response_model=RejectionNoticeSchema)
async def get_rejection_notice(
    rejection_no: str,
    db: Session = Depends(get_db)
):
    service = CustomsService(db)
    notice = service.query_by_rejection_no(rejection_no)
    if not notice:
        raise HTTPException(status_code=404, detail="退单通知不存在")
    return notice


@router.get("/tax-certificates/{certificate_no}", response_model=TaxCertificateSchema)
async def get_tax_certificate(
    certificate_no: str,
    db: Session = Depends(get_db)
):
    service = CustomsService(db)
    certificate = service.query_tax_certificate(certificate_no)
    if not certificate:
        raise HTTPException(status_code=404, detail="补税凭证不存在")
    return certificate


@router.get("/tax-certificates/{certificate_no}/trace", response_model=TaxCertificateTraceResponse)
async def trace_tax_certificate(
    certificate_no: str,
    db: Session = Depends(get_db)
):
    service = CustomsService(db)
    trace_data = service.trace_tax_certificate(certificate_no)
    if not trace_data:
        raise HTTPException(status_code=404, detail="补税凭证不存在")
    return trace_data


@router.get("/batches", response_model=List[DeclarationBatchSchema])
async def list_batches(
    status: Optional[BatchStatus] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    from sqlalchemy import desc
    query = db.query(DeclarationBatch)
    if status:
        query = query.filter(DeclarationBatch.status == status)
    batches = query.order_by(desc(DeclarationBatch.created_at)).offset(skip).limit(limit).all()
    return batches


@router.get("/items/{item_id}", response_model=ItemDetailResponse)
async def get_item_detail(
    item_id: int,
    db: Session = Depends(get_db)
):
    item = db.query(DeclarationItem).filter(DeclarationItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="申报明细不存在")
    return item


@router.get("/operation-logs", response_model=List[OperationLogSchema])
async def list_operation_logs(
    batch_id: Optional[int] = None,
    item_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    from sqlalchemy import desc
    query = db.query(OperationLog)
    if batch_id:
        query = query.filter(OperationLog.batch_id == batch_id)
    if item_id:
        query = query.filter(OperationLog.item_id == item_id)
    logs = query.order_by(desc(OperationLog.operation_time)).offset(skip).limit(limit).all()
    return logs
