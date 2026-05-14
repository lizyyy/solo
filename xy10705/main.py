from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
import enum

DATABASE_URL = "sqlite:///./task_queue.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class TaskStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    SUCCESS = "success"
    FAILED = "failed"
    DEAD_LETTER = "dead_letter"

class TaskPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True)
    task_type = Column(String, index=True)
    original_input = Column(Text)
    processed_result = Column(Text, nullable=True)
    priority = Column(String, default=TaskPriority.MEDIUM)
    status = Column(String, default=TaskStatus.PENDING)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    dead_letter_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    versions = relationship("TaskVersion", back_populates="task")
    executions = relationship("TaskExecution", back_populates="task")

class TaskVersion(Base):
    __tablename__ = "task_versions"
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"))
    version_number = Column(Integer)
    original_input = Column(Text)
    processed_result = Column(Text, nullable=True)
    modified_by = Column(String, default="system")
    modification_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    task = relationship("Task", back_populates="versions")

class TaskExecution(Base):
    __tablename__ = "task_executions"
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"))
    status = Column(String)
    executed_by = Column(String, default="system")
    execution_reason = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    task = relationship("Task", back_populates="executions")

Base.metadata.create_all(bind=engine)

app = FastAPI(title="异步任务队列看板")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.responses import FileResponse

@app.get("/")
async def read_root():
    return FileResponse("index.html")

@app.get("/index.html")
async def read_index():
    return FileResponse("index.html")

class TaskCreate(BaseModel):
    task_type: str
    original_input: str
    priority: TaskPriority = TaskPriority.MEDIUM
    max_retries: int = 3

class TaskUpdate(BaseModel):
    original_input: Optional[str] = None
    priority: Optional[TaskPriority] = None
    processed_result: Optional[str] = None

class TaskReview(BaseModel):
    modified_input: str
    modification_reason: str
    modified_by: str = "operator"

class TaskRetry(BaseModel):
    execution_reason: str
    executed_by: str = "operator"

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/api/tasks")
def get_tasks(status: Optional[str] = None, task_type: Optional[str] = None):
    db = next(get_db())
    query = db.query(Task)
    if status:
        query = query.filter(Task.status == status)
    if task_type:
        query = query.filter(Task.task_type == task_type)
    tasks = query.order_by(Task.created_at.desc()).all()
    return {"tasks": [
        {
            "id": t.id,
            "task_type": t.task_type,
            "original_input": t.original_input,
            "processed_result": t.processed_result,
            "priority": t.priority,
            "status": t.status,
            "retry_count": t.retry_count,
            "max_retries": t.max_retries,
            "dead_letter_reason": t.dead_letter_reason,
            "created_at": t.created_at,
            "updated_at": t.updated_at
        } for t in tasks
    ]}

@app.get("/api/tasks/{task_id}")
def get_task(task_id: int):
    db = next(get_db())
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    versions = db.query(TaskVersion).filter(TaskVersion.task_id == task_id).order_by(TaskVersion.version_number.desc()).all()
    executions = db.query(TaskExecution).filter(TaskExecution.task_id == task_id).order_by(TaskExecution.started_at.desc()).all()
    return {
        "task": {
            "id": task.id,
            "task_type": task.task_type,
            "original_input": task.original_input,
            "processed_result": task.processed_result,
            "priority": task.priority,
            "status": task.status,
            "retry_count": task.retry_count,
            "max_retries": task.max_retries,
            "dead_letter_reason": task.dead_letter_reason,
            "created_at": task.created_at,
            "updated_at": task.updated_at
        },
        "versions": [
            {
                "id": v.id,
                "version_number": v.version_number,
                "original_input": v.original_input,
                "processed_result": v.processed_result,
                "modified_by": v.modified_by,
                "modification_reason": v.modification_reason,
                "created_at": v.created_at
            } for v in versions
        ],
        "executions": [
            {
                "id": e.id,
                "status": e.status,
                "executed_by": e.executed_by,
                "execution_reason": e.execution_reason,
                "error_message": e.error_message,
                "started_at": e.started_at,
                "completed_at": e.completed_at
            } for e in executions
        ]
    }

@app.post("/api/tasks")
def create_task(task: TaskCreate):
    db = next(get_db())
    db_task = Task(
        task_type=task.task_type,
        original_input=task.original_input,
        priority=task.priority,
        max_retries=task.max_retries
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    db_version = TaskVersion(
        task_id=db_task.id,
        version_number=1,
        original_input=db_task.original_input,
        modified_by="system",
        modification_reason="Initial creation"
    )
    db.add(db_version)
    db.commit()
    return {"id": db_task.id, "message": "Task created successfully"}

@app.put("/api/tasks/{task_id}/review")
def review_task(task_id: int, review: TaskReview):
    db = next(get_db())
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    max_version = db.query(TaskVersion).filter(TaskVersion.task_id == task_id).count()
    db_version = TaskVersion(
        task_id=task_id,
        version_number=max_version + 1,
        original_input=review.modified_input,
        modified_by=review.modified_by,
        modification_reason=review.modification_reason
    )
    db.add(db_version)
    task.original_input = review.modified_input
    task.status = TaskStatus.PENDING
    task.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "Task reviewed and reset to pending"}

