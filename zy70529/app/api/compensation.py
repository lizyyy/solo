from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import pandas as pd
import os
from datetime import datetime

from app.database import get_db
from app.services import CompensationService
from app.schemas import (
    CompensationRecordCreate, CompensationRecordResponse, CompensationHistoryResponse,
    CompensationBatchResponse, CompensationReportResponse, ManualFixRequest,
    BatchCreateRequest, QueryRequest, PaginatedResponse, ExportRequest
)

router = APIRouter()


@router.post("/records", response_model=CompensationRecordResponse, summary="创建补偿记录")
def create_record(record_data: CompensationRecordCreate, db: Session = Depends(get_db)):
    try:
        service = CompensationService(db)
        return service.create_record(record_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/records/batch", response_model=CompensationBatchResponse, summary="批量创建补偿记录")
def create_batch_records(batch_data: BatchCreateRequest, db: Session = Depends(get_db)):
    service = CompensationService(db)
    return service.create_batch(batch_data.queue_name, batch_data.records)


@router.get("/records/{record_id}", response_model=CompensationRecordResponse, summary="获取单个补偿记录")
def get_record(record_id: int, db: Session = Depends(get_db)):
    service = CompensationService(db)
    record = service.get_record(record_id)
    if not record:
        raise HTTPException(status_code=404, detail="补偿记录不存在")
    return record


@router.get("/records/business/{business_no}", response_model=CompensationRecordResponse, summary="根据业务单号获取记录")
def get_record_by_business_no(business_no: str, db: Session = Depends(get_db)):
    service = CompensationService(db)
    record = service.get_record_by_business_no(business_no)
    if not record:
        raise HTTPException(status_code=404, detail="未找到该业务单据的补偿记录")
    return record


@router.post("/records/query", response_model=PaginatedResponse, summary="查询补偿记录列表")
def query_records(query: QueryRequest, db: Session = Depends(get_db)):
    service = CompensationService(db)
    records, total = service.query_records(
        queue_name=query.queue_name,
        business_no=query.business_no,
        status=query.status,
        batch_id=query.batch_id,
        page=query.page,
        page_size=query.page_size
    )
    return {
        "total": total,
        "page": query.page,
        "page_size": query.page_size,
        "items": records
    }


@router.get("/records/{record_id}/history", response_model=List[CompensationHistoryResponse], summary="获取记录的历史变更")
def get_record_history(record_id: int, db: Session = Depends(get_db)):
    service = CompensationService(db)
    return service.get_record_history(record_id)


@router.post("/records/{record_id}/process", response_model=CompensationRecordResponse, summary="开始处理记录")
def process_record(record_id: int, db: Session = Depends(get_db)):
    try:
        service = CompensationService(db)
        return service.process_record(record_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/records/{record_id}/success", response_model=CompensationRecordResponse, summary="标记处理成功")
def handle_success(record_id: int, process_basis: str, final_conclusion: str, db: Session = Depends(get_db)):
    try:
        service = CompensationService(db)
        return service.handle_success(record_id, process_basis, final_conclusion)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/records/{record_id}/failure", response_model=CompensationRecordResponse, summary="标记处理失败")
def handle_failure(record_id: int, error_message: str, process_basis: str = None, final_conclusion: str = None, db: Session = Depends(get_db)):
    try:
        service = CompensationService(db)
        return service.handle_failure(record_id, error_message, process_basis, final_conclusion)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/records/manual-fix", response_model=CompensationRecordResponse, summary="人工修正")
def manual_fix(request: ManualFixRequest, db: Session = Depends(get_db)):
    try:
        service = CompensationService(db)
        return service.manual_fix(
            business_no=request.business_no,
            final_conclusion=request.final_conclusion,
            process_basis=request.process_basis,
            operator=request.operator
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/records/{record_id}/skip", response_model=CompensationRecordResponse, summary="跳过处理")
def skip_record(record_id: int, operator: str = "system", remark: str = "跳过处理", db: Session = Depends(get_db)):
    try:
        service = CompensationService(db)
        return service.skip_record(record_id, operator, remark)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/batches/{batch_id}", response_model=CompensationBatchResponse, summary="获取批次信息")
def get_batch(batch_id: str, db: Session = Depends(get_db)):
    service = CompensationService(db)
    batch = service.get_batch(batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    return batch


@router.post("/export", summary="导出补偿记录")
def export_records(export_request: ExportRequest, db: Session = Depends(get_db)):
    service = CompensationService(db)
    export_data = service.export_records(
        queue_name=export_request.queue_name,
        batch_id=export_request.batch_id,
        status=export_request.status,
        start_time=export_request.start_time,
        end_time=export_request.end_time
    )

    if not export_data:
        raise HTTPException(status_code=404, detail="没有可导出的数据")

    os.makedirs("exports", exist_ok=True)
    filename = f"compensation_export_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"
    file_path = os.path.join("exports", filename)

    df = pd.DataFrame(export_data)
    df.to_excel(file_path, index=False, engine="openpyxl")

    return {
        "success": True,
        "file_path": file_path,
        "total_count": len(export_data),
        "message": f"成功导出{len(export_data)}条记录"
    }


@router.post("/reports", response_model=CompensationReportResponse, summary="生成补偿报告")
def create_report(export_request: ExportRequest, created_by: str = "system", db: Session = Depends(get_db)):
    service = CompensationService(db)
    return service.create_report(
        batch_id=export_request.batch_id,
        queue_name=export_request.queue_name,
        start_time=export_request.start_time,
        end_time=export_request.end_time,
        created_by=created_by
    )


@router.get("/reports/{report_id}", response_model=CompensationReportResponse, summary="获取补偿报告")
def get_report(report_id: str, db: Session = Depends(get_db)):
    service = CompensationService(db)
    report = service.get_report(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="报告不存在")
    return report
