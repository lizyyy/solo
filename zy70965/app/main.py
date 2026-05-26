from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.models.database import Base, engine
from app.api.routes import router as api_router

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="质检申诉同步系统",
    description="解决坐席申诉后复核分数与最终分数不同步的问题，支持扣分项撤销、二次复核、成绩回写等规则",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/", summary="健康检查")
def root():
    return {
        "status": "ok",
        "service": "质检申诉同步系统",
        "docs": "/docs",
        "api_prefix": "/api"
    }
