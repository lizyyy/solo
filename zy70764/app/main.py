from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List
import json
from app import models, schemas, crud
from app.database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Postman断言覆盖变量引用审计后端API",
    description="用于审计Postman Collection中的断言覆盖和变量引用情况",
    version="1.0.0"
)


@app.post("/collections/upload", response_model=schemas.CollectionUploadResponse)
async def upload_collection(file: UploadFile = File(...), db: Session = Depends(get_db)):
    try:
        content = await file.read()
        collection_data = json.loads(content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"无效的JSON文件: {str(e)}")

    if "info" not in collection_data or "item" not in collection_data:
        raise HTTPException(status_code=400, detail="无效的Postman Collection格式")

    db_collection = crud.create_collection(db, collection_data)

    requests_without_assertions = db_collection.total_requests - db_collection.requests_with_assertions
    requests_without_examples = db_collection.total_requests - db_collection.requests_with_examples

    return schemas.CollectionUploadResponse(
        collection_id=db_collection.id,
        message=f"Collection '{db_collection.name}' 上传并分析成功",
        total_requests=db_collection.total_requests,
        requests_without_assertions=requests_without_assertions,
        requests_without_examples=requests_without_examples
    )


@app.get("/collections", response_model=List[schemas.CollectionResponse])
def list_collections(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_collections(db, skip=skip, limit=limit)


@app.get("/collections/{collection_id}", response_model=schemas.CollectionResponse)
def get_collection(collection_id: int, db: Session = Depends(get_db)):
    db_collection = crud.get_collection(db, collection_id)
    if not db_collection:
        raise HTTPException(status_code=404, detail="Collection不存在")
    return db_collection


@app.delete("/collections/{collection_id}")
def delete_collection(collection_id: int, db: Session = Depends(get_db)):
    db_collection = crud.delete_collection(db, collection_id)
    if not db_collection:
        raise HTTPException(status_code=404, detail="Collection不存在")
    return {"message": f"Collection '{db_collection.name}' 已删除"}


@app.get("/collections/{collection_id}/requests", response_model=List[schemas.RequestResponse])
def list_collection_requests(collection_id: int, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    db_collection = crud.get_collection(db, collection_id)
    if not db_collection:
        raise HTTPException(status_code=404, detail="Collection不存在")
    return crud.get_requests_by_collection(db, collection_id, skip=skip, limit=limit)


@app.get("/collections/{collection_id}/requests/no-assertions", response_model=List[schemas.RequestResponse])
def list_requests_without_assertions(collection_id: int, db: Session = Depends(get_db)):
    db_collection = crud.get_collection(db, collection_id)
    if not db_collection:
        raise HTTPException(status_code=404, detail="Collection不存在")
    return crud.get_requests_without_assertions(db, collection_id)


@app.get("/collections/{collection_id}/requests/no-examples", response_model=List[schemas.RequestResponse])
def list_requests_without_examples(collection_id: int, db: Session = Depends(get_db)):
    db_collection = crud.get_collection(db, collection_id)
    if not db_collection:
        raise HTTPException(status_code=404, detail="Collection不存在")
    return crud.get_requests_without_examples(db, collection_id)


@app.get("/requests/{request_id}", response_model=schemas.RequestDetail)
def get_request_detail(request_id: int, db: Session = Depends(get_db)):
    db_request = crud.get_request(db, request_id)
    if not db_request:
        raise HTTPException(status_code=404, detail="Request不存在")
    return db_request


@app.put("/requests/status", response_model=schemas.RequestResponse)
def update_request_status(status_update: schemas.StatusUpdate, db: Session = Depends(get_db)):
    db_request = crud.update_request_status(db, status_update.request_id, status_update)
    if not db_request:
        raise HTTPException(status_code=404, detail="Request不存在")
    return db_request


@app.get("/requests/{request_id}/audit-logs", response_model=List[schemas.AuditLogResponse])
def get_request_audit_logs(request_id: int, db: Session = Depends(get_db)):
    db_request = crud.get_request(db, request_id)
    if not db_request:
        raise HTTPException(status_code=404, detail="Request不存在")
    return crud.get_audit_logs_by_request(db, request_id)


@app.get("/collections/{collection_id}/coverage", response_model=schemas.CoverageStats)
def get_coverage_stats(collection_id: int, db: Session = Depends(get_db)):
    stats = crud.get_coverage_stats(db, collection_id)
    if not stats:
        raise HTTPException(status_code=404, detail="Collection不存在")
    return stats


@app.post("/collections/{collection_id}/reports", response_model=schemas.ReportResponse)
def generate_report(collection_id: int, generated_by: str = "system", db: Session = Depends(get_db)):
    db_report = crud.create_report(db, collection_id, "coverage", generated_by)
    if not db_report:
        raise HTTPException(status_code=404, detail="Collection不存在")
    return db_report


@app.get("/collections/{collection_id}/reports", response_model=List[schemas.ReportResponse])
def list_reports(collection_id: int, db: Session = Depends(get_db)):
    db_collection = crud.get_collection(db, collection_id)
    if not db_collection:
        raise HTTPException(status_code=404, detail="Collection不存在")
    return crud.get_reports_by_collection(db, collection_id)


@app.get("/reports/{report_id}/export")
def export_report(report_id: int, db: Session = Depends(get_db)):
    db_report = crud.get_report(db, report_id)
    if not db_report:
        raise HTTPException(status_code=404, detail="Report不存在")
    return JSONResponse(content=db_report.content)


@app.post("/environments/upload")
async def upload_environment(file: UploadFile = File(...), db: Session = Depends(get_db)):
    try:
        content = await file.read()
        env_data = json.loads(content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"无效的JSON文件: {str(e)}")

    name = env_data.get("name", "")
    postman_id = env_data.get("id", "")
    variables = env_data.get("values", {})

    db_env = crud.create_environment(db, name, postman_id, variables)
    return {"id": db_env.id, "name": db_env.name, "message": "环境变量上传成功"}


@app.get("/environments")
def list_environments(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_environments(db, skip=skip, limit=limit)


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "Postman断言覆盖变量引用审计后端API"}
