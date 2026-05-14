from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
import json

from database import get_db, init_db
from models import ApiDocument, ExecutionRecord, Favorite
from data_validator import DataValidator

app = FastAPI(title="API文档互动示例台")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

validator = DataValidator()

class DocumentCreate(BaseModel):
    name: str
    method: str
    url: str
    raw_content: str
    auth_type: str = "none"
    auth_config: dict = None

class ExecuteRequest(BaseModel):
    document_id: int
    params: dict

class FavoriteCreate(BaseModel):
    document_id: int
    example_params: dict
    note: Optional[str] = ""

@app.on_event("startup")
def startup_event():
    init_db()

@app.get("/api/documents")
def get_documents(db: Session = Depends(get_db)):
    documents = db.query(ApiDocument).order_by(ApiDocument.created_at.desc()).all()
    return {"data": documents}

@app.get("/api/documents/{document_id}")
def get_document(document_id: int, db: Session = Depends(get_db)):
    document = db.query(ApiDocument).filter(ApiDocument.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="文档不存在")
    return {"data": document}

@app.post("/api/documents")
def create_document(doc: DocumentCreate, db: Session = Depends(get_db)):
    try:
        processed = json.loads(doc.raw_content)
    except:
        processed = {"raw": doc.raw_content}
    
    db_doc = ApiDocument(
        name=doc.name,
        method=doc.method,
        url=doc.url,
        raw_content=doc.raw_content,
        processed_content=processed,
        auth_type=doc.auth_type,
        auth_config=doc.auth_config or {}
    )
    db.add(db_doc)
    db.commit()
    db.refresh(db_doc)
    return {"data": db_doc}

