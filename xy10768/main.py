from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
import os
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

from api.routes import batches, validation, replay, logs, export
from core.config import settings
from core.database import init_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    from core.database import init_sample_data
    init_sample_data()
    yield

app = FastAPI(
    title="ETL任务回放台",
    description="ETL批次校验与回放系统",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(batches.router, prefix="/api/batches", tags=["批次管理"])
app.include_router(validation.router, prefix="/api/validation", tags=["数据校验"])
app.include_router(replay.router, prefix="/api/replay", tags=["任务回放"])
app.include_router(logs.router, prefix="/api/logs", tags=["日志查询"])
app.include_router(export.router, prefix="/api/export", tags=["数据导出"])

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def root():
    return FileResponse("static/index.html")

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
