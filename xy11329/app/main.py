from fastapi import FastAPI
from app.database import engine, Base
from app.api import tasks_router, escorts_router, stats_router, exports_router

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="门诊陪检调度系统",
    description="陪检员接单、取消、插队、超时处理和统计系统",
    version="1.0.0",
)

app.include_router(tasks_router, prefix="/api/v1")
app.include_router(escorts_router, prefix="/api/v1")
app.include_router(stats_router, prefix="/api/v1")
app.include_router(exports_router, prefix="/api/v1")


@app.get("/")
def root():
    return {
        "message": "门诊陪检调度系统 API",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}
