from fastapi import FastAPI
from app.database import engine, Base
from app.api.routes import router as api_router

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="任务失败归因系统",
    description="基于边缘节点清册的任务失败归因后端服务",
    version="1.0.0"
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/")
def root():
    return {
        "message": "任务失败归因系统 API",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc"
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}
