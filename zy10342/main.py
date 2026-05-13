from fastapi import FastAPI
from app.config import settings
from app.database import engine, Base
from app.api import router as api_router
from app.exceptions import APIException, api_exception_handler, general_exception_handler

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="接口故障声明 API - 用于管理和追踪接口故障事件，支持影响范围计算、版本管理、客户通知等功能",
    version="1.0.0"
)

app.add_exception_handler(APIException, api_exception_handler)
app.add_exception_handler(Exception, general_exception_handler)

app.include_router(api_router, prefix=settings.API_V1_STR, tags=["fault-events"])

@app.get("/")
async def root():
    return {
        "message": "接口故障声明 API",
        "version": "1.0.0",
        "docs": "/docs",
        "api_prefix": settings.API_V1_STR
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
