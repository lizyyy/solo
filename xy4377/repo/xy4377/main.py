from fastapi import FastAPI
from contextlib import asynccontextmanager

from config import settings
from database import init_db
from routers import stalls, circuits, generators, drills, risks, exports


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    description="户外音乐节电力管理系统 REST API",
    version="1.0.0",
    lifespan=lifespan
)


app.include_router(stalls.router)
app.include_router(circuits.router)
app.include_router(generators.router)
app.include_router(drills.router)
app.include_router(risks.router)
app.include_router(exports.router)


@app.get("/")
def root():
    return {
        "name": settings.APP_NAME,
        "version": "1.0.0",
        "description": "户外音乐节电力管理系统",
        "docs": "/docs",
        "redoc": "/redoc"
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.get("/api/status")
def api_status():
    return {
        "status": "running",
        "database": "connected",
        "endpoints": {
            "stalls": "/api/stalls",
            "circuits": "/api/circuits",
            "generators": "/api/generators",
            "drills": "/api/drills",
            "risks": "/api/risks",
            "export": "/api/export"
        }
    }
