from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from app.database import engine, Base
from app.config import settings
from app.api import orders, reconciliation, review, reports

Base.metadata.create_all(bind=engine)

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.EXPORT_DIR, exist_ok=True)

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="短租运营对账服务 - 导入、自动比对、人工复核、重新计算和报告下载"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(orders.router)
app.include_router(reconciliation.router)
app.include_router(review.router)
app.include_router(reports.router)


@app.get("/")
def root():
    return {
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "endpoints": {
            "orders": "/api/orders",
            "reconciliation": "/api/reconciliation",
            "review": "/api/review",
            "reports": "/api/reports"
        }
    }


@app.get("/health")
def health_check():
    return {"status": "healthy", "version": settings.APP_VERSION}
