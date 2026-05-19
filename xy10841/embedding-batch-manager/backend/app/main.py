from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from typing import List, Optional
import os
from dotenv import load_dotenv

from . import models, schemas, services
from .database import engine, get_db
from .models import BatchStatus, TaskStatus

load_dotenv()

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Embedding Batch Manager API",
    description="API for managing document embedding batches with support for idempotency, retry mechanisms, and dirty data cleanup",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {"message": "Embedding Batch Manager API", "version": "1.0.0"}


@app.post("/api/strategies/", response_model=schemas.ChunkStrategy, tags=["Chunk Strategies"])
def create_strategy(strategy: schemas.ChunkStrategyCreate, db: Session = Depends(get_db)):
    db_strategy = services.get_chunk_strategy_by_name(db, name=strategy.name)
    if db_strategy:
        raise HTTPException(status_code=400, detail="Strategy name already exists")
    return services.create_chunk_strategy(db=db, strategy=strategy)


@app.get("/api/strategies/", response_model=List[schemas.ChunkStrategy], tags=["Chunk Strategies"])
def read_strategies(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    strategies = services.get_chunk_strategies(db, skip=skip, limit=limit)
    return strategies


@app.get("/api/strategies/{strategy_id}", response_model=schemas.ChunkStrategy, tags=["Chunk Strategies"])
def read_strategy(strategy_id: int, db: Session = Depends(get_db)):
    db_strategy = services.get_chunk_strategy(db, strategy_id=strategy_id)
    if db_strategy is None:
        raise HTTPException(status_code=404, detail="Strategy not found")
    return db_strategy


@app.post("/api/batches/", response_model=schemas.DocumentBatch, tags=["Batches"])
def create_batch(
    batch: schemas.DocumentBatchCreate,
    request_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    if request_id:
        cached = services.IdempotencyService.check_request(request_id)
        if cached:
            return cached["result"]
    
    result = services.create_document_batch(db=db, batch=batch)
    
    if request_id:
        services.IdempotencyService.store_result(request_id, result)
    
    return result


@app.get("/api/batches/", response_model=List[schemas.DocumentBatch], tags=["Batches"])
def read_batches(
    skip: int = 0,
    limit: int = 100,
    status: Optional[BatchStatus] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    batches = services.get_document_batches(db, skip=skip, limit=limit, status=status, search=search)
    return batches


@app.get("/api/batches/{batch_id}", response_model=schemas.DocumentBatchDetail, tags=["Batches"])
def read_batch(batch_id: int, db: Session = Depends(get_db)):
    db_batch = services.get_batch_detail(db, batch_id=batch_id)
    if db_batch is None:
        raise HTTPException(status_code=404, detail="Batch not found")
    return db_batch


@app.patch("/api/batches/{batch_id}", response_model=schemas.DocumentBatch, tags=["Batches"])
def update_batch(batch_id: int, batch_update: schemas.DocumentBatchUpdate, db: Session = Depends(get_db)):
    db_batch = services.update_document_batch(db, batch_id=batch_id, batch_update=batch_update)
    if db_batch is None:
        raise HTTPException(status_code=404, detail="Batch not found")
    return db_batch


@app.delete("/api/batches/{batch_id}", tags=["Batches"])
def delete_batch(batch_id: int, db: Session = Depends(get_db)):
    success = services.delete_document_batch(db, batch_id=batch_id)
    if not success:
        raise HTTPException(status_code=404, detail="Batch not found")
    return {"message": "Batch deleted successfully", "batch_id": batch_id}


@app.post("/api/batches/{batch_id}/start", response_model=schemas.DocumentBatch, tags=["Batches"])
def start_batch(batch_id: int, db: Session = Depends(get_db)):
    db_batch = services.start_batch_processing(db, batch_id=batch_id)
    if db_batch is None:
        raise HTTPException(status_code=404, detail="Batch not found")
    return db_batch


@app.post("/api/batches/{batch_id}/pause", response_model=schemas.DocumentBatch, tags=["Batches"])
def pause_batch(batch_id: int, db: Session = Depends(get_db)):
    db_batch = services.pause_batch_processing(db, batch_id=batch_id)
    if db_batch is None:
        raise HTTPException(status_code=404, detail="Batch not found")
    return db_batch


@app.post("/api/batches/{batch_id}/resume", response_model=schemas.DocumentBatch, tags=["Batches"])
def resume_batch(batch_id: int, db: Session = Depends(get_db)):
    db_batch = services.resume_batch_processing(db, batch_id=batch_id)
    if db_batch is None:
        raise HTTPException(status_code=404, detail="Batch not found")
    return db_batch


@app.post("/api/batches/{batch_id}/complete", response_model=schemas.DocumentBatch, tags=["Batches"])
def complete_batch(batch_id: int, db: Session = Depends(get_db)):
    db_batch = services.complete_batch_processing(db, batch_id=batch_id)
    if db_batch is None:
        raise HTTPException(status_code=404, detail="Batch not found")
    return db_batch


@app.post("/api/batches/{batch_id}/fail", response_model=schemas.DocumentBatch, tags=["Batches"])
def fail_batch(batch_id: int, error_message: str, db: Session = Depends(get_db)):
    db_batch = services.fail_batch_processing(db, batch_id=batch_id, error_message=error_message)
    if db_batch is None:
        raise HTTPException(status_code=404, detail="Batch not found")
    return db_batch


@app.get("/api/batches/{batch_id}/report", response_model=schemas.BatchReport, tags=["Batches"])
def get_batch_report(batch_id: int, db: Session = Depends(get_db)):
    report = services.generate_batch_report(db, batch_id=batch_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Batch not found")
    return report


@app.get("/api/batches/{batch_id}/export", tags=["Batches"])
def export_batch(batch_id: int, db: Session = Depends(get_db)):
    data = services.export_batch_data(db, batch_id=batch_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Batch not found")
    return data


@app.post("/api/batches/{batch_id}/cleanup", tags=["Batches"])
def cleanup_batch(batch_id: int, db: Session = Depends(get_db)):
    result = services.cleanup_dirty_data(db, batch_id=batch_id)
    return result


@app.post("/api/tasks/", response_model=schemas.VectorTask, tags=["Tasks"])
def create_task(
    task: schemas.VectorTaskCreate,
    request_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    if request_id:
        cached = services.IdempotencyService.check_request(request_id)
        if cached:
            return cached["result"]
    
    result = services.create_vector_task(db=db, task=task)
    
    if request_id:
        services.IdempotencyService.store_result(request_id, result)
    
    return result


@app.post("/api/tasks/bulk", tags=["Tasks"])
def create_tasks_bulk(
    tasks: List[schemas.VectorTaskCreate],
    batch_id: int,
    request_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    if request_id:
        cached = services.IdempotencyService.check_request(request_id)
        if cached:
            return cached["result"]
    
    result = services.create_vector_tasks_bulk(db=db, tasks=tasks, batch_id=batch_id)
    
    if request_id:
        services.IdempotencyService.store_result(request_id, {"created": len(result), "tasks": result})
    
    return {"created": len(result), "tasks": result}


@app.get("/api/tasks/{task_id}", response_model=schemas.VectorTask, tags=["Tasks"])
def read_task(task_id: int, db: Session = Depends(get_db)):
    db_task = services.get_vector_task(db, task_id=task_id)
    if db_task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return db_task


@app.get("/api/batches/{batch_id}/tasks/", response_model=List[schemas.VectorTask], tags=["Tasks"])
def read_batch_tasks(
    batch_id: int,
    skip: int = 0,
    limit: int = 100,
    status: Optional[TaskStatus] = None,
    db: Session = Depends(get_db)
):
    tasks = services.get_vector_tasks_by_batch(db, batch_id=batch_id, skip=skip, limit=limit, status=status)
    return tasks


@app.patch("/api/tasks/{task_id}", response_model=schemas.VectorTask, tags=["Tasks"])
def update_task(task_id: int, task_update: schemas.VectorTaskUpdate, db: Session = Depends(get_db)):
    db_task = services.update_vector_task(db, task_id=task_id, task_update=task_update)
    if db_task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return db_task


@app.post("/api/tasks/{task_id}/complete", response_model=schemas.VectorTask, tags=["Tasks"])
def complete_task(task_id: int, db: Session = Depends(get_db)):
    db_task = services.complete_vector_task(db, task_id=task_id)
    if db_task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return db_task


@app.post("/api/tasks/{task_id}/fail", response_model=schemas.VectorTask, tags=["Tasks"])
def fail_task(
    task_id: int,
    error_message: str,
    error_type: str = "Unknown",
    error_traceback: Optional[str] = None,
    db: Session = Depends(get_db)
):
    db_task = services.fail_vector_task(
        db,
        task_id=task_id,
        error_message=error_message,
        error_type=error_type,
        error_traceback=error_traceback
    )
    if db_task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return db_task


@app.post("/api/tasks/{task_id}/retry", response_model=schemas.VectorTask, tags=["Tasks"])
def retry_task(task_id: int, db: Session = Depends(get_db)):
    db_task = services.retry_vector_task(db, task_id=task_id)
    if db_task is None:
        raise HTTPException(status_code=404, detail="Task not found or max retries reached")
    return db_task


@app.get("/api/batches/{batch_id}/failed-chunks/", response_model=List[schemas.FailedChunk], tags=["Failed Chunks"])
def read_failed_chunks(batch_id: int, resolved: Optional[bool] = None, db: Session = Depends(get_db)):
    failed_chunks = services.get_failed_chunks_by_batch(db, batch_id=batch_id, resolved=resolved)
    return failed_chunks


@app.post("/api/failed-chunks/{failed_chunk_id}/resolve", response_model=schemas.FailedChunk, tags=["Failed Chunks"])
def resolve_failed_chunk(failed_chunk_id: int, db: Session = Depends(get_db)):
    db_failed = services.resolve_failed_chunk(db, failed_chunk_id=failed_chunk_id)
    if db_failed is None:
        raise HTTPException(status_code=404, detail="Failed chunk not found")
    return db_failed


@app.get("/api/batches/{batch_id}/retry-queue/", response_model=List[schemas.RetryQueue], tags=["Retry Queue"])
def read_retry_queue(batch_id: int, status: Optional[str] = None, db: Session = Depends(get_db)):
    retry_queue = services.get_retry_queue_by_batch(db, batch_id=batch_id, status=status)
    return retry_queue


@app.post("/api/batches/{batch_id}/retry-queue/process", tags=["Retry Queue"])
def process_retry_queue(batch_id: int, db: Session = Depends(get_db)):
    results = services.process_retry_queue(db, batch_id=batch_id)
    return {"processed": len(results), "results": results}


@app.post("/api/index-results/", response_model=schemas.IndexResult, tags=["Index Results"])
def create_index_result(index_result: schemas.IndexResultCreate, db: Session = Depends(get_db)):
    return services.create_index_result(db=db, index_result=index_result)


@app.get("/api/batches/{batch_id}/index-results/", response_model=List[schemas.IndexResult], tags=["Index Results"])
def read_index_results(batch_id: int, verified: Optional[bool] = None, db: Session = Depends(get_db)):
    return services.get_index_results_by_batch(db, batch_id=batch_id, verified=verified)


@app.post("/api/index-results/{index_id}/verify", response_model=schemas.IndexResult, tags=["Index Results"])
def verify_index(
    index_id: int,
    is_valid: bool,
    error_message: Optional[str] = None,
    db: Session = Depends(get_db)
):
    db_index = services.verify_index_result(db, index_id=index_id, is_valid=is_valid, error_message=error_message)
    if db_index is None:
        raise HTTPException(status_code=404, detail="Index result not found")
    return db_index


@app.get("/api/batches/{batch_id}/verify-indexes", tags=["Index Results"])
def verify_batch_indexes(batch_id: int, db: Session = Depends(get_db)):
    return services.verify_batch_indexes(db, batch_id=batch_id)


@app.post("/api/admin/cleanup-all", tags=["Admin"])
def cleanup_all_dirty_data(db: Session = Depends(get_db)):
    result = services.cleanup_dirty_data(db)
    return result


@app.post("/api/admin/idempotency/cleanup", tags=["Admin"])
def cleanup_idempotency_cache():
    services.IdempotencyService.cleanup_expired()
    return {"message": "Expired idempotency cache entries cleaned up"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")
    uvicorn.run(app, host=host, port=port)
