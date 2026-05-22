import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.api import tasks, reports
from app.services.scheduler import start_scheduler, stop_scheduler, get_scheduler_status

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("应用启动中...")
    start_scheduler()
    yield
    logger.info("应用关闭中...")
    stop_scheduler()


app = FastAPI(
    title="冷链中转重试补偿队列 API",
    description="处理冷链中转赔付的重试补偿队列，支持外部回执、限次重试、人工接管、补偿入账",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tasks.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")


@app.get("/")
def root():
    return {
        "name": "冷链中转重试补偿队列 API",
        "version": "1.0.0",
        "status": "running",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.get("/scheduler/status")
def scheduler_status():
    return get_scheduler_status()
