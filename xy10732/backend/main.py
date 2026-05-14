from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Boolean, ForeignKey, Text, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from datetime import datetime, timedelta
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import json
from collections import defaultdict

DATABASE_URL = "sqlite:///./task_calendar.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

app = FastAPI(title="定时任务日历中心")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    cron_expression = Column(String)
    description = Column(Text)
    dependencies = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    executions = relationship("TaskExecution", back_populates="task")

class TaskExecution(Base):
    __tablename__ = "task_executions"
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"))
    scheduled_time = Column(DateTime)
    actual_start_time = Column(DateTime, nullable=True)
    actual_end_time = Column(DateTime, nullable=True)
    status = Column(String)
    result = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0)
    is_missed = Column(Boolean, default=False)
    is_compensated = Column(Boolean, default=False)
    needs_review = Column(Boolean, default=False)
    resource_changes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    task = relationship("Task", back_populates="executions")

class ResourceChange(Base):
    __tablename__ = "resource_changes"
    id = Column(Integer, primary_key=True, index=True)
    resource_name = Column(String)
    change_type = Column(String)
    change_details = Column(Text)
    changed_at = Column(DateTime, default=datetime.utcnow)
    affected_tasks = Column(Text)

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class TaskCreate(BaseModel):
    name: str
    cron_expression: str
    description: str = ""
    dependencies: List[str] = []

class TaskResponse(BaseModel):
    id: int
    name: str
    cron_expression: str
    description: str
    dependencies: List[str]
    created_at: datetime
    updated_at: datetime

class ExecutionResponse(BaseModel):
    id: int
    task_id: int
    task_name: str
    scheduled_time: datetime
    actual_start_time: Optional[datetime]
    actual_end_time: Optional[datetime]
    status: str
    result: Optional[str]
    error_message: Optional[str]
    retry_count: int
    is_missed: bool
    is_compensated: bool
    needs_review: bool

class CalendarDayResponse(BaseModel):
    date: str
    executions: List[ExecutionResponse]
    stats: Dict[str, int]

