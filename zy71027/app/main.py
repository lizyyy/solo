from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .api import router
from .config import settings

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="药房管制药品夜班交接管理系统 API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

@app.get("/")
def root():
    return {
        "message": "管制药品交接 API 服务已启动",
        "docs": "/docs",
        "api_prefix": settings.API_V1_STR
    }

@app.get("/health")
def health_check():
    return {"status": "healthy"}
