import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from apscheduler.schedulers.background import BackgroundScheduler

from app.config import settings
from app.database import init_db, SessionLocal
from app.core.scheduler import MainScheduler
from app.api import gpus, tasks, bills, reports

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


scheduler = BackgroundScheduler()


def scheduler_job():
    db = SessionLocal()
    try:
        main_scheduler = MainScheduler(db)
        main_scheduler.schedule_tick()
    except Exception as e:
        logger.exception(f"Scheduler job error: {e}")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    logger.info("Database initialized")
    
    scheduler.add_job(
        scheduler_job,
        "interval",
        seconds=settings.scheduler_interval_seconds,
        id="gpu_queue_scheduler",
        replace_existing=True
    )
    scheduler.start()
    logger.info(f"Scheduler started (interval: {settings.scheduler_interval_seconds}s)")
    
    yield
    
    scheduler.shutdown()
    logger.info("Scheduler stopped")


app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description="GPU Task Queue Service - Priority-based scheduling with timeout, retry, and billing",
    lifespan=lifespan
)


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": settings.app_name,
        "version": settings.version
    }


@app.get("/")
def root():
    return {
        "service": settings.app_name,
        "version": settings.version,
        "docs": "/docs",
        "endpoints": {
            "gpus": "/gpus",
            "tasks": "/tasks",
            "bills": "/bills",
            "reports": "/reports"
        }
    }


app.include_router(gpus.router, prefix="/api/v1")
app.include_router(tasks.router, prefix="/api/v1")
app.include_router(bills.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")
