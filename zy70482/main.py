from fastapi import FastAPI
from contextlib import asynccontextmanager
from database import engine, Base
from api import materials, evaluations, corrections, operations
import uvicorn


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="限流影子评估服务",
    description="灰度法务证据评估系统 - 限流影子评估后端服务",
    version="1.0.0",
    lifespan=lifespan
)

app.include_router(materials.router, prefix="/api/materials", tags=["材料管理"])
app.include_router(evaluations.router, prefix="/api/evaluations", tags=["评估管理"])
app.include_router(corrections.router, prefix="/api/corrections", tags=["人工修正"])
app.include_router(operations.router, prefix="/api/operations", tags=["批量操作"])


@app.get("/")
async def root():
    return {
        "service": "限流影子评估服务",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
