from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import List, Optional
from datetime import datetime
import io
import pandas as pd

from database import engine, get_db
from models import Base, CrawlerTask, FailureReason, CaptchaEvent, FrequencyAnomaly, CollectionReport
from schemas import (
    CrawlerTaskCreate, CrawlerTaskResponse, TaskDetailResponse,
    CaptchaEventCreate, CaptchaEventResponse,
    ApproveRequest, RollbackRequest, CaptchaConfirmRequest,
    TaskStatus
)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="爬虫任务反封监控系统", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/tasks", response_model=CrawlerTaskResponse)
def create_task(task: CrawlerTaskCreate, db: Session = Depends(get_db)):
    existing_task = db.query(CrawlerTask).filter(
        CrawlerTask.idempotency_key == task.idempotency_key
    ).first()
    
    if existing_task:
        return existing_task
    
    db_task = CrawlerTask(
        task_id=task.task_id,
        idempotency_key=task.idempotency_key,
        target_site=task.target_site,
        proxy_pool=task.proxy_pool,
        version=task.version,
        frequency_strategy=task.frequency_strategy,
        status=TaskStatus.PENDING
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    
    return db_task

@app.get("/api/tasks", response_model=List[CrawlerTaskResponse])
def list_tasks(
    target_site: Optional[str] = None,
    proxy_pool: Optional[str] = None,
    status: Optional[str] = None,
    version: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(CrawlerTask)
    
    if target_site:
        query = query.filter(CrawlerTask.target_site.contains(target_site))
    if proxy_pool:
        query = query.filter(CrawlerTask.proxy_pool.contains(proxy_pool))
    if status:
        query = query.filter(CrawlerTask.status == status)
    if version:
        query = query.filter(CrawlerTask.version == version)
    
    return query.order_by(CrawlerTask.created_at.desc()).all()

@app.get("/api/tasks/{task_id}", response_model=TaskDetailResponse)
def get_task(task_id: str, db: Session = Depends(get_db)):
    task = db.query(CrawlerTask).filter(CrawlerTask.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@app.post("/api/tasks/{task_id}/approve", response_model=CrawlerTaskResponse)
def approve_task(task_id: str, request: ApproveRequest, db: Session = Depends(get_db)):
    task = db.query(CrawlerTask).filter(CrawlerTask.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task.status = TaskStatus.APPROVED
    task.approved_by = request.approved_by
    task.approved_at = datetime.utcnow()
    db.commit()
    db.refresh(task)
    return task

@app.post("/api/tasks/{task_id}/rollback", response_model=CrawlerTaskResponse)
def rollback_task(task_id: str, request: RollbackRequest, db: Session = Depends(get_db)):
    task = db.query(CrawlerTask).filter(CrawlerTask.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    original_task = db.query(CrawlerTask).filter(
        CrawlerTask.id == request.rolled_back_from
    ).first()
    if not original_task:
        raise HTTPException(status_code=404, detail="Original task not found")
    
    task.status = TaskStatus.ROLLED_BACK
    task.rolled_back_from = request.rolled_back_from
    task.target_site = original_task.target_site
    task.proxy_pool = original_task.proxy_pool
    task.frequency_strategy = original_task.frequency_strategy
    db.commit()
    db.refresh(task)
    return task

@app.post("/api/tasks/{task_id}/retry", response_model=CrawlerTaskResponse)
def retry_task(task_id: str, db: Session = Depends(get_db)):
    task = db.query(CrawlerTask).filter(CrawlerTask.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    new_task_id = f"{task.task_id}_retry_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
    new_idempotency_key = f"{task.idempotency_key}_retry_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
    
    new_task = CrawlerTask(
        task_id=new_task_id,
        idempotency_key=new_idempotency_key,
        target_site=task.target_site,
        proxy_pool=task.proxy_pool,
        version=task.version,
        frequency_strategy=task.frequency_strategy,
        status=TaskStatus.PENDING
    )
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    return new_task

@app.post("/api/captcha-events", response_model=CaptchaEventResponse)
def create_captcha_event(event: CaptchaEventCreate, db: Session = Depends(get_db)):
    task = db.query(CrawlerTask).filter(CrawlerTask.task_id == event.task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    db_event = CaptchaEvent(
        task_id=task.id,
        event_type=event.event_type,
        captcha_type=event.captcha_type
    )
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    return db_event

@app.post("/api/captcha-events/{event_id}/confirm", response_model=CaptchaEventResponse)
def confirm_captcha_event(event_id: int, request: CaptchaConfirmRequest, db: Session = Depends(get_db)):
    event = db.query(CaptchaEvent).filter(CaptchaEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Captcha event not found")
    
    event.confirmed = True
    event.confirmed_by = request.confirmed_by
    event.confirmed_at = datetime.utcnow()
    db.commit()
    db.refresh(event)
    return event

@app.get("/api/export")
def export_data(
    target_site: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(CrawlerTask)
    
    if target_site:
        query = query.filter(CrawlerTask.target_site.contains(target_site))
    if status:
        query = query.filter(CrawlerTask.status == status)
    
    tasks = query.all()
    
    data = []
    for task in tasks:
        failure_count = sum(fr.count for fr in task.failure_reasons)
        captcha_count = len(task.captcha_events)
        anomaly_count = len([a for a in task.frequency_anomalies if not a.resolved])
        
        latest_report = None
        if task.collection_reports:
            latest_report = sorted(task.collection_reports, key=lambda x: x.report_date, reverse=True)[0]
        
        data.append({
            "任务ID": task.task_id,
            "目标站点": task.target_site,
            "代理池": task.proxy_pool,
            "状态": task.status,
            "版本": task.version,
            "失败原因数量": failure_count,
            "验证码事件数量": captcha_count,
            "未解决频率异常": anomaly_count,
            "成功率": latest_report.success_rate if latest_report else None,
            "创建时间": task.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            "审批人": task.approved_by,
            "审批时间": task.approved_at.strftime("%Y-%m-%d %H:%M:%S") if task.approved_at else None
        })
    
    df = pd.DataFrame(data)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='监控数据')
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=crawler_monitor_{datetime.utcnow().strftime('%Y%m%d')}.xlsx"}
    )

@app.get("/api/versions")
def get_versions(db: Session = Depends(get_db)):
    versions = db.query(CrawlerTask.version).filter(
        CrawlerTask.version.isnot(None)
    ).distinct().all()
    return [v[0] for v in versions]

@app.get("/api/target-sites")
def get_target_sites(db: Session = Depends(get_db)):
    sites = db.query(CrawlerTask.target_site).distinct().all()
    return [s[0] for s in sites]

@app.get("/api/proxy-pools")
def get_proxy_pools(db: Session = Depends(get_db)):
    pools = db.query(CrawlerTask.proxy_pool).distinct().all()
    return [p[0] for p in pools]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)