@app.post("/api/tasks/{task_id}/retry")
def retry_task(task_id: int, retry: TaskRetry):
    db = next(get_db())
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    execution = TaskExecution(
        task_id=task_id,
        status=TaskStatus.PROCESSING,
        executed_by=retry.executed_by,
        execution_reason=retry.execution_reason
    )
    db.add(execution)
    task.status = TaskStatus.PROCESSING
    task.retry_count += 1
    task.updated_at = datetime.utcnow()
    db.commit()
    import time
    time.sleep(0.5)
    try:
        result = f"处理结果: {task.original_input} (人工重跑成功)"
        task.processed_result = result
        task.status = TaskStatus.SUCCESS
        execution.status = TaskStatus.SUCCESS
        execution.completed_at = datetime.utcnow()
    except Exception as e:
        task.status = TaskStatus.FAILED
        execution.status = TaskStatus.FAILED
        execution.error_message = str(e)
        execution.completed_at = datetime.utcnow()
        if task.retry_count >= task.max_retries:
            task.status = TaskStatus.DEAD_LETTER
            task.dead_letter_reason = f"重试{task.retry_count}次后仍然失败: {str(e)}"
    db.commit()
    return {"message": "Task retried successfully"}

@app.post("/api/tasks/{task_id}/execute")
def execute_task(task_id: int):
    db = next(get_db())
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    execution = TaskExecution(
        task_id=task_id,
        status=TaskStatus.PROCESSING
    )
    db.add(execution)
    task.status = TaskStatus.PROCESSING
    task.updated_at = datetime.utcnow()
    db.commit()
    import time
    time.sleep(0.3)
    try:
        if "错误" in task.original_input or "脏数据" in task.original_input:
            raise Exception(f"处理失败: 输入数据包含无效内容 - {task.original_input}")
        result = f"处理结果: {task.original_input} - 已验证"
        task.processed_result = result
        task.status = TaskStatus.SUCCESS
        execution.status = TaskStatus.SUCCESS
        execution.completed_at = datetime.utcnow()
    except Exception as e:
        task.status = TaskStatus.FAILED
        execution.status = TaskStatus.FAILED
        execution.error_message = str(e)
        execution.completed_at = datetime.utcnow()
        task.retry_count += 1
        if task.retry_count >= task.max_retries:
            task.status = TaskStatus.DEAD_LETTER
            task.dead_letter_reason = f"重试{task.retry_count}次后仍然失败: {str(e)}"
    db.commit()
    return {"message": "Task executed"}

@app.get("/api/statistics")
def get_statistics():
    db = next(get_db())
    total = db.query(Task).count()
    success = db.query(Task).filter(Task.status == TaskStatus.SUCCESS).count()
    failed = db.query(Task).filter(Task.status == TaskStatus.FAILED).count()
    dead_letter = db.query(Task).filter(Task.status == TaskStatus.DEAD_LETTER).count()
    pending = db.query(Task).filter(Task.status == TaskStatus.PENDING).count()
    manual_retries = db.query(TaskExecution).filter(TaskExecution.executed_by != "system").count()
    return {
        "total": total,
        "success": success,
        "failed": failed,
        "dead_letter": dead_letter,
        "pending": pending,
        "manual_retries": manual_retries,
        "success_rate": round(success / total * 100, 2) if total > 0 else 0
    }

@app.get("/api/task-types")
def get_task_types():
    db = next(get_db())
    types = db.query(Task.task_type).distinct().all()
    return {"task_types": [t[0] for t in types]}

def init_sample_data():
    db = next(get_db())
    if db.query(Task).count() > 0:
        return
    sample_tasks = [
        {
            "task_type": "订单同步",
            "original_input": '{"order_id": "ORD001", "amount": 100}',
            "priority": TaskPriority.HIGH,
            "status": TaskStatus.SUCCESS,
            "processed_result": "处理结果: {\"order_id\": \"ORD001\", \"amount\": 100} - 已验证"
        },
        {
            "task_type": "用户通知",
            "original_input": '{"user_id": "U001", "message": "脏数据测试"}',
            "priority": TaskPriority.MEDIUM,
            "status": TaskStatus.FAILED,
            "retry_count": 2
        },
        {
            "task_type": "数据清洗",
            "original_input": '{"batch_id": "B001", "content": "包含错误的脏数据"}',
            "priority": TaskPriority.CRITICAL,
            "status": TaskStatus.DEAD_LETTER,
            "retry_count": 3,
            "dead_letter_reason": "重试3次后仍然失败: 处理失败: 输入数据包含无效内容 - {\"batch_id\": \"B001\", \"content\": \"包含错误的脏数据\"}"
        },
        {
            "task_type": "报表生成",
            "original_input": '{"report_id": "R001", "date": "2024-01-15"}',
            "priority": TaskPriority.LOW,
            "status": TaskStatus.PENDING
        },
        {
            "task_type": "订单同步",
            "original_input": '{"order_id": "ORD002", "amount": 250, "status": "待处理脏数据"}',
            "priority": TaskPriority.HIGH,
            "status": TaskStatus.FAILED,
            "retry_count": 1
        }
    ]
    for t in sample_tasks:
        task = Task(**t)
        db.add(task)
        db.flush()
        version = TaskVersion(
            task_id=task.id,
            version_number=1,
            original_input=task.original_input,
            modified_by="system",
            modification_reason="Initial sample data"
        )
        db.add(version)
        if task.status in [TaskStatus.SUCCESS, TaskStatus.FAILED, TaskStatus.DEAD_LETTER]:
            execution = TaskExecution(
                task_id=task.id,
                status=task.status,
                error_message=task.dead_letter_reason if task.status == TaskStatus.DEAD_LETTER else None
            )
            if task.status == TaskStatus.SUCCESS:
                execution.completed_at = datetime.utcnow()
            db.add(execution)
    db.commit()

init_sample_data()
