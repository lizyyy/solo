from fastapi import FastAPI, Depends, UploadFile, File, Form, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import json
import csv
import io
from datetime import datetime
import os

from .database import get_db, engine, Base, UPLOAD_DIR, SKETCHES_DIR
from . import models, schemas, routers

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="分镜连续性检查台",
    description="独立漫画工作室用的本地分镜连续性检查工具",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(routers.import_router, prefix="/api/import", tags=["导入"])
app.include_router(routers.validate_router, prefix="/api/validate", tags=["校验"])
app.include_router(routers.review_router, prefix="/api/review", tags=["复核"])
app.include_router(routers.export_router, prefix="/api/export", tags=["导出"])
app.include_router(routers.data_router, prefix="/api/data", tags=["数据管理"])

@app.get("/")
def root():
    return {"message": "分镜连续性检查台 API 正在运行", "version": "1.0.0"}

@app.get("/api/health")
def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

@app.get("/api/stats")
def get_stats(db: Session = Depends(get_db)):
    from sqlalchemy import func
    
    chapter_count = db.query(models.Chapter).count()
    panel_count = db.query(models.Panel).count()
    character_count = db.query(models.Character).count()
    issue_count = db.query(models.Issue).count()
    
    issues_by_status = db.query(
        models.Issue.status,
        func.count(models.Issue.id)
    ).group_by(models.Issue.status).all()
    
    issues_by_category = db.query(
        models.Issue.category,
        func.count(models.Issue.id)
    ).group_by(models.Issue.category).all()
    
    return {
        "chapters": chapter_count,
        "panels": panel_count,
        "characters": character_count,
        "issues": issue_count,
        "issues_by_status": {str(s.value): c for s, c in issues_by_status},
        "issues_by_category": {str(c.value): c for c, c in issues_by_category}
    }
