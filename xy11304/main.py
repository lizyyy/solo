from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import engine, Base
from app.core.config import settings
from app.api.routes import router as api_router
from app.utils.logging import setup_logging
import logging

Base.metadata.create_all(bind=engine)

setup_logging()
logger = logging.getLogger(__name__)

app = FastAPI(
    title="社区食堂配餐管理系统",
    description="专为社区食堂设计的配餐管理系统，支持老人信息管理、忌口/慢病标签、配餐复核、配送路线和导出报告等功能",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/")
def read_root():
    return {
        "message": "欢迎使用社区食堂配餐管理系统",
        "version": "1.0.0",
        "docs": "/docs",
        "api_base": "/api/v1"
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
