from fastapi import FastAPI
from app.database import engine, Base
from app.api.v1 import router as api_router

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="灰度指标缺口回填覆盖保护后端API",
    description="灰度发布指标缺口回填系统，支持窗口校验、回填去重、覆盖保护、审核状态机、快照导出等核心功能",
    version="1.0.0",
)

app.include_router(api_router, prefix="/api/v1", tags=["v1"])


@app.get("/")
def root():
    return {
        "message": "灰度指标缺口回填覆盖保护后端API",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}
