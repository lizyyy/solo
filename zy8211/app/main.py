from fastapi import FastAPI
from contextlib import asynccontextmanager

from app.models import init_db
from app.routers import import_router, query_router, review_router, report_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="污泥脱水药剂投加复核系统",
    description="用于污水厂运行班组复核污泥脱水药剂投加的FastAPI服务",
    version="1.0.0",
    lifespan=lifespan
)

app.include_router(import_router.router)
app.include_router(query_router.router)
app.include_router(review_router.router)
app.include_router(report_router.router)


@app.get("/")
def root():
    return {
        "message": "污泥脱水药剂投加复核系统",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": {
            "import": "/import",
            "query": "/query",
            "review": "/review",
            "report": "/report"
        }
    }


@app.get("/health")
def health_check():
    return {"status": "healthy", "timestamp": None}
