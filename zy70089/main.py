from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from config import settings
from database import init_db
from routers import permissions, detection, overlimit, rectification, review_supervision, trace_export


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.API_VERSION,
    description="排污许可超标预警系统 - 管理排污许可指标、检测报告、超标判定、整改任务及监管追溯",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(permissions.router)
app.include_router(detection.router)
app.include_router(overlimit.router)
app.include_router(rectification.router)
app.include_router(review_supervision.router)
app.include_router(trace_export.router)


@app.get("/", tags=["健康检查"])
def health_check():
    return {
        "name": settings.APP_NAME,
        "version": settings.API_VERSION,
        "status": "running",
        "docs": "/docs"
    }


@app.get("/api/v1/stats", tags=["统计概览"])
def get_stats(db=None):
    from database import get_db_context
    from models import Permission, DetectionReport, OverlimitRecord, RectificationTask
    from models import OverlimitStatus, RectificationStatus
    
    with get_db_context() as db:
        permission_count = db.query(Permission).count()
        detection_count = db.query(DetectionReport).count()
        overlimit_count = db.query(OverlimitRecord).count()
        pending_overlimit = db.query(OverlimitRecord).filter(
            OverlimitRecord.status.in_([OverlimitStatus.IDENTIFIED, OverlimitStatus.RECTIFYING])
        ).count()
        
        rectification_count = db.query(RectificationTask).count()
        pending_tasks = db.query(RectificationTask).filter(
            RectificationTask.status.in_([RectificationStatus.PENDING, RectificationStatus.IN_PROGRESS])
        ).count()
        
        from datetime import datetime, timedelta
        now = datetime.utcnow()
        overdue_tasks = db.query(RectificationTask).filter(
            RectificationTask.deadline < now,
            RectificationTask.status.in_([RectificationStatus.PENDING, RectificationStatus.IN_PROGRESS])
        ).count()
        
        return {
            "permissions": permission_count,
            "detection_reports": detection_count,
            "overlimit_records": overlimit_count,
            "pending_overlimit": pending_overlimit,
            "rectification_tasks": rectification_count,
            "pending_tasks": pending_tasks,
            "overdue_tasks": overdue_tasks
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
