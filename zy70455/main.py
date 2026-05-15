from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from database import init_db, get_db, DutyRecord, SamplingRule, ProcessingBatch, OperationLog, CleanupCandidate
from schemas import (
    DutyRecordCreate, DutyRecordResponse,
    SamplingRuleCreate, SamplingRuleResponse,
    ProcessingBatchCreate, ProcessingBatchResponse,
    OperationLogResponse,
    CleanupCandidateCreate, CleanupCandidateResponse,
    SamplingResultResponse,
    BatchQuery, OperationLogQuery
)
from sampling_service import (
    create_sampling_rule, get_active_rule, get_rule_by_version,
    create_duty_record, batch_create_duty_records,
    sample_call_chain, log_operation,
    create_cleanup_candidate, approve_cleanup_candidate, execute_cleanup,
    get_operation_logs_by_time, get_batch_raw_records, generate_batch_id
)
from demo_data import init_all_demo_data

app = FastAPI(
    title="调用链采样导出服务",
    description="研发值班记录调用链采样导出后端服务，支持规则版本化、脏数据处理、数据安全清理",
    version="1.0.0"
)

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


@app.post("/api/demo/init", summary="初始化演示数据", tags=["演示数据"])
def init_demo_data(db: Session = Depends(get_db)):
    result = init_all_demo_data(db)
    return {"message": "演示数据初始化成功", "data": result}


@app.post("/api/rules", response_model=SamplingRuleResponse, summary="创建采样规则", tags=["采样规则"])
def create_rule(rule: SamplingRuleCreate, db: Session = Depends(get_db)):
    return create_sampling_rule(db, rule)


@app.get("/api/rules", response_model=List[SamplingRuleResponse], summary="获取所有采样规则", tags=["采样规则"])
def get_all_rules(db: Session = Depends(get_db)):
    return db.query(SamplingRule).order_by(SamplingRule.created_at.desc()).all()


@app.get("/api/rules/active", response_model=Optional[SamplingRuleResponse], summary="获取当前激活的规则", tags=["采样规则"])
def get_active_sampling_rule(department: str, db: Session = Depends(get_db)):
    return get_active_rule(db, department)


@app.get("/api/rules/{version}", response_model=Optional[SamplingRuleResponse], summary="获取指定版本的规则", tags=["采样规则"])
def get_rule(version: str, db: Session = Depends(get_db)):
    return get_rule_by_version(db, version)


@app.post("/api/batches", response_model=ProcessingBatchResponse, summary="创建处理批次", tags=["批次管理"])
def create_batch(batch: ProcessingBatchCreate, db: Session = Depends(get_db)):
    db_batch = ProcessingBatch(
        batch_id=batch.batch_id,
        rule_version=batch.rule_version,
        department=batch.department,
        start_date=batch.start_date,
        end_date=batch.end_date,
        created_by=batch.created_by,
        status="processing"
    )
    db.add(db_batch)
    db.commit()
    db.refresh(db_batch)
    return db_batch


