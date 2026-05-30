from fastapi import FastAPI

from app.database import engine, Base
from app.models import *
from app.routers import entry, process, review, export

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="医保控费申诉账本",
    description="录入 → 处理 → 复核 → 导出，含数据清洗、自动标记与变更历史",
    version="1.0.0",
)

app.include_router(entry.router)
app.include_router(process.router)
app.include_router(review.router)
app.include_router(export.router)


@app.get("/")
def root():
    return {
        "service": "医保控费申诉账本",
        "workflow": "录入 → 处理 → 复核 → 导出",
        "docs": "/docs",
    }
