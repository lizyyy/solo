from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routers import router
from app.config import settings

Base.metadata.create_all(bind=engine)

app = FastAPI(title=settings.APP_NAME, description="响应字段裁剪器后端服务", version="1.0.0")

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
        "message": "响应字段裁剪器后端服务",
        "version": "1.0.0",
        "docs": "/docs",
        "data_directory": str(settings.DATA_DIR)
    }


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": settings.APP_NAME}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
