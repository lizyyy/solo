from fastapi import FastAPI
from app.config import settings
from app.api import routes

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="多源湖仓分区版本提醒器后端服务"
)

app.include_router(routes.router)


@app.get("/")
async def root():
    return {
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running"
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
