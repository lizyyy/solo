from fastapi import FastAPI, Depends
from contextlib import asynccontextmanager
from app.database import init_db
from app.routers import works, kiln_sessions, reports


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="陶艺工作室烧窑管理 API",
    description="社区陶艺工作室烧窑安排管理系统 - 支持作品录入、窑次拼窑、烧成记录、延期查询和交接报告导出",
    version="0.1.0",
    lifespan=lifespan
)

app.include_router(works.router, prefix="/api/v1")
app.include_router(kiln_sessions.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")


@app.get("/")
async def root():
    return {
        "message": "陶艺工作室烧窑管理 API 服务已启动",
        "docs": "/docs",
        "redoc": "/redoc"
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
