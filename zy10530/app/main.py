from fastapi import FastAPI
from app.core.database import engine, Base
from app.api.routes import router

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="任务重跑预算 API",
    description="管理任务重跑预算，按失败原因和时间窗口限制重跑次数",
    version="1.0.0"
)

app.include_router(router)


@app.get("/")
def root():
    return {
        "message": "任务重跑预算 API 服务已启动",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc"
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}
