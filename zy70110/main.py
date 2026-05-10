from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.routers import appointments, master_data, queue, failed_tasks, export

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="冷库入库预约排队 API",
    description="农产品冷库入库预约排队系统 - 处理车辆、仓位、检测窗口的冲突检测与排队管理",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(master_data.router)
app.include_router(appointments.router)
app.include_router(queue.router)
app.include_router(failed_tasks.router)
app.include_router(export.router)


@app.get("/")
def root():
    return {
        "name": "冷库入库预约排队 API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
        "description": "农产品冷库入库预约排队系统"
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}
