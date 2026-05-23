from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from app.config import settings
from app.database import engine, Base
from app.api import (
    batches_router,
    materials_router,
    visitors_router,
    tasks_router,
    reports_router,
)

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="园区访客通行异常回执状态机 API",
    description="处理园区访客预约表、闸机记录、临时车牌截图和手工改价表的异常回执状态管理系统",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(batches_router)
app.include_router(materials_router)
app.include_router(visitors_router)
app.include_router(tasks_router)
app.include_router(reports_router)


@app.get("/")
def root():
    return {
        "name": "园区访客通行异常回执状态机 API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
    )
