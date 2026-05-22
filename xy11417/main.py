from fastapi import FastAPI
from app.api import api_router
from app.core.config import settings
from app.core.database import engine, Base
from app.core.queue import QueueManager
from contextlib import asynccontextmanager

queue_manager = QueueManager()

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    await queue_manager.start()
    yield
    await queue_manager.stop()

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="物业维修派单重试补偿队列服务 API",
    version="1.0.0",
    lifespan=lifespan
)

app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "repair-compensation-queue"}
