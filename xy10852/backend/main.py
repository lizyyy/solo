from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.database import engine, Base
from app.api.preferences import router as preferences_router

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="通知偏好API",
    description="用户通知偏好管理系统 - 支持多渠道同步、异常处理、状态追踪",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(preferences_router, prefix="/api/v1")


@app.get("/")
def root():
    return {
        "message": "通知偏好API服务运行中",
        "version": "1.0.0",
        "docs": "/docs",
        "api_prefix": "/api/v1"
    }


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "notification-preference-api"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
