from fastapi import FastAPI
from contextlib import asynccontextmanager

from app.models import init_db
from app.routers import batches, authorizations, outputs
from app.sample_data import init_sample_data


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    init_sample_data()
    yield


app = FastAPI(
    title="证据下载授权服务",
    description="多源审计取证管理系统",
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(batches.router)
app.include_router(authorizations.router)
app.include_router(outputs.router)


@app.get("/")
def root():
    return {
        "message": "证据下载授权服务",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}
