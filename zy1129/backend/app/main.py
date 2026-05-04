from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.database import init_db
from app.routers import (
    members, policies, coverages, incidents, claims,
    import_router, export_router, dashboard, analysis
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="家庭保险保单和理赔跟进系统",
    description="一个用于管理家庭保险保单、追踪理赔进度的本地系统",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(members, prefix="/api/members", tags=["家庭成员"])
app.include_router(policies, prefix="/api/policies", tags=["保单"])
app.include_router(coverages, prefix="/api/coverages", tags=["保障责任"])
app.include_router(incidents, prefix="/api/incidents", tags=["出险事件"])
app.include_router(claims, prefix="/api/claims", tags=["理赔申请"])
app.include_router(analysis, prefix="/api/analysis", tags=["理赔分析"])
app.include_router(import_router, prefix="/api/import", tags=["数据导入"])
app.include_router(export_router, prefix="/api/export", tags=["数据导出"])
app.include_router(dashboard, prefix="/api/dashboard", tags=["风险看板"])


@app.get("/")
async def root():
    return {
        "name": "家庭保险保单和理赔跟进系统",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc"
    }
