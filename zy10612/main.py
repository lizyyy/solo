from fastapi import FastAPI
from contextlib import asynccontextmanager

from database import engine, Base
from api import router as api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="多租户报表服务导出任务排队重试 API",
    description="处理多租户报表导出任务的排队、重试和历史记录追踪",
    version="1.0.0",
    lifespan=lifespan
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
