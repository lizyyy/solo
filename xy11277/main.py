from fastapi import FastAPI
from app.api.routes import router
from app.core.config import settings

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="仓库夜班排班管理系统API",
    version="1.0.0"
)

app.include_router(router, prefix=settings.API_V1_STR)


@app.get("/")
def root():
    return {
        "message": "仓库夜班排班管理系统",
        "version": "1.0.0",
        "docs": "/docs",
        "api_prefix": settings.API_V1_STR
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
