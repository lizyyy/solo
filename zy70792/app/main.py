from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import engine, get_db, Base
from app import models, schemas, services

Base.metadata.create_all(bind=engine)

app = FastAPI(title="发布制品哈希校验区域对比API", version="1.0.0")


@app.post("/tasks/", response_model=schemas.HashTask)
def create_task(task: schemas.HashTaskCreate, db: Session = Depends(get_db)):
    return services.create_task(db, task)


@app.get("/tasks/", response_model=List[schemas.HashTask])
def read_tasks(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    tasks = services.get_all_tasks(db, skip=skip, limit=limit)
    return tasks


@app.get("/tasks/{task_id}", response_model=schemas.HashTask)
def read_task(task_id: int, db: Session = Depends(get_db)):
    task = services.get_task(db, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@app.post("/tasks/{task_id}/scan", response_model=schemas.HashTask)
def scan_task(task_id: int, db: Session = Depends(get_db)):
    try:
        return services.scan_task_files(db, task_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/tasks/{task_id}/compare", response_model=schemas.HashTask)
def compare_task(task_id: int, db: Session = Depends(get_db)):
    try:
        return services.compare_task_files(db, task_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/tasks/{task_id}/advance", response_model=schemas.HashTask)
def advance_task(task_id: int, db: Session = Depends(get_db)):
    task = services.get_task(db, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if task.status == models.TaskStatus.PENDING:
        return services.scan_task_files(db, task_id)
    elif task.status == models.TaskStatus.SCAN_COMPLETED:
        return services.compare_task_files(db, task_id)
    else:
        raise HTTPException(status_code=400, detail=f"Cannot advance from status: {task.status}")


@app.post("/tasks/{task_id}/correct", response_model=schemas.ExceptionRecord)
def manual_correction(task_id: int, correction: schemas.ManualCorrection, db: Session = Depends(get_db)):
    task = services.get_task(db, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return services.add_exception_record(db, task_id, correction)


@app.post("/tasks/{task_id}/cancel", response_model=schemas.HashTask)
def cancel_task(task_id: int, db: Session = Depends(get_db)):
    task = services.cancel_task(db, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@app.post("/tasks/{task_id}/close", response_model=schemas.HashTask)
def close_task(task_id: int, db: Session = Depends(get_db)):
    task = services.close_task(db, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@app.get("/tasks/{task_id}/export")
def export_task(task_id: int, format: str = "json", db: Session = Depends(get_db)):
    try:
        return services.export_task_report(db, task_id, format)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