@app.post("/api/tasks", response_model=TaskResponse)
def create_task(task: TaskCreate, db: Session = Depends(get_db)):
    existing = db.query(Task).filter(Task.name == task.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="任务名称已存在")
    
    db_task = Task(
        name=task.name,
        cron_expression=task.cron_expression,
        description=task.description,
        dependencies=json.dumps(task.dependencies)
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    
    generate_executions_for_task(db, db_task)
    
    return TaskResponse(
        id=db_task.id,
        name=db_task.name,
        cron_expression=db_task.cron_expression,
        description=db_task.description,
        dependencies=json.loads(db_task.dependencies),
        created_at=db_task.created_at,
        updated_at=db_task.updated_at
    )

def generate_executions_for_task(db: Session, task: Task, days: int = 90):
    from croniter import croniter
    base = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    iter = croniter(task.cron_expression, base)
    
    existing_times = set(
        exec.scheduled_time for exec in 
        db.query(TaskExecution).filter(TaskExecution.task_id == task.id).all()
    )
    
    for _ in range(days * 24):
        scheduled = iter.get_next(datetime)
        if scheduled > base + timedelta(days=days):
            break
        if scheduled not in existing_times:
            db_exec = TaskExecution(
                task_id=task.id,
                scheduled_time=scheduled,
                status="scheduled"
            )
            db.add(db_exec)
    db.commit()

@app.get("/api/tasks", response_model=List[TaskResponse])
def get_tasks(db: Session = Depends(get_db)):
    tasks = db.query(Task).all()
    return [
        TaskResponse(
            id=t.id,
            name=t.name,
            cron_expression=t.cron_expression,
            description=t.description,
            dependencies=json.loads(t.dependencies or "[]"),
            created_at=t.created_at,
            updated_at=t.updated_at
        )
        for t in tasks
    ]

@app.get("/api/calendar/{year}/{month}", response_model=List[CalendarDayResponse])
def get_calendar(year: int, month: int, db: Session = Depends(get_db)):
    start_date = datetime(year, month, 1)
    if month == 12:
        end_date = datetime(year + 1, 1, 1)
    else:
        end_date = datetime(year, month + 1, 1)
    
    executions = db.query(TaskExecution).join(Task).filter(
        TaskExecution.scheduled_time >= start_date,
        TaskExecution.scheduled_time < end_date
    ).all()
    
    days = defaultdict(list)
    for exec in executions:
        day_key = exec.scheduled_time.strftime("%Y-%m-%d")
        days[day_key].append(exec)
    
    result = []
    current = start_date
    while current < end_date:
        day_key = current.strftime("%Y-%m-%d")
        day_execs = days.get(day_key, [])
        
        stats = defaultdict(int)
        for exec in day_execs:
            stats[exec.status] += 1
            if exec.is_missed:
                stats["missed"] += 1
            if exec.is_compensated:
                stats["compensated"] += 1
        
        result.append(CalendarDayResponse(
            date=day_key,
            executions=[
                ExecutionResponse(
                    id=e.id,
                    task_id=e.task_id,
                    task_name=e.task.name,
                    scheduled_time=e.scheduled_time,
                    actual_start_time=e.actual_start_time,
                    actual_end_time=e.actual_end_time,
                    status=e.status,
                    result=e.result,
                    error_message=e.error_message,
                    retry_count=e.retry_count,
                    is_missed=e.is_missed,
                    is_compensated=e.is_compensated,
                    needs_review=e.needs_review
                )
                for e in day_execs
            ],
            stats=dict(stats)
        ))
        current += timedelta(days=1)
    
    return result

@app.post("/api/executions/{execution_id}/status")
def update_execution_status(
    execution_id: int,
    status: str,
    result: Optional[str] = None,
    error_message: Optional[str] = None,
    db: Session = Depends(get_db)
):
    execution = db.query(TaskExecution).filter(TaskExecution.id == execution_id).first()
    if not execution:
        raise HTTPException(status_code=404, detail="执行记录不存在")
    
    valid_statuses = ["scheduled", "running", "success", "failed", "blocked", "compensated", "reviewing"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail="无效的状态")
    
    execution.status = status
    if result:
        execution.result = result
    if error_message:
        execution.error_message = error_message
    
    if status == "running":
        execution.actual_start_time = datetime.utcnow()
    elif status in ["success", "failed", "compensated"]:
        execution.actual_end_time = datetime.utcnow()
    
    db.commit()
    return {"success": True}

@app.post("/api/executions/{execution_id}/compensate")
def compensate_execution(execution_id: int, db: Session = Depends(get_db)):
    execution = db.query(TaskExecution).filter(TaskExecution.id == execution_id).first()
    if not execution:
        raise HTTPException(status_code=404, detail="执行记录不存在")
    
    execution.is_compensated = True
    execution.status = "compensated"
    db.commit()
    return {"success": True}

@app.post("/api/executions/{execution_id}/review")
def mark_for_review(execution_id: int, db: Session = Depends(get_db)):
    execution = db.query(TaskExecution).filter(TaskExecution.id == execution_id).first()
    if not execution:
        raise HTTPException(status_code=404, detail="执行记录不存在")
    
    execution.needs_review = True
    execution.status = "reviewing"
    db.commit()
    return {"success": True}

@app.get("/api/stats/dashboard")
def get_dashboard_stats(db: Session = Depends(get_db)):
    now = datetime.now()
    thirty_days_ago = now - timedelta(days=30)
    
    executions = db.query(TaskExecution).filter(
        TaskExecution.scheduled_time >= thirty_days_ago
    ).all()
    
    stats = defaultdict(int)
    daily_stats = defaultdict(lambda: defaultdict(int))
    
    for exec in executions:
        stats[exec.status] += 1
        if exec.is_missed:
            stats["missed"] += 1
        if exec.is_compensated:
            stats["compensated"] += 1
        if exec.needs_review:
            stats["needs_review"] += 1
        
        day_key = exec.scheduled_time.strftime("%Y-%m-%d")
        daily_stats[day_key][exec.status] += 1
    
    task_count = db.query(Task).count()
    
    return {
        "total_tasks": task_count,
        "execution_stats": dict(stats),
        "daily_stats": dict(daily_stats)
    }

@app.get("/api/export/{year}/{month}")
def export_calendar(year: int, month: int, db: Session = Depends(get_db)):
    import pandas as pd
    from io import BytesIO
    from fastapi.responses import StreamingResponse
    
    start_date = datetime(year, month, 1)
    if month == 12:
        end_date = datetime(year + 1, 1, 1)
    else:
        end_date = datetime(year, month + 1, 1)
    
    executions = db.query(TaskExecution).join(Task).filter(
        TaskExecution.scheduled_time >= start_date,
        TaskExecution.scheduled_time < end_date
    ).all()
    
    data = []
    for exec in executions:
        data.append({
            "任务名称": exec.task.name,
            "计划时间": exec.scheduled_time.strftime("%Y-%m-%d %H:%M:%S"),
            "实际开始时间": exec.actual_start_time.strftime("%Y-%m-%d %H:%M:%S") if exec.actual_start_time else "",
            "实际结束时间": exec.actual_end_time.strftime("%Y-%m-%d %H:%M:%S") if exec.actual_end_time else "",
            "状态": exec.status,
            "是否错过": "是" if exec.is_missed else "否",
            "是否补偿": "是" if exec.is_compensated else "否",
            "需人工复核": "是" if exec.needs_review else "否",
            "重试次数": exec.retry_count,
            "结果": exec.result or "",
            "错误信息": exec.error_message or ""
        })
    
    df = pd.DataFrame(data)
    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='执行日历')
    
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=task_calendar_{year}_{month}.xlsx"}
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
