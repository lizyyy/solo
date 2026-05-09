import logging
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from config import settings
from database import init_db
from routers import sources, logs, tasks, reports, audit
from services.scheduler import task_scheduler

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    logger.info("数据库初始化完成")
    
    if settings.SCHEDULER_ENABLED:
        task_scheduler.start()
        logger.info("任务调度器已启动")
    
    yield
    
    if settings.SCHEDULER_ENABLED:
        task_scheduler.stop()
        logger.info("任务调度器已停止")


app = FastAPI(
    title=settings.APP_NAME,
    lifespan=lifespan
)

app.include_router(sources.router, prefix=settings.API_PREFIX)
app.include_router(logs.router, prefix=settings.API_PREFIX)
app.include_router(tasks.router, prefix=settings.API_PREFIX)
app.include_router(reports.router, prefix=settings.API_PREFIX)
app.include_router(audit.router, prefix=settings.API_PREFIX)


@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.get("/")
def get_index():
    import os
    static_dir = os.path.join(os.path.dirname(__file__), "static")
    index_path = os.path.join(static_dir, "index.html")
    return FileResponse(index_path)


import os
static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
