from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine, Base
from app.routers import auth, ledger, audit

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="连锁茶饮原料权限追责台账 API",
    description="加盟商老板视角的完整追责台账系统，包含状态流转、脏记录检测、权限控制、审计追踪",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(ledger.router, prefix=settings.API_V1_STR)
app.include_router(audit.router, prefix=settings.API_V1_STR)


@app.get("/", tags=["根路径"])
def root():
    return {
        "message": "连锁茶饮原料权限追责台账 API",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc"
    }


@app.get("/health", tags=["健康检查"])
def health_check():
    return {"status": "healthy"}
