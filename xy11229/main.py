from fastapi import FastAPI
from app.api.routes import router
from app.config import settings

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="换电运营值班系统 - 处理设备事件、客服单自动分类、派修流程"
)

app.include_router(router, prefix="/api/v1")


@app.get("/")
async def root():
    return {
        "message": "换电运营值班系统",
        "version": settings.app_version,
        "docs": "/docs",
        "api_prefix": "/api/v1"
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
