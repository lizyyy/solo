from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from contextlib import asynccontextmanager

from app.config import settings
from app.database import init_db, get_db
from app.routes import import_routes, risk_routes, report_routes
from app.schemas import HealthResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="船厂涂装安全管理系统 - 用于管理舱室台账、涂装作业票、VOC传感器数据，检测风险异常并生成安全报告",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(import_routes.router)
app.include_router(risk_routes.router)
app.include_router(report_routes.router)


@app.get("/", tags=["系统"])
async def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "description": "船厂涂装安全管理系统",
        "docs_url": "/docs",
        "openapi_url": "/openapi.json"
    }


@app.get("/health", response_model=HealthResponse, tags=["系统"])
async def health_check(db: Session = Depends(get_db)):
    try:
        from sqlalchemy import text
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception:
        db_status = "disconnected"
    
    return HealthResponse(
        status="ok",
        version=settings.APP_VERSION,
        database=db_status
    )


@app.get("/api/stats", tags=["系统"])
async def get_stats(db: Session = Depends(get_db)):
    from app.database import Cabin, WorkTicket, SensorLog, VentilationRule, RiskAnomaly
    
    cabin_count = db.query(Cabin).count()
    ticket_count = db.query(WorkTicket).count()
    sensor_log_count = db.query(SensorLog).count()
    rule_count = db.query(VentilationRule).count()
    anomaly_count = db.query(RiskAnomaly).filter(RiskAnomaly.is_confirmed == False).count()
    confirmed_count = db.query(RiskAnomaly).filter(RiskAnomaly.is_confirmed == True).count()
    
    return {
        "cabins": cabin_count,
        "work_tickets": ticket_count,
        "sensor_logs": sensor_log_count,
        "ventilation_rules": rule_count,
        "risk_anomalies": {
            "pending": anomaly_count,
            "confirmed": confirmed_count
        }
    }
