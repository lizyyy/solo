from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import engine, Base
from app.core.logging import get_logger
from app.routers import batches_router, records_router, settlements_router, audit_logs_router

logger = get_logger(__name__)

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="体检中心财务后端服务",
    description="支持加项 CSV、套餐 JSON、单位协议接入；批次/记录/结算清单全链路可追踪；券叠加/退项冲正/单位限额原因留痕。",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(batches_router, prefix=settings.API_PREFIX)
app.include_router(records_router, prefix=settings.API_PREFIX)
app.include_router(settlements_router, prefix=settings.API_PREFIX)
app.include_router(audit_logs_router, prefix=settings.API_PREFIX)


@app.get("/", tags=["健康检查"])
def health():
    return {"status": "ok", "service": "体检中心财务后端"}


@app.get("/health", tags=["健康检查"])
def health_check():
    return {"status": "ok"}