@app.get("/api/batches", response_model=List[ProcessingBatchResponse], summary="查询批次列表", tags=["批次管理"])
def query_batches(
    batch_id: Optional[str] = None,
    department: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(ProcessingBatch)
    if batch_id:
        query = query.filter(ProcessingBatch.batch_id.contains(batch_id))
    if department:
        query = query.filter(ProcessingBatch.department.contains(department))
    if status:
        query = query.filter(ProcessingBatch.status == status)
    return query.order_by(ProcessingBatch.created_at.desc()).all()


@app.get("/api/batches/{batch_id}", response_model=Optional[ProcessingBatchResponse], summary="获取批次详情", tags=["批次管理"])
def get_batch(batch_id: str, db: Session = Depends(get_db)):
    return db.query(ProcessingBatch).filter(ProcessingBatch.batch_id == batch_id).first()


@app.get("/api/batches/{batch_id}/raw-records", response_model=List[DutyRecordResponse], summary="获取批次原始记录", tags=["批次管理"])
def get_batch_records(batch_id: str, db: Session = Depends(get_db)):
    return get_batch_raw_records(db, batch_id)


@app.post("/api/batches/{batch_id}/sample", response_model=SamplingResultResponse, summary="执行调用链采样", tags=["采样执行"])
def execute_sampling(batch_id: str, rule_version: Optional[str] = None, db: Session = Depends(get_db)):
    try:
        sampled_records, summary = sample_call_chain(db, batch_id, rule_version)
        return {
            "batch_id": batch_id,
            "rule_version": summary["rule_version"],
            "total_records": summary["total_records"],
            "sampled_count": summary["sampled_count"],
            "sampled_records": sampled_records,
            "late_receipt_count": summary["late_receipt_count"],
            "rule_snapshot": {
                "version": summary["rule_version"],
                "sampling_rate": summary["sampling_rate_used"],
                "min_incidents_threshold": summary["min_incidents_threshold"],
                "receipt_timeout_hours": summary["receipt_timeout_hours"]
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/records/batch", response_model=List[DutyRecordResponse], summary="批量创建值班记录", tags=["记录管理"])
def create_records(records: List[DutyRecordCreate], db: Session = Depends(get_db)):
    return batch_create_duty_records(db, records)


@app.get("/api/records/{record_id}", response_model=Optional[DutyRecordResponse], summary="获取单条记录详情", tags=["记录管理"])
def get_record(record_id: int, db: Session = Depends(get_db)):
    return db.query(DutyRecord).filter(DutyRecord.id == record_id).first()


@app.post("/api/cleanup/candidates", response_model=CleanupCandidateResponse, summary="创建清理候选清单", tags=["数据清理"])
def create_candidate(candidate: CleanupCandidateCreate, operator: str = Query(...), db: Session = Depends(get_db)):
    return create_cleanup_candidate(db, candidate, operator)


@app.get("/api/cleanup/candidates", response_model=List[CleanupCandidateResponse], summary="获取清理候选清单", tags=["数据清理"])
def get_candidates(status: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(CleanupCandidate)
    if status:
        query = query.filter(CleanupCandidate.status == status)
    return query.order_by(CleanupCandidate.created_at.desc()).all()


@app.post("/api/cleanup/candidates/{candidate_id}/approve", response_model=CleanupCandidateResponse, summary="审批清理候选", tags=["数据清理"])
def approve_candidate(candidate_id: str, approver: str = Query(...), db: Session = Depends(get_db)):
    try:
        return approve_cleanup_candidate(db, candidate_id, approver)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/cleanup/candidates/{candidate_id}/execute", summary="执行清理操作", tags=["数据清理"])
def execute_cleanup_operation(candidate_id: str, executor: str = Query(...), db: Session = Depends(get_db)):
    try:
        result = execute_cleanup(db, candidate_id, executor)
        return {"message": "清理执行成功", "result": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/logs", response_model=List[OperationLogResponse], summary="查询操作日志", tags=["审计日志"])
def query_logs(
    operation_type: Optional[str] = None,
    batch_id: Optional[str] = None,
    operator: Optional[str] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    query = db.query(OperationLog)
    if operation_type:
        query = query.filter(OperationLog.operation_type == operation_type)
    if batch_id:
        query = query.filter(OperationLog.batch_id == batch_id)
    if operator:
        query = query.filter(OperationLog.operator.contains(operator))
    if start_time:
        query = query.filter(OperationLog.operation_time >= start_time)
    if end_time:
        query = query.filter(OperationLog.operation_time <= end_time)
    return query.order_by(OperationLog.operation_time.desc()).all()


@app.get("/api/logs/trace", summary="根据执行时间追溯数据擦除申请", tags=["审计日志"])
def trace_cleanup_by_time(start_time: datetime, end_time: datetime, db: Session = Depends(get_db)):
    cleanup_logs = get_operation_logs_by_time(db, start_time, end_time, "execute_cleanup")
    create_logs = get_operation_logs_by_time(db, start_time, end_time, "create_cleanup_candidate")
    
    result = {
        "time_range": f"{start_time} to {end_time}",
        "cleanup_operations": [],
        "candidate_creation_operations": []
    }
    
    for log in cleanup_logs:
        result["cleanup_operations"].append({
            "operation_time": log.operation_time,
            "operator": log.operator,
            "details": log.details
        })
    
    for log in create_logs:
        result["candidate_creation_operations"].append({
            "operation_time": log.operation_time,
            "operator": log.operator,
            "details": log.details
        })
    
    return result


@app.post("/api/utils/generate-batch-id", summary="生成批次ID", tags=["工具"])
def gen_batch_id(department: str, date_str: str):
    return {"batch_id": generate_batch_id(department, date_str)}


@app.get("/", summary="服务健康检查", tags=["系统"])
def health_check():
    return {
        "status": "healthy",
        "service": "调用链采样导出服务",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat()
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
