from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import uuid
import io

from .database import engine, get_db, Base
from . import models, schemas, crud, reconciliation, report_generator

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="市政运维对账服务",
    description="智慧路灯故障派修对账系统 - 告警、巡查、维修单自动比对与人工复核",
    version="1.0.0"
)


@app.post("/import/alarms/csv", response_model=schemas.ImportResult, tags=["数据导入"])
async def import_alarms_csv(
    file: UploadFile = File(...),
    source_file: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """导入告警CSV文件"""
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="仅支持CSV文件")
    
    filename = source_file or file.filename
    content = await file.read()
    
    result = crud.import_alarms_from_csv(db, content, filename)
    return result


@app.post("/import/inspections/json", response_model=schemas.ImportResult, tags=["数据导入"])
async def import_inspections_json(
    file: UploadFile = File(...),
    source_file: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """导入巡查JSON文件"""
    if not file.filename.endswith('.json'):
        raise HTTPException(status_code=400, detail="仅支持JSON文件")
    
    filename = source_file or file.filename
    content = await file.read()
    
    result = crud.import_inspections_from_json(db, content, filename)
    return result


@app.post("/import/work-orders/csv", response_model=schemas.ImportResult, tags=["数据导入"])
async def import_work_orders_csv(
    file: UploadFile = File(...),
    source_file: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """导入维修单CSV文件"""
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="仅支持CSV文件")
    
    filename = source_file or file.filename
    content = await file.read()
    
    result = crud.import_work_orders_from_csv(db, content, filename)
    return result


@app.get("/alarms", response_model=List[schemas.Alarm], tags=["数据查询"])
def list_alarms(
    pole_id: Optional[str] = None,
    light_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """查询告警列表"""
    return crud.get_alarms(db, pole_id=pole_id, light_id=light_id, skip=skip, limit=limit)


@app.get("/inspections", response_model=List[schemas.Inspection], tags=["数据查询"])
def list_inspections(
    pole_id: Optional[str] = None,
    light_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """查询巡查列表"""
    return crud.get_inspections(db, pole_id=pole_id, light_id=light_id, skip=skip, limit=limit)


@app.get("/work-orders", response_model=List[schemas.WorkOrder], tags=["数据查询"])
def list_work_orders(
    pole_id: Optional[str] = None,
    light_id: Optional[str] = None,
    order_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """查询维修单列表"""
    return crud.get_work_orders(db, pole_id=pole_id, light_id=light_id, order_id=order_id, skip=skip, limit=limit)


@app.post("/reconciliation/start", response_model=schemas.ReconciliationBatch, tags=["对账处理"])
def start_reconciliation(
    batch_data: schemas.ReconciliationBatchCreate,
    db: Session = Depends(get_db)
):
    """创建新的对账批次"""
    batch = reconciliation.create_reconciliation_batch(db, batch_data)
    return batch


@app.post("/reconciliation/{batch_id}/run", response_model=schemas.ReconciliationResult, tags=["对账处理"])
def run_reconciliation(
    batch_id: str,
    db: Session = Depends(get_db)
):
    """执行自动比对"""
    result = reconciliation.run_reconciliation(db, batch_id)
    return result


@app.get("/reconciliation/{batch_id}/summary", tags=["对账处理"])
def get_reconciliation_summary(
    batch_id: str,
    db: Session = Depends(get_db)
):
    """获取对账汇总信息"""
    summary = reconciliation.get_reconciliation_summary(db, batch_id)
    return summary


@app.get("/reconciliation/{batch_id}/records", response_model=List[schemas.ReconciliationRecord], tags=["对账处理"])
def list_reconciliation_records(
    batch_id: str,
    status: Optional[schemas.ReconciliationStatus] = None,
    review_status: Optional[schemas.ReviewStatus] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """获取对账记录列表"""
    records = reconciliation.get_reconciliation_records(
        db, batch_id, status=status, review_status=review_status, skip=skip, limit=limit
    )
    return records


@app.get("/reconciliation/record/{record_id}", response_model=schemas.ReconciliationRecord, tags=["对账处理"])
def get_reconciliation_record(
    record_id: int,
    db: Session = Depends(get_db)
):
    """获取单条对账记录详情"""
    record = reconciliation.get_reconciliation_record(db, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="对账记录不存在")
    return record


@app.post("/review", response_model=schemas.ReconciliationRecord, tags=["人工复核"])
def review_record(
    review_request: schemas.ReviewRequest,
    db: Session = Depends(get_db)
):
    """人工复核对账记录"""
    record = reconciliation.review_record(db, review_request)
    if not record:
        raise HTTPException(status_code=404, detail="对账记录不存在")
    return record


@app.post("/reconciliation/{batch_id}/recalculate", response_model=schemas.ReconciliationResult, tags=["对账处理"])
def recalculate_reconciliation(
    batch_id: str,
    db: Session = Depends(get_db)
):
    """重新计算对账结果"""
    result = reconciliation.recalculate_reconciliation(db, batch_id)
    return result


@app.get("/trace/work-order/{order_id}", response_model=schemas.TraceDetail, tags=["全链路追踪"])
def trace_work_order(
    order_id: str,
    db: Session = Depends(get_db)
):
    """从维修单号追踪全链路信息"""
    trace_info = reconciliation.trace_by_work_order(db, order_id)
    if not trace_info:
        raise HTTPException(status_code=404, detail="未找到相关记录")
    return trace_info


@app.get("/trace/alarm/{alarm_id}", response_model=schemas.TraceDetail, tags=["全链路追踪"])
def trace_alarm(
    alarm_id: str,
    db: Session = Depends(get_db)
):
    """从告警ID追踪全链路信息"""
    trace_info = reconciliation.trace_by_alarm(db, alarm_id)
    if not trace_info:
        raise HTTPException(status_code=404, detail="未找到相关记录")
    return trace_info


@app.get("/report/{batch_id}/summary", response_model=schemas.ReportSummary, tags=["报告生成"])
def get_report_summary(
    batch_id: str,
    db: Session = Depends(get_db)
):
    """获取报告汇总数据"""
    report = report_generator.generate_report_summary(db, batch_id)
    if not report:
        raise HTTPException(status_code=404, detail="对账批次不存在")
    return report


@app.get("/report/{batch_id}/download/excel", tags=["报告生成"])
def download_excel_report(
    batch_id: str,
    db: Session = Depends(get_db)
):
    """下载Excel格式对账报告"""
    excel_content = report_generator.generate_excel_report(db, batch_id)
    
    return StreamingResponse(
        io.BytesIO(excel_content),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename=reconciliation_report_{batch_id}.xlsx"
        }
    )


@app.get("/report/{batch_id}/details", tags=["报告生成"])
def get_report_details(
    batch_id: str,
    db: Session = Depends(get_db)
):
    """获取报告详细数据"""
    details = report_generator.generate_report_details(db, batch_id)
    if not details:
        raise HTTPException(status_code=404, detail="对账批次不存在")
    return details


@app.get("/batches", response_model=List[schemas.ReconciliationBatch], tags=["对账批次"])
def list_batches(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """获取对账批次列表"""
    return crud.get_batches(db, skip=skip, limit=limit)


@app.get("/batches/{batch_id}", response_model=schemas.ReconciliationBatch, tags=["对账批次"])
def get_batch(
    batch_id: str,
    db: Session = Depends(get_db)
):
    """获取对账批次详情"""
    batch = crud.get_batch_by_id(db, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="对账批次不存在")
    return batch


@app.get("/health", tags=["系统"])
def health_check():
    """健康检查"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}