@app.post("/api/documents/upload")
async def upload_document(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    content_str = content.decode()
    
    try:
        processed = json.loads(content_str)
        name = processed.get("name", file.filename)
        method = processed.get("method", "GET")
        url = processed.get("url", "")
    except:
        processed = {"raw": content_str}
        name = file.filename
        method = "GET"
        url = ""
    
    db_doc = ApiDocument(
        name=name,
        method=method,
        url=url,
        raw_content=content_str,
        processed_content=processed
    )
    db.add(db_doc)
    db.commit()
    db.refresh(db_doc)
    return {"data": db_doc}

@app.post("/api/execute")
def execute_api(req: ExecuteRequest, db: Session = Depends(get_db)):
    document = db.query(ApiDocument).filter(ApiDocument.id == req.document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="文档不存在")
    
    is_dirty, dirty_reasons, corrected_params = validator.validate_params(req.params)
    explanation = validator.generate_explanation(dirty_reasons) if is_dirty else None
    
    record = ExecutionRecord(
        document_id=req.document_id,
        request_params=corrected_params if is_dirty else req.params,
        raw_request=req.params,
        is_dirty=is_dirty,
        dirty_reasons=dirty_reasons,
        is_blocked=is_dirty,
        status="blocked" if is_dirty else "success",
        corrected_params=corrected_params if is_dirty else None,
        correction_explanation=explanation,
        response_data={
            "message": "执行成功" if not is_dirty else "请求被拦截",
            "timestamp": datetime.utcnow().isoformat()
        } if not is_dirty else {
            "error": "脏数据检测",
            "blocked": True
        }
    )
    
    db.add(record)
    db.commit()
    db.refresh(record)
    
    return {
        "data": {
            "record": record,
            "was_blocked": is_dirty,
            "explanation": explanation
        }
    }

@app.get("/api/executions")
def get_executions(document_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(ExecutionRecord)
    if document_id:
        query = query.filter(ExecutionRecord.document_id == document_id)
    records = query.order_by(ExecutionRecord.executed_at.desc()).all()
    return {"data": records}

@app.get("/api/executions/{execution_id}")
def get_execution(execution_id: int, db: Session = Depends(get_db)):
    record = db.query(ExecutionRecord).filter(ExecutionRecord.id == execution_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    return {"data": record}

@app.post("/api/executions/{execution_id}/retry")
def retry_execution(execution_id: int, db: Session = Depends(get_db)):
    record = db.query(ExecutionRecord).filter(ExecutionRecord.id == execution_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    
    params = record.corrected_params or record.request_params
    
    is_dirty, dirty_reasons, corrected_params = validator.validate_params(params)
    explanation = validator.generate_explanation(dirty_reasons) if is_dirty else None
    
    new_record = ExecutionRecord(
        document_id=record.document_id,
        request_params=corrected_params if is_dirty else params,
        raw_request=params,
        is_dirty=is_dirty,
        dirty_reasons=dirty_reasons,
        is_blocked=is_dirty,
        status="success" if not is_dirty else "blocked",
        corrected_params=corrected_params if is_dirty else None,
        correction_explanation=explanation,
        response_data={
            "message": "重试成功",
            "timestamp": datetime.utcnow().isoformat()
        } if not is_dirty else {
            "error": "脏数据检测",
            "blocked": True
        }
    )
    
    db.add(new_record)
    db.commit()
    db.refresh(new_record)
    
    return {"data": new_record}

@app.get("/api/favorites")
def get_favorites(db: Session = Depends(get_db)):
    favorites = db.query(Favorite).order_by(Favorite.created_at.desc()).all()
    return {"data": favorites}

@app.post("/api/favorites")
def create_favorite(fav: FavoriteCreate, db: Session = Depends(get_db)):
    favorite = Favorite(
        document_id=fav.document_id,
        example_params=fav.example_params,
        note=fav.note
    )
    db.add(favorite)
    db.commit()
    db.refresh(favorite)
    return {"data": favorite}

@app.delete("/api/favorites/{favorite_id}")
def delete_favorite(favorite_id: int, db: Session = Depends(get_db)):
    favorite = db.query(Favorite).filter(Favorite.id == favorite_id).first()
    if not favorite:
        raise HTTPException(status_code=404, detail="收藏不存在")
    db.delete(favorite)
    db.commit()
    return {"message": "删除成功"}

@app.post("/api/init-sample-data")
def init_sample_data(db: Session = Depends(get_db)):
    doc1 = ApiDocument(
        name="用户登录接口",
        method="POST",
        url="/api/auth/login",
        raw_content=json.dumps({
            "name": "用户登录接口",
            "method": "POST",
            "url": "/api/auth/login",
            "params": {
                "username": "string",
                "password": "string"
            }
        }, ensure_ascii=False),
        processed_content={
            "name": "用户登录接口",
            "method": "POST",
            "url": "/api/auth/login",
            "params": {
                "username": "string",
                "password": "string"
            }
        },
        auth_type="none"
    )
    db.add(doc1)
    db.commit()
    db.refresh(doc1)
    
    dirty_params_1 = {
        "username": "admin' OR '1'='1",
        "password": "123456"
    }
    is_dirty_1, reasons_1, corrected_1 = validator.validate_params(dirty_params_1)
    
    exec1 = ExecutionRecord(
        document_id=doc1.id,
        request_params=corrected_1,
        raw_request=dirty_params_1,
        is_dirty=is_dirty_1,
        dirty_reasons=reasons_1,
        is_blocked=True,
        status="blocked",
        corrected_params=corrected_1,
        correction_explanation=validator.generate_explanation(reasons_1),
        response_data={"error": "脏数据检测", "blocked": True}
    )
    db.add(exec1)
    
    dirty_params_2 = {
        "username": "<script>alert('xss')</script>",
        "password": "pass123"
    }
    is_dirty_2, reasons_2, corrected_2 = validator.validate_params(dirty_params_2)
    
    exec2 = ExecutionRecord(
        document_id=doc1.id,
        request_params=corrected_2,
        raw_request=dirty_params_2,
        is_dirty=is_dirty_2,
        dirty_reasons=reasons_2,
        is_blocked=True,
        status="blocked",
        corrected_params=corrected_2,
        correction_explanation=validator.generate_explanation(reasons_2),
        response_data={"error": "脏数据检测", "blocked": True}
    )
    db.add(exec2)
    
    clean_params = {
        "username": "normal_user",
        "password": "secure_pass"
    }
    is_dirty_3, reasons_3, corrected_3 = validator.validate_params(clean_params)
    
    exec3 = ExecutionRecord(
        document_id=doc1.id,
        request_params=clean_params,
        raw_request=clean_params,
        is_dirty=False,
        dirty_reasons=[],
        is_blocked=False,
        status="success",
        response_data={"message": "执行成功", "token": "sample_token_123"}
    )
    db.add(exec3)
    db.commit()
    
    doc2 = ApiDocument(
        name="获取用户信息",
        method="GET",
        url="/api/users/{id}",
        raw_content=json.dumps({
            "name": "获取用户信息",
            "method": "GET",
            "url": "/api/users/{id}",
            "params": {
                "id": "number",
                "fields": "string"
            }
        }, ensure_ascii=False),
        processed_content={
            "name": "获取用户信息",
            "method": "GET",
            "url": "/api/users/{id}",
            "params": {
                "id": "number",
                "fields": "string"
            }
        },
        auth_type="bearer"
    )
    db.add(doc2)
    db.commit()
    db.refresh(doc2)
    
    dirty_params_4 = {
        "id": -1,
        "fields": "name,email"
    }
    is_dirty_4, reasons_4, corrected_4 = validator.validate_params(dirty_params_4)
    
    exec4 = ExecutionRecord(
        document_id=doc2.id,
        request_params=corrected_4,
        raw_request=dirty_params_4,
        is_dirty=is_dirty_4,
        dirty_reasons=reasons_4,
        is_blocked=True,
        status="blocked",
        corrected_params=corrected_4,
        correction_explanation=validator.generate_explanation(reasons_4),
        response_data={"error": "脏数据检测", "blocked": True}
    )
    db.add(exec4)
    db.commit()
    
    return {"message": "示例数据初始化完成"}
