from fastapi import FastAPI
from app.config import get_settings
from app.database import engine, Base
from app.api import api_router
from app import models

settings = get_settings()

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="机场地服申诉预审系统API - 支持申诉CSV、航班JSON、照片索引的批量导入与自动预审",
    version="1.0.0"
)

app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/")
async def root():
    return {
        "message": "机场地服申诉预审系统",
        "version": "1.0.0",
        "docs": "/docs",
        "api_prefix": settings.API_V1_PREFIX
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
