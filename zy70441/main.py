from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from database import engine, Base
from routers import router
from config import get_settings

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="分布式锁观测服务",
    description="客服升级工单观测系统，支持时区异常检测、人工修正、历史追溯等功能",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1", tags=["核心接口"])


@app.get("/")
def root():
    return {
        "message": "分布式锁观测服务",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    )
