from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings
from app.database import Base, engine
from app.routers import suppliers, switches, approvals, delivery, exceptions, reports


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="""
    备选供应商切换服务 API
    
    业务场景：主供应商异常时切换备选供应商，
    包含供应商池、资质校验、价格快照、
    切换审批、交期影响分析、切换报告等完整流程。
    
    异常数据不会静默吞掉，会进入可查询的异常记录。
    """,
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(suppliers.router)
app.include_router(switches.router)
app.include_router(approvals.router)
app.include_router(delivery.router)
app.include_router(exceptions.router)
app.include_router(reports.router)


@app.get("/", tags=["健康检查"])
def root():
    return {
        "app_name": settings.app_name,
        "version": settings.app_version,
        "status": "running",
        "endpoints": {
            "suppliers": "/api/suppliers",
            "switches": "/api/switches",
            "approvals": "/api/approvals",
            "delivery": "/api/delivery",
            "exceptions": "/api/exceptions",
            "reports": "/api/reports"
        },
        "docs": {
            "swagger": "/docs",
            "redoc": "/redoc"
        }
    }


@app.get("/health", tags=["健康检查"])
def health_check():
    return {"status": "healthy"}
