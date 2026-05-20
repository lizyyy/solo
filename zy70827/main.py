from fastapi import FastAPI
from contextlib import asynccontextmanager

from app.config import settings
from app.database import engine
from app.models import Base
from app.api import router as api_router


def create_tables():
    Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="直播样品寄送回收管理系统 API",
    version="1.0.0",
    lifespan=lifespan
)

app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/")
def root():
    return {
        "message": "欢迎使用直播样品寄送回收管理系统",
        "docs": "/docs",
        "api_version": settings.API_V1_STR
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
