from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.models.database import init_db, Base, engine
from app.api.endpoints import router

app = FastAPI(title="地图围栏告警API", description="围栏管理、轨迹追踪、告警处理系统", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

app.include_router(router)

@app.get("/")
def root():
    return {"message": "地图围栏告警API服务已启动", "docs": "/docs"}

@app.get("/health")
def health_check():
    return {"status": "healthy", "timestamp": "2024-01-15T00:00:00"}