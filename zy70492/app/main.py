from fastapi import FastAPI
from contextlib import asynccontextmanager

from app.config import settings
from app.database import init_db, SessionLocal
from app.api import router as api_router
from app.services import create_sample_data


@asynccontextmanager
async def lifespan(app: FastAPI):
    import os
    data_dir = settings.BASE_DIR / "data"
    data_dir.mkdir(exist_ok=True)
    
    init_db()
    
    db = SessionLocal()
    try:
        create_sample_data(db)
    finally:
        db.close()
    
    yield


app = FastAPI(
    title="租户配额回收服务",
    description="基于灰度物流拦截等风险场景的租户配额回收后端服务",
    version="1.0.0",
    lifespan=lifespan
)

app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/")
def root():
    return {
        "message": "租户配额回收服务 API",
        "version": "1.0.0",
        "docs": "/docs",
        "api_prefix": settings.API_V1_STR
    }


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "quota-recycle"}
