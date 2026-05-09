from fastapi import FastAPI
from contextlib import asynccontextmanager
from .database import engine, Base
from .routers import applications, lottery, rules, tasks, exports
from . import scheduler

Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.start_scheduler()
    yield
    scheduler.stop_scheduler()


app = FastAPI(
    title="公租房摇号资格管理 API",
    description="公租房摇号资格管理后端系统，包含资格核验、摇号锁定、公示异议、结果导出等完整流程",
    version="1.0.0",
    lifespan=lifespan
)

app.include_router(applications.router)
app.include_router(lottery.router)
app.include_router(rules.router)
app.include_router(tasks.router)
app.include_router(exports.router)


@app.get("/", tags=["系统"])
def root():
    return {
        "name": "公租房摇号资格管理 API",
        "version": "1.0.0",
        "status": "running",
        "documentation": "/docs"
    }


@app.get("/health", tags=["系统"])
def health_check():
    return {"status": "healthy"}
