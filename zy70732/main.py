from datetime import datetime
from typing import Optional, List
from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from pydantic import BaseModel, Field

from models import Base, TrialStatus, SourceType, FeaturePackage
from services import TrialService

DATABASE_URL = "sqlite:///./trial_management.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="租户功能权益试用回收API", version="1.0.0")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class CreateTrialRequest(BaseModel):
    tenant_id: str = Field(..., description="租户ID")
    feature_package: FeaturePackage = Field(..., description="功能包")
    trial_days: int = Field(..., gt=0, description="试用天数")
    source: SourceType = Field(..., description="开通来源")
    source_id: str = Field(..., description="来源ID")
    created_by: str = Field(..., description="创建人")
    tenant_name: Optional[str] = Field(None, description="租户名称")
    remarks: Optional[str] = Field(None, description="备注")


class AdvanceStatusRequest(BaseModel):
    operated_by: str = Field(..., description="操作人")


class CorrectStatusRequest(BaseModel):
    new_status: TrialStatus = Field(..., description="新状态")
    reason: str = Field(..., description="修正原因")
    operated_by: str = Field(..., description="操作人")


class CloseTrialRequest(BaseModel):
    reason: str = Field(..., description="关闭原因")
    operated_by: str = Field(..., description="操作人")


class ExecuteRecycleRequest(BaseModel):
    operated_by: str = Field(..., description="操作人")


class TrialResponse(BaseModel):
    id: int
    tenant_id: str
    feature_package: str
    status: str
    trial_days: int
    start_date: Optional[datetime]
    end_date: Optional[datetime]
    source: str
    source_id: Optional[str]
    created_by: str
    created_at: datetime
    updated_at: datetime
    remarks: Optional[str]


class SnapshotResponse(BaseModel):
    id: int
    trial_id: int
    snapshot_type: str
    snapshot_data: dict
    generated_by: str
    generated_at: datetime


class OperationLogResponse(BaseModel):
    id: int
    trial_id: int
    operation_type: str
    old_status: Optional[str]
    new_status: Optional[str]
    original_input: Optional[dict]
    operated_by: str
    reason: Optional[str]
    conclusion: Optional[str]
    created_at: datetime


class RecycleTaskResponse(BaseModel):
    id: int
    trial_id: int
    task_status: str
    scheduled_time: Optional[datetime]
    executed_time: Optional[datetime]
    executed_by: Optional[str]
    result: Optional[str]
    error_message: Optional[str]


@app.exception_handler(ValueError)
async def value_error_handler(request, exc):
    return JSONResponse(status_code=400, content={"detail": str(exc)})


@app.post("/api/trials", response_model=TrialResponse, summary="创建试用")
async def create_trial(request: CreateTrialRequest, db: Session = Depends(get_db)):
    service = TrialService(db)
    trial, is_new = service.create_trial(
        tenant_id=request.tenant_id,
        feature_package=request.feature_package.value,
        trial_days=request.trial_days,
        source=request.source.value,
        source_id=request.source_id,
        created_by=request.created_by,
        tenant_name=request.tenant_name,
        remarks=request.remarks
    )
    db.commit()
    return trial


@app.get("/api/trials", response_model=List[TrialResponse], summary="查询试用列表")
async def list_trials(
    tenant_id: Optional[str] = None,
    status: Optional[TrialStatus] = None,
    source: Optional[SourceType] = None,
    feature_package: Optional[FeaturePackage] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    service = TrialService(db)
    trials = service.list_trials(
        tenant_id=tenant_id,
        status=status.value if status else None,
        source=source.value if source else None,
        feature_package=feature_package.value if feature_package else None,
        skip=skip,
        limit=limit
    )
    return trials


@app.get("/api/trials/{trial_id}", response_model=TrialResponse, summary="查询单个试用")
async def get_trial(trial_id: int, db: Session = Depends(get_db)):
    service = TrialService(db)
    trial = service.get_trial(trial_id)
    if not trial:
        raise HTTPException(status_code=404, detail="Trial not found")
    return trial


@app.post("/api/trials/{trial_id}/advance", response_model=TrialResponse, summary="推进状态")
async def advance_status(trial_id: int, request: AdvanceStatusRequest, db: Session = Depends(get_db)):
    service = TrialService(db)
    trial = service.advance_status(trial_id, request.operated_by)
    db.commit()
    return trial


@app.post("/api/trials/{trial_id}/correct", response_model=TrialResponse, summary="人工修正状态")
async def correct_status(trial_id: int, request: CorrectStatusRequest, db: Session = Depends(get_db)):
    service = TrialService(db)
    trial = service.correct_status(trial_id, request.new_status.value, request.reason, request.operated_by)
    db.commit()
    return trial


@app.post("/api/trials/{trial_id}/close", response_model=TrialResponse, summary="关闭/撤回试用")
async def close_trial(trial_id: int, request: CloseTrialRequest, db: Session = Depends(get_db)):
    service = TrialService(db)
    trial = service.close_trial(trial_id, request.reason, request.operated_by)
    db.commit()
    return trial


@app.post("/api/trials/{trial_id}/snapshot", response_model=SnapshotResponse, summary="生成权益快照")
async def create_snapshot(trial_id: int, operated_by: str, db: Session = Depends(get_db)):
    service = TrialService(db)
    snapshot = service.create_snapshot(trial_id, operated_by)
    db.commit()
    return snapshot


@app.get("/api/trials/{trial_id}/snapshot", summary="导出权益快照")
async def export_snapshot(trial_id: int, db: Session = Depends(get_db)):
    service = TrialService(db)
    snapshot = service.create_snapshot(trial_id, "API_EXPORT")
    db.commit()
    return JSONResponse(content=snapshot.snapshot_data)


@app.get("/api/trials/{trial_id}/logs", response_model=List[OperationLogResponse], summary="查询操作日志")
async def get_operation_logs(
    trial_id: int,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    service = TrialService(db)
    logs = service.get_operation_logs(trial_id, skip, limit)
    return logs


@app.post("/api/recycle-tasks/{task_id}/execute", response_model=RecycleTaskResponse, summary="执行回收任务")
async def execute_recycle_task(task_id: int, request: ExecuteRecycleRequest, db: Session = Depends(get_db)):
    service = TrialService(db)
    task = service.execute_recycle_task(task_id, request.operated_by)
    db.commit()
    return task


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
